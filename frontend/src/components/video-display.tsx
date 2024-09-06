import { useCallStore } from "@/stores/calls";

export function VideoDisplay() {
	const { callStatus, localVideoRef, remoteVideoRef } = useCallStore();

	return (
		<div className="relative w-full aspect-video bg-gray-200 rounded-lg overflow-hidden">
			{callStatus === "connected" && (
				<>
					<video
						ref={remoteVideoRef}
						autoPlay
						playsInline
						className="absolute inset-0 w-full h-full object-cover"
					>
						<track kind="captions" />
					</video>
					<video
						ref={localVideoRef}
						autoPlay
						playsInline
						muted
						className="absolute bottom-4 right-4 w-1/4 h-1/4 object-cover rounded-lg"
					/>
				</>
			)}
		</div>
	);
}
