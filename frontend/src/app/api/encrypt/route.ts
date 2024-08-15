import { encryptMessage } from "@/lib/crypto";

export async function POST(req: Request) {
	const { message, publicKeyReceiver, publicKeySender, fileUploads } =
		await req.json();
	try {
		const {
			encryptedMessage,
			encryptedAESKeyReceiver,
			encryptedAESKeySender,
			encryptedFilesUploads,
		} = await encryptMessage(
			message,
			publicKeyReceiver,
			publicKeySender,
			fileUploads,
		);
		return Response.json({
			encryptedMessage,
			encryptedAESKeyReceiver,
			encryptedAESKeySender,
			encryptedFilesUploads,
		});
	} catch (error) {
		return Response.json({ error: "Error encrypting message" });
	}
}
