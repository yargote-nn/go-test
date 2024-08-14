"use client";

import { FileInfo } from "@/components/file-info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { encryptMessage } from "@/lib/crypto";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

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
	file_metadata: z.string().optional(),
});

type WSMessage = z.infer<typeof WSMessageSchema>;

const MessageSchema = z.object({
	id: z.number(),
	sender_id: z.number(),
	receiver_id: z.number(),
	content: z.string(),
	status: z.string(),
	expires_at: z.string(),
	aes_key_receiver: z.string().optional(),
	aes_key_sender: z.string().optional(),
	file_metadata: z.string().optional(),
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
	const [file, setFile] = useState<File | null>(null);
	const router = useRouter();
	const { toast } = useToast();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const wsRef = useRef<WebSocket | null>(null);

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
					// console.log(responseData);
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
					console.log(dataResponse);
					const { data, success } =
						MessageResponseSchema.safeParse(dataResponse);
					if (success) {
						for (const message of data) {
							if (
								message.receiver_id === Number(userId) &&
								message.aes_key_receiver
							) {
								const { decryptedMessage } = await fetch("/api/decrypt", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										encryptedMessage: message.content,
										encryptedAESKey: message.aes_key_receiver,
										privateKey,
									}),
								}).then((res) => res.json());
								message.content = decryptedMessage;
							} else if (
								message.sender_id === Number(userId) &&
								message.aes_key_sender
							) {
								const { decryptedMessage } = await fetch("/api/decrypt", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										encryptedMessage: message.content,
										encryptedAESKey: message.aes_key_sender,
										privateKey,
									}),
								}).then((res) => res.json());
								message.content = decryptedMessage;
							}

							// Enviar actualización de estado si el mensaje es "sent" y no es del usuario actual
							if (
								message.status === "sent" &&
								message.sender_id !== Number(userId)
							) {
								message.status = "received";
								sendStatusUpdate(message.id, "received");
							}
						}
						setMessages(data.reverse());
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
				if (data.receiver_id === Number(userId) && data.aes_key_receiver) {
					const response = await fetch("/api/decrypt", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							encryptedMessage: data.content,
							encryptedAESKey: data.aes_key_receiver,
							privateKey,
						}),
					});
					const { decryptedMessage } = await response.json();
					decryptedContent = decryptedMessage;
				} else if (data.sender_id === Number(userId) && data.aes_key_sender) {
					const response = await fetch("/api/decrypt", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							encryptedMessage: data.content,
							encryptedAESKey: data.aes_key_sender,
							privateKey,
						}),
					});
					const { decryptedMessage } = await response.json();
					decryptedContent = decryptedMessage;
				}
				console.log("Decrypted message:", decryptedContent);

				const newMessage: Message = {
					id: data.message_id ?? -1,
					sender_id: data.sender_id,
					receiver_id: data.receiver_id,
					content: decryptedContent,
					status: "received", // Cambiamos el estado a "received" inmediatamente
					expires_at: new Date().toISOString(),
					aes_key_receiver: data.aes_key_receiver,
					aes_key_sender: data.aes_key_sender,
					file_metadata: data.file_metadata,
				};

				setMessages((prev) => [...prev, newMessage]);

				// Enviamos la actualización de estado "received" al backend
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

		// Iniciar la conexión WebSocket aquí
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
			//console.log("WebSocket message:", data);
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

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const sendMessageCallback = useCallback(async () => {
		if (!isWebSocketReady) {
			toast({
				title: "Error",
				description: "WebSocket connection is not ready. Please try again.",
				variant: "destructive",
			});
			return;
		}

		if (!newMessage.trim()) {
			toast({
				title: "Error",
				description: "Message cannot be empty.",
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
			} = await encryptMessage(newMessage, partnerPublicKey, publicKey);

			let fileMetadata = null;
			if (file) {
				const formData = new FormData();
				formData.append("file", file);
				const response = await fetch("http://localhost:8080/api/upload", {
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});

				fileMetadata = await response.json();
				setFile(null);
				console.log("File metadata:", fileMetadata);
			}
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				const messageToSend = JSON.stringify({
					type: "message",
					content: encryptedMessage,
					receiver_id: Number(partnerId),
					aes_key_sender: encryptedAESKeySender,
					aes_key_receiver: encryptedAESKeyReceiver,
					expires_at: expiresAt,
					file_attachment: fileMetadata,
				});

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
				};

				setMessages((prev) => [...prev, message]);
				setNewMessage("");
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
		file,
		token,
	]);

	const sendMessage = (e: React.FormEvent) => {
		e.preventDefault();
		sendMessageCallback();
	};

	return (
		<div className="flex flex-col h-screen p-4">
			<h1 className="text-2xl text-center font-bold mb-4">
				Chat of {username}
			</h1>
			<div className="flex-1 overflow-y-auto mb-4 space-y-2">
				{messages?.map((message) => (
					<div
						key={`${message.id} - ${message.content}`}
						className={"p-2 rounded-lg mx-auto bg-gray-200 max-w-md"}
					>
						{`${message.sender_id === Number.parseInt(userId) ? "You" : "Partner"}: ${message.content} : ${message.status}`}
						{message.file_metadata && (
							<FileInfo
								fileInfo={{
									file_name: JSON.parse(message.file_metadata).file_name,
									file_size: JSON.parse(message.file_metadata).file_size,
									file_type: JSON.parse(message.file_metadata).file_type,
									file_url: JSON.parse(message.file_metadata).file_url,
								}}
							/>
						)}
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<form onSubmit={sendMessage} className="flex space-x-2">
				<Input
					type="file"
					onChange={(e) => setFile(e.target.files?.[0] as File)}
					className="flex-1"
				/>
				<Input
					type="text"
					value={partnerId}
					onChange={(e) => setPartnerId(e.target.value)}
					placeholder="Partner ID"
					className="flex-1"
				/>
				<Input
					type="text"
					value={newMessage}
					onChange={(e) => setNewMessage(e.target.value)}
					placeholder="Type a message..."
					className="flex-1"
				/>
				<Button type="submit">Send</Button>
			</form>
		</div>
	);
}
