"use client"

import { CallControls } from "@/components/calls-controls"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { VideoDisplay } from "@/components/video-display"
import { useCallStore } from "@/stores/calls"
import type { PartnerInfo } from "@/types"
import { Phone } from "lucide-react"

type CallsProps = {
	partnerInfo: PartnerInfo
}

export function Calls({ partnerInfo }: CallsProps) {
	const isOpen = useCallStore((state) => state.isOpen)
	const setIsOpen = useCallStore((state) => state.setIsOpen)

	return (
		<div className="fixed top-20 right-4 z-50">
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button size="icon" className="h-12 w-12 rounded-full">
						<Phone className="h-6 w-6" />
					</Button>
				</DialogTrigger>
				<DialogContent className="max-h-[80vh] w-[90vw] overflow-y-auto sm:max-w-[600px]">
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
	)
}
