import { z } from "zod";

const UserSchema = z.object({
	id: z.number(),
	nickname: z.string(),
	publicKey: z.string(),
});

type User = z.infer<typeof UserSchema>;

export { UserSchema, type User };
