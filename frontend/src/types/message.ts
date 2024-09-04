import { z } from "zod";

const WSMessageSchema = z.object({
	type: z.string(),
	senderId: z.number(),
	receiverId: z.number(),
	body: z.string(),
	aesKeySender: z.string().optional(),
	aesKeyReceiver: z.string().optional(),
	messageId: z.number().optional(),
	state: z.string().optional(),
	fileAttachments: z.string().optional(),
});

type WSMessage = z.infer<typeof WSMessageSchema>;

const FileUploadSchema = z.object({
	fileName: z.string(),
	fileSize: z.number(),
	fileType: z.string(),
	fileUrl: z.string(),
});

type FileUpload = z.infer<typeof FileUploadSchema>;

const FileUploadsSchema = z.array(FileUploadSchema);

type FileUploads = z.infer<typeof FileUploadsSchema>;

const MessageSchema = z.object({
	id: z.number(),
	senderId: z.number(),
	receiverId: z.number(),
	body: z.string(),
	state: z.string(),
	expiredAt: z.string(),
	createdAt: z.string().optional(),
	aesKeyReceiver: z.string().optional(),
	aesKeySender: z.string().optional(),
	fileAttachments: FileUploadsSchema.nullable().optional(),
});

type Message = z.infer<typeof MessageSchema>;

const MessageResponseSchema = z.array(MessageSchema);

type MessageResponse = z.infer<typeof MessageResponseSchema>;

export {
	FileUploadSchema,
	FileUploadsSchema,
	MessageResponseSchema,
	MessageSchema,
	WSMessageSchema,
	type FileUpload,
	type FileUploads,
	type Message,
	type MessageResponse,
	type WSMessage,
};
