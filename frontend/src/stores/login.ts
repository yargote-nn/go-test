import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

interface LoginState {
	isLoggedIn: boolean
	login: () => void
	logOut: () => void
}

const useLoginStore = create(
	persist<LoginState>(
		(set) => ({
			isLoggedIn: false,
			login: () => set({ isLoggedIn: true }),
			logOut: () => set({ isLoggedIn: false }),
		}),
		{
			name: "login",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
)

export { useLoginStore }
