"use client"

import VideoGrid from "@/components/calls/video-grid"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Mic, MicOff, PhoneOff, Users, Video, VideoOff } from "lucide-react"
import { useCallsContext } from "./call-context"

const CallsComponent: React.FC = () => {
	const {
		peerStreams,
		roomId,
		isInRoom,
		isAudioEnabled,
		isVideoEnabled,
		localStreamRef,
		setRoomId,
		joinRoom,
		leaveRoom,
		toggleAudio,
		toggleVideo,
	} = useCallsContext()

	return (
		<div className="min-h-screen bg-gradient-to-br from-background/10 to-foreground/10 p-4">
			<div className="container mx-auto max-w-6xl">
				<Card className="overflow-hidden rounded-xl shadow-2xl">
					<CardHeader className="bg-foreground text-background">
						<CardTitle className="flex items-center justify-between font-bold text-2xl">
							<span>Video Call Room</span>
							<Users className="h-6 w-6" />
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col items-center gap-4 p-6">
						<div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
							<Input
								type="text"
								placeholder="Enter Room ID"
								value={roomId}
								onChange={(e) => setRoomId(e.target.value)}
								className="w-full max-w-xs rounded-full shadow-inner"
								disabled={isInRoom}
								aria-label="Room ID"
							/>
							{!isInRoom ? (
								<Button
									onClick={joinRoom}
									className="w-full max-w-xs rounded-full hover:scale-105 hover:transition-all sm:w-auto"
								>
									<Video className="mr-2 h-4 w-4" /> Join Room
								</Button>
							) : (
								<div className="flex gap-2">
									<Button
										size="sm"
										variant={isAudioEnabled ? "secondary" : "destructive"}
										onClick={toggleAudio}
										className="rounded-full"
										aria-label={
											isAudioEnabled ? "Mute microphone" : "Unmute microphone"
										}
									>
										{isAudioEnabled ? (
											<Mic className="h-4 w-4" />
										) : (
											<MicOff className="h-4 w-4" />
										)}
									</Button>
									<Button
										size="sm"
										variant={isVideoEnabled ? "secondary" : "destructive"}
										onClick={toggleVideo}
										className="rounded-full"
										aria-label={
											isVideoEnabled ? "Turn off camera" : "Turn on camera"
										}
									>
										{isVideoEnabled ? (
											<Video className="h-4 w-4" />
										) : (
											<VideoOff className="h-4 w-4" />
										)}
									</Button>
									<Button
										size="sm"
										variant="destructive"
										onClick={leaveRoom}
										className="rounded-full"
										aria-label="Leave call"
									>
										<PhoneOff className="h-4 w-4" />
									</Button>
								</div>
							)}
						</div>
						{localStreamRef.current && (
							<div className="relative flex max-w-lg items-center justify-center overflow-hidden rounded-lg shadow-lg">
								<video
									ref={(el) => {
										if (el) el.srcObject = localStreamRef.current
									}}
									autoPlay
									playsInline
									muted
									className="h-full w-full object-cover"
								/>
							</div>
						)}
						<VideoGrid peerStreams={peerStreams} />
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

export default CallsComponent
