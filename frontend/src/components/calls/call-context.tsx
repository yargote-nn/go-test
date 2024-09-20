"use client"

import { getWsUrl } from "@/lib/utils"
import { stunTurnConfig } from "@/lib/webrtc-config"
import { useUserInfoStore } from "@/stores/user-info"
import type { PeerConnections, PeerStreams } from "@/types/calls"
import { useRouter } from "next/navigation"
import type React from "react"
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import Peer from "simple-peer"

interface CallsContextType {
	peerStreams: PeerStreams
	roomId: string
	isInRoom: boolean
	isAudioEnabled: boolean
	isVideoEnabled: boolean
	localStreamRef: React.MutableRefObject<MediaStream | null>
	setRoomId: (id: string) => void
	joinRoom: () => Promise<void>
	leaveRoom: () => void
	toggleAudio: () => void
	toggleVideo: () => void
}

const CallsContext = createContext<CallsContextType | undefined>(undefined)

export const useCallsContext = () => {
	const context = useContext(CallsContext)
	if (!context) {
		throw new Error("useCallsContext must be used within a CallsProvider")
	}
	return context
}

export const CallsProvider: React.FC<React.PropsWithChildren<{}>> = ({
	children,
}) => {
	const [peerStreams, setPeerStreams] = useState<PeerStreams>({})
	const [roomId, setRoomId] = useState("default-room")
	const [isInRoom, setIsInRoom] = useState(false)
	const [isAudioEnabled, setIsAudioEnabled] = useState(true)
	const [isVideoEnabled, setIsVideoEnabled] = useState(true)

	const router = useRouter()
	const userInfo = useUserInfoStore((state) => state.userInfo)
	const isValidUserInfo = useUserInfoStore((state) => state.isValidUserInfo)

	const localStreamRef = useRef<MediaStream | null>(null)
	const socketRef = useRef<WebSocket | null>(null)
	const peerConnectionsRef = useRef<PeerConnections>({})

	useEffect(() => {
		if (!isValidUserInfo()) {
			router.push("/login")
		}
	}, [isValidUserInfo, router])

	const connectSocket = useCallback(
		(token: string) => {
			console.log("Connecting to WebSocket", token)
			const newSocket = new WebSocket(
				`${getWsUrl()}/ws/group-call/${roomId}?token=${token}`,
			)
			newSocket.onopen = () => {
				console.log("WebSocket Connected")
				socketRef.current = newSocket
			}
			newSocket.onmessage = (event: MessageEvent) => {
				const message = JSON.parse(event.data)
				console.log("Received message:", message)
				switch (message.type) {
					case "user-joined":
						console.log("Join User: ", message)
						addPeer(message.userId, true)
						break
					case "offer":
						console.log("Offer: ", message)
						handleOffer(message.from, message.offer)
						break
					case "answer":
						console.log("Answer: ", message)
						handleAnswer(message.from, message.answer)
						break
					case "user-left":
						console.log("User left:", message)
						handleLeft(message.userId)
						break
					default:
						console.log("Unhandled message type:", message.type)
						break
				}
			}
			newSocket.onerror = (error) => {
				console.error("WebSocket Error:", error)
			}
			newSocket.onclose = (event: CloseEvent) => {
				console.log("WebSocket closed. Reconnecting in 1 second:", event)
				// setTimeout(() => connectSocket(token), 1000)
			}
		},
		[roomId],
	)

	useEffect(() => {
		if (userInfo?.token) {
			connectSocket(userInfo.token)
		}
		return () => {
			if (socketRef.current) {
				socketRef.current.close()
			}
		}
	}, [connectSocket, userInfo?.token])

	const sendToServer = useCallback((message: any) => {
		if (socketRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
			console.log("Sending message:", message)
			socketRef.current?.send(JSON.stringify(message))
		} else {
			console.error("WebSocket is not open")
		}
	}, [])

	const addPeer = useCallback(
		(userId: string, initiator: boolean) => {
			console.log("Adding peer:", userId, "Initiator:", initiator)
			if (!localStreamRef.current) {
				console.error("Local stream not available")
				return
			}
			const newPeer = new Peer({
				initiator: initiator,
				stream: localStreamRef.current,
				trickle: false,
				config: stunTurnConfig,
			})
			newPeer.on("signal", (data) => {
				console.log("Sending", initiator ? "offer" : "answer", "to", userId)
				sendToServer({
					type: initiator ? "offer" : "answer",
					to: userId,
					[initiator ? "offer" : "answer"]: data,
				})
			})
			newPeer.on("stream", (stream) => {
				console.log("Received stream from", userId, stream)
				peerStreams[userId]?.id !== stream.id &&
					setPeerStreams((prev) => ({ ...prev, [userId]: stream }))
			})
			peerConnectionsRef.current[userId] = newPeer
		},
		[sendToServer],
	)

	const handleOffer = useCallback(
		(userId: string, offer: any) => {
			console.log("Handling offer from:", userId)
			if (!findPeerByUserId(userId)) {
				addPeer(userId, false)
				peerConnectionsRef.current[userId]?.signal(offer)
			}
		},
		[addPeer],
	)

	const handleAnswer = useCallback((userId: string, answer: any) => {
		console.log("Handling answer from:", userId)
		peerConnectionsRef.current[userId]?.signal(answer)
	}, [])

	const handleLeft = useCallback((userId: string) => {
		peerConnectionsRef.current[userId]?.destroy()
		delete peerConnectionsRef.current[userId]

		setPeerStreams((prev) => {
			const newPeerStreams = { ...prev }
			delete newPeerStreams[userId]
			return newPeerStreams
		})
	}, [])

	const joinRoom = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true,
			})
			localStreamRef.current = stream
			setIsAudioEnabled(true)
			setIsVideoEnabled(true)
			sendToServer({ type: "join" })
			setIsInRoom(true)
		} catch (error) {
			console.error("Error accessing media devices:", error)
			throw error
		}
	}, [sendToServer])

	const findPeerByUserId = (targetUserId: string) => {
		const entry = Object.entries(peerConnectionsRef.current).find(([userId]) =>
			userId.includes(targetUserId),
		)
		return entry ? { userId: entry[0], peer: entry[1] } : null
	}

	const leaveRoom = useCallback(() => {
		setPeerStreams({})
		Object.values(peerConnectionsRef.current).forEach((peer) => peer?.destroy())
		peerConnectionsRef.current = {}
		localStreamRef.current?.getTracks().forEach((track) => track.stop())
		localStreamRef.current = null
		sendToServer({ type: "leave" })
		setIsInRoom(false)
	}, [sendToServer])

	const toggleAudio = useCallback(() => {
		if (localStreamRef.current) {
			const audioTrack = localStreamRef.current.getAudioTracks()[0]
			if (audioTrack) {
				audioTrack.enabled = !audioTrack.enabled
				setIsAudioEnabled(audioTrack.enabled)
			}
		}
	}, [])

	const toggleVideo = useCallback(() => {
		if (localStreamRef.current) {
			const videoTrack = localStreamRef.current.getVideoTracks()[0]
			if (videoTrack) {
				videoTrack.enabled = !videoTrack.enabled
				setIsVideoEnabled(videoTrack.enabled)
			}
		}
	}, [])

	const value = {
		peerStreams,
		roomId,
		isInRoom,
		isAudioEnabled,
		isVideoEnabled,
		localStreamRef,
		setRoomId,
		joinRoom,
		leaveRoom,
		toggleAudio,
		toggleVideo,
	}

	return <CallsContext.Provider value={value}>{children}</CallsContext.Provider>
}
