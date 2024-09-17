"use client"

import { Button } from "@/components/ui/button"
import { useMessagesStore } from "@/stores/messages"
import { ChevronDownIcon } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { MessageItem } from "./message-item"
import { ScrollArea } from "./ui/scroll-area"

interface MessageListProps {
	userId: string
}

export const MessageList = ({ userId }: MessageListProps) => {
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const messages = useMessagesStore((state) => state.messages)

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [])

	useEffect(() => {
		scrollToBottom()
	}, [messages, scrollToBottom])

	return (
		<div className="flex h-full w-full flex-col">
			<ScrollArea
				className="relative mb-4 min-w-lg flex-1 flex-col rounded-lg p-4 shadow-md"
				ref={containerRef}
			>
				<ul className="space-y-2 divide-y divide-gray-200">
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
			<div className="z-50 mb-20 flex justify-center">
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
	)
}
