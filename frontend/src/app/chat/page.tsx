"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { decryptMessage, encryptMessage } from "@/lib/crypto";
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
	aes_key: z.string().optional(),
	message_id: z.number().optional(),
	status: z.string().optional(),
});

type WSMessage = z.infer<typeof WSMessageSchema>;

const MessageSchema = z.object({
	id: z.number(),
	sender_id: z.number(),
	receiver_id: z.number(),
	content: z.string(),
	status: z.string(),
	expires_at: z.string(),
	aes_key: z.string().optional(),
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
	const [ws, setWs] = useState<WebSocket | null>(null);
	const [privateKey, setPrivateKey] = useState("");
	const router = useRouter();
	const { toast } = useToast();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const token = localStorage.getItem("token") || "";
		if (!token) {
			console.log("Token not found");
			router.push("/login");
			return;
		}
		setToken(token);
	}, [router]);

	useEffect(() => {
		const userId = localStorage.getItem("user_id") || "";
		if (!userId) {
			console.log("User ID not found");
			router.push("/login");
			return;
		}
		setUserId(userId);
	}, [router]);

	useEffect(() => {
		const username = localStorage.getItem("username") || "";
		if (!username) {
			console.log("Username not found");
			router.push("/login");
			return;
		}
		setUsername(username);
	}, [router]);

	useEffect(() => {
		const privateKey = localStorage.getItem("privateKey") || "";
		if (!privateKey) {
			console.log("Private key not found");
			router.push("/login");
			return;
		}
		setPrivateKey(privateKey);
	}, [router]);

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
					console.log(responseData);
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
					console.log("Messages:", data);
					console.log("Success:", success);
					if (success) {
						for (const message of data) {
							if (message.aes_key && privateKey) {
								const decryptedMessage = await decryptMessage(
									message.content,
									message.aes_key,
									privateKey,
								);
								message.content = decryptedMessage;
								console.log("Decrypted message:", message.content);
							}
						}
						setMessages(data.reverse());
					} else {
						toast({
							title: "No messages found",
						});
					}
				} else {
					toast({
						title: "Fetch messages failed",
					});
				}
			} catch (error) {
				toast({
					title: "Error",
					description: JSON.stringify(error),
					variant: "destructive",
				});
			}
		};

		if (partnerId) {
			fetchPartnerInfo();
		}
	}, [partnerId, toast, token, privateKey]);

	useEffect(() => {
		// Set up WebSocket connection
		const websocket = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
		setWs(websocket);

		websocket.onmessage = (event) => {
			const { data, success } = WSMessageSchema.safeParse(
				JSON.parse(event.data),
			);
			console.log("Websocket message:", data);
			if (success) {
				if (data.type === "new_message") {
					const { data: messageData, success: messageSuccess } =
						MessageSchema.safeParse(data);
					console.log("Message data:", messageData);
					if (messageSuccess) {
						setMessages((prev) => [...prev, messageData]);
					}
				} else if (data.type === "status_update") {
					const { data: messageData, success: messageSuccess } =
						MessageSchema.safeParse(data);
					console.log("Message data 2:", messageData);
					if (messageSuccess) {
						setMessages((prev) =>
							prev.map((message) => {
								if (message.id === messageData.id) {
									message.status = messageData.status;
								}
								return message;
							}),
						);
					}
				}
			}
		};

		websocket.onerror = (event) => {
			console.error(event);
		};

		websocket.onclose = (event) => {
			console.error(event);
		};

		return () => {
			websocket.close();
		};
	}, [token]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const sendMessageCallback = useCallback(() => {
		const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
		const expiresAt = tomorrow.toISOString();

		async function encryptNewMessage() {
			const { encryptedMessage, encryptedAESKey } = await encryptMessage(
				newMessage,
				partnerPublicKey,
			);

			console.log("Encrypted message:", encryptedMessage);
			console.log("Encrypted AES key:", encryptedAESKey);

			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(
					JSON.stringify({
						type: "message",
						content: encryptedMessage,
						receiver_id: Number.parseInt(partnerId),
						aes_key: encryptedAESKey,
						expires_at: expiresAt,
					}),
				);
			}
		}
		const message: Message = {
			id: 0,
			sender_id: Number.parseInt(userId),
			content: newMessage,
			status: "sent",
			receiver_id: Number.parseInt(partnerId),
			aes_key: "",
			expires_at: expiresAt,
		};

		setMessages((prev) => [...prev, message]);
		setNewMessage("");

		encryptNewMessage();
	}, [newMessage, partnerId, partnerPublicKey, userId, ws]);

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
						key={message.content}
						className={"p-2 rounded-lg mx-auto bg-gray-200 max-w-md"}
					>
						{`${message.sender_id === Number.parseInt(userId) ? "You" : "Partner"}: ${message.content} : ${message.status}`}
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<form onSubmit={sendMessage} className="flex space-x-2">
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
