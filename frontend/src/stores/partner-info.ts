import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { getApiUrl } from "@/lib/utils"
import { userToPartner } from "@/mappers/userToPartner"
import { type PartnerInfo, UserSchema } from "@/types"

interface ParnterInfoState {
	partnerInfo: PartnerInfo | null
	setPartnerInfo: (partnerInfo: PartnerInfo) => void
	updatePartnerInfo: (partnerNickname: string, token: string) => Promise<void>
	resetPartnerInfo: () => void
}

const usePartnerInfoStore = create(
	persist<ParnterInfoState>(
		(set) => ({
			partnerInfo: null,
			setPartnerInfo: (partnerInfo: PartnerInfo) => set({ partnerInfo }),
			updatePartnerInfo: async (partnerNickname: string, token: string) => {
				try {
					const response = await fetch(
						`${getApiUrl()}/api/users?nickname=${partnerNickname}`,
						{
							headers: { Authorization: `Bearer ${token}` },
							method: "GET",
						},
					)
					const responseData = await response.json()
					console.log("responseData", responseData)
					const { data: user, success } = UserSchema.safeParse(responseData)
					if (success) {
						const partnerInfo = userToPartner(user)
						set({ partnerInfo })
					} else {
						set({ partnerInfo: null })
					}
				} catch (error) {
					console.error("Error fetching partner info:", error)
				}
			},
			resetPartnerInfo: () => set({ partnerInfo: null }),
		}),
		{
			name: "partner-info",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
)

export { usePartnerInfoStore }
