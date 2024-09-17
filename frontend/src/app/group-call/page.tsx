"use client"

import { useGroupCallStore } from "@/stores/group-calls"
import { useUserInfoStore } from "@/stores/user-info"
import { useEffect, useRef } from "react"
import Peer from "simple-peer"

export default function GroupCall() {
	const socket = useGroupCallStore((state) => state.socket)
	const peerConnections = useGroupCallStore((state) => state.peerConnections)
	const localStream = useGroupCallStore((state) => state.localStream)
	const roomId = useGroupCallStore((state) => state.roomId)
	const isVideoEnabled = useGroupCallStore((state) => state.isVideoEnabled)
	const setSocket = useGroupCallStore((state) => state.setSocket)
	const setPeerConnection = useGroupCallStore(
		(state) => state.setPeerConnection,
	)
	const removePeerConnection = useGroupCallStore(
		(state) => state.removePeerConnection,
	)
	const setLocalStream = useGroupCallStore((state) => state.setLocalStream)
	const setIsVideoEnabled = useGroupCallStore(
		(state) => state.setIsVideoEnabled,
	)

	const userInfo = useUserInfoStore((state) => state.userInfo)

	const localVideoRef = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		console.log("userInfo", userInfo)
		connectSocket(userInfo?.token ?? "")
		return () => {
			if (socket) socket.close()
		}
	}, [userInfo?.token])

	useEffect(() => {
		if (localStream && localVideoRef.current) {
			localVideoRef.current.srcObject = localStream
		}
	}, [localStream])

	const connectSocket = (token: string) => {
		console.log("token", token)
		const newSocket = new WebSocket(
			`ws://127.0.0.1:8000/ws/group-call/${roomId}?token=${token}`,
		)
		newSocket.onopen = () => console.log("WebSocket Connected")
		newSocket.onmessage = handleSocketMessage
		newSocket.onerror = (error) => console.error("Socket Error: ", error)
		newSocket.onclose = (event) => console.log("Socket is closed", event)
		setSocket(newSocket)
	}

	const handleSocketMessage = (event: MessageEvent) => {
		const message = JSON.parse(event.data)
		console.log(message)
		switch (message.type) {
			case "user-joined":
				addPeer(message.userId, true)
				break
			case "offer":
				handleOffer(message.from, message.offer)
				break
			case "answer":
				handleAnswer(message.from, message.answer)
				break
			case "ice-candidate":
				handleIceCandidate(message.from, message.candidate)
				break
			case "user-left":
				removePeer(message.userId)
				break
			default:
				console.log("Unhandled message type: ", message.type)
		}
	}

	const sendToServer = (message: any) => {
		if (socket && socket.readyState === WebSocket.OPEN) {
			console.log("Sending Message: ", message)
			socket.send(JSON.stringify(message))
		} else {
			console.error("WebSocket is not Open")
		}
	}

	const addPeer = (peerId: string, initiator: boolean) => {
		if (!localStream) return
		const peer = new Peer({
			initiator,
			stream: localStream,
			trickle: false,
		})

		peer.on("signal", (data) => {
			sendToServer({
				type: initiator ? "offer" : "answer",
				to: peerId,
				[initiator ? "offer" : "answer"]: data,
			})
		})

		peer.on("stream", (stream) => {
			console.log("Received stream from peer:", peerId)
			setPeerConnection(peerId, { peer, stream })

			// Create a new video element for this peer
			const video = document.createElement("video")
			video.srcObject = stream
			video.id = `peer-${peerId}`
			video.autoplay = true
			video.playsInline = true
			document.getElementById("remote-videos")?.appendChild(video)
		})

		setPeerConnection(peerId, { peer, stream: null })
	}

	const handleOffer = (peerId: string, offer: any) => {
		addPeer(peerId, false)
		peerConnections[peerId].peer.signal(offer)
	}

	const handleAnswer = (peerId: string, answer: any) => {
		peerConnections[peerId].peer.signal(answer)
	}

	const handleIceCandidate = (peerId: string, candidate: any) => {
		peerConnections[peerId].peer.signal({ type: "candidate", candidate })
	}

	const removePeer = (peerId: string) => {
		if (peerConnections[peerId]) {
			peerConnections[peerId].peer.destroy()
			removePeerConnection(peerId)

			// Remove the video element for this peer
			const videoElement = document.getElementById(`peer-${peerId}`)
			if (videoElement) {
				videoElement.remove()
			}
		}
	}

	const joinRoom = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: isVideoEnabled,
			})
			setLocalStream(stream)
			sendToServer({ type: "join" })
		} catch (error) {
			console.error("Error accessing media devices:", error)
		}
	}

	const leaveRoom = () => {
		sendToServer({ type: "leave" })
		Object.keys(peerConnections).forEach(removePeer)
		if (localStream) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			localStream.getTracks().forEach((track) => track.stop())
			setLocalStream(null)
		}
	}

	const toggleVideo = () => {
		setIsVideoEnabled(!isVideoEnabled)
		if (localStream) {
			const videoTrack = localStream.getVideoTracks()[0]
			if (videoTrack) {
				videoTrack.enabled = !isVideoEnabled
			}
		}
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
			<h1 className="mb-8 font-bold text-4xl">Group Call</h1>
			<div className="mb-8 space-x-4">
				<button
					type="button"
					className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
					onClick={joinRoom}
				>
					Join Room
				</button>
				<button
					type="button"
					className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
					onClick={leaveRoom}
				>
					Leave Room
				</button>
				<button
					type="button"
					className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
					onClick={toggleVideo}
				>
					Toggle Video
				</button>
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="relative">
					<video
						ref={localVideoRef}
						autoPlay
						playsInline
						muted
						className="h-auto w-full rounded border-4 border-blue-500"
					/>
					<span className="absolute bottom-2 left-2 rounded bg-blue-500 px-2 py-1 text-white">
						You
					</span>
				</div>
				{Object.entries(peerConnections).map(([peerId, { stream }]) => (
					<div key={peerId} className="relative">
						<video
							ref={(el) => {
								if (el && stream) el.srcObject = stream
							}}
							autoPlay
							playsInline
							className="h-auto w-full rounded border-4 border-green-500"
						>
							<track kind="captions" />
						</video>
						<span className="absolute bottom-2 left-2 rounded bg-green-500 px-2 py-1 text-white">
							Peer {peerId}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
