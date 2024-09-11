import { z } from "zod";

const CommonMessageSchema = z.object({
	senderId: z.string(),
	receiverId: z.string(),
	body: z.string(),
	aesKeySender: z.string(),
	aesKeyReceiver: z.string(),
	messageId: z.string(),
	state: z.string(),
	expiredAt: z.string(),
	fileAttachments: z.string(),
});

type CommonMessage = z.infer<typeof CommonMessageSchema>;

const UpdateStateMessageSchema = z.object({
	senderId: z.string(),
	receiverId: z.string(),
	state: z.string(),
	messageId: z.string(),
});

type UpdateStateMessage = z.infer<typeof UpdateStateMessageSchema>;

const ErrorSchema = z.object({
	status: z.string(),
	message: z.string(),
});

type Error = z.infer<typeof ErrorSchema>;

const WSMessageSchema = z.object({
	type: z.string(),
	data: CommonMessageSchema.or(UpdateStateMessageSchema),
	error: ErrorSchema.optional(),
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
	id: z.string(),
	senderId: z.string(),
	receiverId: z.string(),
	body: z.string(),
	state: z.string(),
	expiredAt: z.string(),
	createdAt: z.string().optional(),
	aesKeyReceiver: z.string().optional(),
	aesKeySender: z.string().optional(),
	fileAttachments: FileUploadsSchema.nullable().optional(),
});

type Message = z.infer<typeof MessageSchema>;

const MessagesSchema = z.array(MessageSchema);

type Messages = z.infer<typeof MessagesSchema>;

export {
	CommonMessageSchema,
	ErrorSchema,
	FileUploadSchema,
	FileUploadsSchema,
	MessageSchema,
	MessagesSchema,
	UpdateStateMessageSchema,
	WSMessageSchema,
	type CommonMessage,
	type Error,
	type FileUpload,
	type FileUploads,
	type Message,
	type Messages,
	type UpdateStateMessage,
	type WSMessage,
};
