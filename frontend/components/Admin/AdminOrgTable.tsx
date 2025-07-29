import { useCallback, useEffect, useState, useRef } from "react";
import { Building2, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { getToken } from "../../hooks/useAuth";
import { useRouter } from "next/router";
import Link from "next/link";
import api from "../../utils/api";
import { useToast } from "../../utils/toast";
import { Button } from "@headlessui/react";
import ConfirmationModal from "../SharedComponents/ConfirmationModal";
import * as Popover from "@radix-ui/react-popover";

interface OrgRow {
  id: string;
  name: string;
  head_user_id?: string | null;
  usage_quota: {
    used: number;
    total_limit: number;
  };
  agents: Array<{ assistant_id: string; documents: string[] }>;
  created_at: string;
  member_count?: number;
  plan?: string;
  tokens_used?: number;
  is_active: boolean;
}

interface AdminOrgTableProps {
  refreshKey: number;
  onOrgDeleted: () => void;
}

// OrgActions component for dropdown menu
function OrgActions({
  org,
  onStatusChange,
  onDelete,
}: {
  org: OrgRow;
  onStatusChange: (org: OrgRow) => void;
  onDelete: (org: OrgRow) => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </Popover.Trigger>

      <Popover.Content
        align="end"
        side="bottom"
        sideOffset={8}
        className="z-50 w-52 rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black/10 dark:ring-white/10 focus:outline-none"
      >
        <div className="py-1">
          <button
            onClick={() => onStatusChange(org)}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-700"
          >
            {org.is_active ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
            {org.is_active ? "Deactivate" : "Activate"}
          </button>

          <Link
            href={`/admin/orgs/${org.id}`}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-700"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>

          <button
            onClick={() => onDelete(org)}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-700/30"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
export default function AdminOrgTable({
  refreshKey,
  onOrgDeleted,
}: AdminOrgTableProps) {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<OrgRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [orgForStatusChange, setOrgForStatusChange] = useState<OrgRow | null>(
    null
  );
  const [nextStatusState, setNextStatusState] = useState<boolean | null>(null);
  const [isUpdatingOrgStatus, setIsUpdatingOrgStatus] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/admin/organizations");
      const fetchedOrgs = response.data.map((org: any) => ({
        ...org,
        tokens_used: org.usage_quota?.used,
        plan: org.plan || "Standard",
      }));
      setOrgs(fetchedOrgs);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to fetch organizations"
      );
      console.error("Error fetching orgs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [refreshKey, fetchOrgs]);

  const handleDeleteClick = (org: OrgRow) => {
    setOrgToDelete(org);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orgToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/organizations/${orgToDelete.id}`);
      toast.success(`Organization "${orgToDelete.name}" deleted successfully.`);
      onOrgDeleted();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || `Failed to delete ${orgToDelete.name}.`
      );
    } finally {
      setIsDeleting(false);
      setIsConfirmModalOpen(false);
      setOrgToDelete(null);
    }
  };

  const handleStatusActionClick = (org: OrgRow) => {
    setOrgForStatusChange(org);
    setNextStatusState(!org.is_active);
    setIsStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!orgForStatusChange || nextStatusState === null) return;

    setIsUpdatingOrgStatus(true);
    const actionText = nextStatusState ? "activate" : "deactivate";
    try {
      await api.patch(`/admin/organizations/${orgForStatusChange.id}/status`, {
        is_active: nextStatusState,
      });
      setOrgs((prevOrgs) =>
        prevOrgs.map((o) =>
          o.id === orgForStatusChange.id
            ? { ...o, is_active: nextStatusState }
            : o
        )
      );
      toast.success(
        `Organization "${orgForStatusChange.name}" ${actionText}d successfully.`
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail ||
          `Failed to ${actionText} ${orgForStatusChange.name}.`
      );
    } finally {
      setIsUpdatingOrgStatus(false);
      setIsStatusModalOpen(false);
      setOrgForStatusChange(null);
      setNextStatusState(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 dark:text-gray-400">
          Loading organizations...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-500 dark:text-red-400">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (orgs.length === 0 && !loading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 dark:text-gray-400">
          No organizations found.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mt-6">
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="text-blue-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          All Organizations
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Members</th>
              <th className="px-4 py-3 font-medium">Quota Used</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Head User ID</th>
              <th className="px-4 py-3 font-medium">Agents Count</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
            {orgs.map((org) => (
              <tr
                key={org.id}
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
              >
                <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">
                  {org.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      org.is_active
                        ? "bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100"
                        : "bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100"
                    }`}
                  >
                    {org.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {org.member_count ?? 0}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {org.usage_quota?.used?.toLocaleString() ?? 0} /{" "}
                  {org.usage_quota?.total_limit?.toLocaleString() ?? "N/A"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {new Date(org.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 capitalize">
                  {org.plan || "N/A"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {org.head_user_id || "N/A"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {org.agents && org.agents.length > 0
                    ? org.agents.map(agent =>
                        `${agent.assistant_id} (${(agent.documents || []).length} docs)`
                      ).join(', ')
                    : "0"}
                </td>
                <td className="px-4 py-3 text-right">
                  <OrgActions
                    org={org}
                    onStatusChange={handleStatusActionClick}
                    onDelete={handleDeleteClick}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isConfirmModalOpen && orgToDelete && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Confirm Deletion"
          message={`Are you sure you want to delete the organization "${orgToDelete.name}"? This action cannot be undone.`}
          confirmButtonText="Delete"
          confirmButtonVariant="danger"
        />
      )}

      {isStatusModalOpen && orgForStatusChange && (
        <ConfirmationModal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          onConfirm={handleConfirmStatusChange}
          title="Confirm Status Change"
          message={`Are you sure you want to ${
            nextStatusState ? "activate" : "deactivate"
          } the organization "${orgForStatusChange.name}"?`}
          confirmButtonText={nextStatusState ? "Activate" : "Deactivate"}
          confirmButtonVariant={nextStatusState ? "primary" : "danger"}
        />
      )}
    </div>
  );
}
