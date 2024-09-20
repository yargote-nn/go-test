"use client"

import type { PeerStreams } from "@/types/calls"
import { useEffect, useRef } from "react"

interface VideoGridProps {
	peerStreams: PeerStreams
}

const VideoGrid: React.FC<VideoGridProps> = ({ peerStreams }) => {
	const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})

	useEffect(() => {
		Object.entries(peerStreams).forEach(([peerId, stream]) => {
			if (videoRefs.current[peerId] && stream) {
				videoRefs.current[peerId].srcObject = stream
			}
		})
	}, [peerStreams])

	return (
		<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{Object.entries(peerStreams).map(([peerId]) => (
				<div
					key={peerId}
					className="relative overflow-hidden rounded-lg shadow-lg"
				>
					<video
						ref={(el) => {
							videoRefs.current[peerId] = el
						}}
						autoPlay
						playsInline
						className="h-full w-full object-cover"
					>
						<track kind="captions" />
						<track kind="descriptions" />
					</video>
					<div className="absolute top-2 left-2 rounded-full bg-black bg-opacity-50 px-3 py-1 text-sm text-white">
						{peerId}
					</div>
				</div>
			))}
		</div>
	)
}

export default VideoGrid
