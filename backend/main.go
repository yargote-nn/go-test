// main.go
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"

	// "github.com/gofiber/fiber/v2/middleware/limiter"
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
	// app.Use(limiter.New(limiter.Config{
	// 	Max:        20,
	// 	Expiration: 30 * time.Second,
	// }))

	// Start server
	log.Fatal(app.Listen(":8080"))
}

func getUserHandler(c *fiber.Ctx) error {
	userID := c.Params("id")
	log.Println("User ID:", userID)
	var user User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	log.Println("User:", user)
	// Map user to UserResponse
	userResponse := UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		PublicKey: user.PublicKey,
	}
	return c.JSON(fiber.Map{"user": userResponse})
}

func setupWebSocket(app *fiber.App) {
	app.Use("/ws", func(c *fiber.Ctx) error {
		// IsWebSocketUpgrade returns true if the client
		// requested upgrade to the WebSocket protocol.
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

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(userReq.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not hash password"})
	}

	user := new(User)
	user.Username = userReq.Username
	user.Password = string(hashedPassword)
	user.PublicKey = userReq.PublicKey
	user.PrivateKey = userReq.PrivateKey

	// Generate key pair
	// publicKey, privateKey, err := generateKeyPair()
	// if err != nil {
	// 	return c.Status(500).JSON(fiber.Map{"error": "Could not generate key pair"})
	// }
	// user.PublicKey = publicKey
	// user.PrivateKey = privateKey

	// Save user to database
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

	// Generate JWT
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
	log.Println("Get messages")
	username := c.Locals("username").(string)
	log.Println("Username:", username)
	var user User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	log.Println("User ID:", user.ID)

	// Get chat partner's ID
	partnerID, err := strconv.ParseUint(c.Query("partner_id"), 10, 32)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid partner_id"})
	}
	log.Println("Partner ID:", partnerID)

	var messages []Message
	if err := db.Where("(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
		user.ID, partnerID, partnerID, user.ID).
		Order("created_at DESC").
		Limit(100). // Limit to last 100 messages
		Find(&messages).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not retrieve messages"})
	}
	log.Println("Messages retrieved successfully")

	log.Printf("Messages: %+v", messages)

	// Prepare response
	var responseMessages []MessageResponse
	for _, msg := range messages {
		responseMsg := MessageResponse{
			ID:         msg.ID,
			SenderID:   msg.SenderID,
			ReceiverID: msg.ReceiverID,
			Content:    msg.Content, // Note: This is still encrypted
			Status:     msg.Status,
			ExpiresAt:  msg.ExpiresAt.Local().Format("2006-01-02 15:04:05"),
			AESKey:     msg.AESKey,
		}
		responseMessages = append(responseMessages, responseMsg)
	}

	return c.JSON(responseMessages)
}

func websocketHandler(c *websocket.Conn) {
	// Authenticate the WebSocket connection
	log.Println("WebSocket connection attempt received")

	tokenString := c.Query("token")
	log.Println("Received token:", tokenString)

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		log.Println("Invalid token")
		c.Close()
		return
	}

	log.Println("Token validated successfully")

	username := claims["username"].(string)
	var user User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		log.Println("User not found")
		c.Close()
		return
	}

	// Register the client
	mutex.Lock()
	clients[user.ID] = c
	mutex.Unlock()

	// Unregister the client when the connection closes
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
			log.Println("Error reading message:", err)
			break
		}

		switch msg.Type {
		case "message":
			handleNewMessage(user.ID, &msg)
		case "status_update":
			handleStatusUpdate(user.ID, &msg)
		default:
			log.Println("Unknown message type:", msg.Type)
		}
	}
}

func handleNewMessage(senderID uint, msg *WSMessage) {
	// Encrypt the message content and AES key
	log.Println("handleNewMessage...")
	log.Println("Sender ID:", senderID)
	log.Println("Receiver ID:", msg.ReceiverID)
	log.Println("Content:", msg.Content)
	log.Println("Expires at:", msg.ExpiresAt)

	t, err := time.Parse(time.RFC3339, msg.ExpiresAt)
	if err != nil {
		log.Println("Error parsing expires at:", err)
		return
	}

	// Save the message to the database
	message := Message{
		SenderID:   senderID,
		ReceiverID: msg.ReceiverID,
		Content:    msg.Content,
		AESKey:     msg.AESKey,
		Status:     "sent",
		ExpiresAt:  t, // Set message expiration (e.g., 24 hours)
	}
	if err := db.Create(&message).Error; err != nil {
		log.Println("Error saving message:", err)
		return
	}

	// Send the message to the receiver if they're online
	mutex.Lock()
	if conn, ok := clients[msg.ReceiverID]; ok {
		outMsg := WSMessage{
			Type:       "new_message",
			SenderID:   senderID,
			ReceiverID: msg.ReceiverID,
			Content:    msg.Content,
			AESKey:     msg.AESKey,
			MessageID:  message.ID,
		}
		err := conn.WriteJSON(outMsg)
		if err != nil {
			log.Println("Error sending message to receiver:", err)
		} else {
			// Update message status to "received"
			message.Status = "received"
			db.Save(&message)
		}
	}
	mutex.Unlock()

	// Send confirmation to the sender
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
	// Update message status in the database
	var message Message
	if err := db.First(&message, msg.MessageID).Error; err != nil {
		log.Println("Error finding message:", err)
		return
	}

	if message.ReceiverID != userID {
		log.Println("Unauthorized status update attempt")
		return
	}

	message.Status = msg.Status
	if err := db.Save(&message).Error; err != nil {
		log.Println("Error updating message status:", err)
		return
	}

	// Notify the sender about the status update
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

func generateKeyPair() (string, string, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", "", err
	}

	publicKey := &privateKey.PublicKey

	privateKeyPEM := pem.EncodeToMemory(
		&pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
		},
	)

	publicKeyPEM := pem.EncodeToMemory(
		&pem.Block{
			Type:  "RSA PUBLIC KEY",
			Bytes: x509.MarshalPKCS1PublicKey(publicKey),
		},
	)

	return string(publicKeyPEM), string(privateKeyPEM), nil
}

func encryptMessage(message string, publicKey string) (string, string, error) {
	block, _ := pem.Decode([]byte(publicKey))
	if block == nil {
		return "", "", errors.New("failed to parse PEM block containing the public key")
	}

	pub, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err != nil {
		return "", "", err
	}

	// Generate AES key
	aesKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, aesKey); err != nil {
		return "", "", err
	}

	// Encrypt AES key with RSA public key
	encryptedAESKey, err := rsa.EncryptPKCS1v15(rand.Reader, pub, aesKey)
	if err != nil {
		return "", "", err
	}

	// Encrypt message with AES key
	cipherBlock, err := aes.NewCipher(aesKey)
	if err != nil {
		return "", "", err
	}

	ciphertext := make([]byte, aes.BlockSize+len(message))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", "", err
	}

	stream := cipher.NewCFBEncrypter(cipherBlock, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], []byte(message))

	return string(ciphertext), string(encryptedAESKey), nil
}

func decryptMessage(encryptedMessage string, encryptedAESKey string, privateKey string) (string, error) {
	block, _ := pem.Decode([]byte(privateKey))
	if block == nil {
		return "", errors.New("failed to parse PEM block containing the private key")
	}

	priv, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return "", err
	}

	// Decrypt AES key
	aesKey, err := rsa.DecryptPKCS1v15(rand.Reader, priv, []byte(encryptedAESKey))
	if err != nil {
		return "", err
	}

	// Decrypt message
	cipherBlock, err := aes.NewCipher(aesKey)
	if err != nil {
		return "", err
	}

	ciphertext := []byte(encryptedMessage)
	if len(ciphertext) < aes.BlockSize {
		return "", errors.New("ciphertext too short")
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(cipherBlock, iv)
	stream.XORKeyStream(ciphertext, ciphertext)

	return string(ciphertext), nil
}

func setupCronJobs() {
	c := cron.New()
	c.AddFunc("@hourly", deleteExpiredMessages)
	c.Start()
}

func deleteExpiredMessages() {
	db.Where("expires_at < ?", time.Now()).Delete(&Message{})
}
