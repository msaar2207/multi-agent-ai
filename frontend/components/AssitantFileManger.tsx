import { useEffect, useState } from 'react';
import api from '../utils/api';
import {useToast} from '../utils/toast';

function computeHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      crypto.subtle.digest('SHA-256', reader.result as ArrayBuffer)
        .then((hash) => {
          const hex = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          resolve(hex);
        })
        .catch(reject);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export const AssistantFileManager = ({ assistantId }: { assistantId: string }) => {
  const toast = useToast();
  const [files, setFiles] = useState<any[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: number }>({});
  const [uploading, setUploading] = useState(false);
  const [assistantActive, setAssistantActive] = useState(false);
  const MAX_FILE_SIZE_MB = 25;
  const fetchFiles = async () => {
    const res = await api.get(`/admin/assistant/${assistantId}/files`);
    setFiles(res.data);
  };

  const fetchActiveStatus = async () => {
    const res = await api.get(`/admin/assistant/list`);
    const active = res.data.find((a: any) => a._id === 'default_assistant');
    setAssistantActive(active?.assistant_id === assistantId);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const oversized = selected.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length) {
      toast.error(`File too large: ${oversized[0].name} exceeds ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    const filtered: File[] = [];
    const hashes = await Promise.all(selected.map(computeHash));
    for (let i = 0; i < selected.length; i++) {
      const isDuplicate = files.some((f: any) => f.hash === hashes[i]);
      if (!isDuplicate) filtered.push(selected[i]);
      else toast.error(`⚠️ Duplicate skipped: ${selected[i].name}`);
    }
    setNewFiles(filtered);
    setUploadProgress({});
  };

  const handleUpload = async () => {
    if (!newFiles.length) return;
    setUploading(true);
    for (const file of newFiles) {
      const formData = new FormData();
      formData.append('files', file);
      try {
        await api.post(`/admin/assistant/${assistantId}/files/add`, formData, {
          onUploadProgress: (e) => {
            const percent = Math.round((e.loaded * 100) / (e.total || 1));
            setUploadProgress((prev) => ({ ...prev, [file.name]: percent }));
          },
        });
        toast.success(`✅ ${file.name} uploaded`);
      } catch (error) { // Added error parameter
        console.error(`Failed to upload ${file.name}. Error:`, error); // Added console.error
        toast.error(`❌ Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    setNewFiles([]);
    setUploadProgress({});
    fetchFiles();
  };

  const toggleActive = async (fileId: string, active: boolean) => {
    await api.patch(`/admin/assistant/${assistantId}/files/${fileId}`, { active: !active });
    fetchFiles();
  };

  const deleteFile = async (fileId: string) => {
    await api.delete(`/admin/assistant/${assistantId}/files/${fileId}`);
    fetchFiles();
  };

  const setAsActive = async () => {
    try {
      await api.post(`/admin/assistant/set-default`, { id: assistantId });
      toast.success('✅ Assistant set as active');
      setAssistantActive(true);
    } catch {
      toast.error('❌ Failed to set active');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    const oversized = dropped.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length) {
      toast.error(`File too large: ${oversized[0].name} exceeds ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    setNewFiles(dropped);
  };

  const preventDefaults = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    fetchFiles();
    fetchActiveStatus();
  }, [assistantId]);

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold">📂 Assistant Files</h4>
        {!assistantActive && (
          <button onClick={setAsActive} className="text-blue-600 text-xs hover:underline">
            ✅ Set as Active Assistant
          </button>
        )}
      </div>

      <div
        className="mb-2 p-4 border-2 border-dashed rounded hover:border-blue-400 cursor-pointer text-center text-sm"
        onDrop={handleDrop}
        onDragOver={preventDefaults}
        onDragEnter={preventDefaults}
      >
        Drag and drop files here (max {MAX_FILE_SIZE_MB}MB each) or
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="block mt-2 mx-auto"
        />
      </div>

      <button
        onClick={handleUpload}
        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
        disabled={uploading || !newFiles.length}
      >
        Upload Selected Files
      </button>

      {Object.entries(uploadProgress).map(([file, percent]) => (
        <div key={file} className="w-full bg-gray-200 rounded mt-2">
          <div
            className="bg-blue-500 text-xs text-white text-center p-1 rounded"
            style={{ width: `${percent}%` }}
          >
            {file} {percent}%
          </div>
        </div>
      ))}

      <ul className="mt-4 space-y-2">
        {files.map((file) => (
          <li key={file.file_id} className="flex justify-between items-center text-sm bg-gray-100 p-2 rounded">
            <div>
              <span className="font-mono">{file.filename}</span>
              <span className={`ml-2 text-xs ${file.active ? 'text-green-600' : 'text-gray-400'}`}>
                {file.active ? 'active' : 'inactive'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleActive(file.file_id, file.active)}
                className="text-blue-500 hover:underline text-xs"
              >
                {file.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => deleteFile(file.file_id)}
                className="text-red-500 hover:underline text-xs"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};