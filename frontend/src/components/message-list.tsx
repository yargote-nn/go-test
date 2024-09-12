"use client";

import { Button } from "@/components/ui/button";
import { useMessagesStore } from "@/stores/messages";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { MessageItem } from "./message-item";
import { ScrollArea } from "./ui/scroll-area";

interface MessageListProps {
	userId: string;
}

export const MessageList = ({ userId }: MessageListProps) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const messages = useMessagesStore((state) => state.messages);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	return (
		<div className="flex flex-col h-full w-full">
			<ScrollArea
				className="flex-col flex-1 mb-4 p-4 rounded-lg shadow-md relative min-w-lg"
				ref={containerRef}
			>
				<ul className="divide-y divide-gray-200 space-y-2">
					{messages?.map((message) => (
						<MessageItem
							key={`${message.id} - ${message.body}`}
							message={message}
							userId={userId}
						/>
					))}
				</ul>
				<div ref={messagesEndRef} />
			</ScrollArea>
			<div className="flex justify-center mb-20 z-50">
				<Button
					className="rounded-full p-2"
					onClick={scrollToBottom}
					size="icon"
					variant="outline"
				>
					<ChevronDownIcon className="h-4 w-4" />
					<span className="sr-only">Scroll to bottom</span>
				</Button>
			</div>
		</div>
	);
};
