import { useLoginStore } from "@/stores/login"
import { usePartnerInfoStore } from "@/stores/partner-info"
import { useUserInfoStore } from "@/stores/user-info"

export function useLogin() {
	const { isLoggedIn, logOut: logout, login } = useLoginStore()
	const { resetPartnerInfo } = usePartnerInfoStore()
	const { clearUserInfo } = useUserInfoStore()

	const logOut = () => {
		logout()
		resetPartnerInfo()
		clearUserInfo()
	}

	return { isLoggedIn, login, logOut }
}
