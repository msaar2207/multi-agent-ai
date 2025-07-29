import { useState, useEffect, ChangeEvent } from 'react';
import { getToken } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { UploadCloud, FileText, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import ConfirmationModal from '../SharedComponents/ConfirmationModal'; // Import ConfirmationModal

interface OrgFile {
  id: string; // MongoDB ID
  filename: string;
  openai_file_id: string;
  uploaded_at: string;
  // Add other relevant fields if returned by the API, e.g., uploaded_by_user_id
}

interface OrgFileManagerProps {
  orgId: string;
}

export default function OrgFileManager({ orgId }: OrgFileManagerProps) {
  const [files, setFiles] = useState<OrgFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // Changed to File[]
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [error, setError] = useState<string | null>(null); // General error for the component (e.g. initial fetch)
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // State for ConfirmationModal
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchFiles = async () => {
    if (!orgId) return;
    setLoadingFiles(true);
    setError(null);
    const token = getToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to fetch files.");
      }
      const data: OrgFile[] = await res.json();
      // Ensure 'id' field, as backend might send '_id'
      setFiles(data.map(f => ({ ...f, id: (f as any)._id || f.id })));
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Could not fetch files.");
      console.error("Failed to fetch files:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchFiles();
    }
  }, [orgId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFiles(Array.from(event.target.files)); // Store all selected files
      setError(null); // Clear previous errors
    } else {
      setSelectedFiles([]);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select one or more files to upload.");
      toast.error("Please select one or more files.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0); // Reset progress for the batch
    const token = getToken();
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file); // Use 'files' as the field name, matching backend
    });

    try {
      // Simulate progress for the batch
      let progress = 0;
      const interval = setInterval(() => {
        progress = Math.min(progress + 10, 90); // Simulate progress up to 90%
        setUploadProgress(progress);
      }, 200); // Update every 200ms

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(interval); // Stop simulation
      setUploadProgress(100); // Mark as complete

      if (!res.ok) {
        // Try to parse error from backend for the whole batch
        const errorData = await res.json().catch(() => ({ detail: "File upload failed with status: " + res.status }));
        throw new Error(errorData.detail || "An unknown error occurred during upload.");
      }

      const results = await res.json(); // Expecting a list of results from backend
      let allSuccessful = true;
      results.forEach((result: any) => {
        if (result.status === "success") {
          toast.success(`File "${result.file_info?.filename || 'unknown file'}" uploaded successfully!`);
        } else {
          allSuccessful = false;
          toast.error(`Failed to upload "${result.filename || 'unknown file'}": ${result.detail || 'Unknown error'}`);
        }
      });

      if (allSuccessful) {
        // toast.success("All files uploaded successfully!"); // Or rely on individual toasts
      } else {
        // toast.error("Some files failed to upload. Check individual messages.");
      }

      setSelectedFiles([]); // Clear the selection
      const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = ""; // Reset the file input
      }
      await fetchFiles(); // Refresh the list
    } catch (err: any) {
      toast.error(err.message || "Upload failed. Please try again.");
      console.error("Upload failed:", err);
      // setError(err.message); // Display a general error if needed, though toasts are primary
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Updated handleDeleteFile to open the modal
  const handleDeleteFile = (openaiFileId: string, filename: string) => {
    setFileToDelete({ id: openaiFileId, name: filename });
    setIsConfirmDeleteModalOpen(true);
  };

  // New function to execute the actual deletion
  const executeDeleteFile = async () => {
    if (!fileToDelete) return;

    setDeletingFileId(fileToDelete.id);
    const token = getToken();

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete file "${fileToDelete.name}".`);
      }

      toast.success(`File "${fileToDelete.name}" deleted successfully!`);
      await fetchFiles(); // Refresh the list
    } catch (err: any) {
      toast.error(err.message || `Could not delete file "${fileToDelete.name}".`);
      console.error("Delete file error:", err);
    } finally {
      setDeletingFileId(null);
      // Modal closing and fileToDelete reset is handled by onConfirm/onClose
    }
  };

  return (
    <> {/* Added Fragment to wrap modal and existing content */}
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-zinc-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Organization Files</h2>
        <FileText className="text-blue-500" size={28} />
      </div>

      {/* File Upload Section */}
      <div className="mb-8 p-4 border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg">
        <h3 className="text-lg font-medium text-gray-700 dark:text-zinc-300 mb-3">Upload New File(s)</h3>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            id="file-upload-input"
            type="file"
            multiple // Allow multiple file selection
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 dark:text-gray-400
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300
                       hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                       cursor-pointer flex-grow"
          />
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading} // Disabled if no files or uploading
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md px-6 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Uploading... ({uploadProgress}%)
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4 mr-2" />
                {selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : "Upload File"}
              </>
            )}
          </button>
        </div>
        {/* Display selected files */}
        {selectedFiles.length > 0 && !uploading && (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Selected files:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 max-h-28 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <li key={index} className="truncate" title={file.name}>{file.name} ({ (file.size / 1024).toFixed(2) } KB)</li>
              ))}
            </ul>
          </div>
        )}
        {error && ( // General error display (e.g., for no files selected)
          <div className="mt-3 flex items-center text-red-600 dark:text-red-400">
            <AlertCircle size={18} className="mr-2" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* File List Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-zinc-300 mb-3">Uploaded Files</h3>
        {loadingFiles ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="ml-2 text-gray-500 dark:text-gray-400">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">No files found for this organization.</p>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2"> {/* Ensure this list is scrollable if it gets long */}
            {files.map(file => (
              <li
                key={file.id}
                className="flex items-center justify-between p-4 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
              >
                <div>
                  <p className="font-semibold text-blue-600 dark:text-blue-400 break-all">{file.filename}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 break-all">
                    <span className="font-medium">OpenAI ID:</span> {file.openai_file_id}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Uploaded: {new Date(file.uploaded_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteFile(file.openai_file_id, file.filename)} // Still passes original values to initiate delete
                  disabled={deletingFileId === file.openai_file_id} // Loading state still uses deletingFileId
                  className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  title="Delete File"
                >
                  {deletingFileId === file.openai_file_id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Trash2 size={20} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>

    {fileToDelete && (
      <ConfirmationModal
        isOpen={isConfirmDeleteModalOpen}
        onClose={() => {
          setIsConfirmDeleteModalOpen(false);
          setFileToDelete(null);
        }}
        onConfirm={async () => { // Made onConfirm async to await executeDeleteFile
          await executeDeleteFile();
          setIsConfirmDeleteModalOpen(false); // Ensure modal closes after execution
          setFileToDelete(null);
        }}
        title="Confirm File Deletion"
        message={`Are you sure you want to delete the file "${fileToDelete.name}"? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonVariant="danger"
      />
    )}
    </>
  );
}
