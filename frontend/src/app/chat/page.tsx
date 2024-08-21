"use client";

import { FileInfo } from "@/components/file-info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { encryptMessage } from "@/lib/crypto";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

const RTCSignalSchema = z.object({
	type: z.string(),
	sdp: z.string().optional(),
	candidate: z.string().optional(),
	sdpMLineIndex: z.number().optional(),
	sdpMid: z.string().optional(),
});

const UserSchema = z.object({
	id: z.number(),
	username: z.string(),
	public_key: z.string(),
});

const UserResponseSchema = z.object({
	user: UserSchema,
});

const WSMessageSchema = z.object({
	type: z.string(),
	sender_id: z.number(),
	receiver_id: z.number(),
	content: z.string(),
	aes_key_sender: z.string().optional(),
	aes_key_receiver: z.string().optional(),
	message_id: z.number().optional(),
	status: z.string().optional(),
	file_attachments: z.string().optional(),
	rtc_signal: RTCSignalSchema.optional(),
});

type WSMessage = z.infer<typeof WSMessageSchema>;

const FileUploadSchema = z.object({
	file_name: z.string(),
	file_size: z.number(),
	file_type: z.string(),
	file_url: z.string(),
});

type FileUpload = z.infer<typeof FileUploadSchema>;

const FileUploadsSchema = z.array(FileUploadSchema);

type FileUploads = z.infer<typeof FileUploadsSchema>;

const MessageSchema = z.object({
	id: z.number(),
	sender_id: z.number(),
	receiver_id: z.number(),
	content: z.string(),
	status: z.string(),
	expires_at: z.string(),
	aes_key_receiver: z.string().optional(),
	aes_key_sender: z.string().optional(),
	file_attachments: FileUploadsSchema.nullable(),
});

type Message = z.infer<typeof MessageSchema>;

const MessageResponseSchema = z.array(MessageSchema);

type MessageResponse = z.infer<typeof MessageResponseSchema>;

export default function Chat() {
	const [username, setUsername] = useState("");
	const [messages, setMessages] = useState<MessageResponse>([]);
	const [partnerId, setPartnerId] = useState("");
	const [partnerPublicKey, setPartnerPublicKey] = useState("");
	const [userId, setUserId] = useState("");
	const [newMessage, setNewMessage] = useState("");
	const [token, setToken] = useState("");
	const [privateKey, setPrivateKey] = useState("");
	const [publicKey, setPublicKey] = useState("");
	const [fileUploads, setFileUploads] = useState<FileUploads>([]);
	const router = useRouter();
	const { toast } = useToast();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const wsRef = useRef<WebSocket | null>(null);

	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
	const [isCallActive, setIsCallActive] = useState(false);
	const [isVideoEnabled, setIsVideoEnabled] = useState(true);
	const peerConnection = useRef<RTCPeerConnection | null>(null);
	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	const [isWebSocketReady, setIsWebSocketReady] = useState(false);

	const sendStatusUpdate = useCallback((messageId: number, status: string) => {
		console.log("Sending status update:", messageId, status);
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			console.log("WebSocket is open, sending status update");
			wsRef.current.send(
				JSON.stringify({
					type: "status_update",
					message_id: messageId,
					status: status,
				}),
			);
		}
	}, []);

	useEffect(() => {
		const fetchPartnerInfo = async () => {
			try {
				const response = await fetch(
					`http://localhost:8080/api/users/${partnerId}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (response.ok) {
					const responseData = await response.json();
					const { data, success } = UserResponseSchema.safeParse(responseData);
					if (success) {
						const { user } = data;
						setPartnerPublicKey(user.public_key);
						fetchMessages();
					} else {
						toast({
							title: "No partner valid",
						});
					}
				} else {
					toast({
						title: "No partner found",
					});
				}
			} catch (error) {
				console.error("Error fetching partner info:", error);
				toast({
					title: "Error",
					description: "Please try again. Failed to fetch partner info",
					variant: "destructive",
				});
			}
		};

		const fetchMessages = async () => {
			try {
				const response = await fetch(
					`http://localhost:8080/api/messages?partner_id=${partnerId}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (response.ok) {
					const dataResponse = await response.json();
					const { data, success } =
						MessageResponseSchema.safeParse(dataResponse);
					if (success) {
						const decryptedMessages = await Promise.all(
							data.map(async (message) => {
								if (
									message.receiver_id === Number(userId) &&
									message.aes_key_receiver
								) {
									const response = await fetch("/api/decrypt", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											encryptedMessage: message.content,
											encryptedAESKey: message.aes_key_receiver,
											privateKey,
											fileUploads: message.file_attachments ?? [],
										}),
									});
									const { decryptedMessage, decryptedFileUploads } =
										await response.json();
									message.content = decryptedMessage;
									message.file_attachments = decryptedFileUploads;
								} else if (
									message.sender_id === Number(userId) &&
									message.aes_key_sender
								) {
									const response = await fetch("/api/decrypt", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											encryptedMessage: message.content,
											encryptedAESKey: message.aes_key_sender,
											privateKey,
											fileUploads: message.file_attachments ?? [],
										}),
									});
									const { decryptedMessage, decryptedFileUploads } =
										await response.json();
									message.content = decryptedMessage;
									message.file_attachments = decryptedFileUploads;
								}

								if (
									message.status === "sent" &&
									message.sender_id !== Number(userId)
								) {
									message.status = "received";
									sendStatusUpdate(message.id, "received");
								}
								return message;
							}),
						);
						setMessages(decryptedMessages.reverse());
					} else {
						setMessages([]);
						toast({
							title: "No messages found",
						});
					}
				} else {
					setMessages([]);
					toast({
						title: "Fetch messages failed",
					});
				}
			} catch (error) {
				console.error("Error fetching messages:", error);
				toast({
					title: "Error",
					description: JSON.stringify(error),
					variant: "destructive",
				});
			}
		};

		if (partnerId && token && privateKey && userId) {
			fetchPartnerInfo();
		}
	}, [partnerId, toast, token, privateKey, userId, sendStatusUpdate]);

	const handleNewMessage = useCallback(
		async (data: WSMessage) => {
			console.log("New message received:", data);
			try {
				let decryptedContent = data.content;
				let decryptedFileUploads: FileUploads = [];
				if (data.receiver_id === Number(userId) && data.aes_key_receiver) {
					const response = await fetch("/api/decrypt", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							encryptedMessage: data.content,
							encryptedAESKey: data.aes_key_receiver,
							privateKey,
							fileUploads: data.file_attachments ?? [],
						}),
					});
					const { decryptedMessage, decryptedFileUploads: fileUploads } =
						await response.json();
					decryptedContent = decryptedMessage;
					decryptedFileUploads = fileUploads;
				} else if (data.sender_id === Number(userId) && data.aes_key_sender) {
					const response = await fetch("/api/decrypt", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							encryptedMessage: data.content,
							encryptedAESKey: data.aes_key_sender,
							privateKey,
							fileUploads: data.file_attachments ?? [],
						}),
					});
					const { decryptedMessage, decryptedFileUploads: fileUploads } =
						await response.json();
					decryptedContent = decryptedMessage;
					decryptedFileUploads = fileUploads;
				}
				console.log("Decrypted message:", decryptedContent);
				console.log("Decrypted file uploads:", decryptedFileUploads);

				let parsedFileAttachments: FileUploads = [];
				if (decryptedFileUploads.length > 0) {
					try {
						const { data: attachments, success } =
							FileUploadsSchema.safeParse(decryptedFileUploads);
						if (success) {
							parsedFileAttachments = attachments;
						}
					} catch (error) {
						console.error("Error parsing file attachments:", error);
					}
				}

				const newMessage: Message = {
					id: data.message_id ?? -1,
					sender_id: data.sender_id,
					receiver_id: data.receiver_id,
					content: decryptedContent,
					status: "received",
					expires_at: new Date().toISOString(),
					aes_key_receiver: data.aes_key_receiver,
					aes_key_sender: data.aes_key_sender,
					file_attachments: parsedFileAttachments,
				};

				setMessages((prev) => [...prev, newMessage]);

				if (data.message_id) {
					sendStatusUpdate(data.message_id, "received");
				}
			} catch (error) {
				console.error("Error processing new message:", error);
				toast({
					title: "Error",
					description: "Failed to process new message",
					variant: "destructive",
				});
			}
		},
		[privateKey, toast, sendStatusUpdate, userId],
	);

	const handleStatusUpdate = useCallback((data: WSMessage) => {
		console.log("Status update:", data.status, data.message_id);
		setMessages((prev) =>
			prev.map((message) => {
				if (message.id === data.message_id) {
					return { ...message, status: data.status || "sent" };
				}
				return message;
			}),
		);
	}, []);

	const handleMessageSent = useCallback((data: WSMessage) => {
		console.log("Message sent:", data.status);
		setMessages((prev) =>
			prev.map((message) =>
				message.id === -1
					? {
							...message,
							status: data.status || "sent",
							id: data.message_id ?? -1,
						}
					: message,
			),
		);
	}, []);

	useEffect(() => {
		const token = localStorage.getItem("token");
		const userId = localStorage.getItem("user_id");
		const username = localStorage.getItem("username");
		const privateKey = localStorage.getItem(`private_key_${userId}`);
		const publicKey = localStorage.getItem(`public_key_${userId}`);

		if (!token || !userId || !username || !privateKey || !publicKey) {
			router.push("/login");
			return;
		}

		setToken(token);
		setUserId(userId);
		setUsername(username);
		setPrivateKey(privateKey);
		setPublicKey(publicKey);

		const websocket = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
		wsRef.current = websocket;

		websocket.onopen = () => {
			console.log("WebSocket connection established");
			setIsWebSocketReady(true);
		};

		websocket.onmessage = async (event) => {
			const { data, success } = WSMessageSchema.safeParse(
				JSON.parse(event.data),
			);
			if (success) {
				switch (data.type) {
					case "new_message":
						await handleNewMessage(data);
						break;
					case "message_sent":
						handleMessageSent(data);
						break;
					case "status_update":
						handleStatusUpdate(data);
						break;
					case "rtc_signal":
						if (data.rtc_signal) {
							handleWebRTCSignal(data.rtc_signal);
						}
						break;
					default:
						console.log("Unknown message type:", data.type);
				}
			}
		};

		websocket.onerror = (event) => {
			console.error("WebSocket error:", event);
			setIsWebSocketReady(false);
		};

		websocket.onclose = (event) => {
			console.log("WebSocket connection closed:", event);
			setIsWebSocketReady(false);
		};

		return () => {
			websocket.close();
		};
	}, [router, handleNewMessage, handleStatusUpdate, handleMessageSent]);

	// useEffect(() => {
	// 	messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	// }, []);

	const sendMessageCallback = useCallback(async () => {
		if (!isWebSocketReady) {
			toast({
				title: "Error",
				description: "WebSocket connection is not ready. Please try again.",
				variant: "destructive",
			});
			return;
		}

		if (!newMessage.trim() && fileUploads.length === 0) {
			toast({
				title: "Error",
				description:
					"Message cannot be empty and must have at least one attachment.",
				variant: "destructive",
			});
			return;
		}

		const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
		const expiresAt = tomorrow.toISOString();

		try {
			const {
				encryptedMessage,
				encryptedAESKeyReceiver,
				encryptedAESKeySender,
				encryptedFilesUploads,
			} = await encryptMessage(
				newMessage,
				partnerPublicKey,
				publicKey,
				fileUploads,
			);

			if (wsRef.current?.readyState === WebSocket.OPEN) {
				const messageToSend = JSON.stringify({
					type: "message",
					content: encryptedMessage,
					receiver_id: Number(partnerId),
					aes_key_sender: encryptedAESKeySender,
					aes_key_receiver: encryptedAESKeyReceiver,
					expires_at: expiresAt,
					file_attachments: JSON.stringify(encryptedFilesUploads),
				});
				console.log("Message to send:", messageToSend);

				wsRef.current.send(messageToSend);

				const message: Message = {
					id: -1, // Temporary ID
					sender_id: Number(userId),
					content: newMessage,
					status: "sent",
					receiver_id: Number(partnerId),
					aes_key_sender: encryptedAESKeySender,
					aes_key_receiver: encryptedAESKeyReceiver,
					expires_at: expiresAt,
					file_attachments: fileUploads,
				};

				setMessages((prev) => [...prev, message]);
				setNewMessage("");
				setFileUploads([]);
			} else {
				throw new Error("WebSocket is not in OPEN state");
			}
		} catch (error) {
			console.error("Failed to send message:", error);
			toast({
				title: "Error",
				description: "Failed to send message. Please try again.",
				variant: "destructive",
			});
		}
	}, [
		newMessage,
		partnerId,
		partnerPublicKey,
		userId,
		isWebSocketReady,
		toast,
		publicKey,
		fileUploads,
	]);

	const sendMessage = (e: React.FormEvent) => {
		e.preventDefault();
		sendMessageCallback();
	};

	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(event.target.files || []);
		if (files.length === 0) return;

		const formData = new FormData();
		// biome-ignore lint/complexity/noForEach: <explanation>
		files.forEach((file) => formData.append("files", file));

		try {
			const response = await fetch(
				"http://localhost:8080/api/upload-multiple",
				{
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				},
			);

			if (!response.ok) {
				throw new Error("File upload failed");
			}

			const result = await response.json();
			const { data, success } = FileUploadsSchema.safeParse(result.files);
			if (!success) {
				throw new Error("Failed to parse file uploads");
			}
			setFileUploads(data);
		} catch (error) {
			console.error("Error uploading files:", error);
			toast({
				title: "Error",
				description: "Failed to upload files. Please try again.",
				variant: "destructive",
			});
		}
	};

	const initializePeerConnection = useCallback(() => {
		const pc = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});

		pc.onicecandidate = (event) => {
			if (event.candidate) {
				sendWebRTCSignal({
					type: "ice_candidate",
					candidate: event.candidate.candidate,
					sdpMLineIndex: event.candidate.sdpMLineIndex,
					sdpMid: event.candidate.sdpMid,
				});
			}
		};

		pc.ontrack = (event) => {
			setRemoteStream(event.streams[0]);
		};

		peerConnection.current = pc;
	}, []);

	const startCall = useCallback(async () => {
		try {
			const constraints = {
				audio: true,
				video: isVideoEnabled,
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			setLocalStream(stream);

			if (localVideoRef.current) {
				localVideoRef.current.srcObject = stream;
			}

			initializePeerConnection();

			if (peerConnection.current) {
				// biome-ignore lint/complexity/noForEach: <explanation>
				stream.getTracks().forEach((track) => {
					peerConnection.current?.addTrack(track, stream);
				});

				const offer = await peerConnection.current.createOffer();
				await peerConnection.current.setLocalDescription(offer);

				sendWebRTCSignal({
					type: "offer",
					sdp: offer.sdp,
					sender_id: Number(userId),
					receiver_id: Number(partnerId),
				});
			}

			setIsCallActive(true);
		} catch (error) {
			console.error("Error starting call:", error);
			toast({
				title: "Error",
				description: "Failed to start call. Please try again.",
				variant: "destructive",
			});
		}
	}, [initializePeerConnection, toast, isVideoEnabled, partnerId, userId]);

	const endCall = useCallback(() => {
		if (peerConnection.current) {
			peerConnection.current.close();
		}
		if (localStream) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			localStream.getTracks().forEach((track) => track.stop());
		}
		setLocalStream(null);
		setRemoteStream(null);
		setIsCallActive(false);
	}, [localStream]);

	const handleIncomingCall = useCallback(
		async (offer: RTCSessionDescriptionInit) => {
			try {
				const constraints = {
					audio: true,
					video: isVideoEnabled,
				};

				const stream = await navigator.mediaDevices.getUserMedia(constraints);
				setLocalStream(stream);

				if (localVideoRef.current) {
					localVideoRef.current.srcObject = stream;
				}

				initializePeerConnection();

				if (peerConnection.current) {
					await peerConnection.current.setRemoteDescription(offer);

					// biome-ignore lint/complexity/noForEach: <explanation>
					stream.getTracks().forEach((track) => {
						peerConnection.current?.addTrack(track, stream);
					});

					const answer = await peerConnection.current.createAnswer();
					await peerConnection.current.setLocalDescription(answer);

					sendWebRTCSignal({
						type: "answer",
						sdp: answer.sdp,
					});
				}

				setIsCallActive(true);
			} catch (error) {
				console.error("Error handling incoming call:", error);
				toast({
					title: "Error",
					description: "Failed to answer call. Please try again.",
					variant: "destructive",
				});
			}
		},
		[initializePeerConnection, toast, isVideoEnabled],
	);

	const handleWebRTCSignal = useCallback(
		(signal: z.infer<typeof RTCSignalSchema>) => {
			if (!peerConnection.current) {
				initializePeerConnection();
			}

			switch (signal.type) {
				case "offer":
					handleIncomingCall({ type: "offer", sdp: signal.sdp });
					break;
				case "answer":
					peerConnection.current?.setRemoteDescription({
						type: "answer",
						sdp: signal.sdp,
					});
					break;
				case "ice_candidate":
					peerConnection.current?.addIceCandidate({
						candidate: signal.candidate,
						sdpMLineIndex: signal.sdpMLineIndex,
						sdpMid: signal.sdpMid,
					});
					break;
			}
		},
		[handleIncomingCall, initializePeerConnection],
	);

	const sendWebRTCSignal = useCallback(
		(signal: z.infer<typeof RTCSignalSchema>) => {
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				wsRef.current.send(
					JSON.stringify({
						type: "rtc_signal",
						receiver_id: Number(partnerId),
						rtc_signal: signal,
					}),
				);
			}
		},
		[partnerId],
	);

	useEffect(() => {
		if (remoteVideoRef.current && remoteStream) {
			remoteVideoRef.current.srcObject = remoteStream;
		}
	}, [remoteStream]);

	return (
		<div className="flex flex-col h-screen p-4">
			<h1 className="text-2xl text-center font-bold mb-4">
				Chat of {username}
			</h1>
			<div className="flex-1 overflow-y-auto mb-4 space-y-2">
				{messages?.map((message) => (
					<div
						key={`${message.id} - ${message.content}`}
						className={`p-2 rounded-lg mx-auto bg-gray-200 max-w-md ${
							message.sender_id === Number(userId)
								? "ml-auto bg-blue-200"
								: "mr-auto"
						}`}
					>
						<p>{`${
							message.sender_id === Number(userId) ? "You" : "Partner"
						}: ${message.content}`}</p>
						<p className="text-xs text-gray-500">{message.status}</p>
						{message.file_attachments?.map((file: FileUpload) => (
							<FileInfo key={file.file_name} fileInfo={file} />
						))}
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<div className="mb-4">
				{isCallActive ? (
					<div className="flex space-x-2">
						<div className="w-1/2">
							{isVideoEnabled ? (
								<video
									ref={localVideoRef}
									autoPlay
									muted
									playsInline
									className="w-full"
								/>
							) : (
								<div className="w-full h-40 bg-gray-200 flex items-center justify-center">
									Audio Only (You)
								</div>
							)}
						</div>
						<div className="w-1/2">
							{isVideoEnabled ? (
								// biome-ignore lint/a11y/useMediaCaption: <explanation>
								<video
									ref={remoteVideoRef}
									autoPlay
									playsInline
									className="w-full"
								/>
							) : (
								<div className="w-full h-40 bg-gray-200 flex items-center justify-center">
									Audio Only (Partner)
								</div>
							)}
						</div>
					</div>
				) : null}
				<div className="flex justify-center mt-2 space-x-2">
					{isCallActive ? (
						<Button onClick={endCall} className="bg-red-500 hover:bg-red-600">
							End Call
						</Button>
					) : (
						<>
							<Button onClick={startCall}>Start Call</Button>
							<Button
								onClick={() => setIsVideoEnabled(!isVideoEnabled)}
								className={isVideoEnabled ? "bg-blue-500" : "bg-gray-500"}
							>
								{isVideoEnabled ? "Video On" : "Video Off"}
							</Button>
						</>
					)}
				</div>
			</div>
			<form onSubmit={sendMessage} className="space-y-2">
				<div className="flex space-x-2">
					<Input
						type="file"
						onChange={handleFileUpload}
						className="flex-1"
						multiple={true}
					/>
					<Input
						type="text"
						value={partnerId}
						onChange={(e) => setPartnerId(e.target.value)}
						placeholder="Partner ID"
						className="flex-1"
					/>
				</div>
				<div className="flex space-x-2">
					<Input
						type="text"
						value={newMessage}
						onChange={(e) => setNewMessage(e.target.value)}
						placeholder="Type a message..."
						className="flex-1"
					/>
					<Button type="submit">Send</Button>
				</div>
				{fileUploads.length > 0 && (
					<div className="mt-2">
						<p>Attached files:</p>
						{fileUploads.map((file) => (
							<FileInfo key={file.file_name} fileInfo={file} />
						))}
					</div>
				)}
			</form>
		</div>
	);
}
