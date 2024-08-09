import { decryptMessage } from "@/lib/crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method === "POST") {
		try {
			const { encryptedMessage, encryptedAESKey, privateKey } = req.body;
			const decryptedMessage = await decryptMessage(
				encryptedMessage,
				encryptedAESKey,
				privateKey,
			);
			res.status(200).json({ decryptedMessage });
		} catch (error) {
			res.status(500).json({ error: "Error decrypting message" });
		}
	} else {
		res.setHeader("Allow", ["POST"]);
		res.status(405).end(`Method ${req.method} Not Allowed`);
	}
}
