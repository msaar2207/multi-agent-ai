import { useState, useEffect } from 'react';
import api from '../utils/api';
import AssistantEditModal from './AssistantEditModal';
import ConfirmationModal from './SharedComponents/ConfirmationModal';

export const AssistantCreator = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [instructions, setInstructions] = useState('');
  const [name, setName] = useState('');
  const [modelName, setModelName] = useState('gpt-4o');
  const [status, setStatus] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<any[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<string>('');

  // State for editing
  const [editingAssistant, setEditingAssistant] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [availableOrgFilesForEdit, setAvailableOrgFilesForEdit] = useState<any[]>([]);

  // State for delete confirmation
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [assistantToDeleteId, setAssistantToDeleteId] = useState<string | null>(null);
  const [assistantToDeleteName, setAssistantToDeleteName] = useState<string | null>(null);


  const fetchAssistants = async () => {
    // Assuming the list assistants endpoint returns assistants with _id, org_id etc.
    // The current '/admin/assistant/list' might need to be '/assistant/details' or similar
    // if it provides all assistants across orgs, or we might need a new one if it's org-specific.
    // For now, let's assume it returns assistants with necessary fields like org_id.
    // The task implies `get_all_assistants` (`/details`) or `list_assistants` (`/{org_id}/assistants`)
    // Let's use `/assistant/details` for now, assuming it lists all assistants for an admin/user to see.
    // This might need adjustment based on actual API behavior for fetching *all* assistants.
    // The original code used '/admin/assistant/list' which might be an admin-only route.
    // For editing, we need `org_id` to fetch files, so assistants must have it.
    const res = await api.get('/assistant/details'); // Changed from /admin/assistant/list
    setAssistants(res.data);
  };

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('model_name', modelName)
    formData.append('instructions', instructions);
    files.forEach((f) => formData.append('files', f));
    try {
      const res = await api.post('/admin/assistant/create', formData);
      setStatus('✅ Assistant created. Opening for edit...');
      await fetchAssistants(); // Refresh the list
      
      // Assuming res.data is the newly created assistant object
      if (res.data && res.data._id) { // Check if response contains assistant data
        handleShowEditModal(res.data); // Open edit modal for the new assistant
      } else {
        // Fallback status if created assistant data isn't returned as expected
        setStatus('✅ Assistant created, but could not open edit modal automatically. Please find it in the list.');
      }
    } catch (error: any) {
      console.error("Failed to create assistant:", error);
      const errorMessage = error.response?.data?.detail || 'Failed to create assistant';
      setStatus(`❌ ${errorMessage}`);
    }
  };

  const executeDeleteAssistant = async () => {
    if (!assistantToDeleteId) return;
    try {
      // Note: The original handleDelete used `/admin/assistant/${id}`.
      // The task for editing used `/assistant/${orgId}/assistants/${assistantId}`.
      // For deleting an assistant, it's often just by its own ID, not org-scoped in the URL,
      // but this depends on backend design. Assuming `/admin/assistant/${id}` is correct for deletion for now.
      // If assistants are org-specific and deletion requires org_id, this URL might need adjustment.
      // For this task, I will stick to the original delete URL structure.
      await api.delete(`/admin/assistant/${assistantToDeleteId}`);
      setStatus(`🗑 Assistant "${assistantToDeleteName || 'ID: ' + assistantToDeleteId}" deleted successfully.`);
      fetchAssistants();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Delete failed';
      setStatus(`❌ ${errorMessage}`);
      console.error("Delete assistant error:", error);
    } finally {
      setAssistantToDeleteId(null);
      setAssistantToDeleteName(null);
      setIsDeleteConfirmModalOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    const assistant = assistants.find(a => a._id === id);
    setAssistantToDeleteId(id);
    setAssistantToDeleteName(assistant ? assistant.name : `ID: ${id}`);
    setIsDeleteConfirmModalOpen(true);
  };

  const setActiveAssistant = async (id: string) => {
    try {
      await api.post(`/admin/assistant/set-default`, { id });
      setStatus('✅ Set as active');
    } catch {
      setStatus('❌ Failed to set active');
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, []);

  const handleShowEditModal = async (assistant: any) => {
    setEditingAssistant(assistant);
    setShowEditModal(true);
    setStatus(null); // Clear previous status
    if (assistant.org_id) {
      try {
        // Fetch available organization files for the assistant being edited
        const filesRes = await api.get(`/assistant/${assistant.org_id}/files`);
        setAvailableOrgFilesForEdit(filesRes.data || []);
      } catch (error) {
        console.error("Failed to fetch organization files:", error);
        setStatus('❌ Failed to fetch organization files for editing.');
        setAvailableOrgFilesForEdit([]); // Ensure it's empty on error
      }
    } else {
      console.warn("Assistant being edited has no org_id. Cannot fetch organization files.");
      setAvailableOrgFilesForEdit([]);
    }
  };

  const handleCancelEdit = () => {
    setEditingAssistant(null);
    setShowEditModal(false);
    setAvailableOrgFilesForEdit([]);
  };

const handleSaveEdit = async (assistantId: string, orgId: string, payload: any) => {
  setStatus('⏳ Saving assistant...');
  try {
    const response = await api.patch(`/assistant/${orgId}/assistants/${assistantId}`, payload);
    // It's good practice to update the state with the returned data
    // For now, just refetching the whole list for simplicity.
    // Consider replacing the specific assistant in the `assistants` array with `response.data`
    // if the API returns the updated assistant. This would be more efficient.
    // e.g., setAssistants(prev => prev.map(a => a._id === assistantId ? response.data : a));

    await fetchAssistants(); // Re-fetch the list of assistants to show changes
    handleCancelEdit(); // Close modal and reset editing state
    setStatus('✅ Assistant updated successfully!');
  } catch (error: any) {
    console.error("Failed to update assistant:", error);
    const errorMessage = error.response?.data?.detail || 'Failed to update assistant.';
    setStatus(`❌ ${errorMessage}`);
  }
};


  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">🧠 Create Assistant</h2>

      <input
        className="mb-2 w-full p-2 border rounded"
        placeholder="Assistant name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        className="mb-2 w-full p-2 border rounded"
        placeholder="Instructions"
        value={instructions}
        rows={4}
        onChange={(e) => setInstructions(e.target.value)}
      />
      <input
        type="file"
        multiple
        accept=".pdf,.txt,.doc,.docx"
        className="mb-4"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />
      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Create Assistant
      </button>

      {status && <p className="mt-4 text-sm">{status}</p>}

      <hr className="my-6" />
      <h3 className="text-lg font-semibold mb-2">🗂 All Assistants</h3>
      <ul className="space-y-2">
        {assistants.map((a) => (
          <li key={a._id} className="p-2 border rounded text-sm">
            <div><strong>{a.name}</strong> — ID: {a.assistant_id}</div>
            <div className="text-xs italic mb-2">{a.instructions?.slice(0, 100)}...</div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setActiveAssistant(a._id)}
                className="text-green-600 hover:underline text-xs px-2 py-1 border border-green-600 rounded hover:bg-green-50"
              >
                ✅ Set Active
              </button>
              <button
                onClick={() => handleShowEditModal(a)}
                className="text-blue-600 hover:underline text-xs px-2 py-1 border border-blue-600 rounded hover:bg-blue-50"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(a._id)}
                className="text-red-600 hover:underline text-xs px-2 py-1 border border-red-600 rounded hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Render the AssistantEditModal */}
      {editingAssistant && ( // Keep editingAssistant check to ensure it's populated before modal attempts to render with it
        <AssistantEditModal
          isOpen={showEditModal} // Pass showEditModal to isOpen
          assistant={editingAssistant}
          availableOrgFiles={availableOrgFilesForEdit}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
          setStatus={setStatus}
        />
      )}

      {isDeleteConfirmModalOpen && (
        <ConfirmationModal
          isOpen={isDeleteConfirmModalOpen}
          onClose={() => {
            setIsDeleteConfirmModalOpen(false);
            setAssistantToDeleteId(null);
            setAssistantToDeleteName(null);
          }}
          onConfirm={executeDeleteAssistant} // executeDeleteAssistant will handle its own state reset for ID/Name
          title="Confirm Assistant Deletion"
          message={`Are you sure you want to delete the assistant "${assistantToDeleteName || assistantToDeleteId}"? This action cannot be undone.`}
          confirmButtonText="Delete"
          confirmButtonVariant="danger"
        />
      )}
    </div>
  );
}