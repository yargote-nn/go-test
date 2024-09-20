import { FileInfo } from "@/components/file-info"
import type { FileUpload, Message } from "@/types"

const statusColors = {
	sent: "bg-yellow-500",
	received: "bg-green-500",
}

interface MessageItemProps {
	message: Message
	userId: string
}

export function MessageItem({ message, userId }: MessageItemProps) {
	return (
		<li
			className={`mx-auto flex max-w-md flex-col gap-2 rounded-lg p-2 shadow-md transition-colors duration-150 ease-in-out hover:bg-primary/35 ${
				message.senderId === userId ? "ml-auto bg-primary/10" : "mr-auto"
			}`}
		>
			<div className="flex">
				<div className="min-w-0 flex-1">
					<p className="font-semibold">
						{message.senderId === userId ? "You" : "Partner"}
					</p>
					<p>{message.body}</p>
				</div>
				<div
					className={`h-3 w-3 rounded-full ${statusColors[message.state as keyof typeof statusColors]}`}
				/>
			</div>
			<div className="m-0 flex flex-col">
				{message.fileAttachments?.map((file: FileUpload) => (
					<FileInfo key={file.fileName} fileInfo={file} />
				))}
			</div>
		</li>
	)
}
