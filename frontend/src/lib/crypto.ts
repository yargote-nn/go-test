"use server"

import crypto from "crypto"
import { z } from "zod"

const FileUploadSchema = z.object({
	fileName: z.string(),
	fileSize: z.number(),
	fileType: z.string(),
	fileUrl: z.string(),
})

const FileUploadsSchema = z.array(FileUploadSchema)

type FileUploads = z.infer<typeof FileUploadsSchema>

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
					console.error("Error generating key pair:", err)
					reject(err)
				} else {
					resolve({ publicKey, privateKey })
				}
			},
		)
	})
}

function encryptString(data: string, aesKey: Buffer, iv: Buffer): string {
	const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv)
	let encryptedData = cipher.update(data, "utf8", "base64")
	encryptedData += cipher.final("base64")
	return `${iv.toString("base64")}:${encryptedData}`
}

function decryptString(encryptedData: string, aesKey: Buffer): string {
	const [ivBase64, encryptedString] = encryptedData.split(":")
	const iv = Buffer.from(ivBase64, "base64")
	const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv)
	let decryptedData = decipher.update(encryptedString, "base64", "utf8")
	decryptedData += decipher.final("utf8")
	return decryptedData
}

async function encryptMessage(
	message: string,
	publicKeyReceiver: string,
	publicKeySender: string,
	fileUploads: FileUploads,
): Promise<{
	encryptedMessage: string
	encryptedAESKeyReceiver: string
	encryptedAESKeySender: string
	encryptedFilesUploads: FileUploads
}> {
	try {
		// Generate AES key
		const aesKey = crypto.randomBytes(32)

		// Encrypt AES key with RSA public key of receiver
		const encryptedAESKeyReceiver = crypto.publicEncrypt(
			{
				key: publicKeyReceiver,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			},
			aesKey,
		)

		// Encrypt AES key with RSA public key of sender
		const encryptedAESKeySender = crypto.publicEncrypt(
			{
				key: publicKeySender,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			},
			aesKey,
		)

		// Encrypt message with AES key
		const iv = crypto.randomBytes(16)
		const encryptedMessage = encryptString(message, aesKey, iv)

		// Encrypt file uploads with AES key
		const encryptedFileUploads = fileUploads.map((fileUpload) => {
			const encryptedFileUploadURL = encryptString(
				fileUpload.fileUrl,
				aesKey,
				iv,
			)

			return {
				fileName: fileUpload.fileName,
				fileSize: fileUpload.fileSize,
				fileType: fileUpload.fileType,
				fileUrl: encryptedFileUploadURL,
			}
		})

		return {
			encryptedMessage,
			encryptedAESKeyReceiver: encryptedAESKeyReceiver.toString("base64"),
			encryptedAESKeySender: encryptedAESKeySender.toString("base64"),
			encryptedFilesUploads: encryptedFileUploads,
		}
	} catch (error) {
		console.error("Error encrypting message:", error)
		throw error
	}
}

async function decryptMessage(
	encryptedMessage: string,
	encryptedAESKey: string,
	privateKey: string,
	fileUploads: FileUploads | string,
): Promise<{ decryptedMessage: string; decryptedFileUploads: FileUploads }> {
	try {
		// Ensure privateKey is a string
		if (typeof privateKey !== "string") {
			throw new TypeError("Private key must be a string")
		}

		let parsedFileUploads: FileUploads = []

		if (typeof fileUploads === "string") {
			parsedFileUploads = JSON.parse(fileUploads)
		} else {
			const { data, success } = FileUploadsSchema.safeParse(fileUploads)
			if (!success) {
				throw new Error("Invalid file uploads")
			}
			parsedFileUploads = data
		}

		// Decrypt AES key
		const aesKey = crypto.privateDecrypt(
			{
				key: privateKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			},
			Buffer.from(encryptedAESKey, "base64"),
		)

		// Decrypt message
		const decryptedMessage = decryptString(encryptedMessage, aesKey)

		let decryptedFileUploads: FileUploads = []
		if (parsedFileUploads.length === 0) {
			return { decryptedMessage, decryptedFileUploads }
		}
		// Decrypt url from file uploads
		decryptedFileUploads = parsedFileUploads.map((fileUpload) => {
			const decryptedFileUploadURL = decryptString(fileUpload.fileUrl, aesKey)

			return {
				fileName: fileUpload.fileName,
				fileSize: fileUpload.fileSize,
				fileType: fileUpload.fileType,
				fileUrl: decryptedFileUploadURL,
			}
		})

		return { decryptedMessage, decryptedFileUploads }
	} catch (error) {
		console.error("Error decrypting message:", error)
		throw error
	}
}

export { decryptMessage, encryptMessage, generateKeyPair }
