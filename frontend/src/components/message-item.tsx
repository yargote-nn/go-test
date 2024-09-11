import { FileInfo } from "@/components/file-info";
import type { FileUpload, Message } from "@/types";

export const MessageItem = ({
	message,
	userId,
}: { message: Message; userId: string }) => (
	<div
		className={`p-2 rounded-lg mx-auto bg-gray-200 max-w-md ${
			message.senderId === userId ? "ml-auto bg-blue-200" : "mr-auto"
		}`}
	>
		<p>{`${
			message.senderId === userId ? "You" : "Partner"
		}: ${message.body}`}</p>
		<p className="text-xs text-gray-500">{message.state}</p>
		{message.fileAttachments?.map((file: FileUpload) => (
			<FileInfo key={file.fileName} fileInfo={file} />
		))}
	</div>
);
