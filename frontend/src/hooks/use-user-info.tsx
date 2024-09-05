import { useUserInfoStore } from "@/stores/user-info";
import { useMemo } from "react";

export function useUserInfo() {
	const userInfo = useUserInfoStore((state) => state.userInfo);
	const isValidUserInfo = useUserInfoStore((state) => state.isValidUserInfo);

	return useMemo(
		() => ({ userInfo, isValidUserInfo }),
		[userInfo, isValidUserInfo],
	);
}
