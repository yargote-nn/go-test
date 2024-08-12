package main

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"
	"github.com/golang-jwt/jwt/v4"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB

var (
	clients = make(map[uint]*websocket.Conn)
	mutex   = &sync.Mutex{}
)

type WSMessage struct {
	Type       string `json:"type"`
	SenderID   uint   `json:"sender_id"`
	ReceiverID uint   `json:"receiver_id"`
	Content    string `json:"content"`
	AESKey     string `json:"aes_key,omitempty"`
	MessageID  uint   `json:"message_id,omitempty"`
	Status     string `json:"status,omitempty"`
	ExpiresAt  string `json:"expires_at,omitempty"`
}

type UserResponse struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	PublicKey string `json:"public_key"`
}

type UserRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	PrivateKey string `json:"private_key"`
	PublicKey  string `json:"public_key"`
}

type User struct {
	gorm.Model
	Username   string `gorm:"uniqueIndex"`
	Password   string // Store hashed password
	PrivateKey string
	PublicKey  string
}

type Message struct {
	gorm.Model
	SenderID   uint
	ReceiverID uint
	Content    string // Store encrypted content as binary data
	Status     string
	ExpiresAt  time.Time
	AESKey     string // Store encrypted AES key as binary data
}

type MessageResponse struct {
	ID         uint   `json:"id"`
	SenderID   uint   `json:"sender_id"`
	ReceiverID uint   `json:"receiver_id"`
	Content    string `json:"content"`
	Status     string `json:"status"`
	ExpiresAt  string `json:"expires_at"`
	AESKey     string `json:"aes_key"`
}

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// Database connection
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect database")
	}

	// Auto migrate the schema
	db.AutoMigrate(&User{}, &Message{})

	// Setup cron job
	setupCronJobs()

	// Fiber app
	app := fiber.New()

	// Enable CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000", // Replace with your Next.js app's URL
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,HEAD,PUT,DELETE,PATCH,OPTIONS",
		AllowCredentials: true,
	}))

	// Setup WebSocket
	setupWebSocket(app)

	// Routes
	api := app.Group("/api")
	api.Post("/register", registerHandler)
	api.Post("/login", loginHandler)

	// Protected routes
	api.Use(jwtMiddleware)
	api.Get("/messages", getMessagesHandler)
	api.Get("/users/:id", getUserHandler)

	// Add middleware
	app.Use(logger.New())  // Adds logging
	app.Use(recover.New()) // Recovers from panics

	// Start server
	log.Fatal(app.Listen(":8080"))
}

func getUserHandler(c *fiber.Ctx) error {
	userID := c.Params("id")
	var user User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	userResponse := UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		PublicKey: user.PublicKey,
	}
	return c.JSON(fiber.Map{"user": userResponse})
}

func setupWebSocket(app *fiber.App) {
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws", websocket.New(websocketHandler))
}

func registerHandler(c *fiber.Ctx) error {
	userReq := new(UserRequest)
	if err := c.BodyParser(userReq); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(userReq.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not hash password"})
	}

	user := new(User)
	user.Username = userReq.Username
	user.Password = string(hashedPassword)
	user.PublicKey = userReq.PublicKey
	user.PrivateKey = userReq.PrivateKey

	if err := db.Create(user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create user"})
	}

	return c.JSON(fiber.Map{"user_id": user.ID})
}

func loginHandler(c *fiber.Ctx) error {
	input := new(struct {
		Username string `json:"username"`
		Password string `json:"password"`
	})
	if err := c.BodyParser(input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	var user User
	if err := db.Where("username = ?", input.Username).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["username"] = user.Username
	claims["exp"] = time.Now().Add(time.Hour * 72).Unix()

	t, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not login"})
	}

	return c.JSON(fiber.Map{
		"user_id":     user.ID,
		"username":    user.Username,
		"token":       t,
		"private_key": user.PrivateKey,
	})
}

func getMessagesHandler(c *fiber.Ctx) error {
	username := c.Locals("username").(string)
	var user User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	partnerID, err := strconv.ParseUint(c.Query("partner_id"), 10, 32)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid partner_id"})
	}

	var messages []Message
	if err := db.Where("(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
		user.ID, partnerID, partnerID, user.ID).
		Order("created_at DESC").
		Limit(100).
		Find(&messages).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not retrieve messages"})
	}

	var responseMessages []MessageResponse
	for _, msg := range messages {
		responseMsg := MessageResponse{
			ID:         msg.ID,
			SenderID:   msg.SenderID,
			ReceiverID: msg.ReceiverID,
			Content:    msg.Content,
			Status:     msg.Status,
			ExpiresAt:  msg.ExpiresAt.Local().Format(time.RFC3339),
			AESKey:     msg.AESKey,
		}
		responseMessages = append(responseMessages, responseMsg)
	}

	return c.JSON(responseMessages)
}

func websocketHandler(c *websocket.Conn) {
	tokenString := c.Query("token")
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		c.Close()
		return
	}

	username := claims["username"].(string)
	var user User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		c.Close()
		return
	}

	mutex.Lock()
	clients[user.ID] = c
	mutex.Unlock()

	defer func() {
		mutex.Lock()
		delete(clients, user.ID)
		mutex.Unlock()
		c.Close()
	}()

	for {
		var msg WSMessage
		err := c.ReadJSON(&msg)
		if err != nil {
			break
		}

		switch msg.Type {
		case "message":
			handleNewMessage(user.ID, &msg)
		case "status_update":
			handleStatusUpdate(user.ID, &msg)
		case "read_receipt":
			handleReadReceipt(user.ID, &msg)
		default:
			log.Println("Unknown message type:", msg.Type)
		}
	}
}

func handleReadReceipt(userID uint, msg *WSMessage) {
	var message Message
	if err := db.First(&message, msg.MessageID).Error; err != nil {
		return
	}

	if message.ReceiverID != userID {
		return
	}

	message.Status = "read"
	if err := db.Save(&message).Error; err != nil {
		return
	}

	readMsg := WSMessage{
		Type:      "status_update",
		MessageID: msg.MessageID,
		Status:    "read",
	}
	mutex.Lock()
	if conn, ok := clients[message.SenderID]; ok {
		err := conn.WriteJSON(readMsg)
		if err != nil {
			log.Println("Error sending read receipt to sender:", err)
		}
	}
	mutex.Unlock()
}

func handleNewMessage(senderID uint, msg *WSMessage) {
	t, err := time.Parse(time.RFC3339, msg.ExpiresAt)
	if err != nil {
		return
	}

	message := Message{
		SenderID:   senderID,
		ReceiverID: msg.ReceiverID,
		Content:    msg.Content,
		AESKey:     msg.AESKey,
		Status:     "sent",
		ExpiresAt:  t,
	}
	if err := db.Create(&message).Error; err != nil {
		return
	}

	mutex.Lock()
	if conn, ok := clients[msg.ReceiverID]; ok {
		outMsg := WSMessage{
			Type:       "new_message",
			SenderID:   senderID,
			ReceiverID: msg.ReceiverID,
			Content:    msg.Content,
			AESKey:     msg.AESKey,
			MessageID:  message.ID,
			Status:     message.Status,
		}
		err := conn.WriteJSON(outMsg)
		if err != nil {
			log.Println("Error sending message to receiver:", err)
		} else {
			message.Status = "delivered"
			db.Save(&message)
		}
	}
	mutex.Unlock()

	confirmMsg := WSMessage{
		Type:      "message_sent",
		MessageID: message.ID,
		Status:    message.Status,
	}

	mutex.Lock()
	if conn, ok := clients[senderID]; ok {
		err := conn.WriteJSON(confirmMsg)
		if err != nil {
			log.Println("Error sending confirmation to sender:", err)
		}
	}
	mutex.Unlock()
}

func handleStatusUpdate(userID uint, msg *WSMessage) {
	var message Message
	if err := db.First(&message, msg.MessageID).Error; err != nil {
		return
	}

	if message.ReceiverID != userID {
		return
	}

	log.Printf("Current message: %+v\n", message)
	log.Printf("Received status update: %+v\n", msg)

	validTransition := (message.Status == "delivered" && msg.Status == "received") ||
		(message.Status == "received" && msg.Status == "read")

	if validTransition {
		message.Status = msg.Status
		if err := db.Save(&message).Error; err != nil {
			return
		}

		statusMsg := WSMessage{
			Type:      "status_update",
			MessageID: msg.MessageID,
			Status:    msg.Status,
		}

		mutex.Lock()
		if conn, ok := clients[message.SenderID]; ok {
			err := conn.WriteJSON(statusMsg)
			if err != nil {
				log.Println("Error sending status update to sender:", err)
			}
		}
		mutex.Unlock()

		mutex.Lock()
		if conn, ok := clients[message.ReceiverID]; ok {
			err := conn.WriteJSON(statusMsg)
			if err != nil {
				log.Println("Error sending status update to receiver:", err)
			}
		}
		mutex.Unlock()
	}
}

func jwtMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Missing auth token"})
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid auth token"})
	}

	claims := token.Claims.(jwt.MapClaims)
	c.Locals("username", claims["username"])

	return c.Next()
}

func setupCronJobs() {
	c := cron.New()
	c.AddFunc("@hourly", deleteExpiredMessages)
	c.Start()
}

func deleteExpiredMessages() {
	db.Where("expires_at < ?", time.Now()).Delete(&Message{})
}
