import type { Message } from "@/types"
import { MessageItem } from "./message-item"
import { ScrollArea } from "./ui/scroll-area"

interface MessageListProps {
	userId: string
	messages: Message[]
}

export const MessageList = ({ userId, messages }: MessageListProps) => {
	return (
		<div className="flex h-full w-full flex-col pb-12">
			<ScrollArea className="relative mb-4 min-w-lg flex-1 flex-col rounded-lg p-4">
				<ul className="space-y-2 divide-y divide-gray-200">
					{messages?.map((message) => (
						<MessageItem
							key={`${message.id} - ${message.body}`}
							message={message}
							userId={userId}
						/>
					))}
				</ul>
			</ScrollArea>
		</div>
	)
}
