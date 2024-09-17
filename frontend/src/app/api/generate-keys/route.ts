import { generateKeyPair } from "@/lib/crypto"

export async function GET() {
	try {
		const { publicKey, privateKey } = await generateKeyPair()
		return Response.json({ publicKey, privateKey })
	} catch (_error) {
		return Response.json({ error: "Error encrypting message" })
	}
}
