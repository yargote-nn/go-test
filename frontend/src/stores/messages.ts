import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { decryptMessage } from "@/lib/crypto"
import { getApiUrl } from "@/lib/utils"
import {
	type Message,
	type Messages,
	MessagesSchema,
	type PartnerInfo,
	type UserInfo,
} from "@/types"

interface MessageState {
	messages: Messages
	setMessages: (messages: Messages) => void
	updateMessages: (partnerInfo: PartnerInfo, userInfo: UserInfo) => void
	addNewMessage: (message: Message) => void
	updateMessageState: (messageId: string, newState: string) => void
}

const useMessagesStore = create(
	persist<MessageState>(
		(set) => ({
			messages: [],
			setMessages: (messages: Messages) => set({ messages }),
			addNewMessage: (message: Message) =>
				set((state) => ({ messages: [...state.messages, message] })),
			updateMessageState: (messageId: string, newState: string) =>
				set((state) => ({
					messages: state.messages.map((message) =>
						message.id === messageId
							? { ...message, state: newState }
							: message,
					),
				})),
			updateMessages: async (partnerInfo: PartnerInfo, userInfo: UserInfo) => {
				try {
					const response = await fetch(
						`${getApiUrl()}/api/messages?partner_id=${partnerInfo.partnerId}`,
						{
							headers: { Authorization: `Bearer ${userInfo.token}` },
							method: "GET",
						},
					)
					const responseData = await response.json()
					const { data: messages, success } =
						MessagesSchema.safeParse(responseData)
					if (success) {
						const decryptedMessages = await Promise.all(
							messages.map(async (message) => {
								if (
									message.receiverId === userInfo.userId &&
									message.aesKeyReceiver
								) {
									const { decryptedMessage, decryptedFileUploads } =
										await decryptMessage(
											message.body,
											message.aesKeyReceiver,
											userInfo.privateKey,
											message.fileAttachments ?? [],
										)
									message.body = decryptedMessage
									message.fileAttachments = decryptedFileUploads
								} else if (
									message.senderId === userInfo.userId &&
									message.aesKeySender
								) {
									const { decryptedMessage, decryptedFileUploads } =
										await decryptMessage(
											message.body,
											message.aesKeySender,
											userInfo.privateKey,
											message.fileAttachments ?? [],
										)
									message.body = decryptedMessage
									message.fileAttachments = decryptedFileUploads
								}
								return message
							}),
						)
						set({ messages: decryptedMessages })
					}
				} catch (error) {
					console.error("Error fetching messages with partner:", error)
				}
			},
		}),
		{
			name: "messages",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
)

export { useMessagesStore }
