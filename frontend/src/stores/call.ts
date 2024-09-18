// store.ts
import type Peer from "simple-peer"
import { create } from "zustand"

interface CallState {
	roomId: string | null
	localStream: MediaStream | null
	peers: { [key: string]: Peer.Instance }
	messages: { userId: string; content: string }[]
	setRoomId: (roomId: string) => void
	setLocalStream: (stream: MediaStream | null) => void
	addPeer: (userId: string, peer: Peer.Instance) => void
	updateSignal: (userId: string, signal: string) => void
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
	updateSignal: (userId, signal) =>
		set((state) => {
			const { peers } = state
			console.log("updateSignal", userId, Object.keys(peers))
			const peer = peers[userId]
			if (peer) {
				peer.signal(signal)
			}
			return { peers }
		}),
	removePeer: (userId) =>
		set((state) => {
			const { [userId]: removedPeer, ...peers } = state.peers
			return { peers }
		}),
	addMessage: (userId, content) =>
		set((state) => ({ messages: [...state.messages, { userId, content }] })),
}))
