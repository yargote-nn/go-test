import { create } from "zustand";

import type { Message } from "@/types";

type State = {
	newMessage: Message | null;
};

type Actions = {
	setNewMessage: (messages: Message) => void;
};

const useMessageStore = create<State & Actions>((set) => ({
	newMessage: null,
	setNewMessage: (newMessage) => set({ newMessage }),
}));

export { useMessageStore };
