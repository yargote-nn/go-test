"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

const MessageSchema = z.object({
	id: z.number(),
	sender_id: z.number(),
	receiver_id: z.number(),
	content: z.string(),
	status: z.enum(["sent", "received", "read"]),
	created_at: z.date(),
});

type Message = z.infer<typeof MessageSchema>;

const UserSchema = z.object({
	id: z.number(),
	username: z.string(),
	public_key: z.string(),
});

type User = z.infer<typeof UserSchema>;

const UserResponseSchema = z.object({
	user: UserSchema,
});

type UserResponse = z.infer<typeof UserResponseSchema>;

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

const MessageResponseSchema = z.array(WSMessageSchema);

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
	const router = useRouter();
	const { toast } = useToast();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const token = localStorage.getItem("token") || "";
		if (!token) {
			router.push("/login");
			return;
		}
		setToken(token);
	}, [router]);

	useEffect(() => {
		const userId = localStorage.getItem("user_id") || "";
		if (!userId) {
			router.push("/login");
			return;
		}
		setUserId(userId);
	}, [router]);

	useEffect(() => {
		const username = localStorage.getItem("username") || "";
		if (!username) {
			router.push("/login");
			return;
		}
		setUsername(username);
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
					if (success) {
						setMessages(data);
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
	}, [partnerId, toast, token]);

	useEffect(() => {
		// Set up WebSocket connection
		const websocket = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
		setWs(websocket);

		websocket.onmessage = (event) => {
			const { data, success } = WSMessageSchema.safeParse(
				JSON.parse(event.data),
			);
			if (success) {
				if (data.type === "new_message") {
					setMessages((prev) => [...prev, data]);
				} else if (data.type === "status_update") {
					setMessages((prev) =>
						prev.map((message) => {
							if (message.message_id === data.message_id) {
								message.status = data.status;
							}
							return message;
						}),
					);
				}
			}
		};

		websocket.onerror = (event) => {
			toast({
				title: "Error",
				description: "Please try again. Websocket connection error.",
				variant: "destructive",
			});
		};

		websocket.onclose = (event) => {
			toast({
				title: "Connection closed",
				description: "Please try again. Websocket connection closed.	",
				variant: "destructive",
			});
		};

		return () => {
			websocket.close();
		};
	}, [token, toast]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const sendMessage = (e: React.FormEvent) => {
		console.log("sendMessage");
		e.preventDefault();
		if (ws && ws.readyState === WebSocket.OPEN) {
			const message: WSMessage = {
				sender_id: Number.parseInt(localStorage.getItem("user_id") ?? "0"), // Assuming the current user has ID 1
				content: newMessage,
				status: "sent",
				receiver_id: Number.parseInt(partnerId),
				aes_key: partnerPublicKey,
				type: "message",
			};

			setMessages((prev) => [...prev, message]);
			setNewMessage("");

			ws.send(
				JSON.stringify({
					type: "message",
					content: newMessage,
					receiver_id: Number.parseInt(partnerId),
					aes_key: partnerPublicKey,
				}),
			);
		}
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
						{`${message.sender_id === Number.parseInt(userId) ? "You" : "Partner"}: ${message.content}`}
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
