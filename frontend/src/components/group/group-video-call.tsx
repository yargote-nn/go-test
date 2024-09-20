import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUserInfo } from "@/hooks/use-user-info"
import { MicIcon, VideoIcon } from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"
import Peer from "simple-peer"

type PeerData = {
	id: string
	peer: Peer.Instance
	stream: MediaStream
}

const useWebSocket = (url: string) => {
	const [socket, setSocket] = useState<WebSocket | null>(null)

	useEffect(() => {
		const ws = new WebSocket(url)
		setSocket(ws)

		return () => {
			ws.close()
		}
	}, [url])

	return socket
}

export default function GroupVideoCall() {
	const { userInfo } = useUserInfo()
	const [roomId, setRoomId] = useState("123")
	const peersRef = useRef<{ [key: string]: PeerData }>({})
	const pendingUsersRef = useRef<string[]>([])
	const localStreamRef = useRef<MediaStream | null>(null)
	const peersArrayRef = useRef<PeerData[]>([])

	const wsUrl = `ws://localhost:8000/ws/group-call/${roomId}?token=${userInfo?.token}`
	const socket = useWebSocket(wsUrl)

	const createPeer = useCallback(
		(userId: string, stream: MediaStream, initiator: boolean) => {
			console.log("createPeer ", userId, initiator)
			const peer = new Peer({
				initiator,
				trickle: false,
				stream,
			})

			peer.on("signal", (signal) => {
				socket?.send(
					JSON.stringify({
						type: initiator ? "offer" : "answer",
						to: userId,
						[initiator ? "offer" : "answer"]: signal,
					}),
				)
			})

			peer.on("stream", (remoteStream) => {
				const newPeer = { id: userId, peer, stream: remoteStream }
				peersArrayRef.current = [...peersArrayRef.current, newPeer]
				// Force re-render
				setPeerUpdateTrigger((prev) => !prev)
			})

			return peer
		},
		[socket],
	)

	const handleUserJoined = useCallback(
		(userId: string) => {
			console.log("handleUserJoined", userId, localStreamRef.current)
			if (localStreamRef.current) {
				const peer = createPeer(userId, localStreamRef.current, true)
				console.log("Created peer:", peer)
				peersRef.current[userId] = {
					id: userId,
					peer,
					stream: new MediaStream(),
				}
			} else {
				// If localStream is not ready, add the user to a pending list
				pendingUsersRef.current.push(userId)
			}
		},
		[createPeer],
	)
	const findPeerByUserId = (targetUserId: string) => {
		const entry = Object.entries(peersRef.current).find(([userId]) =>
			userId.includes(targetUserId),
		)
		return entry ? { userId: entry[0], peer: entry[1] } : null
	}

	const handleOffer = useCallback(
		(userId: string, signal: Peer.SignalData) => {
			console.log("handleOffer", userId, signal)
			if (!findPeerByUserId(userId) && localStreamRef.current) {
				const peer = createPeer(userId, localStreamRef.current, false)
				peer.signal(signal)
				peersRef.current[userId] = {
					id: userId,
					peer,
					stream: new MediaStream(),
				}
			} else {
				console.log("Received offer but localStream is not ready")
			}
		},
		[createPeer],
	)

	const handleAnswer = useCallback(
		(userId: string, signal: Peer.SignalData) => {
			console.log("handleAnswer", userId, signal)
			peersRef.current[userId]?.peer.signal(signal)
		},
		[],
	)

	const handleUserLeft = useCallback((userId: string) => {
		console.log("handleUserLeft", userId)
		peersArrayRef.current = peersArrayRef.current.filter(
			(peer) => peer.id !== userId,
		)
		if (peersRef.current[userId]) {
			peersRef.current[userId].peer.destroy()
			delete peersRef.current[userId]
		}
		// Force re-render
		setPeerUpdateTrigger((prev) => !prev)
	}, [])

	const [peerUpdateTrigger, setPeerUpdateTrigger] = useState(false)

	useEffect(() => {
		if (socket) {
			socket.onopen = () => {
				console.log("WebSocket Connected")
				socket.send(JSON.stringify({ type: "join" }))
			}

			socket.onmessage = (event) => {
				const message = JSON.parse(event.data)
				console.log("Received message:", message.type)
				switch (message.type) {
					case "user-joined":
						handleUserJoined(message.userId)
						break
					case "offer":
						handleOffer(message.from, message.offer)
						break
					case "answer":
						handleAnswer(message.from, message.answer)
						break
					case "user-left":
						handleUserLeft(message.userId)
						break
				}
			}

			socket.onclose = (event) => console.log("Socket is closed", event)
		}
	}, [socket, handleUserJoined, handleOffer, handleAnswer, handleUserLeft])

	useEffect(() => {
		if (localStreamRef.current) {
			pendingUsersRef.current.forEach((userId) => {
				handleUserJoined(userId)
			})
			pendingUsersRef.current = []
		}
	}, [peerUpdateTrigger, handleUserJoined])

	const joinRoom = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true,
			})
			localStreamRef.current = stream
			setPeerUpdateTrigger((prev) => !prev)
		} catch (error) {
			console.error("Error accessing media devices:", error)
		}
	}, [])

	const leaveRoom = useCallback(() => {
		socket?.send(JSON.stringify({ type: "leave" }))
		socket?.close()
		localStreamRef.current?.getTracks().forEach((track) => track.stop())
		Object.values(peersRef.current).forEach(({ peer }) => peer.destroy())
		peersArrayRef.current = []
		localStreamRef.current = null
		peersRef.current = {}
		setPeerUpdateTrigger((prev) => !prev)
	}, [socket])

	const VideoCard = React.memo(({ stream }: { stream: MediaStream }) => (
		<Card className="relative overflow-hidden">
			<video
				ref={(video) => {
					if (video) video.srcObject = stream
				}}
				autoPlay
				muted={stream === localStreamRef.current}
				playsInline
				className="h-full w-full object-cover"
			/>
			{stream === localStreamRef.current && (
				<div className="absolute bottom-2 left-2 flex space-x-2">
					<Button size="icon" variant="secondary">
						<MicIcon className="h-4 w-4" />
					</Button>
					<Button size="icon" variant="secondary">
						<VideoIcon className="h-4 w-4" />
					</Button>
				</div>
			)}
		</Card>
	))

	return (
		<div className="container mx-auto p-4">
			<Card className="mb-4">
				<CardContent className="p-4">
					<div className="flex items-center space-x-4">
						<Label htmlFor="room-id">Room ID</Label>
						<Input
							id="room-id"
							value={roomId}
							onChange={(e) => setRoomId(e.target.value)}
							placeholder="Enter room ID"
							className="flex-grow"
						/>
						<Button
							onClick={joinRoom}
							disabled={!roomId || !!localStreamRef.current}
						>
							Join Room
						</Button>
						<Button
							onClick={leaveRoom}
							variant="destructive"
							disabled={!localStreamRef.current}
						>
							Leave Room
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{localStreamRef.current && (
					<VideoCard stream={localStreamRef.current} />
				)}
				{peersArrayRef.current.map((peer) => (
					<VideoCard key={peer.id} stream={peer.stream} />
				))}
			</div>
		</div>
	)
}
