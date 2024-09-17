import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { UserInfo } from "@/types"

interface UserInfoState {
	userInfo: UserInfo | null
}

type UserInfoActions = {
	setUserInfo: (userInfo: UserInfo) => void
	isValidUserInfo: () => boolean
	clearUserInfo: () => void
}

const useUserInfoStore = create(
	persist<UserInfoState & UserInfoActions>(
		(set, get) => ({
			userInfo: null,
			setUserInfo: (userInfo: UserInfo) => set({ userInfo }),
			isValidUserInfo: () => {
				const user = get().userInfo
				if (!user) return false
				const { userId, nickname, token, privateKey, publicKey } = user
				const isValidUserInfo = Boolean(
					userId && nickname && token && privateKey && publicKey,
				)
				return isValidUserInfo
			},
			clearUserInfo: () => set({ userInfo: null }),
		}),
		{
			name: "user-info",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
)

export { useUserInfoStore }
