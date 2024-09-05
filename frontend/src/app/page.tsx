"use client";

import { Button } from "@/components/ui/button";
import { useUserInfo } from "@/hooks/use-user-info";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
	const { userInfo } = useUserInfo();
	const router = useRouter();

	useEffect(() => {
		if (userInfo) {
			router.push("/chat");
		}
	});

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24">
			<h1 className="text-4xl font-bold mb-8">Welcome to Secure Messaging</h1>
			<div className="space-x-4">
				<Link href="/login">
					<Button>Login</Button>
				</Link>
				<Link href="/register">
					<Button variant="outline">Register</Button>
				</Link>
			</div>
		</main>
	);
}
