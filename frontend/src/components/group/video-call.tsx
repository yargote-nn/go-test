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
	const pendingOffersRef = useRef<{ [key: string]: RTCSessionDescriptionInit }>(
		{},
	)

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

	const createPeer = (
		userId: string,
		initiator: boolean,
		offer?: RTCSessionDescriptionInit,
	) => {
		console.log(`Creating peer. Initiator: ${initiator}, UserId: ${userId}`)
		const peer = new Peer({
			initiator,
			trickle: false,
			stream: localStream as MediaStream,
		})

		let signalSent = false

		peer.on("signal", (signal) => {
			if (signalSent) return
			signalSent = true

			console.log(`Signaling ${initiator ? "offer" : "answer"} to ${userId}`)
			wSocketRef.current?.send(
				JSON.stringify({
					type: initiator ? "offer" : "answer",
					to: userId,
					[initiator ? "offer" : "answer"]: signal,
				}),
			)
		})

		peer.on("connect", () => {
			console.log(`Connected to peer ${userId}`)
		})

		peer.on("error", (err) => {
			console.error(`Peer connection error with ${userId}:`, err)
			// Attempt to recreate the peer connection
			setTimeout(() => {
				console.log(`Attempting to recreate peer connection with ${userId}`)
				peer.destroy()
				delete peersRef.current[userId]
				createPeer(userId, true)
			}, 1000)
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

		if (offer) {
			peer.signal(offer)
		}

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
					if (peersRef.current[message.from]) {
						console.log(
							`Peer already exists for ${message.from}, storing offer`,
						)
						pendingOffersRef.current[message.from] = message.offer
					} else {
						const peer = createPeer(message.from, false, message.offer)
						peersRef.current[message.from] = peer
					}
				}
				break
			case "answer":
				if (message.from !== userInfo?.userId) {
					console.log(`Answer from: ${message.from}`)
					const peer = peersRef.current[message.from]
					if (peer) {
						console.log(`Updating signal for ${message.from}`)
						peer.signal(message.answer)
					} else {
						console.error(`No peer found for user ${message.from}`)
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
		<div className="flex h-screen flex-col bg-gray-100">
			<header className="flex items-center justify-between bg-white p-4 shadow-sm">
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
