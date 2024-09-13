import {
	Download,
	FileAudio,
	FileIcon,
	FileImage,
	FileVideo,
} from "lucide-react";

interface FileInfo {
	fileName: string;
	fileSize: number;
	fileType: string;
	fileUrl: string;
}

export const FileInfo: React.FC<{ fileInfo: FileInfo }> = ({ fileInfo }) => {
	const { fileName, fileSize, fileType, fileUrl } = fileInfo;

	const formatFileSize = (size: number): string => {
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
		return `${(size / (1024 * 1024)).toFixed(2)} MB`;
	};

	const isImage = fileType.startsWith("image/");
	const isVideo = fileType.startsWith("video/");
	const isAudio = fileType.startsWith("audio/");

	return (
		<div className="p-2 border rounded-lg shadow-sm">
			<div className="flex items-center mb-4">
				{isImage ? (
					<FileImage className="size-4 mr-2" />
				) : isVideo ? (
					<FileVideo className="size-4 mr-2" />
				) : isAudio ? (
					<FileAudio className="size-4 mr-2" />
				) : (
					<FileIcon className="size-4 mr-2" />
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
						className="max-w-full h-auto rounded-lg shadow-md"
					/>
				</div>
			) : isVideo ? (
				<div className="mt-4">
					<video
						src={fileUrl}
						controls
						className="max-w-full h-auto rounded-lg shadow-md"
					>
						<track kind="captions" />
					</video>
				</div>
			) : isAudio ? (
				<div className="mt-4">
					<audio
						src={fileUrl}
						controls
						className="max-w-full h-auto rounded-lg shadow-md"
					>
						<track kind="captions" />
					</audio>
				</div>
			) : (
				<div className="mt-4">
					<a
						href={fileUrl}
						download={fileName}
						className="inline-flex items-center px-4 py-2 rounded-lg hover:bg-background/20 transition-colors"
					>
						<Download className="w-5 h-5 mr-2" />
						Download File
					</a>
				</div>
			)}
		</div>
	);
};
