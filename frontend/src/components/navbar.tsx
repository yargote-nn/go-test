"use client"

import { Button } from "@/components/ui/button"
import { useLogin } from "@/hooks/use-login"
import {
	Home,
	LogIn,
	LogOut,
	MessageCircle,
	Phone,
	UserPlus,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Navbar() {
	const { isLoggedIn, logOut } = useLogin()
	const pathname = usePathname()

	const pages = [
		{ name: "Home", path: "/", icon: Home },
		{ name: "Chat", path: "/chat", icon: MessageCircle },
		{ name: "Calls", path: "/calls", icon: Phone },
	]

	return (
		<header className="fixed top-0 right-0 left-0 z-50 bg-background shadow-md">
			<div className="container mx-auto px-4">
				<div className="flex h-16 items-center justify-between">
					<nav className="flex items-center space-x-4">
						{pages.map((page) => {
							const Icon = page.icon
							return (
								<Link
									key={page.path}
									href={page.path}
									className={`flex items-center space-x-2 font-medium text-sm transition-colors hover:text-primary ${pathname === page.path ? "text-primary" : "text-muted-foreground"}`}
								>
									<Icon className="h-4 w-4" />
									<span>{page.name}</span>
								</Link>
							)
						})}
					</nav>
					<div className="flex items-center space-x-4">
						{!isLoggedIn ? (
							<>
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
							</>
						) : (
							<Button variant="outline" size="sm" onClick={logOut}>
								<LogOut className="mr-2 h-4 w-4" />
								Logout
							</Button>
						)}
					</div>
				</div>
			</div>
		</header>
	)
}
