import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserInfo } from "@/types";

interface UserInfoState {
	userInfo: UserInfo;
}

type UserInfoActions = {
	setUserInfo: (userInfo: UserInfo) => void;
	isValidUserInfo: () => boolean;
	clearUserInfo: () => void;
};

const initialState: UserInfoState = {
	userInfo: {
		userId: "",
		nickname: "",
		token: "",
		privateKey: "",
		publicKey: "",
	},
};

const useUserInfoStore = create(
	persist<UserInfoState & UserInfoActions>(
		(set, get) => ({
			...initialState,
			setUserInfo: (userInfo: UserInfo) => set({ userInfo }),
			isValidUserInfo: () => {
				const { userId, nickname, token, privateKey, publicKey } =
					get().userInfo;
				const isValidUserInfo = Boolean(
					userId && nickname && token && privateKey && publicKey,
				);
				return isValidUserInfo;
			},
			clearUserInfo: () => set(initialState),
		}),
		{
			name: "user-info",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);

export { useUserInfoStore };
