import { Navbar } from "@/components/navbar"
import { Toaster } from "@/components/ui/toaster"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
	title: "Secure Messaging",
	description: "A secure messaging application",
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en" className="h-full">
			<body className={`${inter.className} flex min-h-full flex-col`}>
				<Navbar />
				<main className="flex-grow pt-16">{children}</main>
				<Toaster />
			</body>
		</html>
	)
}
