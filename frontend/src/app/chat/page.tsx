"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
	id: number;
	sender_id: number;
	content: string;
	status: string;
	created_at: string;
};

export default function Chat() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [partnerId, setPartnerId] = useState("");
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
		// Set up WebSocket connection
		const websocket = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
		setWs(websocket);

		websocket.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === "new_message") {
				setMessages((prev) => [
					...prev,
					{
						id: data.message_id,
						sender_id: data.sender_id,
						content: data.content,
						status: "received",
						created_at: new Date().toISOString(),
					},
				]);
			}
		};

		return () => {
			websocket.close();
		};
	}, [token]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const fetchMessagesCallback = useCallback(() => {
		const fetchMessages = async () => {
			try {
				const response = await fetch(
					`http://localhost:8080/api/messages?partner_id=${partnerId}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (response.ok) {
					const data = await response.json();
					setMessages(data);
				} else {
					throw new Error("Failed to fetch messages");
				}
			} catch (error) {
				toast({
					title: "Error",
					description: JSON.stringify(error),
					variant: "destructive",
				});
			}
		};
		fetchMessages();
	}, [partnerId, toast, token]);

	useEffect(() => {
		if (partnerId) {
			fetchMessagesCallback();
		}
	}, [partnerId, fetchMessagesCallback]);

	const sendMessage = (e: React.FormEvent) => {
		console.log("sendMessage");
		e.preventDefault();
		if (ws && ws.readyState === WebSocket.OPEN) {
			const message: Message = {
				id: 0, // Set a temporary ID, will be updated when the message is saved
				sender_id: Number.parseInt(localStorage.getItem("user_id") ?? "0"), // Assuming the current user has ID 1
				content: newMessage,
				status: "sent",
				created_at: new Date().toISOString(),
			};

			setMessages((prev) => [...prev, message]);
			setNewMessage("");

			ws.send(
				JSON.stringify({
					type: "message",
					content: newMessage,
					receiver_id: Number.parseInt(partnerId),
					aes_key: "test",
				}),
			);
		}
	};

	const handlePartnerIdChange = (partnerId: string) => {
		setPartnerId(partnerId);
	};

	return (
		<div className="flex flex-col h-screen p-4">
			<div className="flex-1 overflow-y-auto mb-4 space-y-2">
				{messages?.map((message) => (
					<div
						key={message.id}
						className={`p-2 rounded-lg ${message.sender_id === 1 ? "bg-blue-200 ml-auto" : "bg-gray-200"} max-w-md`}
					>
						{message.content}
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<form onSubmit={sendMessage} className="flex space-x-2">
				<Input
					type="text"
					value={partnerId}
					onChange={(e) => handlePartnerIdChange(e.target.value)}
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
