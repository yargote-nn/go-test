import type Peer from "simple-peer"

type CallStatus = "idle" | "calling" | "incomingCall" | "connected"
type MediaType = "video" | "audio"

interface PeerConnections {
	[key: string]: Peer.Instance | null
}

interface PeerStreams {
	[key: string]: MediaStream | null
}
export type { CallStatus, MediaType, PeerConnections, PeerStreams }
