import { z } from "zod"

const RegisterDataSchema = z.object({
	created: z.boolean(),
})

export { RegisterDataSchema }
