"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { generateKeyPair } from "@/lib/crypto";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

const RegisterDataSchema = z.object({
	user_id: z.number(),
});

export default function Register() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const router = useRouter();
	const { toast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const { publicKey, privateKey } = await generateKeyPair();
			const response = await fetch("http://localhost:8080/api/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username,
					password,
					public_key: publicKey,
					private_key: privateKey,
				}),
			});

			if (response.ok) {
				const responseData = await response.json();
				const { data, success } = RegisterDataSchema.safeParse(responseData);
				if (success) {
					const { user_id } = data;
					console.log(user_id);
					if (user_id) {
						toast({
							title: "Registration successful",
							description: "Please login with your new account",
						});
						router.push("/login");
						return;
					}
					toast({
						title: "Registration failed",
						description: "User Not Created",
						variant: "destructive",
					});
				} else {
					toast({
						title: "Registration failed",
						description: "Please try again. Invalid response",
						variant: "destructive",
					});
				}
			} else {
				toast({
					title: "Registration failed",
					description: "Please try again",
				});
			}
		} catch (error) {
			toast({
				title: "Registration failed",
				description: "Please try again",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-24">
			<h1 className="text-2xl font-bold mb-8">Register</h1>
			<form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
				<Input
					type="text"
					placeholder="Username"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					required
				/>
				<Input
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
				<Button type="submit" className="w-full">
					Register
				</Button>
			</form>
		</div>
	);
}
