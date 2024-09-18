"use client"

import { VideoCall } from "@/components/group/video-call"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCallStore } from "@/stores/call"
import { useState } from "react"

export default function App() {
	const [roomInput, setRoomInput] = useState("")
	const { roomId, setRoomId } = useCallStore()

	const joinRoom = () => {
		if (roomInput) {
			setRoomId(roomInput)
		}
	}

	if (roomId) {
		return <VideoCall />
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="rounded-lg p-8 shadow-md">
				<h1 className="mb-4 font-bold text-2xl">Join a Meeting</h1>
				<Input
					type="text"
					placeholder="Enter Room ID"
					value={roomInput}
					onChange={(e) => setRoomInput(e.target.value)}
					className="mb-4"
				/>
				<Button onClick={joinRoom}>Join</Button>
			</div>
		</div>
	)
}
