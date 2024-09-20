"use client"

import GroupVideoCall from "@/components/group/group-video-call"
import { useUserInfo } from "@/hooks/use-user-info"

export default function Video() {
	const { userInfo } = useUserInfo()

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
			<h1 className="mb-8 font-bold text-4xl">
				Video Call - {userInfo?.nickname} - {userInfo?.userId}
			</h1>
			<GroupVideoCall />
		</div>
	)
}
