import { useState, useRef } from 'react';
import api from '../utils/api';

export const DocumentUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);

  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDocs = async () => {
    try {
      const res = await api.get('/documents/list');
      setDocuments(res.data);
    } catch {
      showToast('❌ Failed to fetch documents');
    }
  };

  const handleUpload = async () => {
    if (!file || !allowedTypes.includes(file.type)) {
      showToast('⚠️ Unsupported file type');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      showToast('✅ Upload successful');
      setFile(null);
      setProgress(0);
      fetchDocs();
    } catch (error) { // Added error parameter
      console.error("Upload failed. Error:", error); // Added console.error
      showToast('❌ Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/documents/${id}`);
      fetchDocs();
    } catch {
      showToast('❌ Delete failed');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && allowedTypes.includes(dropped.type)) {
      setFile(dropped);
      showToast(`📄 Selected: ${dropped.name}`);
    } else {
      showToast('⚠️ Invalid file type');
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">📁 Upload Document</h2>

      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="w-full p-6 mb-4 text-center border-2 border-dashed rounded-xl border-gray-400 dark:border-gray-600 hover:border-blue-500"
      >
        Drag & drop a file here or
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full mt-2 text-sm text-gray-700 dark:text-white"
        />
      </div>

      {file && (
        <div className="mb-4 text-sm">📎 Selected: <strong>{file.name}</strong></div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>

      {uploading && (
        <div className="w-full bg-gray-200 rounded mt-4">
          <div
            className="bg-blue-600 text-xs text-white text-center py-1 rounded"
            style={{ width: `${progress}%` }}
          >
            {progress}%
          </div>
        </div>
      )}

      {toast && (
        <div className="mt-4 p-2 bg-black text-white rounded text-sm shadow-lg">
          {toast}
        </div>
      )}

      <hr className="my-6" />

      <h3 className="text-xl font-bold mb-2">📜 Uploaded Documents</h3>
      <button
        onClick={fetchDocs}
        className="mb-4 text-sm text-blue-500 hover:underline"
      >
        Refresh
      </button>

      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded"
          >
            <span>{doc.filename}</span>
            <button
              onClick={() => handleDelete(doc.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
