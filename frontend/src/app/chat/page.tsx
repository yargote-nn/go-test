"use client";

import { Input } from "@/components/ui/input";
import { usePartnerInfoStore } from "@/stores/partner-info";
import { useUserInfoStore } from "@/stores/user-info";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function ChatPage() {
	const router = useRouter();
	const [partnerId, setPartnerId] = useState("");
	const userInfo = useUserInfoStore((state) => state.userInfo);
	const isValidUserInfo = useUserInfoStore((state) => state.isValidUserInfo);
	const parnerInfo = usePartnerInfoStore((state) => state.partnerInfo);
	const updatePartnerInfo = usePartnerInfoStore(
		(state) => state.updatePartnerInfo,
	);

	useEffect(() => {
		if (!isValidUserInfo()) {
			router.push("/login");
			return;
		}
	});

	const updatePartnerInfoCallback = useCallback(() => {
		if (partnerId && userInfo.token) {
			updatePartnerInfo(partnerId, userInfo.token);
		}
	}, [partnerId, userInfo.token, updatePartnerInfo]);

	useEffect(() => {
		updatePartnerInfoCallback();
	}, [updatePartnerInfoCallback]);

	return (
		<div className="flex flex-col h-screen p-4">
			<h1 className="text-2xl text-center font-bold mb-4">
				Chat of {userInfo.nickname}
			</h1>
			<p>User ID: {userInfo.userId}</p>
			<p>Token: {userInfo.token}</p>
			<p>Partner ID: {parnerInfo.partnerId || "-"}</p>
			<p>Partner Nickname: {parnerInfo.nickname || "-"}</p>

			<Input
				type="text"
				placeholder="Partner ID"
				value={partnerId}
				onChange={(e) => setPartnerId(e.target.value)}
				className="mb-4"
			/>
		</div>
	);
}
