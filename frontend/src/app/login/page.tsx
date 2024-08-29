// src/app/login/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

const loginDataSchema = z.object({
	id: z.number(),
	nickname: z.string(),
	token: z.string(),
	privateKey: z.string(),
	publicKey: z.string(),
});

export default function Login() {
	const [nickname, setNickname] = useState("");
	const router = useRouter();
	const { toast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const response = await fetch("http://localhost:8000/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ nickname }),
			});
			const jsonData = await response.json();
			console.log(jsonData);
			const { data, success } = loginDataSchema.safeParse(jsonData);
			if (success) {
				localStorage.setItem("token", data.token);
				localStorage.setItem("user_id", data.id.toString());
				localStorage.setItem("nickname", data.nickname);
				localStorage.setItem(`private_key_${data.id}`, data.privateKey);
				localStorage.setItem(`public_key_${data.id}`, data.publicKey);
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
