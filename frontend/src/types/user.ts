import { z } from "zod"

const UserSchema = z.object({
	id: z.string(),
	nickname: z.string(),
	publicKey: z.string(),
})

type User = z.infer<typeof UserSchema>

export { UserSchema, type User }
