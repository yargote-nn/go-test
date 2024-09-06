"use client";

import { Button } from "@/components/ui/button";
import { useCallStore } from "@/stores/calls";
import type { PartnerInfo } from "@/types";
import { Mic, Phone, Video, X } from "lucide-react";

interface CallControlsProps {
	partnerInfo: PartnerInfo;
}

export function CallControls({ partnerInfo }: CallControlsProps) {
	const {
		callStatus,
		mediaType,
		startCall,
		acceptCall,
		declineCall,
		endCall,
		toggleMediaType,
	} = useCallStore();

	return (
		<div className="flex justify-between">
			<Button
				onClick={toggleMediaType}
				variant={mediaType === "video" ? "default" : "outline"}
				disabled={callStatus !== "connected"}
			>
				{mediaType === "video" ? (
					<>
						<Video className="mr-2 h-4 w-4" />
						Switch to Audio
					</>
				) : (
					<>
						<Mic className="mr-2 h-4 w-4" />
						Switch to Video
					</>
				)}
			</Button>
			{callStatus === "idle" && (
				<Button
					onClick={() => startCall(false, partnerInfo.partnerId)}
					disabled={!partnerInfo.partnerId}
				>
					<Phone className="mr-2 h-4 w-4" />
					Start Call
				</Button>
			)}
			{callStatus === "connected" && (
				<Button onClick={endCall} variant="destructive">
					<X className="mr-2 h-4 w-4" />
					End Call
				</Button>
			)}
			{callStatus === "incomingCall" && (
				<>
					<Button onClick={acceptCall}>Accept Call</Button>
					<Button onClick={declineCall} variant="destructive">
						Decline Call
					</Button>
				</>
			)}
		</div>
	);
}
