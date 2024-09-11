import {
	type CommonMessage,
	type UpdateStateMessage,
	WSMessageSchema,
} from "@/types";
import { useCallback, useRef, useState } from "react";

interface useWebSocketProps {
	onNewMessage: (
		data: CommonMessage,
		sendMessage: (message: string) => void,
	) => Promise<void>;
	onStatusUpdate: (data: UpdateStateMessage) => void;
}

export function useWebSocket({
	onNewMessage,
	onStatusUpdate,
}: useWebSocketProps) {
	const [isWebSocketReady, setIsWebSocketReady] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	const webSocketConnect = useCallback(
		(token: string) => {
			const websocket = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
			console.log("WebSocket:", websocket);
			wsRef.current = websocket;

			websocket.onopen = () => {
				console.log("WebSocket connection established");
				setIsWebSocketReady(true);
			};

			websocket.onmessage = async (event) => {
				console.log("WebSocket message received:", event.data);
				const { data: message, success } = WSMessageSchema.safeParse(
					JSON.parse(event.data),
				);
				if (success) {
					switch (message.type) {
						case "new_message": {
							console.log("New message, data:", message.data);
							const commonMessage = message.data as CommonMessage;
							await onNewMessage(commonMessage, sendMessage);
							break;
						}
						case "status_update": {
							console.log("Status update:", message.data);
							const updatedMessage = message.data as UpdateStateMessage;
							onStatusUpdate(updatedMessage);
							break;
						}
						default:
							console.log("Unknown message type:", message.type);
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
		[onNewMessage, onStatusUpdate],
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
