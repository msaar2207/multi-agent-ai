import { useState, useEffect, Fragment } from "react";
import { Dialog, Transition } from '@headlessui/react'; // Keep for delete confirmation, but edit modal parts will be removed
import { PlusCircle, Bot, Edit3, Trash2, Loader2 as ActionLoader } from "lucide-react";
import { motion } from "framer-motion";
import { getToken } from "../../hooks/useAuth";

import { FileText, Loader2 } from "lucide-react";
import ConfirmationModal from "../SharedComponents/ConfirmationModal"; // Import ConfirmationModal
import { useToast } from "../../utils/toast";
import AssistantEditModal from "../AssistantEditModal";

// TODO: Define a more comprehensive Agent interface based on actual API response
// For now, using a simplified one that matches the create payload and expected list display
interface Agent {
  _id?: string; // From MongoDB
  id?: string; // Potentially if transformed on client
  name: string;
  instructions?: string;
  openai_assistant_id?: string;
  file_ids?: string[];
  // Add other relevant fields like created_at, vector_store_id if needed for display
}

// Define OrgFile interface (consistent with OrgFileManager and backend)
interface OrgFile {
  id: string; // MongoDB ID (usually string after fetch)
  filename: string;
  openai_file_id: string;
  uploaded_at: string;
  // Potentially other fields like 'purpose' or 'size' if available and useful
}


interface AgentManagerProps {
  orgId: string;
}

export default function AgentManager({ orgId }: AgentManagerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newName, setNewName] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); // Main loading for creating new assistant or fetching agent list
  const [error, setError] = useState<string | null>(null); // General errors for the component
  const toast = useToast();
  const [availableOrgFiles, setAvailableOrgFiles] = useState<OrgFile[]>([]);
  const [loadingOrgFiles, setLoadingOrgFiles] = useState(false);

  // State for Edit Modal
  const [editingAssistant, setEditingAssistant] = useState<Agent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // const [editableName, setEditableName] = useState(""); // Will be managed by AssistantEditModal
  // const [editableInstructions, setEditableInstructions] = useState(""); // Will be managed by AssistantEditModal
  // const [editableFileIds, setEditableFileIds] = useState<string[]>([]); // Will be managed by AssistantEditModal
  const [actionLoading, setActionLoading] = useState(false); // For modal save button (can be reused or modal has its own)
  const [modalError, setModalError] = useState<string | null>(null); // Errors specific to modal actions (can be reused)

  // State for Delete action
  const [deletingAssistantId, setDeletingAssistantId] = useState<string | null>(null); // Used for spinner on specific row button
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [agentToDeleteId, setAgentToDeleteId] = useState<string | null>(null);
  const [agentToDeleteName, setAgentToDeleteName] = useState<string | null>(null);


  const fetchAgents = async () => {
    if (!orgId) return;
    setLoading(true); // This loading is for the agent list / creation
    setError(null); // Clear general errors before fetching agents
    const token = getToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/assistants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to fetch assistants");
      }
      const data = await res.json();
      setAgents(data.map((agent: any) => ({ ...agent, id: agent._id })));
    } catch (err: any) {
      setError(err.message); // Set error for agent fetching
      console.error("Failed to fetch assistants:", err);
    } finally {
      setLoading(false); // For agent list / creation
    }
  };

  const fetchAvailableOrgFiles = async () => {
    if (!orgId) return;
    setLoadingOrgFiles(true);
    setError(null); // Clear general errors before fetching files
    const token = getToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to fetch organization files");
      }
      const data: OrgFile[] = await res.json();
      // Ensure 'id' from '_id' and presence of 'openai_file_id'
      setAvailableOrgFiles(data.map(f => ({ ...f, id: (f as any)._id || f.id })).filter(f => f.openai_file_id));
    } catch (err: any) {
      setError(err.message); // Set error for file fetching
      console.error("Failed to fetch organization files:", err);
      setAvailableOrgFiles([]); // Clear previous files on error
    } finally {
      setLoadingOrgFiles(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchAgents();
      fetchAvailableOrgFiles();
    }
  }, [orgId]);

  // Renamed for clarity to distinguish from edit form's handler
  const handleCreateFormFileSelectionChange = (fileOpenAIId: string, isChecked: boolean) => {
    setSelectedFileIds(prevSelectedIds => {
      if (isChecked) {
        return [...prevSelectedIds, fileOpenAIId];
      } else {
        return prevSelectedIds.filter(id => id !== fileOpenAIId);
      }
    });
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newInstructions.trim()) {
      setError("Assistant name and instructions are required.");
      return;
    }

    const token = getToken();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", newName);
    formData.append("instructions", newInstructions);

    if (selectedFileIds.length > 0) {
      selectedFileIds.forEach(fileId => {
        formData.append("file_ids", fileId);
      });
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/assistants/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to create assistant");
      }

      toast.success("Assistant created successfully!");
      setNewName("");
      setNewInstructions("");
      setSelectedFileIds([]);
      await fetchAgents();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Failed to create assistant.");
      console.error("Failed to create assistant:", err);
    } finally {
      setLoading(false);
    }
  };

  // Renamed from handleDeleteAssistant to clarify it opens the modal
  const promptDeleteConfirmation = (assistantId: string, assistantName: string) => {
    setAgentToDeleteId(assistantId);
    setAgentToDeleteName(assistantName);
    setIsDeleteConfirmModalOpen(true);
  };

  const executeDeleteAssistant = async () => {
    if (!agentToDeleteId) return;

    setDeletingAssistantId(agentToDeleteId); // Show spinner on the row button
    const token = getToken();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/assistants/${agentToDeleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to delete assistant.");
      }
      toast.success(`Assistant "${agentToDeleteName || agentToDeleteId}" deleted successfully!`);
      await fetchAgents(); // Refresh list
    } catch (err: any) {
      toast.error(err.message || "Could not delete assistant.");
      console.error("Delete assistant error:", err);
    } finally {
      setDeletingAssistantId(null); // Clear spinner
      setIsDeleteConfirmModalOpen(false); // Close modal
      setAgentToDeleteId(null); // Reset
      setAgentToDeleteName(null); // Reset
    }
  };

  const handleOpenEditModal = (assistant: Agent) => {
    setEditingAssistant(assistant); // Set the assistant to be edited
    // setEditableName(assistant.name); // No longer needed here
    // setEditableInstructions(assistant.instructions || ""); // No longer needed here
    // setEditableFileIds(assistant.file_ids || []); // No longer needed here
    setIsEditModalOpen(true); // Open the modal
    setModalError(null); // Clear any previous modal errors
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingAssistant(null);
    setModalError(null);
  };

  // This function will be passed to AssistantEditModal as onSave
  const handleSaveFromModal = async (assistantDbId: string, assistantOrgId: string, payload: any) => {
    // assistantOrgId from modal might be redundant if AgentManager's orgId is definitive
    if (!editingAssistant) return;

    setActionLoading(true);
    setModalError(null);
    const token = getToken();

    // Construct the final payload. The payload from modal already includes name, instructions, model, file_ids
    // We just need to ensure it's what the backend expects.
    // The original handleUpdateAssistant checked for actual changes.
    // The modal's handleSubmit currently doesn't, it sends all fields.
    // For simplicity, we'll proceed with the payload as is from the modal.
    // If fine-grained change detection is needed, it could be added here or in the modal.

    if (Object.keys(payload).length === 0) {
        toast.info("No changes submitted."); // Or success if payload always contains all fields
        setActionLoading(false);
        handleCloseEditModal();
        return;
    }

    // Use orgId from AgentManager's props for the endpoint
    // Use assistantDbId from the modal callback (which should be editingAssistant._id or .id)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/assistants/${assistantDbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Error updating assistant" }));
        throw new Error(errorData.detail);
      }

      toast.success("Assistant updated successfully!");
      handleCloseEditModal();
      await fetchAgents(); // Refresh the list of agents
    } catch (err: any) {
      setModalError(err.message); // Show error (potentially in AgentManager, or modal needs an error display prop)
      toast.error(err.message || "Could not update assistant.");
      console.error("Update assistant error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <motion.div
      className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md p-6 border border-gray-200 dark:border-zinc-700"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Bot className="text-green-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Assistants</h2>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>} {/* General component errors */}

      <div className="space-y-3 mb-6 max-h-72 overflow-y-auto pr-2">
        {agents.map((agent) => (
          <div
            key={agent.id || agent._id}
            className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
          >
            <div className="flex-grow space-y-1 overflow-hidden">
              <p className="font-semibold text-lg text-blue-600 dark:text-blue-400">{agent.name}</p>
              {agent.instructions && (
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate" title={agent.instructions}>
                  <span className="font-medium text-gray-700 dark:text-gray-200">Instructions:</span> {agent.instructions}
                </p>
              )}
              <div className="flex space-x-4 text-xs">
                {agent.openai_assistant_id && (
                  <p className="text-gray-500 dark:text-gray-400">
                    <span className="font-medium">OpenAI ID:</span> <span className="font-mono text-gray-700 dark:text-gray-300">{agent.openai_assistant_id.substring(0,15)}...</span>
                  </p>
                )}
                <p className="text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Files Attached:</span> <span className="font-semibold text-gray-700 dark:text-gray-200">{agent.file_ids?.length || 0}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center space-x-2 ml-4">
              <button
                onClick={() => handleOpenEditModal(agent)}
                className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                title="Edit Assistant"
                disabled={deletingAssistantId === (agent.id || agent._id)}
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={() => promptDeleteConfirmation((agent.id || agent._id)!, agent.name)}
                className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                title="Delete Assistant"
                disabled={deletingAssistantId === (agent.id || agent._id)} // Keep spinner logic for specific button
              >
                {deletingAssistantId === (agent.id || agent._id) ? (
                  <ActionLoader className="animate-spin w-[18px] h-[18px]" />
                ) : (
                  <Trash2 size={18} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t dark:border-zinc-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
          ➕ Create New Assistant
        </h3>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Assistant name"
            className="px-3 py-2 rounded-md border dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <textarea
            placeholder="Instructions (e.g., You are a helpful assistant specialized in analyzing financial documents...)"
            className="px-3 py-2 rounded-md border dark:border-zinc-600 dark:bg-zinc-800 dark:text-white min-h-[80px]" // Increased min-height
            rows={4} // Increased rows
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
          />

          {/* File Selection UI */}
          <div className="mt-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Attach Files (Optional)</h4>
            {loadingOrgFiles ? (
              <div className="flex items-center text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading available files...
              </div>
            ) : availableOrgFiles.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No organization files available to attach. Upload files via "Organization Files" manager.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto border dark:border-zinc-700 rounded-md p-2 bg-zinc-50 dark:bg-zinc-800/50">
                {availableOrgFiles.map(file => (
                  <label key={file.id} className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700/50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-zinc-800 dark:bg-zinc-700 dark:border-zinc-600"
                      checked={selectedFileIds.includes(file.openai_file_id)}
                      onChange={(e) => handleCreateFormFileSelectionChange(file.openai_file_id, e.target.checked)}
                    />
                    <FileText size={16} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-zinc-300 truncate" title={file.filename}>{file.filename}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">({new Date(file.uploaded_at).toLocaleDateString()})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-md px-4 py-2 text-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            {loading ? "Creating..." : "Create Assistant"}
          </button>
        </div>
      </div>

      {/* MODIFIED: Use AssistantEditModal component */}
      {isEditModalOpen && editingAssistant && (
        <AssistantEditModal
          isOpen={isEditModalOpen}
          assistant={editingAssistant}
          availableOrgFiles={availableOrgFiles} // Pass the fetched org files
          onSave={handleSaveFromModal}
          onCancel={handleCloseEditModal}
          // TODO: Decide how to handle setStatus from AssistantEditModal
          // For now, internal modal errors or actionLoading can be handled by AgentManager's states if needed,
          // or AssistantEditModal can have its own internal status display.
          // Passing toast functions directly or a new setStatus function for AgentManager to handle.
          // For this refactor, let's assume AssistantEditModal handles its own internal feedback or uses props for simple messages.
          // AgentManager's `modalError` could be passed as a prop if desired.
          // The `actionLoading` prop could also be passed if the save button is in AgentManager.
          // However, AssistantEditModal's onSave is async, so it should handle its own loading state.
          // Let's pass a simple setStatus for now.
          setStatus={(message) => {
            if (message && message.startsWith("Error:")) {
              setModalError(message); // For displaying error in AgentManager if modal doesn't
              toast.error(message);
            } else if (message) {
              // toast.success(message); // Success is handled by handleSaveFromModal
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal (remains unchanged) */}
      <ConfirmationModal
        isOpen={isDeleteConfirmModalOpen}
        onClose={() => {
          setIsDeleteConfirmModalOpen(false);
          setAgentToDeleteId(null);
          setAgentToDeleteName(null);
        }}
        onConfirm={executeDeleteAssistant}
        title="Confirm Agent Deletion"
        message={`Are you sure you want to delete the agent "${agentToDeleteName || agentToDeleteId}"? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonVariant="danger"
      />
    </motion.div>
  );
}
