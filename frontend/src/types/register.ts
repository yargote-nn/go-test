import { z } from "zod";

const RegisterDataSchema = z.object({
	id: z.number(),
});

export { RegisterDataSchema };
