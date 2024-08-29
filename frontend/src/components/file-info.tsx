import { Download, FileIcon, FileImage } from "lucide-react";

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

	return (
		<div className="p-4 border rounded-lg shadow-sm">
			<div className="flex items-center mb-4">
				{isImage ? (
					<FileImage className="w-8 h-8 text-blue-500 mr-2" />
				) : (
					<FileIcon className="w-8 h-8 text-gray-500 mr-2" />
				)}
				<h2 className="text-xl font-semibold">{fileName}</h2>
			</div>
			<div className="space-y-2">
				<p>
					<strong>Size:</strong> {formatFileSize(fileSize)}
				</p>
				<p>
					<strong>Type:</strong> {fileType}
				</p>
			</div>
			{isImage ? (
				<div className="mt-4">
					<img
						src={fileUrl}
						alt={fileName}
						className="max-w-full h-auto rounded-lg shadow-md"
					/>
				</div>
			) : (
				<div className="mt-4">
					<a
						href={fileUrl}
						download={fileName}
						className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
					>
						<Download className="w-5 h-5 mr-2" />
						Download File
					</a>
				</div>
			)}
		</div>
	);
};
