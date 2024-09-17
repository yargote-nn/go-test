import { useMessages } from "@/hooks/use-messages"
import { decryptMessage } from "@/lib/crypto"
import type { CommonMessage, UpdateStateMessage, UserInfo } from "@/types"
import { useCallback } from "react"

interface useWSMessagesProps {
	userInfo: UserInfo | null
}

export const useWSMessages = ({ userInfo }: useWSMessagesProps) => {
	const { addNewMessage, updateMessageState } = useMessages()

	const handleNewMessage = useCallback(
		async (message: CommonMessage, sendMessage: (message: string) => void) => {
			console.log("handleNewMessage")
			let encryptedAESKey: string | undefined
			if (!userInfo) {
				return
			}
			if (
				userInfo &&
				message.receiverId === userInfo.userId &&
				message.aesKeyReceiver
			) {
				encryptedAESKey = message.aesKeyReceiver
			} else if (
				userInfo &&
				message.senderId === userInfo.userId &&
				message.aesKeySender
			) {
				encryptedAESKey = message.aesKeySender
			}
			if (!encryptedAESKey) {
				return
			}
			const { decryptedMessage, decryptedFileUploads } = await decryptMessage(
				message.body,
				encryptedAESKey,
				userInfo.privateKey,
				message.fileAttachments ?? [],
			)

			addNewMessage({
				id: message.messageId ?? "",
				senderId: message.senderId,
				receiverId: message.receiverId,
				body: decryptedMessage,
				state: "received",
				expiredAt: message.expiredAt ?? "",
				fileAttachments: decryptedFileUploads,
			})
			sendMessage(
				JSON.stringify({
					type: "status_update",
					data: {
						state: "received",
						messageId: message.messageId,
						receiverId: message.senderId,
						senderId: message.receiverId,
					},
				}),
			)
		},
		[userInfo, addNewMessage],
	)

	const handleStatusUpdate = useCallback(
		(message: UpdateStateMessage) => {
			console.log("handleStatusUpdate", message)
			updateMessageState(message.messageId ?? "", message.state ?? "sent")
		},
		[updateMessageState],
	)

	return { handleNewMessage, handleStatusUpdate }
}
