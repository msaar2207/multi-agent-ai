import { useState, useEffect } from 'react';
import api from '../utils/api';

export const ChunkedAssistantUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [vectorStores, setVectorStores] = useState<any[]>([]);

  const handleUpload = async () => {
    if (!file || !name || !instructions) return;
    setStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('instructions', instructions);
    try {
      const res = await api.post('/admin/assistant/upload-and-chunk', formData);
      setStatus('✅ Assistant created: ' + res.data.assistant_id);
      fetchVectorStores();
    } catch (err: any) {
      setStatus('❌ Upload failed: ' + err?.response?.data?.detail || 'Unknown error');
    }
  };

  const fetchVectorStores = async () => {
    const res = await api.get('/admin/assistant/list');
    setVectorStores(res.data.filter((a: any) => a.vector_store_id));
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/assistant/vector-store/${id}`);
      fetchVectorStores();
      setStatus(`🧹 Deleted vector store ${id}`);
    } catch (err) {
      setStatus('❌ Failed to delete vector store');
    }
  };

  useEffect(() => {
    fetchVectorStores();
  }, []);

  return (
    <div className="max-w-2xl p-6 mx-auto">
      <h2 className="text-xl font-bold mb-4">🧠 Chunked Assistant Upload</h2>
      <input
        type="text"
        placeholder="Assistant name"
        className="w-full mb-2 p-2 border rounded"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        placeholder="Instructions"
        className="w-full mb-2 p-2 border rounded"
        rows={3}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />
      <input
        type="file"
        accept=".pdf,.txt,.md, .docx, .doc"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />
      <button
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Upload & Chunk
      </button>

      {status && <div className="mt-4 text-sm">{status}</div>}

      <hr className="my-6" />

      <h3 className="text-lg font-semibold mb-2">🗃️ Existing Vector Stores</h3>
      <ul className="space-y-2">
        {vectorStores.map((vs) => (
          <li key={vs._id} className="p-2 border rounded text-sm flex justify-between">
            <div>
              <strong>{vs.name}</strong> → {vs.vector_store_id?.slice(0, 12)}...
            </div>
            <button
              onClick={() => handleDelete(vs.vector_store_id)}
              className="text-red-600 text-xs hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};