import { type WSMessage, WSMessageSchema } from "@/types";
import { useCallback, useRef, useState } from "react";

interface useWebSocketProps {
	onNewMessage: (
		data: WSMessage,
		sendMessage: (message: string) => void,
	) => Promise<void>;
	onMessageSent: (data: WSMessage) => void;
	onStatusUpdate: (data: WSMessage) => void;
}

export function useWebSocket({
	onNewMessage,
	onMessageSent,
	onStatusUpdate,
}: useWebSocketProps) {
	const [isWebSocketReady, setIsWebSocketReady] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	const webSocketConnect = useCallback(
		(token: string) => {
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
							console.log("New message:", data);
							await onNewMessage(data, sendMessage);
							break;
						case "message_sent":
							console.log("Message sent:", data);
							onMessageSent(data);
							break;
						case "status_update":
							console.log("Status update:", data);
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
		},
		[onNewMessage, onMessageSent, onStatusUpdate],
	);

	const sendMessage = useCallback((message: string) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			console.log("Sending message:", message);
			wsRef.current.send(message);
			return;
		}
		console.error("WebSocket is not ready");
	}, []);

	return { isWebSocketReady, webSocketConnect, sendMessage };
}
