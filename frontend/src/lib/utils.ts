import { type ClassValue, clsx } from "clsx";
import CryptoJS from "crypto-js";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const deriveAESKey = (password: string): string => {
	const salt = CryptoJS.enc.Utf8.parse(process.env.SALT ?? "salt");

	return CryptoJS.PBKDF2(password, salt, {
		keySize: 256 / 32,
		iterations: 1000,
	}).toString();
};

export const encryptMessage = (message: string, aesKey: string): string => {
	return CryptoJS.AES.encrypt(message, aesKey).toString();
};

export const decryptMessage = (
	encryptedMessage: string,
	aesKey: string,
): string => {
	const bytes = CryptoJS.AES.decrypt(encryptedMessage, aesKey);
	return bytes.toString(CryptoJS.enc.Utf8);
};
