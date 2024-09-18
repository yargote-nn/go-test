import { useCallStore } from "@/stores/call"
import { useUserInfoStore } from "@/stores/user-info"
import { useCallback, useEffect, useState } from "react"

const GroupCall = () => {
	const [peers, setPeers] = useState({})
	const [localStream, setLocalStream] = useState<MediaStream | null>(null)
	const [socket, setSocket] = useState<WebSocket | null>(null)
	const roomId = useCallStore((state) => state.roomId)
	const userInfo = useUserInfoStore((state) => state.userInfo)

	useEffect(() => {
		if (!roomId) return

		const ws = new WebSocket(
			`ws://localhost:8000/ws/group-call/${roomId}?token=${userInfo?.token}`,
		)
		setSocket(ws)

		ws.onopen = () => {
			console.log("WebSocket connection established")
			ws.send(JSON.stringify({ type: "join" }))
		}

		ws.onmessage = (event) => {
			const message = JSON.parse(event.data)
			handleSignaling(message)
		}

		return () => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "leave" }))
			}
			ws.close()
		}
	}, [roomId, userInfo])

	useEffect(() => {
		navigator.mediaDevices
			.getUserMedia({ video: true, audio: true })
			.then((stream) => {
				setLocalStream(stream)
			})
			.catch((error) => {
				console.error("Error accessing media devices:", error)
			})

		return () => {
			if (localStream) {
				localStream.getTracks().forEach((track) => track.stop())
			}
		}
	}, [])

	const handleSignaling = useCallback(
		(message) => {
			switch (message.type) {
				case "user-joined":
					createPeerConnection(message.userId)
					break
				case "offer":
					handleOffer(message.from, message.offer)
					break
				case "answer":
					handleAnswer(message.from, message.answer)
					break
				case "user-left":
					removePeer(message.userId)
					break
				default:
					console.log("Unknown message type:", message.type)
			}
		},
		[localStream, peers],
	)

	const createPeerConnection = useCallback(
		(userId) => {
			const pc = new RTCPeerConnection()

			pc.onicecandidate = (event) => {
				if (event.candidate) {
					socket.send(
						JSON.stringify({
							type: "ice-candidate",
							to: userId,
							candidate: event.candidate,
						}),
					)
				}
			}

			pc.ontrack = (event) => {
				setPeers((prevPeers) => ({
					...prevPeers,
					[userId]: { ...prevPeers[userId], stream: event.streams[0] },
				}))
			}

			if (localStream) {
				localStream
					.getTracks()
					.forEach((track) => pc.addTrack(track, localStream))
			}

			setPeers((prevPeers) => ({ ...prevPeers, [userId]: { pc } }))

			pc.createOffer()
				.then((offer) => pc.setLocalDescription(offer))
				.then(() => {
					socket.send(
						JSON.stringify({
							type: "offer",
							to: userId,
							offer: pc.localDescription,
						}),
					)
				})
		},
		[localStream, socket],
	)

	const handleOffer = useCallback(
		(from, offer) => {
			const pc = new RTCPeerConnection()

			pc.onicecandidate = (event) => {
				if (event.candidate) {
					socket.send(
						JSON.stringify({
							type: "ice-candidate",
							to: from,
							candidate: event.candidate,
						}),
					)
				}
			}

			pc.ontrack = (event) => {
				setPeers((prevPeers) => ({
					...prevPeers,
					[from]: { ...prevPeers[from], stream: event.streams[0] },
				}))
			}

			if (localStream) {
				localStream
					.getTracks()
					.forEach((track) => pc.addTrack(track, localStream))
			}

			pc.setRemoteDescription(new RTCSessionDescription(offer))
				.then(() => pc.createAnswer())
				.then((answer) => pc.setLocalDescription(answer))
				.then(() => {
					socket.send(
						JSON.stringify({
							type: "answer",
							to: from,
							answer: pc.localDescription,
						}),
					)
				})

			setPeers((prevPeers) => ({ ...prevPeers, [from]: { pc } }))
		},
		[localStream, socket],
	)

	const handleAnswer = useCallback(
		(from, answer) => {
			const pc = peers[from]?.pc
			if (pc) {
				pc.setRemoteDescription(new RTCSessionDescription(answer))
			}
		},
		[peers],
	)

	const removePeer = useCallback((userId) => {
		setPeers((prevPeers) => {
			const newPeers = { ...prevPeers }
			if (newPeers[userId]) {
				newPeers[userId].pc.close()
				delete newPeers[userId]
			}
			return newPeers
		})
	}, [])

	return (
		<div className="grid grid-cols-2 gap-4 p-4">
			<div>
				<h2 className="text-xl font-bold mb-2">Local Stream</h2>
				{localStream && (
					<video
						autoPlay
						muted
						ref={(video) => {
							if (video) video.srcObject = localStream
						}}
						className="w-full h-auto"
					/>
				)}
			</div>
			{Object.entries(peers).map(([userId, peer]) => (
				<div key={userId}>
					<h2 className="text-xl font-bold mb-2">Peer: {userId}</h2>
					{peer.stream && (
						<video
							autoPlay
							ref={(video) => {
								if (video) video.srcObject = peer.stream
							}}
							className="w-full h-auto"
						/>
					)}
				</div>
			))}
		</div>
	)
}

export default GroupCall
