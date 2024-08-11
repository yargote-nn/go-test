import { encryptMessage } from "@/lib/crypto";

export async function POST(req: Request) {
	const { message, publicKey } = await req.json();
	try {
		const { encryptedMessage, encryptedAESKey } = await encryptMessage(
			message,
			publicKey,
		);
		return Response.json({ encryptedMessage, encryptedAESKey });
	} catch (error) {
		return Response.json({ error: "Error encrypting message" });
	}
}
