"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Phone, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";

type CallStatus = "idle" | "calling" | "incomingCall" | "connected";

export default function Calls() {
	const [userId, setUserId] = useState("");
	const [targetId, setTargetId] = useState("");
	const [callStatus, setCallStatus] = useState<CallStatus>("idle");
	const [isVideoEnabled, setIsVideoEnabled] = useState(false);
	const [incomingCallFrom, setIncomingCallFrom] = useState("");
	const [token, setToken] = useState("");
	const [signal, setSignal] = useState("");

	const socketRef = useRef<WebSocket | null>(null);
	const peerRef = useRef<Peer.Instance | null>(null);
	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	const router = useRouter();

	useEffect(() => {
		const storedToken = localStorage.getItem("token");
		if (!storedToken) {
			router.push("/login");
			return;
		}
		setToken(storedToken);
	}, [router]);

	useEffect(() => {
		if (token) {
			connectWebSocket();
		}
	}, [token]);

	const connectWebSocket = () => {
		socketRef.current = new WebSocket(
			`ws://localhost:8000/ws/webrtc?token=${token}`,
		);

		socketRef.current.onopen = () => console.log("WebSocket Connected");
		socketRef.current.onclose = () => console.log("WebSocket Disconnected");

		socketRef.current.onmessage = (event) => {
			const data = JSON.parse(event.data);
			handleIncomingMessage(data);
		};
	};

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const handleIncomingMessage = (data: any) => {
		switch (data.type) {
			case "call":
				setIncomingCallFrom(data.from);
				setCallStatus("incomingCall");
				setSignal(data.signal);
				break;
			case "accept-call":
				setIncomingCallFrom(data.from);
				peerRef.current?.signal(JSON.parse(data.signal));
				break;
			case "end":
				endCall();
				break;
		}
	};

	const sendMessage = (message: object) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify(message));
		}
	};

	const startCall = (isAccepting = false) => {
		navigator.mediaDevices
			.getUserMedia({ video: isVideoEnabled, audio: true })
			.then((stream) => {
				if (localVideoRef.current) {
					localVideoRef.current.srcObject = stream;
				}

				peerRef.current = new Peer({
					initiator: !isAccepting,
					trickle: false,
					stream: stream,
				});

				peerRef.current.on("signal", (data) => {
					sendMessage({
						type: isAccepting ? "accept-call" : "call",
						to: isAccepting ? incomingCallFrom : targetId,
						signal: data,
					});
				});

				peerRef.current.on("stream", (remoteStream) => {
					if (remoteVideoRef.current) {
						remoteVideoRef.current.srcObject = remoteStream;
					}
				});

				if (isAccepting && signal) {
					peerRef.current.signal(signal);
				}

				setCallStatus("connected");
			})
			.catch((err) => console.error("Error accessing media devices:", err));
	};

	const acceptCall = () => {
		startCall(true);
	};

	const declineCall = () => {
		console.log("Declining call", incomingCallFrom);
		sendMessage({
			type: "end",
			to: incomingCallFrom,
			signal: {},
		});
		setCallStatus("idle");
		setIncomingCallFrom("");
	};

	const endCall = () => {
		if (peerRef.current) {
			peerRef.current.destroy();
		}
		if (
			localVideoRef.current &&
			localVideoRef.current.srcObject instanceof MediaStream
		) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			localVideoRef.current.srcObject
				.getTracks()
				.forEach((track) => track.stop());
		}
		if (
			remoteVideoRef.current &&
			remoteVideoRef.current.srcObject instanceof MediaStream
		) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			remoteVideoRef.current.srcObject
				.getTracks()
				.forEach((track) => track.stop());
		}
		const message = {
			type: "end",
			to: incomingCallFrom,
			signal: {},
		};
		if (message.to) {
			sendMessage(message);
		}
		setCallStatus("idle");
		setIncomingCallFrom("");
	};

	return (
		<Card className="w-full max-w-md mx-auto">
			<CardContent className="p-6">
				<div className="flex flex-col space-y-4">
					<Input
						type="text"
						placeholder="Your User ID"
						value={userId}
						onChange={(e) => setUserId(e.target.value)}
					/>
					<Input
						type="text"
						placeholder="Target User ID"
						value={targetId}
						onChange={(e) => setTargetId(e.target.value)}
					/>
					<div className="flex justify-between">
						<Button
							onClick={() => setIsVideoEnabled(!isVideoEnabled)}
							variant={isVideoEnabled ? "default" : "outline"}
						>
							<Video className="mr-2 h-4 w-4" />
							{isVideoEnabled ? "Disable Video" : "Enable Video"}
						</Button>
						{callStatus === "idle" && (
							<Button onClick={() => startCall()} disabled={!targetId}>
								<Phone className="mr-2 h-4 w-4" />
								Start Call
							</Button>
						)}
						{callStatus === "connected" && (
							<Button onClick={endCall} variant="destructive">
								<X className="mr-2 h-4 w-4" />
								End Call
							</Button>
						)}
					</div>
					{callStatus === "incomingCall" && (
						<div className="flex justify-between">
							<Button onClick={acceptCall}>Accept Call</Button>
							<Button onClick={declineCall} variant="destructive">
								Decline Call
							</Button>
						</div>
					)}
					<div className="relative w-full aspect-video bg-gray-200 rounded-lg overflow-hidden">
						{callStatus === "connected" && (
							<>
								{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
								<video
									ref={remoteVideoRef}
									autoPlay
									playsInline
									className="absolute inset-0 w-full h-full object-cover"
								/>
								<video
									ref={localVideoRef}
									autoPlay
									playsInline
									muted
									className="absolute bottom-4 right-4 w-1/4 h-1/4 object-cover rounded-lg"
								/>
							</>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
