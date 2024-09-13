"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/hooks/use-messages";
import { encryptMessage } from "@/lib/crypto";
import { getApiUrl } from "@/lib/utils";
import {
	type FileUploads,
	FileUploadsSchema,
	type Message,
	type PartnerInfo,
	type UserInfo,
} from "@/types";
import { Paperclip, Send } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Textarea } from "./ui/textarea";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = [
	"image/jpeg",
	"image/png",
	"application/pdf",
	"video/mp4",
	"audio/mpeg",
];
const formSchema = z.object({
	newMessage: z.string().min(1, {
		message: "Message is required",
	}),
	files: z
		.custom<FileList>()
		.refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, {
			message: "File is too large",
		})
		.refine(
			(files) => {
				const file = files?.[0];
				return file ? ACCEPTED_FILE_TYPES.includes(file.type) : true;
			},
			{
				message: "Invalid file type",
			},
		)
		.optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NewMessageProps {
	userInfo: UserInfo;
	partnerInfo: PartnerInfo;
	sendMessage: (message: string) => void;
}

export function NewMessage({
	userInfo,
	partnerInfo,
	sendMessage,
}: NewMessageProps) {
	const { addNewMessage } = useMessages();
	const [fileSelected, setFileSelected] = useState<boolean | null>(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			newMessage: "",
		},
	});

	const sendMessageCallback = useCallback(
		async (newMessage: string, files: FileList | undefined) => {
			console.log("sendMessageCallback");
			const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
			const expires = tomorrow.toISOString();
			console.log("expires", expires);

			let filesUploads: FileUploads = [];
			console.log("files", files);
			if (files) {
				const formData = new FormData();
				for (const file of files) {
					formData.append("files", file);
				}

				try {
					const response = await fetch(`${getApiUrl()}/api/upload-files`, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${userInfo.token}`,
						},
						body: formData,
					});
					const responseData = await response.json();
					const { data, success } = FileUploadsSchema.safeParse(responseData);
					if (!success) {
						console.error("Error uploading files:", responseData);
						return;
					}
					filesUploads = data;
				} catch (error) {
					console.error("Error uploading files:", error);
				}
			}

			try {
				const {
					encryptedMessage,
					encryptedAESKeyReceiver,
					encryptedAESKeySender,
					encryptedFilesUploads,
				} = await encryptMessage(
					newMessage,
					partnerInfo.publicKey,
					userInfo.publicKey,
					filesUploads,
				);
				const messageId = uuidv4();
				const wsMessage = {
					type: "message",
					data: {
						senderId: userInfo.userId,
						receiverId: partnerInfo.partnerId,
						body: encryptedMessage,
						aesKeyReceiver: encryptedAESKeyReceiver,
						aesKeySender: encryptedAESKeySender,
						messageId: messageId,
						state: "sent",
						fileAttachments: JSON.stringify(encryptedFilesUploads),
						expiredAt: expires,
					},
				};
				console.log("wsMessage", wsMessage);
				sendMessage(JSON.stringify(wsMessage));

				const message: Message = {
					id: messageId,
					senderId: userInfo.userId,
					receiverId: partnerInfo.partnerId,
					body: newMessage,
					state: "sent",
					expiredAt: expires,
					aesKeyReceiver: encryptedAESKeyReceiver,
					aesKeySender: encryptedAESKeySender,
					fileAttachments: filesUploads,
				};
				addNewMessage(message);
				form.reset();
			} catch (error) {
				console.error("Error sending message:", error);
			}
		},
		[partnerInfo, userInfo, form.reset, sendMessage, addNewMessage],
	);

	function onSubmit(values: FormValues) {
		sendMessageCallback(values.newMessage, values.files);
		setFileSelected(false);
		form.reset();
	}

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		form.setValue("files", files as FileList);
		setFileSelected(files && files.length > 0);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			const values = form.getValues();
			if (values) {
				onSubmit(values);
			}
		}
	};

	return (
		<div className="fixed bottom-0 left-0 right-0 z-10 p-4 max-w-lg m-auto">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="files"
						render={({ field: { onChange, ...field } }) => (
							<FormItem className="hidden">
								<FormControl>
									<Input
										type="file"
										multiple={true}
										accept={ACCEPTED_FILE_TYPES.join(",")}
										onChange={(e) => {
											onChange(e.target.files);
											handleFileChange(e);
										}}
										ref={fileInputRef}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="newMessage"
						render={({ field }) => (
							<FormItem>
								<FormControl>
									<div className="relative flex items-center">
										<Button
											type="button"
											size="icon"
											variant="ghost"
											className={`absolute left-2 ${fileSelected ? "text-primary" : ""}`}
											onClick={() => fileInputRef.current?.click()}
										>
											<Paperclip className="h-5 w-5" />
											<span className="sr-only">Attach file</span>
										</Button>
										<Textarea
											onKeyDown={handleKeyDown}
											placeholder="New Message"
											{...field}
											className="pl-12 pr-12 py-6"
										/>
										<Button
											type="submit"
											size="icon"
											className="absolute right-2"
										>
											<Send className="h-4 w-4" />
											<span className="sr-only">Send message</span>
										</Button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</form>
			</Form>
		</div>
	);
}
