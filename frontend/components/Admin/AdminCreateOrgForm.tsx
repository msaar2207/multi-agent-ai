import { useState } from "react";
import { PlusCircle } from "lucide-react";
import api from "../../utils/api"; // Ensure this path is correct
import { useToast } from "../../utils/toast";

interface AdminCreateOrgFormProps {
  onSuccess: () => void;
  onClose: () => void; // To close the modal
}

export default function AdminCreateOrgForm({
  onSuccess,
  onClose,
}: AdminCreateOrgFormProps) {
  const [name, setName] = useState("");
  const [headUserEmail, setHeadUserEmail] = useState("");
  const [headUserName, setHeadUserName] = useState("");
  const [headUserPassword, setHeadUserPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Organization name cannot be empty.");
      return;
    }

    // Basic validation for head user fields if email is provided
    if (headUserEmail.trim() && !headUserPassword.trim()) {
      toast.error("If providing Head User Email, Password is required.");
      return;
    }

    setLoading(true);
    try {
      const payload: any = { name: name.trim() };
      if (headUserEmail.trim()) {
        payload.head_user_email = headUserEmail.trim();
        payload.head_user_password = headUserPassword; // Password sent as is
        if (headUserName.trim()) {
          payload.head_user_name = headUserName.trim();
        }
      }

      await api.post("/admin/organizations", payload);
      toast.success("Organization created successfully.");
      setName("");
      setHeadUserEmail("");
      setHeadUserName("");
      setHeadUserPassword("");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast.error(
        error.response?.data?.detail || "Failed to create organization."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="orgName"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Organization Name
        </label>
        <input
          id="orgName"
          type="text"
          placeholder="Enter organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          disabled={loading}
        />
      </div>

      {/* Head User Fields */}
      <div className="border-t border-gray-200 dark:border-zinc-700 pt-4 mt-4">
        <h4 className="text-md font-medium text-gray-600 dark:text-gray-400 mb-2">
          Optional: Add Organization Head
        </h4>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="headUserEmail"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Head User Email
            </label>
            <input
              id="headUserEmail"
              type="email"
              placeholder="Head user's email"
              value={headUserEmail}
              onChange={(e) => setHeadUserEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="headUserName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Head User Name (Optional)
            </label>
            <input
              id="headUserName"
              type="text"
              placeholder="Head user's full name"
              value={headUserName}
              onChange={(e) => setHeadUserName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="headUserPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Head User Password
            </label>
            <input
              id="headUserPassword"
              type="password"
              placeholder="Create a password for head user"
              value={headUserPassword}
              onChange={(e) => setHeadUserPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              disabled={loading || !headUserEmail.trim()} // Disable if no email or loading
            />
             <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Password is required if Head User Email is provided.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <PlusCircle className="w-4 h-4" />
          {loading ? "Creating..." : "Create Organization"}
        </button>
      </div>
    </form>
  );
}
