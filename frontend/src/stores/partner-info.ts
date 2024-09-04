import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getApiUrl } from "@/lib/utils";
import { userToPartner } from "@/mappers/userToPartner";
import { type PartnerInfo, UserSchema } from "@/types";

interface ParnterInfoState {
	partnerInfo: PartnerInfo;
}

type PartnerInfoActions = {
	setPartnerInfo: (partnerInfo: PartnerInfo) => void;
	updatePartnerInfo: (partnerId: string, token: string) => Promise<void>;
	clearPartnerInfo: () => void;
};

const initialState: ParnterInfoState = {
	partnerInfo: {
		partnerId: "",
		publicKey: "",
		nickname: "",
	},
};

const usePartnerInfoStore = create(
	persist<ParnterInfoState & PartnerInfoActions>(
		(set) => ({
			...initialState,
			setPartnerInfo: (partnerInfo: PartnerInfo) => set({ partnerInfo }),
			updatePartnerInfo: async (partnerId: string, token: string) => {
				const response = await fetch(`${getApiUrl()}/api/users/${partnerId}`, {
					headers: { Authorization: `Bearer ${token}` },
					method: "GET",
				});
				const responseData = await response.json();
				console.log("Response data:", responseData);
				const { data: user, success } = UserSchema.safeParse(responseData);
				if (success) {
					const partnerInfo = userToPartner(user);
					set({ partnerInfo });
				}
			},
			clearPartnerInfo: () => set(initialState),
		}),
		{
			name: "partner-info",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);

export { usePartnerInfoStore };
