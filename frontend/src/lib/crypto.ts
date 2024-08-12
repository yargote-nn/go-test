"use server";

import crypto from "crypto";

function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
	return new Promise((resolve, reject) => {
		crypto.generateKeyPair(
			"rsa",
			{
				modulusLength: 2048,
				publicKeyEncoding: {
					type: "spki",
					format: "pem",
				},
				privateKeyEncoding: {
					type: "pkcs8",
					format: "pem",
				},
			},
			(err, publicKey, privateKey) => {
				if (err) {
					console.error("Error generating key pair:", err);
					reject(err);
				} else {
					resolve({ publicKey, privateKey });
				}
			},
		);
	});
}

async function encryptMessage(
	message: string,
	publicKey: string,
): Promise<{ encryptedMessage: string; encryptedAESKey: string }> {
	try {
		// Generate AES key
		const aesKey = crypto.randomBytes(32);

		// Encrypt AES key with RSA public key
		const encryptedAESKey = crypto.publicEncrypt(
			{
				key: publicKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			},
			aesKey,
		);

		// Encrypt message with AES key
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
		let encryptedMessage = cipher.update(message, "utf8", "base64");
		encryptedMessage += cipher.final("base64");

		// Combine IV and encrypted message
		const combinedMessage = `${iv.toString("base64")}:${encryptedMessage}`;

		return {
			encryptedMessage: combinedMessage,
			encryptedAESKey: encryptedAESKey.toString("base64"),
		};
	} catch (error) {
		console.error("Error encrypting message:", error);
		throw error;
	}
}

async function decryptMessage(
	encryptedMessage: string,
	encryptedAESKey: string,
	privateKey: string,
): Promise<string> {
	try {
		// Ensure privateKey is a string
		if (typeof privateKey !== "string") {
			throw new TypeError("Private key must be a string");
		}

		// Decrypt AES key
		const aesKey = crypto.privateDecrypt(
			{
				key: privateKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			},
			Buffer.from(encryptedAESKey, "base64"),
		);

		// Split IV and encrypted message
		const [ivBase64, encryptedData] = encryptedMessage.split(":");
		const iv = Buffer.from(ivBase64, "base64");

		// Decrypt message
		const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
		let decryptedMessage = decipher.update(encryptedData, "base64", "utf8");
		decryptedMessage += decipher.final("utf8");

		return decryptedMessage;
	} catch (error) {
		console.error("Error decrypting message:", error);
		throw error;
	}
}

export { decryptMessage, encryptMessage, generateKeyPair };
