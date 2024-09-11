import { z } from "zod";

const loginDataSchema = z.object({
	id: z.string(),
	nickname: z.string(),
	token: z.string(),
	privateKey: z.string(),
	publicKey: z.string(),
});

type LoginData = z.infer<typeof loginDataSchema>;

export { loginDataSchema, type LoginData };
