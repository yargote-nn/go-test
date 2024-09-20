import { CallsProvider } from "@/components/calls/call-context"
import CallsComponent from "@/components/calls/calls"

import ErrorBoundary from "@/components/error-boundary"
import Loading from "@/components/loading"
import { Suspense } from "react"

export default function CallsPage() {
	return (
		<ErrorBoundary>
			<CallsProvider>
				<Suspense fallback={<Loading />}>
					<CallsComponent />
				</Suspense>
			</CallsProvider>
		</ErrorBoundary>
	)
}
