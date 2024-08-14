package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
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

var (
	clients  sync.Map
	db       *gorm.DB
	s3Client *s3.Client
)

type FileUpload struct {
	FileName string `json:"file_name"`
	FileSize int64  `json:"file_size"`
	FileType string `json:"file_type"`
	FileUrl  string `json:"file_url"`
}

type WSMessage struct {
	Type            string `json:"type"`
	SenderID        uint   `json:"sender_id"`
	ReceiverID      uint   `json:"receiver_id"`
	Content         string `json:"content"`
	AESKeySender    string `json:"aes_key_sender,omitempty"`
	AESKeyReceiver  string `json:"aes_key_receiver,omitempty"`
	MessageID       uint   `json:"message_id,omitempty"`
	Status          string `json:"status,omitempty"`
	ExpiresAt       string `json:"expires_at,omitempty"`
	FileAttachments string `json:"file_attachments,omitempty"`
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
	SenderID        uint
	ReceiverID      uint
	Content         string // Store encrypted content as binary data
	Status          string
	ExpiresAt       time.Time
	AESKeySender    string // Store encrypted AES key as binary data
	AESKeyReceiver  string // Store encrypted AES key as binary data
	FileAttachments string
}

type MessageResponse struct {
	ID              uint   `json:"id"`
	SenderID        uint   `json:"sender_id"`
	ReceiverID      uint   `json:"receiver_id"`
	Content         string `json:"content"`
	Status          string `json:"status"`
	ExpiresAt       string `json:"expires_at"`
	AESKeySender    string `json:"aes_key_sender"`
	AESKeyReceiver  string `json:"aes_key_receiver"`
	FileAttachments string `json:"file_attachments"`
}

type MultiFileUploadResponse struct {
	Files []FileUpload `json:"files"`
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

	// AWS S3 client
	cfg, err := config.LoadDefaultConfig(context.TODO())

	if err != nil {
		log.Fatal("Error loading AWS config")
	}

	s3Client = s3.NewFromConfig(cfg)

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
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(limiter.New(
		limiter.Config{
			Max:        100,
			Expiration: 10 * time.Minute,
		},
	))

	// Routes
	api := app.Group("/api")
	api.Post("/register", registerHandler)
	api.Post("/login", loginHandler)

	// Protected routes
	api.Use(jwtMiddleware)
	api.Get("/messages", getMessagesHandler)
	api.Get("/users/:id", getUserHandler)
	api.Post("/upload", uploadFileHandler)
	api.Post("/upload-multiple", uploadMultipleFilesHandler)

	// Setup WebSocket
	setupWebSocket(app)

	// Start server
	log.Fatal(app.Listen(":8080"))
}

func uploadMultipleFilesHandler(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Failed to parse multipart form"})
	}

	files := form.File["files"]
	if len(files) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No files uploaded"})
	}

	var uploadedFiles []FileUpload

	for _, file := range files {
		// Validate file size
		if file.Size > 10*1024*1024 { // 10MB limit
			return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("File %s is too large", file.Filename)})
		}

		// Generate a unique filename
		filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)

		// Open the file
		fileContent, err := file.Open()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Could not open file %s", file.Filename)})
		}
		defer fileContent.Close()

		// Upload to S3
		_, err = s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
			Bucket: aws.String(os.Getenv("S3_BUCKET")),
			Key:    aws.String(filename),
			Body:   fileContent,
		})

		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Could not upload file %s", file.Filename)})
		}

		client := s3.NewPresignClient(s3Client)

		req, err := client.PresignGetObject(context.Background(), &s3.GetObjectInput{
			Bucket: aws.String(os.Getenv("S3_BUCKET")),
			Key:    aws.String(filename),
		}, func(po *s3.PresignOptions) {
			po.Expires = 24 * time.Hour
		})

		if err != nil {
			log.Printf("Failed to sign request for file %s: %v", file.Filename, err)
			return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Could not generate download URL for file %s", file.Filename)})
		}

		fileUpload := FileUpload{
			FileName: file.Filename,
			FileSize: file.Size,
			FileType: file.Header.Get("Content-Type"),
			FileUrl:  req.URL,
		}

		uploadedFiles = append(uploadedFiles, fileUpload)
	}

	return c.JSON(MultiFileUploadResponse{Files: uploadedFiles})
}

func uploadFileHandler(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file uploaded"})
	}

	// Validate file size
	if file.Size > 10*1024*1024 { // 10MB limit
		return c.Status(400).JSON(fiber.Map{"error": "File too large"})
	}

	// Generate a unique filename
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)

	// Open the file
	fileContent, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not open file"})
	}
	defer fileContent.Close()

	// Upload to S3
	_, err = s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(os.Getenv("S3_BUCKET")),
		Key:    aws.String(filename),
		Body:   fileContent,
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not upload file"})
	}

	client := s3.NewPresignClient(s3Client)

	//TODO: Determinate in models of domain what is the expiration time of the file
	req, err := client.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(os.Getenv("S3_BUCKET")),
		Key:    aws.String(filename),
	}, func(po *s3.PresignOptions) {
		po.Expires = 24 * time.Hour
	})

	if err != nil {
		log.Printf("Failed to sign request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Could not generate download URL"})
	}

	fileUpload := FileUpload{
		FileName: file.Filename,
		FileSize: file.Size,
		FileType: file.Header.Get("Content-Type"),
		FileUrl:  req.URL,
	}

	return c.JSON(fileUpload)
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
		"public_key":  user.PublicKey,
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

	log.Printf("Found %d messages\n", len(messages))

	var responseMessages []MessageResponse
	for _, msg := range messages {
		responseMsg := MessageResponse{
			ID:              msg.ID,
			SenderID:        msg.SenderID,
			ReceiverID:      msg.ReceiverID,
			Content:         msg.Content,
			Status:          msg.Status,
			ExpiresAt:       msg.ExpiresAt.Format(time.RFC3339),
			AESKeySender:    msg.AESKeySender,
			AESKeyReceiver:  msg.AESKeyReceiver,
			FileAttachments: msg.FileAttachments,
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

	clients.Store(user.ID, c)

	defer func() {
		clients.Delete(user.ID)
		c.Close()
	}()

	// Heartbeat
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			err := c.WriteMessage(websocket.PingMessage, nil)
			if err != nil {
				return
			}
		}
	}()

	for {
		var msg WSMessage
		err := c.ReadJSON(&msg)
		if err != nil {
			break
		}

		log.Printf("Received message: %v\n", msg)

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
		log.Println("Error finding message:", err)
		return
	}

	if message.ReceiverID != userID {
		log.Println("User does not have permission to read message")
		return
	}

	message.Status = "read"
	if err := db.Save(&message).Error; err != nil {
		log.Println("Error updating message status:", err)
		return
	}

	readMsg := WSMessage{
		Type:      "status_update",
		MessageID: msg.MessageID,
		Status:    "read",
	}

	if conn, ok := clients.Load(message.SenderID); ok {
		err := conn.(*websocket.Conn).WriteJSON(readMsg)
		if err != nil {
			log.Println("Error sending read receipt to sender:", err)
		}
	}
}

func handleNewMessage(senderID uint, msg *WSMessage) {
	t, err := time.Parse(time.RFC3339, msg.ExpiresAt)
	if err != nil {
		return
	}

	message := Message{
		SenderID:        senderID,
		ReceiverID:      msg.ReceiverID,
		Content:         msg.Content,
		AESKeySender:    msg.AESKeySender,
		AESKeyReceiver:  msg.AESKeyReceiver,
		Status:          "sent",
		ExpiresAt:       t,
		FileAttachments: msg.FileAttachments,
	}
	if err := db.Create(&message).Error; err != nil {
		log.Printf("Error creating message: %v\n", err)
		return
	}

	// send message to receiver if online
	if conn, ok := clients.Load(msg.ReceiverID); ok {
		wsConn := conn.(*websocket.Conn)
		err := wsConn.WriteJSON(WSMessage{
			Type:            "new_message",
			SenderID:        senderID,
			ReceiverID:      msg.ReceiverID,
			Content:         msg.Content,
			AESKeySender:    msg.AESKeySender,
			AESKeyReceiver:  msg.AESKeyReceiver,
			MessageID:       message.ID,
			Status:          message.Status,
			FileAttachments: msg.FileAttachments,
		})

		if err != nil {
			log.Println("Error sending message to receiver:", err)
		} else {
			message.Status = "delivered"
			db.Save(&message)
		}
	}

	// send confirmation to sender
	confirmMsg := WSMessage{
		Type:      "message_sent",
		MessageID: message.ID,
		Status:    message.Status,
	}

	if conn, ok := clients.Load(senderID); ok {
		err := conn.(*websocket.Conn).WriteJSON(confirmMsg)
		if err != nil {
			log.Println("Error sending message confirmation to sender:", err)
		}
	}
}

func handleStatusUpdate(userID uint, msg *WSMessage) {
	var message Message
	if err := db.First(&message, msg.MessageID).Error; err != nil {
		log.Println("Error finding message:", err)
		return
	}

	if message.ReceiverID != userID {
		log.Println("User does not have permission to update message status")
		return
	}

	message.Status = msg.Status
	if err := db.Save(&message).Error; err != nil {
		log.Println("Error updating message status:", err)
		return
	}

	if conn, ok := clients.Load(message.SenderID); ok {
		err := conn.(*websocket.Conn).WriteJSON(WSMessage{
			Type:      "status_update",
			MessageID: msg.MessageID,
			Status:    msg.Status,
		})
		if err != nil {
			log.Println("Error sending status update to sender:", err)
		}
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
