import { useMessages } from "@/hooks/use-messages";
import { decryptMessage } from "@/lib/crypto";
import type { UserInfo, WSMessage } from "@/types";
import { useCallback } from "react";

interface useWSMessagesProps {
	userInfo: UserInfo | null;
}

export const useWSMessages = ({ userInfo }: useWSMessagesProps) => {
	const { addNewMessage, updateMessageSent, updateMessageState } =
		useMessages();

	const handleNewMessage = useCallback(
		async (message: WSMessage, sendMessage: (message: string) => void) => {
			console.log("handleNewMessage");
			let encryptedAESKey: string | undefined;
			if (!userInfo) {
				return;
			}
			if (
				userInfo &&
				message.receiverId === Number(userInfo.userId) &&
				message.aesKeyReceiver
			) {
				encryptedAESKey = message.aesKeyReceiver;
			} else if (
				userInfo &&
				message.senderId === Number(userInfo.userId) &&
				message.aesKeySender
			) {
				encryptedAESKey = message.aesKeySender;
			}
			if (!encryptedAESKey) {
				return;
			}
			const { decryptedMessage, decryptedFileUploads } = await decryptMessage(
				message.body,
				encryptedAESKey,
				userInfo.privateKey,
				message.fileAttachments ?? [],
			);

			addNewMessage({
				id: message.messageId ?? 0,
				senderId: message.senderId,
				receiverId: message.receiverId,
				body: decryptedMessage,
				state: "received",
				expiredAt: message.expiredAt ?? "",
				fileAttachments: decryptedFileUploads,
			});
			sendMessage(
				JSON.stringify({
					type: "status_update",
					state: "received",
					messageId: message.messageId,
					receiverId: message.senderId,
				}),
			);
		},
		[userInfo, addNewMessage],
	);

	const handleMessageSent = useCallback(
		(message: WSMessage) => {
			console.log("handleMessageSent", message);
			updateMessageSent(0, message.messageId ?? 0, message.state ?? "sent");
		},
		[updateMessageSent],
	);

	const handleStatusUpdate = useCallback(
		(message: WSMessage) => {
			console.log("handleStatusUpdate", message);
			updateMessageState(message.messageId ?? 0, message.state ?? "sent");
		},
		[updateMessageState],
	);

	return { handleNewMessage, handleMessageSent, handleStatusUpdate };
};
