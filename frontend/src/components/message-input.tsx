"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"

export const MessageInput = ({
	onSendMessage,
	partnerId,
	setPartnerId,
}: {
	onSendMessage: (message: string) => void
	partnerId: string
	setPartnerId: (id: string) => void
}) => {
	const [newMessage, setNewMessage] = useState("")

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		onSendMessage(newMessage)
		setNewMessage("")
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-2">
			<div className="flex space-x-2">
				<Input
					type="text"
					value={partnerId}
					onChange={(e) => setPartnerId(e.target.value)}
					placeholder="Partner ID"
					className="flex-1"
				/>
			</div>
			<div className="flex space-x-2">
				<Input
					type="text"
					value={newMessage}
					onChange={(e) => setNewMessage(e.target.value)}
					placeholder="Type a message..."
					className="flex-1"
				/>
				<Button type="submit">Send</Button>
			</div>
		</form>
	)
}
