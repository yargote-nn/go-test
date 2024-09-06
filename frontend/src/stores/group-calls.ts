import type Peer from "simple-peer";
import { create } from "zustand";

interface PeerConnection {
	peer: Peer.Instance;
	stream: MediaStream | null;
}

interface GroupCallStore {
	socket: WebSocket | null;
	peerConnections: { [key: string]: PeerConnection };
	localStream: MediaStream | null;
	roomId: string;
	isVideoEnabled: boolean;
	setSocket: (socket: WebSocket) => void;
	setPeerConnection: (peerId: string, connection: PeerConnection) => void;
	removePeerConnection: (peerId: string) => void;
	setLocalStream: (stream: MediaStream | null) => void;
	setRoomId: (roomId: string) => void;
	setIsVideoEnabled: (isEnabled: boolean) => void;
}

export const useGroupCallStore = create<GroupCallStore>((set) => ({
	socket: null,
	peerConnections: {},
	localStream: null,
	roomId: "default-room",
	isVideoEnabled: true,
	setSocket: (socket) => set({ socket }),
	setPeerConnection: (peerId, connection) =>
		set((state) => ({
			peerConnections: { ...state.peerConnections, [peerId]: connection },
		})),
	removePeerConnection: (peerId) =>
		set((state) => {
			const { [peerId]: removed, ...rest } = state.peerConnections;
			return { peerConnections: rest };
		}),
	setLocalStream: (stream) => set({ localStream: stream }),
	setRoomId: (roomId) => set({ roomId }),
	setIsVideoEnabled: (isEnabled) => set({ isVideoEnabled: isEnabled }),
}));
