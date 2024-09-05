import { useMessagesStore } from "@/stores/messages";
import { useMemo } from "react";

export function useMessages() {
	const messages = useMessagesStore((state) => state.messages);
	const updateMessages = useMessagesStore((state) => state.updateMessages);
	const setMessages = useMessagesStore((state) => state.setMessages);
	const addNewMessage = useMessagesStore((state) => state.addNewMessage);
	const updateMessageSent = useMessagesStore(
		(state) => state.updateMessageSent,
	);
	const updateMessageState = useMessagesStore(
		(state) => state.updateMessageState,
	);

	return useMemo(
		() => ({
			messages,
			setMessages,
			updateMessages,
			addNewMessage,
			updateMessageSent,
			updateMessageState,
		}),
		[
			messages,
			setMessages,
			updateMessages,
			addNewMessage,
			updateMessageSent,
			updateMessageState,
		],
	);
}
