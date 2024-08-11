import { decryptMessage } from "@/lib/crypto";

export async function POST(req: Request) {
	const { encryptedMessage, encryptedAESKey, privateKey } = await req.json();
	try {
		const decryptedMessage = await decryptMessage(
			encryptedMessage,
			encryptedAESKey,
			privateKey,
		);
		return Response.json({ decryptedMessage });
	} catch (error) {
		return Response.json({ error: "Error decrypting message" });
	}
}
