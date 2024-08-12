import { encryptMessage } from "@/lib/crypto";

export async function POST(req: Request) {
	const { message, publicKeyReceiver, publicKeySender } = await req.json();
	try {
		const { encryptedMessage, encryptedAESKeyReciever, encryptedAESKeySender } =
			await encryptMessage(message, publicKeyReceiver, publicKeySender);
		return Response.json({
			encryptedMessage,
			encryptedAESKeyReciever,
			encryptedAESKeySender,
		});
	} catch (error) {
		return Response.json({ error: "Error encrypting message" });
	}
}
