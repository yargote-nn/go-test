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
import type { Message, PartnerInfo, UserInfo, WSMessage } from "@/types";
import { useCallback } from "react";

const formSchema = z.object({
	newMessage: z.string().min(1, {
		message: "Message is required",
	}),
});

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
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			newMessage: "",
		},
	});

	const sendMessageCallback = useCallback(
		async (newMessage: string) => {
			console.log("sendMessageCallback");
			const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
			const expires = tomorrow.toISOString();
			console.log("expires", expires);

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
					[],
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
					fileAttachments: encryptedFilesUploads,
				};
				addNewMessage(message);
				form.reset();
			} catch (error) {
				console.error("Error sending message:", error);
			}
		},
		[partnerInfo, userInfo, form.reset, sendMessage, addNewMessage],
	);

	function onSubmit(values: z.infer<typeof formSchema>) {
		sendMessageCallback(values.newMessage);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
