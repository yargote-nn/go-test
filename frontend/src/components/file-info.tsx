import {
	Download,
	FileAudio,
	FileIcon,
	FileImage,
	FileVideo,
} from "lucide-react"

interface FileInfo {
	fileName: string
	fileSize: number
	fileType: string
	fileUrl: string
}

export const FileInfo: React.FC<{ fileInfo: FileInfo }> = ({ fileInfo }) => {
	const { fileName, fileSize, fileType, fileUrl } = fileInfo

	const _formatFileSize = (size: number): string => {
		if (size < 1024) return `${size} B`
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
		return `${(size / (1024 * 1024)).toFixed(2)} MB`
	}

	const isImage = fileType.startsWith("image/")
	const isVideo = fileType.startsWith("video/")
	const isAudio = fileType.startsWith("audio/")

	return (
		<div className="rounded-lg border p-2 shadow-sm">
			<div className="mb-4 flex items-center">
				{isImage ? (
					<FileImage className="mr-2 size-4" />
				) : isVideo ? (
					<FileVideo className="mr-2 size-4" />
				) : isAudio ? (
					<FileAudio className="mr-2 size-4" />
				) : (
					<FileIcon className="mr-2 size-4" />
				)}
				<h2 className="font-semibold">{fileName}</h2>
			</div>
			{/* <div className="space-y-2">
				<p>
					<strong>Size:</strong> {formatFileSize(fileSize)}
				</p>
				<p>
					<strong>Type:</strong> {fileType}
				</p>
			</div> */}
			{isImage ? (
				<div className="mt-4">
					<img
						src={fileUrl}
						alt={fileName}
						className="h-auto max-w-full rounded-lg shadow-md"
					/>
				</div>
			) : isVideo ? (
				<div className="mt-4">
					<video
						src={fileUrl}
						controls
						className="h-auto max-w-full rounded-lg shadow-md"
					>
						<track kind="captions" />
					</video>
				</div>
			) : isAudio ? (
				<div className="mt-4">
					<audio
						src={fileUrl}
						controls
						className="h-auto max-w-full rounded-lg shadow-md"
					>
						<track kind="captions" />
					</audio>
				</div>
			) : (
				<div className="mt-4">
					<a
						href={fileUrl}
						download={fileName}
						className="inline-flex items-center rounded-lg px-4 py-2 transition-colors hover:bg-background/20"
					>
						<Download className="mr-2 h-5 w-5" />
						Download File
					</a>
				</div>
			)}
		</div>
	)
}
