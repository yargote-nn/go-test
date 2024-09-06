"use client";

import { Button } from "@/components/ui/button";
import type { Messages } from "@/types";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { MessageItem } from "./message-item";

interface MessageListProps {
	messages: Messages;
	userId: string;
}

export const MessageList = ({ messages, userId }: MessageListProps) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		const shouldScrollToBottom = () => {
			if (!containerRef.current) return true;
			const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
			return scrollTop + clientHeight >= scrollHeight - 100; // Within 100px of bottom
		};

		if (shouldScrollToBottom()) {
			scrollToBottom();
		}
	}, [scrollToBottom]);

	return (
		<div
			className="flex-1 overflow-y-auto mb-4 space-y-2 relative"
			ref={containerRef}
		>
			{messages?.map((message) => (
				<MessageItem
					key={`${message.id} - ${message.body}`}
					message={message}
					userId={userId}
				/>
			))}
			<div ref={messagesEndRef} />
			<Button
				className="absolute bottom-4 right-4 rounded-full p-2"
				onClick={scrollToBottom}
				size="icon"
				variant="secondary"
			>
				<ChevronDownIcon className="h-4 w-4" />
				<span className="sr-only">Scroll to bottom</span>
			</Button>
		</div>
	);
};
