import { z } from "zod"

const PartnerInfoSchema = z.object({
	partnerId: z.string(),
	publicKey: z.string(),
	nickname: z.string(),
})

type PartnerInfo = z.infer<typeof PartnerInfoSchema>

export { PartnerInfoSchema, type PartnerInfo }
