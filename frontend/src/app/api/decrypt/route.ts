import { decryptMessage } from "@/lib/crypto"

export async function POST(req: Request) {
	const { encryptedMessage, encryptedAESKey, privateKey, fileUploads } =
		await req.json()
	try {
		const { decryptedMessage, decryptedFileUploads } = await decryptMessage(
			encryptedMessage,
			encryptedAESKey,
			privateKey,
			fileUploads,
		)
		return Response.json({ decryptedMessage, decryptedFileUploads })
	} catch (error) {
		console.error("Error decrypting message:", error)
		return Response.json({ error: "Error decrypting message" })
	}
}
