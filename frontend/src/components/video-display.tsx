import { useCallStore } from "@/stores/calls"

export function VideoDisplay() {
	const { callStatus, localVideoRef, remoteVideoRef } = useCallStore()

	return (
		<div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-200">
			{callStatus === "connected" && (
				<>
					<video
						ref={remoteVideoRef}
						autoPlay
						playsInline
						className="absolute inset-0 h-full w-full object-cover"
					>
						<track kind="captions" />
					</video>
					<video
						ref={localVideoRef}
						autoPlay
						playsInline
						muted
						className="absolute right-4 bottom-4 h-1/4 w-1/4 rounded-lg object-cover"
					/>
				</>
			)}
		</div>
	)
}
