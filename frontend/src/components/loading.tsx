"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
	children?: ReactNode
	fallback?: ReactNode
}

interface State {
	hasError: boolean
}

class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
	}

	public static getDerivedStateFromError(_: Error): State {
		// Update state so the next render will show the fallback UI.
		return { hasError: true }
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Uncaught error:", error, errorInfo)
	}

	public render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className="flex min-h-screen items-center justify-center bg-gray-100">
						<div className="text-center">
							<h1 className="mb-4 font-bold text-3xl text-red-600">
								Oops! Something went wrong.
							</h1>
							<p className="text-gray-700">
								We're sorry for the inconvenience. Please try refreshing the
								page.
							</p>
						</div>
					</div>
				)
			)
		}

		return this.props.children
	}
}

export default ErrorBoundary
