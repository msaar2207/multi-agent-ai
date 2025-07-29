import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import api from '../utils/api'; // Assuming api util is setup for calls

interface AssistantEditModalProps {
  isOpen: boolean; // To control modal visibility
  assistant: any; // The assistant object being edited
  availableOrgFiles: any[]; // Files available in the assistant's organization
  onSave: (assistantId: string, orgId: string, payload: any) => void;
  onCancel: () => void;
  setStatus: (status: string | null) => void; // To provide feedback
}

const AssistantEditModal: React.FC<AssistantEditModalProps> = ({
  isOpen,
  assistant,
  availableOrgFiles,
  onSave,
  onCancel,
  setStatus,
}) => {
  const [name, setName] = useState(assistant?.name || '');
  const [instructions, setInstructions] = useState(assistant?.instructions || '');
  const [model, setModel] = useState(assistant?.model || 'gpt-4o'); // Default to gpt-4o if not set
  const [currentFileIds, setCurrentFileIds] = useState<string[]>(assistant?.file_ids || []);

  useEffect(() => {
    if (assistant) {
      // Pre-populate form when assistant data changes
      setName(assistant.name || '');
      setInstructions(assistant.instructions || '');
      setModel(assistant.model || 'gpt-4o');
      setCurrentFileIds(assistant.file_ids || []);
    }
  }, [assistant]);

  const handleFileSelectionChange = (fileId: string) => {
    setCurrentFileIds((prevSelectedFileIds) =>
      prevSelectedFileIds.includes(fileId)
        ? prevSelectedFileIds.filter((id) => id !== fileId)
        : [...prevSelectedFileIds, fileId]
    );
  };

  const handleSubmit = () => {
    if (!assistant) return; // Should not happen if modal is open with an assistant
    const payload = {
      name,
      instructions,
      model,
      file_ids: currentFileIds,
    };
    onSave(assistant._id, assistant.org_id, payload);
  };

  // Helper to get filename from availableOrgFiles, falls back to ID
  const getFileName = (fileId: string) => {
    const file = availableOrgFiles.find(f => f.openai_file_id === fileId);
    return file ? file.filename : fileId;
  };

  if (!assistant) {
    return null; // Or some loading/error state if preferred, but typically controlled by isOpen
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Edit Assistant: {assistant.name}
                </Dialog.Title>
                
                <div className="mb-4">
                  <label htmlFor="assistantName" className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            id="assistantName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="assistantInstructions" className="block text-sm font-medium text-gray-700">Instructions</label>
          <textarea
            id="assistantInstructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="assistantModel" className="block text-sm font-medium text-gray-700">Model</label>
          <input
            type="text"
            id="assistantModel"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g., gpt-4o, gpt-4-turbo"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
           {/* Example of a select:
          <select
            id="assistantModel"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
          */}
        </div>

        <div className="mb-4">
          <h4 className="text-md font-semibold mb-2 text-gray-800">Associated Files:</h4>
          {currentFileIds.length > 0 ? (
            <ul className="list-disc pl-5 mb-2 text-sm max-h-32 overflow-y-auto border border-gray-300 p-2 rounded-md bg-gray-50">
              {currentFileIds.map(fileId => (
                <li key={fileId} className="flex justify-between items-center py-1">
                  <span className="text-gray-700">{getFileName(fileId)}</span>
                  <button
                    onClick={() => handleFileSelectionChange(fileId)}
                    className="text-red-500 hover:text-red-700 text-xs ml-2 font-medium"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 mb-2">No files currently associated.</p>
          )}

          <h4 className="text-md font-semibold mb-1 text-gray-800">Available Organization Files:</h4>
          {availableOrgFiles.length > 0 ? (
            <div className="max-h-48 overflow-y-auto border border-gray-300 p-2 rounded-md bg-white">
              {availableOrgFiles.map((file) => (
                <div key={file.openai_file_id} className="flex items-center text-sm py-1">
                  <input
                    type="checkbox"
                    id={`file-${file.openai_file_id}`}
                    checked={currentFileIds.includes(file.openai_file_id)}
                    onChange={() => handleFileSelectionChange(file.openai_file_id)}
                    className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor={`file-${file.openai_file_id}`} className="text-gray-700">{file.filename} <span className="text-gray-500">({file.openai_file_id.slice(-6)})</span></label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No files found in this organization, or still loading.</p>
          )}
        </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    onClick={onCancel}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={handleSubmit}
                  >
                    Save Changes
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AssistantEditModal;
