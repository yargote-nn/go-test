"use client";

import { MessageList } from "@/components/message-list";
import { NewMessage } from "@/components/new-message";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/hooks/use-messages";
import { usePartnerInfo } from "@/hooks/use-partner-info";
import { useUserInfo } from "@/hooks/use-user-info";
import { useWebSocket } from "@/hooks/use-web-socket";
import { useWSMessages } from "@/hooks/use-ws-messages";
import { CircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function ChatPage() {
	const router = useRouter();
	const [partnerId, setPartnerId] = useState("");
	const { userInfo, isValidUserInfo } = useUserInfo();
	const { partnerInfo, updatePartnerInfo, resetPartnerInfo } = usePartnerInfo();
	const { messages, updateMessages, setMessages } = useMessages();
	const { handleNewMessage, handleMessageSent, handleStatusUpdate } =
		useWSMessages({ userInfo });
	const { isWebSocketReady, webSocketConnect, sendMessage } = useWebSocket({
		onNewMessage: handleNewMessage,
		onMessageSent: handleMessageSent,
		onStatusUpdate: handleStatusUpdate,
	});

	useEffect(() => {
		if (!isValidUserInfo()) {
			router.push("/login");
		}
	}, [isValidUserInfo, router]);

	const handleUpdateInfo = useCallback(() => {
		if (partnerId && userInfo?.token) {
			updatePartnerInfo(partnerId, userInfo.token);
		} else {
			resetPartnerInfo();
		}
	}, [partnerId, userInfo?.token, updatePartnerInfo, resetPartnerInfo]);

	const handleUpdateMessages = useCallback(() => {
		if (partnerInfo && userInfo) {
			updateMessages(partnerInfo, userInfo);
		} else {
			setMessages([]);
		}
	}, [partnerInfo, userInfo, updateMessages, setMessages]);

	useEffect(() => {
		handleUpdateMessages();
	}, [handleUpdateMessages]);

	useEffect(() => {
		handleUpdateInfo();
	}, [handleUpdateInfo]);

	useEffect(() => {
		if (userInfo?.token) {
			return webSocketConnect(userInfo.token);
		}
	}, [userInfo?.token, webSocketConnect]);

	return (
		<div className="flex flex-col h-screen p-4">
			<span className="text-center">
				{isWebSocketReady ? (
					<CircleIcon className="size-6 fill-green-600" />
				) : (
					<CircleIcon className="size-6 fill-red-600" />
				)}
			</span>
			<h1 className="text-2xl text-center font-bold mb-4">
				Chat of {userInfo?.nickname} with{" "}
				{partnerInfo?.nickname ?? "No partner"}
			</h1>
			<MessageList messages={messages} userId={userInfo?.userId ?? ""} />
			<Input
				type="text"
				placeholder="Partner ID"
				value={partnerId}
				onChange={(e) => setPartnerId(e.target.value)}
				className="mb-4"
			/>
			{userInfo && partnerInfo && (
				<NewMessage
					userInfo={userInfo}
					partnerInfo={partnerInfo}
					sendMessage={sendMessage}
				/>
			)}
		</div>
	);
}
