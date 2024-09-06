"use client";

import { CallControls } from "@/components/calls-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { VideoDisplay } from "@/components/video-display";
import { useCallStore } from "@/stores/calls";
import type { PartnerInfo } from "@/types";
import { Phone } from "lucide-react";

type CallsProps = {
	partnerInfo: PartnerInfo;
};

export function Calls({ partnerInfo }: CallsProps) {
	const isOpen = useCallStore((state) => state.isOpen);
	const setIsOpen = useCallStore((state) => state.setIsOpen);

	return (
		<div className="fixed top-4 right-4 z-50">
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button size="icon" className="rounded-full w-12 h-12">
						<Phone className="h-6 w-6" />
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[600px] w-[90vw] max-h-[80vh] overflow-y-auto">
					<Card className="w-full">
						<CardContent className="p-6">
							<div className="flex flex-col space-y-4">
								<CallControls partnerInfo={partnerInfo} />
								<VideoDisplay />
							</div>
						</CardContent>
					</Card>
				</DialogContent>
			</Dialog>
		</div>
	);
}
