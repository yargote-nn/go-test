import type { PartnerInfo, User } from "@/types"

function userToPartner(userInfo: User): PartnerInfo {
	return {
		partnerId: userInfo.id.toString(),
		nickname: userInfo.nickname,
		publicKey: userInfo.publicKey,
	}
}

function partnerToUser(partnerInfo: PartnerInfo): User {
	return {
		id: Number(partnerInfo.partnerId),
		nickname: partnerInfo.nickname,
		publicKey: partnerInfo.publicKey,
	}
}

export { partnerToUser, userToPartner }
