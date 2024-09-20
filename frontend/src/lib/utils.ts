import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function getApiUrl() {
	return process.env.NEXT_PUBLIC_API_HOST ?? "http://localhost:8000"
}

export function getServerUrl() {
	return process.env.NEXT_PUBLIC_SERVER_HOST ?? "http://localhost:8000"
}

export function getWsUrl() {
	return process.env.NEXT_PUBLIC_WS_HOST ?? "ws://localhost:8000"
}
