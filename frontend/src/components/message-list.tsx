"use client";

import type { MessageResponse } from "@/types";
import { useEffect, useRef } from "react";
import { MessageItem } from "./message-item";

export const MessageList = ({
	messages,
	userId,
}: { messages: MessageResponse; userId: string }) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	return (
		<div className="flex-1 overflow-y-auto mb-4 space-y-2">
			{messages?.map((message) => (
				<MessageItem
					key={`${message.id} - ${message.body}`}
					message={message}
					userId={userId}
				/>
			))}
			<div ref={messagesEndRef} />
		</div>
	);
};
