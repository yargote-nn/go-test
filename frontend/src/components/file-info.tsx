import { Download, FileIcon, FileImage } from "lucide-react";

interface FileInfo {
	file_name: string;
	file_size: number;
	file_type: string;
	file_url: string;
}

export const FileInfo: React.FC<{ fileInfo: FileInfo }> = ({ fileInfo }) => {
	const { file_name, file_size, file_type, file_url } = fileInfo;

	const formatFileSize = (size: number): string => {
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
		return `${(size / (1024 * 1024)).toFixed(2)} MB`;
	};

	const isImage = file_type.startsWith("image/");

	return (
		<div className="p-4 border rounded-lg shadow-sm">
			<div className="flex items-center mb-4">
				{isImage ? (
					<FileImage className="w-8 h-8 text-blue-500 mr-2" />
				) : (
					<FileIcon className="w-8 h-8 text-gray-500 mr-2" />
				)}
				<h2 className="text-xl font-semibold">{file_name}</h2>
			</div>
			<div className="space-y-2">
				<p>
					<strong>Size:</strong> {formatFileSize(file_size)}
				</p>
				<p>
					<strong>Type:</strong> {file_type}
				</p>
			</div>
			{isImage ? (
				<div className="mt-4">
					<img
						src={file_url}
						alt={file_name}
						className="max-w-full h-auto rounded-lg shadow-md"
					/>
				</div>
			) : (
				<div className="mt-4">
					<a
						href={file_url}
						download={file_name}
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
