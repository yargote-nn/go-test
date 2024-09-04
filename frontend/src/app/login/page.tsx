"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { getServerUrl } from "@/lib/utils";
import { useUserInfoStore } from "@/stores/user-info";
import type { UserInfo } from "@/types";
import { loginDataSchema } from "@/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
	const [nickname, setNickname] = useState("");
	const router = useRouter();
	const { toast } = useToast();
	const setUserInfo = useUserInfoStore((state) => state.setUserInfo);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const response = await fetch(`${getServerUrl()}/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ nickname }),
			});
			const jsonData = await response.json();
			const { data, success } = loginDataSchema.safeParse(jsonData);
			if (success) {
				const userInfo: UserInfo = {
					userId: data.id.toString(),
					nickname: data.nickname,
					token: data.token,
					privateKey: data.privateKey,
					publicKey: data.publicKey,
				};
				setUserInfo(userInfo);
				toast({
					title: "Login successful",
					description: "Welcome back!",
				});
				router.push("/chat");
			} else {
				toast({
					title: "Login failed",
					description: "Invalid credentials",
				});
			}
		} catch (error) {
			console.error(error);
			toast({
				title: "Login failed",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-24">
			<h1 className="text-2xl font-bold mb-8">Login</h1>
			<form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
				<Input
					type="text"
					placeholder="Nickname"
					value={nickname}
					onChange={(e) => setNickname(e.target.value)}
					required
				/>
				<Button type="submit" className="w-full">
					Login
				</Button>
			</form>
		</div>
	);
}
