"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getWsUrl } from "@/lib/utils"
import { useUserInfoStore } from "@/stores/user-info"
import { Mic, MicOff, PhoneOff, Users, Video, VideoOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import Peer from "simple-peer"

interface PeerConnections {
	[key: string]: Peer.Instance | null
}

interface PeerStreams {
	[key: string]: MediaStream | null
}

const stunTurnConfig = {
	iceServers: [
		{ urls: "stun:stun-call.napoleon-chat.com:3478" },
		{
			urls: "turn:turn-call.napoleon-chat.com:3478",
			username: "AfUXBSy",
			credential: "AhFGyHCwalc",
		},
	],
}

export default function Calls() {
	const userInfo = useUserInfoStore((state) => state.userInfo)
	const isValidUserInfo = useUserInfoStore((state) => state.isValidUserInfo)
	const [peerStreams, setPeerStreams] = useState<PeerStreams>({})
	const [roomId, setRoomId] = useState("default-room")
	const [isInRoom, setIsInRoom] = useState(false)
	const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
	const localStreamRef = useRef<MediaStream | null>(null)
	const socketRef = useRef<WebSocket | null>(null)
	const peerConnectionsRef = useRef<PeerConnections>({})
	const router = useRouter()
	const [isAudioEnabled, setIsAudioEnabled] = useState(true)
	const [isVideoEnabled, setIsVideoEnabled] = useState(true)

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
		if (!isValidUserInfo()) {
			router.push("/login")
		}
	}, [isValidUserInfo, router])

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

	const findPeerByUserId = (targetUserId: string) => {
		const entry = Object.entries(peerConnectionsRef.current).find(([userId]) =>
			userId.includes(targetUserId),
		)
		return entry ? { userId: entry[0], peer: entry[1] } : null
	}

	const handleOffer = (userId: string, offer: any) => {
		console.log("Handling offer from:", userId)
		if (!findPeerByUserId(userId)) {
			addPeer(userId, false)
			peerConnectionsRef.current[userId]?.signal(offer)
		}
	}

	const handleAnswer = (userId: string, answer: any) => {
		console.log("Handling answer from:", userId)
		peerConnectionsRef.current[userId]?.signal(answer)
	}

	const handleLeft = (userId: string) => {
		console.log("Handling left from:", userId)
		peerConnectionsRef.current[userId]?.destroy()
		delete peerConnectionsRef.current[userId]

		setPeerStreams((prev) => {
			const newPeerStreams = { ...prev }
			delete newPeerStreams[userId]
			return newPeerStreams
		})
	}

	const onLeave = () => {
		setPeerStreams({})
		Object.values(peerConnectionsRef.current).forEach((peer) => peer?.destroy())
		peerConnectionsRef.current = {}
		localStreamRef.current?.getTracks().forEach((track) => track.stop())
		localStreamRef.current = null
		sendToServer({ type: "leave" })
		setIsInRoom(false)
	}

	const onMic = () => {
		if (localStreamRef.current) {
			const audioTrack = localStreamRef.current.getAudioTracks()[0]
			if (audioTrack) {
				audioTrack.enabled = !audioTrack.enabled
				setIsAudioEnabled(audioTrack.enabled)
			}
		}
	}

	const onVideo = () => {
		if (localStreamRef.current) {
			const videoTrack = localStreamRef.current.getVideoTracks()[0]
			if (videoTrack) {
				videoTrack.enabled = !videoTrack.enabled
				setIsVideoEnabled(videoTrack.enabled)
			}
		}
	}

	const joinRoom = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true,
			})
			localStreamRef.current = stream
			setIsAudioEnabled(true)
			setIsVideoEnabled(true)
			console.log("Local stream obtained:", stream)
			sendToServer({ type: "join" })
			setIsInRoom(true)
		} catch (error) {
			console.error("Error accessing media devices:", error)
		}
	}

	useEffect(() => {
		Object.entries(peerStreams).forEach(([peerId, stream]) => {
			if (videoRefs.current[peerId] && stream) {
				videoRefs.current[peerId].srcObject = stream
			}
		})
	}, [peerStreams])

	return (
		<div className="min-h-screen bg-gradient-to-br from-background/10 to-foreground/10 p-4">
			<div className="container mx-auto max-w-6xl">
				<h1 className="mb-8 text-center font-bold text-4xl">Group Call</h1>
				<Card className="overflow-hidden rounded-xl shadow-2xl">
					<CardHeader className="bg-foreground text-background">
						<CardTitle className="flex items-center justify-between font-bold text-2xl">
							<span>Video Call Room</span>
							<Users className="h-6 w-6" />
						</CardTitle>
					</CardHeader>
					<CardContent className="p-6">
						<div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
							<Input
								type="text"
								placeholder="Enter Room ID"
								value={roomId}
								onChange={(e) => setRoomId(e.target.value)}
								className="w-full max-w-xs rounded-full shadow-inner"
								disabled={isInRoom}
							/>
							{!isInRoom && (
								<Button
									onClick={joinRoom}
									className="w-full max-w-xs rounded-full hover:scale-105 hover:transition-all sm:w-auto"
								>
									<Video className="mr-2 h-4 w-4" /> Join Room
								</Button>
							)}
						</div>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{localStreamRef.current && (
								<div className="relative overflow-hidden rounded-lg shadow-lg">
									<video
										ref={(el) => {
											if (el) el.srcObject = localStreamRef.current
										}}
										autoPlay
										playsInline
										muted
										className="h-full w-full object-cover"
									/>
									<div className="absolute bottom-2 left-2 flex gap-2">
										<Button
											size="sm"
											variant={isAudioEnabled ? "secondary" : "destructive"}
											onClick={onMic}
											className="rounded-full"
										>
											{isAudioEnabled ? (
												<Mic className="h-4 w-4" />
											) : (
												<MicOff className="h-4 w-4" />
											)}
										</Button>
										<Button
											size="sm"
											variant={isVideoEnabled ? "secondary" : "destructive"}
											onClick={onVideo}
											className="rounded-full"
										>
											{isVideoEnabled ? (
												<Video className="h-4 w-4" />
											) : (
												<VideoOff className="h-4 w-4" />
											)}
										</Button>
										<Button
											size="sm"
											variant="destructive"
											onClick={onLeave}
											className="rounded-full"
										>
											<PhoneOff className="h-4 w-4" />
										</Button>
									</div>
								</div>
							)}
							{Object.entries(peerStreams).map(([peerId]) => (
								<div
									key={peerId}
									className="relative overflow-hidden rounded-lg shadow-lg"
								>
									<video
										ref={(el) => {
											videoRefs.current[peerId] = el
										}}
										autoPlay
										playsInline
										className="h-full w-full object-cover"
									>
										<track kind="captions" />
										<track kind="descriptions" />
									</video>
									<div className="absolute top-2 left-2 rounded-full bg-black bg-opacity-50 px-3 py-1 text-sm text-white">
										{peerId}
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
