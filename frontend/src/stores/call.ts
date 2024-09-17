// store.ts
import type Peer from "simple-peer"
import { create } from "zustand"

interface CallState {
	roomId: string | null
	localStream: MediaStream | null
	peers: { [key: string]: Peer.Instance }
	messages: { userId: string; content: string }[]
	setRoomId: (roomId: string) => void
	setLocalStream: (stream: MediaStream) => void
	addPeer: (userId: string, peer: Peer.Instance) => void
	removePeer: (userId: string) => void
	addMessage: (userId: string, content: string) => void
}

export const useCallStore = create<CallState>((set) => ({
	roomId: null,
	localStream: null,
	peers: {},
	messages: [],
	setRoomId: (roomId) => set({ roomId }),
	setLocalStream: (stream) => set({ localStream: stream }),
	addPeer: (userId, peer) =>
		set((state) => ({ peers: { ...state.peers, [userId]: peer } })),
	removePeer: (userId) =>
		set((state) => {
			const { [userId]: removedPeer, ...peers } = state.peers
			return { peers }
		}),
	addMessage: (userId, content) =>
		set((state) => ({ messages: [...state.messages, { userId, content }] })),
}))
