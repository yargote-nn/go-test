"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useUserInfo } from "@/hooks/use-user-info"
import { useCallStore } from "@/stores/call"
import {
	MessageSquare,
	Mic,
	MicOff,
	PhoneOff,
	Users,
	Video,
	VideoOff,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import Peer from "simple-peer"

export default function VideoCall() {
	const {
		roomId,
		localStream,
		peers,
		messages,
		setRoomId,
		setLocalStream,
		addPeer,
		removePeer,
	} = useCallStore()
	const [isMuted, setIsMuted] = useState(false)
	const [isVideoOff, setIsVideoOff] = useState(false)
	const socketRef = useRef<WebSocket | null>(null)
	const localVideoRef = useRef<HTMLVideoElement>(null)
	const peersRef = useRef<{ [key: string]: Peer.Instance }>({})

	const { userInfo } = useUserInfo()

	useEffect(() => {
		// Get user media
		navigator.mediaDevices
			.getUserMedia({ video: true, audio: true })
			.then((stream) => {
				setLocalStream(stream)
				if (localVideoRef.current) localVideoRef.current.srcObject = stream
			})

		// Connect to WebSocket
		socketRef.current = new WebSocket(
			`ws://localhost:8000/ws/group-call/${roomId}?token=${userInfo?.token}`,
		)
		socketRef.current.onopen = () => console.log("WebSocket Connected")
		socketRef.current.onmessage = (event) =>
			handleServerMessage(JSON.parse(event.data))
		socketRef.current.onclose = (event) =>
			console.log("Socket is closed", event)

		return () => {
			localStream?.getTracks().forEach((track) => track.stop())
			socketRef.current?.close()
			Object.values(peersRef.current).forEach((peer) => peer.destroy())
		}
	}, [userInfo?.token])

	const handleServerMessage = (message: any) => {
		switch (message.type) {
			case "user-joined":
				if (message.userId !== userInfo?.userId) {
					const peer = createPeer(
						message.userId,
						userInfo?.userId ?? "",
						localStream ?? new MediaStream(),
					)
					addPeer(message.userId, peer)
					peersRef.current[message.userId] = peer
				}
				break
			case "user-left":
				if (peers[message.userId]) {
					peers[message.userId].destroy()
					removePeer(message.userId)
					delete peersRef.current[message.userId]
				}
				break
			case "offer":
				handleReceiveOffer(message)
				break
			case "answer":
				handleReceiveAnswer(message)
				break
			case "ice-candidate":
				handleNewICECandidate(message)
				break
		}
	}

	const createPeer = (
		userToSignal: string,
		callerID: string,
		stream: MediaStream,
	) => {
		const peer = new Peer({
			initiator: true,
			trickle: false,
			stream,
		})

		peer.on("signal", (signal) => {
			socketRef.current?.send(
				JSON.stringify({
					type: "offer",
					userToSignal,
					callerID,
					signal,
				}),
			)
		})

		return peer
	}

	const handleReceiveOffer = (incoming: any) => {
		const peer = new Peer({
			initiator: false,
			trickle: false,
			stream: localStream ?? new MediaStream(),
		})

		peer.on("signal", (signal) => {
			socketRef.current?.send(
				JSON.stringify({
					type: "answer",
					callerID: incoming.callerID,
					signal,
				}),
			)
		})

		peer.signal(incoming.signal)
		addPeer(incoming.callerID, peer)
		peersRef.current[incoming.callerID] = peer
	}

	const handleReceiveAnswer = (message: any) => {
		const peer = peersRef.current[message.callerID]
		peer.signal(message.signal)
	}

	const handleNewICECandidate = (incoming: any) => {
		const peer = peersRef.current[incoming.callerID]
		peer.signal(incoming.candidate)
	}

	const toggleAudio = () => {
		if (localStream) {
			localStream.getAudioTracks()[0].enabled =
				!localStream.getAudioTracks()[0].enabled
			setIsMuted(!isMuted)
		}
	}

	const toggleVideo = () => {
		if (localStream) {
			localStream.getVideoTracks()[0].enabled =
				!localStream.getVideoTracks()[0].enabled
			setIsVideoOff(!isVideoOff)
		}
	}

	const leaveCall = () => {
		socketRef.current?.send(JSON.stringify({ type: "leave" }))
		localStream?.getTracks().forEach((track) => track.stop())
		Object.values(peersRef.current).forEach((peer) => peer.destroy())
		setRoomId("")
	}

	return (
		<div className="flex h-screen flex-col bg-gray-100">
			<header className="flex items-center justify-between bg-white p-4 shadow-sm">
				<h1 className="font-semibold text-xl">Meeting: {roomId}</h1>
			</header>

			<div className="flex flex-1 overflow-hidden">
				<main className="grid flex-1 grid-cols-2 gap-4 p-4">
					<div className="flex aspect-video items-center justify-center rounded-lg bg-gray-800">
						<video
							ref={localVideoRef}
							autoPlay
							muted
							playsInline
							className="rounded-lg"
						/>
					</div>
					{Object.entries(peers).map(([peerId, peer]) => (
						<PeerVideo key={peerId} peer={peer} />
					))}
				</main>

				<aside className="w-64 overflow-y-auto bg-white p-4">
					<h2 className="mb-4 font-semibold">Chat</h2>
					<div className="space-y-4">
						{messages.map((msg, index) => (
							<div key={index} className="flex items-start space-x-2">
								<Avatar>
									<AvatarFallback>
										{msg.userId.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div>
									<p className="font-semibold">{msg.userId}</p>
									<p>{msg.content}</p>
								</div>
							</div>
						))}
					</div>
				</aside>
			</div>

			<footer className="bg-white p-4 shadow-sm">
				<div className="flex justify-center space-x-4">
					<Button
						variant={isMuted ? "destructive" : "secondary"}
						size="icon"
						onClick={toggleAudio}
					>
						{isMuted ? (
							<MicOff className="h-4 w-4" />
						) : (
							<Mic className="h-4 w-4" />
						)}
					</Button>
					<Button
						variant={isVideoOff ? "destructive" : "secondary"}
						size="icon"
						onClick={toggleVideo}
					>
						{isVideoOff ? (
							<VideoOff className="h-4 w-4" />
						) : (
							<Video className="h-4 w-4" />
						)}
					</Button>
					<Button variant="destructive" size="icon" onClick={leaveCall}>
						<PhoneOff className="h-4 w-4" />
					</Button>
					<Button variant="secondary" size="icon">
						<MessageSquare className="h-4 w-4" />
					</Button>
					<Button variant="secondary" size="icon">
						<Users className="h-4 w-4" />
					</Button>
				</div>
			</footer>
		</div>
	)
}

function PeerVideo({ peer }: { peer: Peer.Instance }) {
	const ref = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		peer.on("stream", (stream) => {
			if (ref.current) ref.current.srcObject = stream
		})
	}, [peer])

	return (
		<video ref={ref} autoPlay playsInline className="rounded-lg">
			<track kind="captions" />
		</video>
	)
}
