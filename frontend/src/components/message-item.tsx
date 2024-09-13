import { FileInfo } from "@/components/file-info";
import type { FileUpload, Message } from "@/types";

const statusColors = {
	sent: "bg-red-500",
	received: "bg-green-500",
};

export const MessageItem = ({
	message,
	userId,
}: { message: Message; userId: string }) => (
	<li
		className={`flex flex-col p-2 hover:bg-primary/35 transition-colors duration-150 ease-in-out rounded-lg mx-auto max-w-md shadow-md gap-2 ${
			message.senderId === userId ? "ml-auto bg-primary/10" : "mr-auto"
		}`}
	>
		<div className="flex">
			<div className="flex-1 min-w-0">
				<p className="font-semibold">
					{message.senderId === userId ? "You" : "Partner"}
				</p>
				<p>{message.body}</p>
			</div>
			<div
				className={`w-3 h-3 rounded-full ${statusColors[message.state as keyof typeof statusColors]}`}
			/>
		</div>
		<div className="flex flex-col m-0">
			{message.fileAttachments?.map((file: FileUpload) => (
				<FileInfo key={file.fileName} fileInfo={file} />
			))}
		</div>
	</li>
);
