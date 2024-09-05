"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
	type WSMessage,
} from "@/types";
import { useCallback } from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

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
				const wsMessage: WSMessage = {
					type: "message",
					body: encryptedMessage,
					receiverId: Number(partnerInfo.partnerId),
					senderId: Number(userInfo.userId),
					aesKeyReceiver: encryptedAESKeyReceiver,
					aesKeySender: encryptedAESKeySender,
					expiredAt: expires,
					state: "sent",
					fileAttachments: JSON.stringify(encryptedFilesUploads),
				};
				sendMessage(JSON.stringify(wsMessage));

				const message: Message = {
					id: 0,
					senderId: Number(userInfo.userId),
					receiverId: Number(partnerInfo.partnerId),
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
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
				<FormField
					control={form.control}
					name="files"
					render={({ field }) => (
						<FormItem>
							<FormControl>
								<Input
									type="file"
									multiple={true}
									placeholder="Files"
									accept={ACCEPTED_FILE_TYPES.join(",")}
									onChange={(e) => {
										field.onChange(e.target.files);
									}}
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
								<Input placeholder="New Message" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit">Enviar</Button>
			</form>
		</Form>
	);
}
