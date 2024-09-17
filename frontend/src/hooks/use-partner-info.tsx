import { usePartnerInfoStore } from "@/stores/partner-info"
import { useMemo } from "react"

export function usePartnerInfo() {
	const partnerInfo = usePartnerInfoStore((state) => state.partnerInfo)
	const updatePartnerInfo = usePartnerInfoStore(
		(state) => state.updatePartnerInfo,
	)
	const setPartnerInfo = usePartnerInfoStore((state) => state.setPartnerInfo)
	const resetPartnerInfo = usePartnerInfoStore(
		(state) => state.resetPartnerInfo,
	)

	return useMemo(
		() => ({
			partnerInfo,
			updatePartnerInfo,
			setPartnerInfo,
			resetPartnerInfo,
		}),
		[partnerInfo, updatePartnerInfo, setPartnerInfo, resetPartnerInfo],
	)
}
