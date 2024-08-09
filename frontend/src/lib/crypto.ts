"use server";

import * as crypto from "node:crypto";

// Function to decrypt the message
export async function decryptMessage(
	encryptedMessage: string,
	encryptedAESKey: string,
	privateKeyPEM: string,
): Promise<string> {
	// Decode the private key
	const privateKey = crypto.createPrivateKey({
		key: privateKeyPEM,
		format: "pem",
		type: "pkcs1",
	});

	// Decrypt the AES key using the private key
	const decryptedAESKey = crypto.privateDecrypt(
		{
			key: privateKey,
			padding: crypto.constants.RSA_PKCS1_PADDING,
		},
		Buffer.from(encryptedAESKey, "base64"),
	);

	// Decrypt the message using the AES key
	const iv = Buffer.from(encryptedMessage, "base64").subarray(0, 16);
	const encryptedContent = Buffer.from(encryptedMessage, "base64").subarray(16);

	const decipher = crypto.createDecipheriv("aes-256-cfb", decryptedAESKey, iv);
	let decryptedContent = decipher.update(encryptedContent);
	decryptedContent = Buffer.concat([decryptedContent, decipher.final()]);

	return decryptedContent.toString();
}

export async function encryptMessage(
	message: string,
	publicKeyPEM: string,
): Promise<{ encryptedMessage: string; encryptedAESKey: string }> {
	// Generate a random AES key
	const aesKey = crypto.randomBytes(32);

	// Generate a random IV
	const iv = crypto.randomBytes(16);

	// Encrypt the message with AES
	const cipher = crypto.createCipheriv("aes-256-cfb", aesKey, iv);
	let encryptedContent = cipher.update(message, "utf8", "base64");
	encryptedContent += cipher.final("base64");

	// Combine IV and encrypted content
	const encryptedMessage = iv.toString("base64") + encryptedContent;

	// Encrypt the AES key with the RSA public key
	const encryptedAESKey = crypto
		.publicEncrypt(
			{
				key: publicKeyPEM,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				oaepHash: "sha256",
			},
			aesKey,
		)
		.toString("base64");

	return { encryptedMessage, encryptedAESKey };
}

export async function generateKeyPair(): Promise<{
	publicKey: string;
	privateKey: string;
}> {
	const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: {
			type: "spki",
			format: "pem",
		},
		privateKeyEncoding: {
			type: "pkcs8",
			format: "pem",
			cipher: "aes-256-cbc",
			passphrase: "",
		},
	});

	return { publicKey, privateKey };
}
