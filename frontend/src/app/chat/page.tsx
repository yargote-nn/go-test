"use client"

import { Calls } from "@/components/calls"
import { Broadcast, BroadcastOff } from "@/components/icons/broadcast"
import { MessageList } from "@/components/message-list"
import { NewMessage } from "@/components/new-message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMessages } from "@/hooks/use-messages"
import { usePartnerInfo } from "@/hooks/use-partner-info"
import { useUserInfo } from "@/hooks/use-user-info"
import { useWebSocket } from "@/hooks/use-web-socket"
import { useWSMessages } from "@/hooks/use-ws-messages"
import { useCallStore } from "@/stores/calls"
import { useMessagesStore } from "@/stores/messages"
import { ChevronDownIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useInView } from "react-intersection-observer"

export default function ChatPage() {
	const router = useRouter()
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const [partnerNickname, setPartnerNickname] = useState("")
	const { userInfo, isValidUserInfo } = useUserInfo()
	const { partnerInfo, updatePartnerInfo, resetPartnerInfo } = usePartnerInfo()
	const { updateMessages, setMessages } = useMessages()
	const { handleNewMessage, handleStatusUpdate } = useWSMessages({ userInfo })
	const { isWebSocketReady, webSocketConnect, sendMessage } = useWebSocket({
		onNewMessage: handleNewMessage,
		onStatusUpdate: handleStatusUpdate,
	})

	const messages = useMessagesStore((state) => state.messages)

	const connectWebSocket = useCallStore((state) => state.connectWebSocket)
	const isWebRTCSocketReady = useCallStore((state) => state.isWebSocketReady)

	const { ref: endOfMessagesRef, inView: isEndOfMessagesVisible } = useInView({
		threshold: 0,
	})

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [])

	useEffect(() => {
		if (!isEndOfMessagesVisible) {
			scrollToBottom()
		}
	}, [messages, scrollToBottom, isEndOfMessagesVisible])

	useEffect(() => {
		if (!isValidUserInfo()) {
			router.push("/login")
		}
	}, [isValidUserInfo, router, userInfo])

	const handleUpdateInfo = useCallback(() => {
		if (partnerNickname && userInfo?.token) {
			updatePartnerInfo(partnerNickname, userInfo.token)
		} else {
			resetPartnerInfo()
		}
	}, [partnerNickname, userInfo?.token, updatePartnerInfo, resetPartnerInfo])

	const handleUpdateMessages = useCallback(() => {
		if (partnerInfo && userInfo) {
			updateMessages(partnerInfo, userInfo)
		} else {
			setMessages([])
		}
	}, [partnerInfo, userInfo, updateMessages, setMessages])

	useEffect(() => {
		handleUpdateMessages()
	}, [handleUpdateMessages])

	useEffect(() => {
		handleUpdateInfo()
	}, [handleUpdateInfo])

	useEffect(() => {
		if (userInfo?.token) {
			return webSocketConnect(userInfo.token)
		}
	}, [userInfo?.token, webSocketConnect])

	useEffect(() => {
		if (userInfo?.token) {
			const newToken = userInfo.token
			return connectWebSocket(newToken)
		}
	}, [userInfo?.token, connectWebSocket])

	return (
		<div className="flex flex-col items-center p-4">
			<header className="mb-4 flex items-center justify-center gap-2">
				{isWebSocketReady && isWebRTCSocketReady ? (
					<Broadcast className="size-8" />
				) : (
					<BroadcastOff className="size-8" />
				)}
				<h1 className="text-balance font-bold text-2xl">
					Chat of {userInfo?.nickname} with{" "}
					{partnerInfo?.nickname ?? "no partner"}
				</h1>
			</header>
			<Input
				type="text"
				placeholder="Partner nickname"
				value={partnerNickname}
				onChange={(e) => setPartnerNickname(e.target.value)}
				className="mb-4 max-w-sm border p-2 text-center text-base"
			/>
			<div className="w-full flex-1 overflow-hidden rounded-lg">
				<MessageList userId={userInfo?.userId ?? ""} messages={messages} />
				<div ref={messagesEndRef} />
				<div ref={endOfMessagesRef} />
			</div>
			{userInfo &&
				partnerInfo &&
				messages.length > 0 &&
				!isEndOfMessagesVisible && (
					<div className="fixed bottom-10 z-50 mb-20 flex justify-center">
						<Button
							className="rounded-full p-2"
							onClick={scrollToBottom}
							size="icon"
							variant="outline"
						>
							<ChevronDownIcon className="h-4 w-4" />
							<span className="sr-only">Scroll to bottom</span>
						</Button>
					</div>
				)}
			{userInfo && partnerInfo && (
				<div className="mt-4 flex w-full max-w-xl flex-col gap-2">
					<Calls partnerInfo={partnerInfo} />
					<NewMessage
						userInfo={userInfo}
						partnerInfo={partnerInfo}
						sendMessage={sendMessage}
					/>
				</div>
			)}
		</div>
	)
}
