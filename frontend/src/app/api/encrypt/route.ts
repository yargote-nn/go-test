import { encryptMessage } from "@/lib/crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method === "POST") {
		try {
			const { message, publicKey } = req.body;
			const encryptedData = await encryptMessage(message, publicKey);
			res.status(200).json(encryptedData);
		} catch (error) {
			res.status(500).json({ error: "Error encrypting message" });
		}
	} else {
		res.setHeader("Allow", ["POST"]);
		res.status(405).end(`Method ${req.method} Not Allowed`);
	}
}
