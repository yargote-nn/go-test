"use client"

import { Button } from "@/components/ui/button"
import { useUserInfo } from "@/hooks/use-user-info"
import { LogIn, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Home() {
	const { userInfo } = useUserInfo()
	const router = useRouter()

	useEffect(() => {
		if (userInfo) {
			router.push("/chat")
		}
	})

	return (
		<main className="flex flex-col items-center justify-center p-24">
			<h1 className="mb-8 font-bold text-4xl">Welcome to Secure Messaging</h1>
			<div className="space-x-4">
				<Link href="/register">
					<Button variant="outline" size="sm">
						<UserPlus className="mr-2 h-4 w-4" />
						Register
					</Button>
				</Link>
				<Link href="/login">
					<Button variant="default" size="sm">
						<LogIn className="mr-2 h-4 w-4" />
						Login
					</Button>
				</Link>
			</div>
		</main>
	)
}
