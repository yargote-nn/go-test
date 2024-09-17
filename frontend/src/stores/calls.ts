import type { CallStatus, MediaType } from "@/types/calls"
import Peer from "simple-peer"
import { create } from "zustand"

interface CallStore {
	isOpen: boolean
	callStatus: CallStatus
	mediaType: MediaType
	incomingCallFrom: string
	signal: string
	socketRef: React.MutableRefObject<WebSocket | null>
	isWebSocketReady: boolean
	peerRef: React.MutableRefObject<Peer.Instance | null>
	streamRef: React.MutableRefObject<MediaStream | null>
	localVideoRef: React.RefObject<HTMLVideoElement>
	remoteVideoRef: React.RefObject<HTMLVideoElement>
	setIsOpen: (isOpen: boolean) => void
	setCallStatus: (status: CallStatus) => void
	setMediaType: (type: MediaType) => void
	setIncomingCallFrom: (from: string) => void
	setSignal: (signal: string) => void
	startCall: (isAccepting?: boolean, to?: string) => void
	acceptCall: () => void
	declineCall: () => void
	endCall: () => void
	toggleMediaType: () => void
	connectWebSocket: (token: string) => void
}

export const useCallStore = create<CallStore>((set, get) => ({
	isOpen: false,
	callStatus: "idle",
	mediaType: "video",
	incomingCallFrom: "",
	signal: "",
	socketRef: { current: null },
	isWebSocketReady: false,
	peerRef: { current: null },
	streamRef: { current: null },
	localVideoRef: { current: null },
	remoteVideoRef: { current: null },
	setIsOpen: (isOpen) => set({ isOpen }),
	setCallStatus: (status) => set({ callStatus: status }),
	setMediaType: (type) => set({ mediaType: type }),
	setIncomingCallFrom: (from) => set({ incomingCallFrom: from }),
	setSignal: (signal) => set({ signal }),

	connectWebSocket: (token: string) => {
		const socket = new WebSocket(`ws://localhost:8000/ws/webrtc?token=${token}`)

		console.log("Socket:", socket)

		socket.onopen = () => {
			console.log("WebSocket RTC Connected")
			set({ isWebSocketReady: true })
		}
		socket.onclose = () => {
			console.log("WebSocket RTC Disconnected")
			set({ isWebSocketReady: false })
		}

		socket.onmessage = (event) => {
			console.log("Incoming message:", event.data)
			const data = JSON.parse(event.data)
			handleIncomingMessage(data, get, set)
		}

		set({ socketRef: { current: socket } })

		return () => {
			if (socket) {
				socket.close()
			}
		}
	},

	startCall: (isAccepting, to) => {
		const {
			mediaType,
			incomingCallFrom,
			signal,
			socketRef,
			peerRef,
			streamRef,
			localVideoRef,
			remoteVideoRef,
		} = get()

		navigator.mediaDevices
			.getUserMedia({ video: mediaType === "video", audio: true })
			.then((stream) => {
				streamRef.current = stream
				if (localVideoRef.current) {
					localVideoRef.current.srcObject = stream
				}

				peerRef.current = new Peer({
					initiator: !isAccepting,
					trickle: false,
					stream: stream,
				})

				peerRef.current.on("signal", (data) => {
					sendMessage(socketRef.current, {
						type: isAccepting ? "accept-call" : "call",
						to: isAccepting ? incomingCallFrom : to,
						signal: data,
					})
				})

				peerRef.current.on("stream", (remoteStream) => {
					if (remoteVideoRef.current) {
						remoteVideoRef.current.srcObject = remoteStream
					}
				})

				if (isAccepting && signal) {
					peerRef.current.signal(signal)
				}

				set({ callStatus: "connected" })
			})
			.catch((err) => console.error("Error accessing media devices:", err))
	},

	acceptCall: () => {
		get().startCall(true)
	},

	declineCall: () => {
		const { socketRef, incomingCallFrom } = get()
		sendMessage(socketRef.current, {
			type: "end",
			to: incomingCallFrom,
			signal: {},
		})
		set({ callStatus: "idle", incomingCallFrom: "" })
	},

	endCall: () => {
		const { peerRef, streamRef, socketRef, incomingCallFrom } = get()
		if (peerRef.current) {
			peerRef.current.destroy()
		}
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) {
				track.stop()
			}
		}
		const message = {
			type: "end",
			to: incomingCallFrom,
			signal: {},
		}
		if (message.to) {
			sendMessage(socketRef.current, message)
		}
		set({ callStatus: "idle", incomingCallFrom: "" })
	},

	toggleMediaType: () => {
		const { mediaType, peerRef, streamRef, localVideoRef } = get()
		const newMediaType = mediaType === "video" ? "audio" : "video"

		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) {
				track.stop()
			}
		}

		navigator.mediaDevices
			.getUserMedia({ video: newMediaType === "video", audio: true })
			.then((newStream) => {
				streamRef.current = newStream
				if (localVideoRef.current) {
					localVideoRef.current.srcObject = newStream
				}
				if (peerRef.current) {
					peerRef.current.replaceTrack(
						peerRef.current.streams[0].getVideoTracks()[0],
						newStream.getVideoTracks()[0],
						peerRef.current.streams[0],
					)
				}
				set({ mediaType: newMediaType })
			})
			.catch((err) => console.error("Error toggling media type:", err))
	},
}))

function handleIncomingMessage(
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	data: any,
	get: () => CallStore,
	set: (partial: Partial<CallStore>) => void,
) {
	switch (data.type) {
		case "call":
			set({
				incomingCallFrom: data.from,
				callStatus: "incomingCall",
				signal: data.signal,
			})
			get().setIsOpen(true)
			break
		case "accept-call":
			set({ incomingCallFrom: data.from })
			get().peerRef.current?.signal(data.signal)
			break
		case "end":
			get().endCall()
			break
	}
}

function sendMessage(socket: WebSocket | null, message: object) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(message))
	}
}
