import { z } from "zod";

const UserInforSchema = z.object({
	userId: z.string(),
	nickname: z.string(),
	token: z.string(),
	privateKey: z.string(),
	publicKey: z.string(),
});

type UserInfo = z.infer<typeof UserInforSchema>;

export { UserInforSchema, type UserInfo };
