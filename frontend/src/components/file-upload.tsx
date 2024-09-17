import { FileInfo } from "@/components/file-info"
import { Input } from "@/components/ui/input"
import type { FileUploads } from "@/types"

export const FileUpload = ({
	onFileUpload,
	fileUploads,
}: {
	onFileUpload: (files: File[]) => void
	fileUploads: FileUploads
}) => {
	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || [])
		onFileUpload(files)
	}

	return (
		<>
			<Input
				type="file"
				onChange={handleFileChange}
				className="flex-1"
				multiple={true}
			/>
			{fileUploads.length > 0 && (
				<div className="mt-2">
					<p>Attached files:</p>
					{fileUploads.map((file) => (
						<FileInfo key={file.fileName} fileInfo={file} />
					))}
				</div>
			)}
		</>
	)
}
