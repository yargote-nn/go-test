import { cn } from "@/lib/utils";
import type * as React from "react";

function BroadcastOff({ className, ...props }: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={24}
			height={24}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn(
				"icon icon-tabler icons-tabler-outline icon-tabler-broadcast-off",
				className,
			)}
			{...props}
		>
			<title>{"Broadcast Off"}</title>
			<path d="M0 0h24v24H0z" stroke="none" />
			<path d="M18.364 19.364A9 9 0 008.643 4.647M6.155 6.156a9 9 0 00-.519 13.208" />
			<path d="M15.536 16.536A5 5 0 0012 8M9 9a5 5 0 00-.535 7.536M12 12a1 1 0 101 1M3 3l18 18" />
		</svg>
	);
}

function Broadcast({ className, ...props }: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={24}
			height={24}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn(
				"icon icon-tabler icons-tabler-outline icon-tabler-broadcast",
				className,
			)}
			{...props}
		>
			<title>{"Broadcast"}</title>
			<path d="M0 0h24v24H0z" stroke="none" />
			<path d="M18.364 19.364a9 9 0 10-12.728 0M15.536 16.536a5 5 0 10-7.072 0" />
			<path d="M11 13a1 1 0 102 0 1 1 0 10-2 0" />
		</svg>
	);
}

export { Broadcast, BroadcastOff };
