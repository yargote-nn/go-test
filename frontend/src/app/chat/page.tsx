"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Message = {
	id: number;
	sender_id: number;
	content: string;
	status: string;
	created_at: string;
};

export default function Chat() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [newMessage, setNewMessage] = useState("");
	const [ws, setWs] = useState<WebSocket | null>(null);
	const router = useRouter();
	const { toast } = useToast();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (!token) {
			router.push("/login");
			return;
		}

		// Fetch messages
		fetchMessages();

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
	}, [router]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const fetchMessages = async () => {
		try {
			const response = await fetch("http://localhost:8080/api/messages", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			console.log(response);
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

	const sendMessage = (e: React.FormEvent) => {
		e.preventDefault();
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(
				JSON.stringify({
					type: "message",
					content: newMessage,
					receiver_id: 1, // For simplicity, we're sending to user with ID 1
				}),
			);
			setNewMessage("");
		}
	};

	return (
		<div className="flex flex-col h-screen p-4">
			<div className="flex-1 overflow-y-auto mb-4 space-y-2">
				{messages.map((message) => (
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
