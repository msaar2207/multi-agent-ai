import React, { useEffect, useState, useCallback, Fragment } from "react"; // Added Fragment
import { useRouter } from "next/router";
import AdminLayout from "../../../components/Layouts/AdminLayout";
import api from "../../../utils/api";
import { useToast } from "../../../utils/toast";
import { Button, Input } from "@headlessui/react";
import ConfirmationModal from "../../../components/SharedComponents/ConfirmationModal"; // Import ConfirmationModal

interface OrganizationData {
  id: string;
  name: string;
  head_user_id: string | null;
  created_at: string;
  usage_quota: {
    reset_date: any;
    total_limit: number;
    used: number;
  };
  agents: Array<{ assistant_id: string; documents: string[] }>;
  is_active: boolean;
}

interface OrgMember {
  id: string;
  name?: string | null; // Match AdminUserResponseSchema
  email: string;
  role: string;
  status?: string | null; // Added status as it's in AdminUserResponseSchema
  created_at?: string | null; // Added created_at
}

interface OrgDocument {
  id: string;
  filename: string;
  uploaded_at: string; // Will be a string from JSON
  openai_file_id?: string | null;
  uploader_name?: string | null;
  // organization_id: string; // Not strictly needed for display in this context
}

interface OrgAssistant {
  id: string;
  name: string;
  assistant_id?: string | null; // OpenAI's ID
  model_name?: string | null;
  instructions?: string | null;
  created_at?: string | null; // Will be string from JSON
  file_ids?: string[];
}

const AdminOrganizationDetailsPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const toast = useToast();

  const [organization, setOrganization] = useState<OrganizationData | null>(
    null
  );
  const [editingName, setEditingName] = useState("");
  const [editingTotalLimit, setEditingTotalLimit] = useState("");
  const [loading, setLoading] = useState(true); // For main organization data
  const [error, setError] = useState<string | null>(null); // For main organization data
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingQuota, setIsUpdatingQuota] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const [assistants, setAssistants] = useState<OrgAssistant[]>([]);
  const [assistantsLoading, setAssistantsLoading] = useState(true);
  const [assistantsError, setAssistantsError] = useState<string | null>(null);

  const [isStatusConfirmModalOpen, setIsStatusConfirmModalOpen] = useState(false);
  // Store the next active state for the confirmation modal
  const [nextActiveState, setNextActiveState] = useState<boolean | null>(null);


  const fetchAllOrganizationData = useCallback(async () => {
    if (!id) return;

    setLoading(true); // For organization details
    setError(null);

    setMembersLoading(true);
    setMembersError(null);

    setDocumentsLoading(true);
    setDocumentsError(null);

    setAssistantsLoading(true);
    setAssistantsError(null);

    try {
      // Fetch organization details
      const orgResponse = await api.get(`/admin/organizations/${id}`);
      setOrganization(orgResponse.data);
      setEditingName(orgResponse.data.name);
      setEditingTotalLimit(
        orgResponse.data.usage_quota?.total_limit?.toString() || ""
      );
      setLoading(false); // Org details loaded successfully

      // Fetch organization members
      try {
        const membersResponse = await api.get(`/admin/organizations/${id}/users`);
        setMembers(membersResponse.data);
      } catch (membersErr: any) {
        const detail = membersErr.response?.data?.detail || "Failed to fetch organization members.";
        setMembersError(detail);
        toast.error(detail);
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }

      // Fetch organization documents
      try {
        const docsResponse = await api.get(`/admin/organizations/${id}/documents`);
        setDocuments(docsResponse.data);
      } catch (docsErr: any) {
        const detail = docsErr.response?.data?.detail || "Failed to fetch organization documents.";
        setDocumentsError(detail);
        toast.error(detail);
        setDocuments([]);
      } finally {
        setDocumentsLoading(false);
      }

      // Fetch organization assistants
      try {
        const assistantsResponse = await api.get(`/admin/organizations/${id}/assistants`);
        setAssistants(assistantsResponse.data);
      } catch (assistantsErr: any) {
        const detail = assistantsErr.response?.data?.detail || "Failed to fetch organization assistants.";
        setAssistantsError(detail);
        toast.error(detail);
        setAssistants([]);
      } finally {
        setAssistantsLoading(false);
      }

    } catch (err: any) { // Error fetching main organization details
      const detail = err.response?.data?.detail || "Failed to fetch organization details.";
      setError(detail);
      setOrganization(null);
      toast.error(detail);
      // If organization fetch fails, stop all loading states
      setLoading(false);
      setMembersLoading(false);
      setDocumentsLoading(false);
      setAssistantsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) {
      fetchAllOrganizationData();
    }
  }, [id]);


  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !id ||
      !editingName.trim() ||
      editingName.trim() === organization?.name
    ) {
      toast.error("Name is the same or empty.");
      return;
    }
    setIsUpdatingName(true);
    try {
      const response = await api.put(`/admin/organizations/${id}`, {
        name: editingName.trim(),
      });
      setOrganization(response.data);
      setEditingName(response.data.name);
      toast.success("Organization name updated successfully.");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to update organization name."
      );
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleQuotaUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || editingTotalLimit === "" || isNaN(Number(editingTotalLimit))) {
      toast.error("Please enter a valid number for the total quota limit.");
      return;
    }

    const newTotalLimit = Number(editingTotalLimit);
    if (newTotalLimit < 0) {
      toast.error("Total quota limit cannot be negative.");
      return;
    }

    if (newTotalLimit === organization?.usage_quota?.total_limit) {
      toast.error("New total limit is the same as the current one.");
      return;
    }

    setIsUpdatingQuota(true);
    try {
      const payload = {
        usage_quota: {
          total_limit: newTotalLimit,
        },
      };
      const response = await api.put(`/admin/organizations/${id}`, payload);
      setOrganization(response.data);
      setEditingTotalLimit(
        response.data.usage_quota?.total_limit?.toString() || ""
      );
      toast.success("Organization quota updated successfully.");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to update organization quota."
      );
    } finally {
      setIsUpdatingQuota(false);
    }
  };

  const openStatusConfirmModal = () => {
    if (!organization) return;
    setNextActiveState(!organization.is_active);
    setIsStatusConfirmModalOpen(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!organization || nextActiveState === null) return;

    setIsStatusConfirmModalOpen(false); // Close modal before API call
    setIsUpdatingStatus(true);
    const actionText = organization.is_active ? "deactivate" : "activate";

    try {
      const response = await api.patch(
        `/admin/organizations/${organization.id}/status`,
        { is_active: nextActiveState }
      );
      setOrganization(response.data);
      toast.success(`Organization ${actionText}d successfully.`);
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || `Failed to ${actionText} organization.`
      );
    } finally {
      setIsUpdatingStatus(false);
      setNextActiveState(null); // Reset
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-10">
          <p>Loading organization details...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error || !organization) {
    return (
      <AdminLayout>
        <div className="text-center py-10 text-red-500">
          <p>{error || "Organization not found."}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">
          Organization Details: {organization.name}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: General Info, Edit Name, Manage Quota */}
          <div className="md:col-span-2 space-y-8">
            {/* General Information Card (ensure it's displayed even if members are loading/error) */}
            {organization && !loading && !error && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  General Information
                </h2>
              </div>
              <div className="space-y-3">
                <p><strong>ID:</strong> {organization.id}</p>
                <p><strong>Name:</strong> {organization.name}</p>
                <p>
                  <strong>Head User ID:</strong>{" "}
                  {organization.head_user_id || "N/A"}
                </p>
                <p>
                  <strong>Created At:</strong>{" "}
                  {new Date(organization.created_at).toLocaleString()}
                </p>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">Agents:</p>
                  {organization.agents && organization.agents.length > 0 ? (
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      {organization.agents.map((agent, index) => (
                        <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                          Assistant ID: {agent.assistant_id} (Documents: {(agent.documents || []).length})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ml-4 text-sm text-gray-700 dark:text-gray-300">No agents assigned.</p>
                  )}
                </div>
                <div className="pt-2">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200">Quota Information:</h4>
                  <p className="ml-4">
                    <strong>Total Limit:</strong>{" "}
                    {organization.usage_quota?.total_limit?.toLocaleString() || "N/A"}
                  </p>
                  <p className="ml-4">
                    <strong>Used:</strong>{" "}
                    {organization.usage_quota?.used?.toLocaleString() || 0}
                  </p>
                  <p className="ml-4">
                    <strong>Reset Date:</strong>
                    {organization.usage_quota?.reset_date
                      ? new Date(organization.usage_quota.reset_date).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    organization.is_active
                      ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100"
                      : "bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100"
                  }`}>
                    {organization.is_active ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
            </div>
            )}
            {/* Edit Organization Name Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Edit Organization Name
              </h2>
              <form onSubmit={handleNameUpdate} className="space-y-4">
                <div>
                  <label
                    htmlFor="orgNameUpdate"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    New Organization Name
                  </label>
                  <Input
                    id="orgNameUpdate"
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-offset-gray-800"
                    disabled={isUpdatingName}
                  />
                </div>
                <Button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
                  disabled={
                    isUpdatingName ||
                    !editingName.trim() ||
                    editingName.trim() === organization.name
                  }
                >
                  {isUpdatingName ? "Updating..." : "Update Name"}
                </Button>
              </form>
            </div>

            {/* Manage Quota Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Manage Quota
              </h2>
              <form onSubmit={handleQuotaUpdate} className="space-y-4">
                <div>
                  <label
                    htmlFor="orgQuotaUpdate"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    New Total Quota Limit
                  </label>
                  <Input
                    id="orgQuotaUpdate"
                    type="number"
                    value={editingTotalLimit}
                    onChange={(e) => setEditingTotalLimit(e.target.value)}
                    placeholder="Enter new total limit"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-offset-gray-800"
                    disabled={isUpdatingQuota}
                  />
                </div>
                <Button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
                  disabled={
                    isUpdatingQuota ||
                    editingTotalLimit === "" ||
                    Number(editingTotalLimit) ===
                      organization.usage_quota.total_limit
                  }
                >
                  {isUpdatingQuota ? "Updating Quota..." : "Update Quota"}
                </Button>
              </form>
            </div>
            

            {/* Organization Members Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Organization Members
              </h2>
              {membersLoading && <p className="text-gray-700 dark:text-gray-300">Loading members...</p>}
              {membersError && <p className="text-red-500">{membersError}</p>}
              {!membersLoading && !membersError && members.length === 0 && (
                <p className="text-gray-700 dark:text-gray-300">No members found for this organization.</p>
              )}
              {!membersLoading && !membersError && members.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Email
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Role
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                      {members.map((member) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {member.name || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {member.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {member.role}
                          </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {member.status || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Organization Assistants Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Organization Assistants
              </h2>
              {assistantsLoading && <p className="text-gray-700 dark:text-gray-300">Loading assistants...</p>}
              {assistantsError && <p className="text-red-500">{assistantsError}</p>}
              {!assistantsLoading && !assistantsError && assistants.length === 0 && (
                <p className="text-gray-700 dark:text-gray-300">No assistants found for this organization.</p>
              )}
              {!assistantsLoading && !assistantsError && assistants.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          OpenAI ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Model
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Created At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                      {assistants.map((assistant) => (
                        <tr key={assistant.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {assistant.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {assistant.assistant_id || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {assistant.model_name || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {assistant.created_at ? new Date(assistant.created_at).toLocaleString() : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Uploaded Documents Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Uploaded Documents
              </h2>
              {documentsLoading && <p className="text-gray-700 dark:text-gray-300">Loading documents...</p>}
              {documentsError && <p className="text-red-500">{documentsError}</p>}
              {!documentsLoading && !documentsError && documents.length === 0 && (
                <p className="text-gray-700 dark:text-gray-300">No documents found for this organization.</p>
              )}
              {!documentsLoading && !documentsError && documents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Filename
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Upload Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          Uploader
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          OpenAI File ID
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                      {documents.map((doc) => (
                        <tr key={doc.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {doc.filename}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {new Date(doc.uploaded_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {doc.uploader_name || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {doc.openai_file_id || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Actions Card (ensure it's displayed even if main organization details are loading/error) */}
          {organization && !loading && !error && (
          <div className="md:col-span-1 space-y-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Actions</h2>
              <div className="space-y-4">
                <Button
                  onClick={openStatusConfirmModal}
                  disabled={isUpdatingStatus}
                  className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                    ${
                      organization.is_active
                        ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                        : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                    }
                    disabled:opacity-50`}
                >
                  {isUpdatingStatus
                    ? organization.is_active
                      ? "Deactivating..."
                      : "Activating..."
                    : organization.is_active
                    ? "Deactivate Organization"
                    : "Activate Organization"}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {organization.is_active
                    ? "Deactivating will prevent members from logging in."
                    : "Activating will allow members to log in."}
                </p>
              </div>
            </div>
            {/* Placeholder for future sections like Documents, Assistants */}
            {/* These could also be in the md:col-span-2 area if they contain more content */}
          </div>
          )}
        </div>

        {/* Placeholder for future sections like managing users, agents, etc. (Full Width) */}
        {/* <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mt-8 md:col-span-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Manage Users (Example Future Section)</h2>
          <p className="text-gray-600 dark:text-gray-400">Details about managing users would go here.</p>
        </div> */}

      </div>
      {organization && ( // Ensure organization is loaded before rendering modal
        <ConfirmationModal
          isOpen={isStatusConfirmModalOpen}
          onClose={() => setIsStatusConfirmModalOpen(false)}
          onConfirm={handleConfirmStatusUpdate}
          title="Confirm Status Change"
          message={`Are you sure you want to ${
            organization.is_active ? "deactivate" : "activate"
          } this organization? ${
            organization.is_active ? "Members will not be able to log in." : "Members will be able to log in."
          }`.trim()}
          confirmButtonText={organization.is_active ? "Deactivate" : "Activate"}
          confirmButtonVariant={organization.is_active ? "danger" : "primary"}
        />
      )}
    </AdminLayout>
  );
};

export default AdminOrganizationDetailsPage;
