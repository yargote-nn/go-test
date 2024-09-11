"use client";

import { Calls } from "@/components/calls";
import { Broadcast, BroadcastOff } from "@/components/icons/broadcast";
import { MessageList } from "@/components/message-list";
import { NewMessage } from "@/components/new-message";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/hooks/use-messages";
import { usePartnerInfo } from "@/hooks/use-partner-info";
import { useUserInfo } from "@/hooks/use-user-info";
import { useWebSocket } from "@/hooks/use-web-socket";
import { useWSMessages } from "@/hooks/use-ws-messages";
import { useCallStore } from "@/stores/calls";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function ChatPage() {
	const router = useRouter();
	const [partnerNickname, setPartnerNickname] = useState("");
	const { userInfo, isValidUserInfo } = useUserInfo();
	const { partnerInfo, updatePartnerInfo, resetPartnerInfo } = usePartnerInfo();
	const { updateMessages, setMessages } = useMessages();
	const { handleNewMessage, handleStatusUpdate } = useWSMessages({ userInfo });
	const { isWebSocketReady, webSocketConnect, sendMessage } = useWebSocket({
		onNewMessage: handleNewMessage,
		onStatusUpdate: handleStatusUpdate,
	});

	const connectWebSocket = useCallStore((state) => state.connectWebSocket);
	const isWebRTCSocketReady = useCallStore((state) => state.isWebSocketReady);

	useEffect(() => {
		if (!isValidUserInfo()) {
			router.push("/login");
		}
	}, [isValidUserInfo, router]);

	const handleUpdateInfo = useCallback(() => {
		if (partnerNickname && userInfo?.token) {
			updatePartnerInfo(partnerNickname, userInfo.token);
		} else {
			resetPartnerInfo();
		}
	}, [partnerNickname, userInfo?.token, updatePartnerInfo, resetPartnerInfo]);

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

	useEffect(() => {
		if (userInfo?.token) {
			const newToken = userInfo.token;
			return connectWebSocket(newToken);
		}
	}, [userInfo?.token, connectWebSocket]);

	return (
		<div className="flex flex-col h-screen p-4 items-center">
			<span className="text-center">
				{isWebSocketReady && isWebRTCSocketReady ? (
					<Broadcast className="size-8" />
				) : (
					<BroadcastOff className="size-8" />
				)}
			</span>
			<h1 className="text-xl text-center font-bold mb-4">
				Chat of {userInfo?.nickname} with{" "}
				{partnerInfo?.nickname ?? "no partner"}
			</h1>
			<Input
				type="text"
				placeholder="Partner nickname"
				value={partnerNickname}
				onChange={(e) => setPartnerNickname(e.target.value)}
				className="mb-4 max-w-sm"
			/>
			<MessageList userId={userInfo?.userId ?? ""} />
			<MessageList userId={userInfo?.userId ?? ""} />
			{userInfo && partnerInfo && (
				<div className="flex flex-col gap-2 w-full max-w-xl">
					<Calls partnerInfo={partnerInfo} />
					<NewMessage
						userInfo={userInfo}
						partnerInfo={partnerInfo}
						sendMessage={sendMessage}
					/>
				</div>
			)}
		</div>
	);
}
