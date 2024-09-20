import { useUserInfo } from "@/hooks/use-user-info"
import { useCallStore } from "@/stores/call"
import { useEffect, useRef, useState } from "react"
import Peer from "simple-peer"

export function VideoCall() {
	const { userInfo } = useUserInfo()
	const roomId = useCallStore((state) => state.roomId)
	const [localStream, setLocalStream] = useState<MediaStream | null>(null)

	const wSocketRef = useRef<WebSocket | null>(null)
	const peersRef = useRef<{ [key: string]: Peer.Instance }>({})

	useEffect(() => {
		const stream = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
					video: true,
				})
				setLocalStream(stream)
			} catch (error) {
				console.error("Error accessing media devices:", error)
			}
		}
		stream()
	}, [])

	const createPeer = (userId: string, initiator: boolean) => {
		console.log(
			`Creating peer. Initiator: ${initiator}, UserId: ${userId} hola`,
		)
		const peer = new Peer({
			initiator,
			trickle: false,
			stream: localStream as MediaStream,
		})

		peer.on("signal", (data) => {
			console.log(
				`Signaling ${initiator ? "offer" : "answer"} to ${userId} ${JSON.stringify(data.type)}`,
			)
			if (data.type === "offer" || data.type === "answer") {
				wSocketRef.current?.send(
					JSON.stringify({
						type: data.type,
						to: userId,
						[data.type]: data,
					}),
				)
			} else if (data.type === "candidate") {
				wSocketRef.current?.send(
					JSON.stringify({
						type: "ice-candidate",
						to: userId,
						candidate: data.candidate,
					}),
				)
			}
		})

		peer.on("connect", () => {
			console.log(`Connected to peer ${userId}`)
		})

		peer.on("error", (err) => {
			console.error(`Peer connection error with ${userId}:`, err)
			peer.destroy()
			delete peersRef.current[userId]
		})

		peer.on("stream", (stream) => {
			console.log(`Received stream from ${userId}`)
			const video = document.createElement("video")
			video.srcObject = stream
			video.id = `peer-${userId}-video`
			video.autoplay = true
			video.playsInline = true
			video.className = "rounded-lg max-w-sm"
			document.getElementById("remote-videos")?.appendChild(video)
		})

		return peer
	}

	const handleServerMessage = (message: any) => {
		console.log("Received server message:", message)
		switch (message.type) {
			case "user-joined":
				if (message.userId !== userInfo?.userId && localStream) {
					console.log(`User joined: ${message.userId}`)
					const peer = createPeer(message.userId, true)
					peersRef.current[message.userId] = peer
				}
				break
			case "offer":
				if (message.from !== userInfo?.userId && localStream) {
					console.log(`Offer from: ${message.from}`)
					const peer = createPeer(message.from, false)
					peer.signal(message.offer)
					peersRef.current[message.from] = peer
				}
				break
			case "answer":
				if (message.from !== userInfo?.userId) {
					console.log(`Answer from: ${message.from}`)
					const peer = peersRef.current[message.from]
					if (peer) {
						peer.signal(message.answer)
					}
				}
				break
			case "ice-candidate":
				if (message.from !== userInfo?.userId) {
					console.log(`ICE candidate from: ${message.from}`)
					const peer = peersRef.current[message.from]
					if (peer) {
						peer.signal(message.candidate)
					}
				}
				break
			case "user-left":
				if (message.userId !== userInfo?.userId) {
					console.log(`User left: ${message.userId}`)
					if (peersRef.current[message.userId]) {
						peersRef.current[message.userId].destroy()
						delete peersRef.current[message.userId]
						const video = document.getElementById(
							`peer-${message.userId}-video`,
						)
						video?.remove()
					}
				}
				break
		}
	}

	useEffect(() => {
		if (!localStream || !userInfo?.token) return

		console.log("Connecting to WebSocket")
		const ws = new WebSocket(
			`ws://localhost:8000/ws/group-call/${roomId}?token=${userInfo.token}`,
		)
		ws.onopen = () => {
			console.log("WebSocket Connected")
			ws?.send(JSON.stringify({ type: "join" }))
		}
		ws.onmessage = (event) => handleServerMessage(JSON.parse(event.data))
		ws.onclose = (event) => console.log("Socket is closed", event)

		wSocketRef.current = ws

		return () => {
			console.log("Cleaning up connections")
			Object.values(peersRef.current).forEach((peer) => peer.destroy())
			ws.close()
		}
	}, [userInfo?.token, localStream, roomId])

	return (
		<div className="flex h-screen flex-col">
			<header className="flex items-center justify-between p-4 shadow-sm">
				<h1 className="font-semibold text-xl">
					Meeting: {roomId} - {userInfo?.nickname}
				</h1>
			</header>
			<div id="remote-videos" className="flex size-full flex-1 overflow-hidden">
				{localStream && (
					<video
						className="max-w-sm rounded-lg"
						ref={(el) => {
							if (el && localStream) el.srcObject = localStream
						}}
						autoPlay
						muted
						playsInline
					/>
				)}
			</div>
		</div>
	)
}
