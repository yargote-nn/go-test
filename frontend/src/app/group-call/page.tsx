"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useUserInfoStore } from "@/stores/user-info"
import { Mic, PhoneOff, Video } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import Peer from "simple-peer"

interface PeerConnections {
	[key: string]: Peer.Instance | null
}

interface PeerStreams {
	[key: string]: MediaStream | null
}

export default function Calls() {
	const userInfo = useUserInfoStore((state) => state.userInfo)
	const [peerStreams, setPeerStreams] = useState<PeerStreams>({})
	const [localStream, setLocalStream] = useState<MediaStream | null>(null)
	const [roomId] = useState("default-room")
	const [error, setError] = useState<string | null>(null)
	const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
	const localStreamRef = useRef<MediaStream | null>(null)
	const socketRef = useRef<WebSocket | null>(null)
	const peerConnectionsRef = useRef<PeerConnections>({})

	const connectSocket = useCallback(
		(token: string) => {
			console.log("Connecting to WebSocket", token)
			const newSocket = new WebSocket(
				`ws://127.0.0.1:8000/ws/group-call/${roomId}?token=${token}`,
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
					default:
						console.log("Unhandled message type:", message.type)
						break
				}
			}
			newSocket.onerror = (error) => {
				console.error("WebSocket Error:", error)
				setError("Error connecting to WebSocket")
			}
			newSocket.onclose = (event: CloseEvent) => {
				console.log("WebSocket closed. Reconnecting in 1 second:", event)
				setError("WebSocket connection closed. Attempting to reconnect...")
				setTimeout(() => connectSocket(token), 1000)
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
			setError("WebSocket is not open. Unable to send message.")
		}
	}, [])

	const addPeer = useCallback(
		(userId: string, initiator: boolean) => {
			console.log("Adding peer:", userId, "Initiator:", initiator)
			if (!localStreamRef.current) {
				console.error("Local stream not available")
				setError("Local stream not available. Unable to add peer.")
				return
			}
			const newPeer = new Peer({
				initiator: initiator,
				stream: localStreamRef.current,
				trickle: false,
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
				// If exist a peer stream with id with userId, not update it
				console.log("peerStreams", peerStreams)
				console.log("stream.id", stream.id)
				console.log(peerStreams[userId])
				peerStreams[userId]?.id !== stream.id &&
					setPeerStreams((prev) => ({ ...prev, [userId]: stream }))
				// setPeerStreams((prev) => ({ ...prev, [userId]: stream }))
			})
			peerConnectionsRef.current[userId] = newPeer
		},
		[sendToServer],
	)

	const handleOffer = useCallback(
		(userId: string, offer: any) => {
			console.log("Handling offer from:", userId)
			addPeer(userId, false)
			peerConnectionsRef.current[userId]?.signal(offer)
		},
		[addPeer],
	)

	const handleAnswer = useCallback((userId: string, answer: any) => {
		console.log("Handling answer from:", userId)
		peerConnectionsRef.current[userId]?.signal(answer)
	}, [])

	const joinRoom = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true,
			})
			setLocalStream(stream)
			localStreamRef.current = stream
			console.log("Local stream obtained:", stream)
			sendToServer({ type: "join" })
		} catch (error) {
			console.error("Error accessing media devices:", error)
			setError(
				"Error accessing media devices. Please check your camera and microphone permissions.",
			)
		}
	}, [sendToServer])

	useEffect(() => {
		Object.entries(peerStreams).forEach(([peerId, stream]) => {
			if (videoRefs.current[peerId] && stream) {
				videoRefs.current[peerId].srcObject = stream
			}
		})
	}, [peerStreams])

	return (
		<div className="container mx-auto p-4">
			<h1 className="text-3xl font-bold mb-6">Group Call</h1>
			{error && (
				<Alert variant="destructive" className="mb-4">
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<Card>
				<CardHeader>
					<CardTitle>Video Call</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-4">
						<Button onClick={joinRoom} className="mb-4">
							<Video className="mr-2 h-4 w-4" /> Join Room
						</Button>
						{localStream && (
							<div className="relative">
								<video
									ref={(el) => {
										if (el) el.srcObject = localStream
									}}
									autoPlay
									playsInline
									muted
									className="rounded-lg shadow-lg"
								/>
								<div className="absolute bottom-2 left-2 flex gap-2">
									<Button size="sm" variant="secondary">
										<Mic className="h-4 w-4" />
									</Button>
									<Button size="sm" variant="secondary">
										<Video className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)}
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
						{Object.entries(peerStreams).map(([peerId]) => (
							<div key={peerId} className="relative">
								<video
									ref={(el) => {
										videoRefs.current[peerId] = el
									}}
									autoPlay
									playsInline
									className="rounded-lg shadow-lg"
								>
									<track kind="captions" />
									<track kind="descriptions" />
								</video>
								<div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
									{peerId}
								</div>
								<Button
									size="sm"
									variant="destructive"
									className="absolute bottom-2 right-2"
								>
									<PhoneOff className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
