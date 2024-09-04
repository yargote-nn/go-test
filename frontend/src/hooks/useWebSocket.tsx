import { type WSMessage, WSMessageSchema } from "@/types";
import { useEffect, useRef, useState } from "react";

export function useWebSocket(
	token: string,
	onNewMessage: (data: WSMessage) => void,
	onStatusUpdate: (data: WSMessage) => void,
	onMessageSent: (data: WSMessage) => void,
) {
	const [isWebSocketReady, setIsWebSocketReady] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		const websocket = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
		wsRef.current = websocket;

		websocket.onopen = () => {
			console.log("WebSocket connection established");
			setIsWebSocketReady(true);
		};

		websocket.onmessage = async (event) => {
			console.log("WebSocket message received:", event.data);
			const { data, success } = WSMessageSchema.safeParse(
				JSON.parse(event.data),
			);
			if (success) {
				switch (data.type) {
					case "new_message":
						await onNewMessage(data);
						break;
					case "message_sent":
						onMessageSent(data);
						break;
					case "status_update":
						onStatusUpdate(data);
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
			if (websocket) websocket.close();
		};
	}, [token, onNewMessage, onStatusUpdate, onMessageSent]);

	const sendMessage = (message: string) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(message);
		} else {
			console.error("WebSocket is not in OPEN state");
		}
	};

	return { isWebSocketReady, sendMessage };
}
