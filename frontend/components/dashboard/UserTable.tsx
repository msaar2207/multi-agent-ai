import { useEffect, useState } from "react";
import { User, RefreshCcw, Settings, UserPlus } from "lucide-react"; // Restored UserPlus
import { motion } from "framer-motion";
import UserActionsDropdown from "../SharedComponents/UsersAction"; // Import UserActionsDropdown
import { getToken } from "../../hooks/useAuth";
import { useToast } from "../../utils/toast";
import AddUserModal from "../Organization/AddUserModal"; // Restored AddUserModal import

interface UserData {
  id: string;
  email: string;
  role: string;
  agent_id?: string;
  quota: {
    used: number;
    monthly_limit: number;
  };
}

// Updated interface for Organization Assistants
interface OrgAssistant {
  id: string; // MongoDB ID (should be from _id)
  name: string;
  openai_assistant_id?: string; // Optional, but good to have for consistency
  // other fields like instructions, file_ids can be added if needed elsewhere
}

interface Props {
  orgId: string;
  currentUserRole: string; // Added currentUserRole
  // Removed refreshTrigger prop
}

export default function UserTable({ orgId, currentUserRole }: Props) { // Removed refreshTrigger from destructuring, added currentUserRole
  const [users, setUsers] = useState<UserData[]>([]);
  const [orgAssistants, setOrgAssistants] = useState<OrgAssistant[]>([]); // Renamed state
  const [loadingAssistants, setLoadingAssistants] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null); // For UI feedback during updates
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false); // Restored isAddUserModalOpen state
  const toast = useToast();
  const fetchUsers = async () => {
    if (!orgId) return;
    const token = getToken();
    // TODO: Add error handling for fetchUsers
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/users?org_id=${orgId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUsers(data);
  };

  // Renamed and updated function to fetch organization assistants
  const fetchOrgAssistants = async () => {
    if (!orgId) return;
    setLoadingAssistants(true);
    const token = getToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/${orgId}/assistants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // TODO: Handle error display to user
        console.error("Failed to fetch organization assistants");
        throw new Error('Failed to fetch organization assistants');
      }
      const data = await res.json();
      // Ensure 'id' field, as backend might send '_id'
      setOrgAssistants(data.map((assistant: any) => ({ ...assistant, id: assistant._id || assistant.id })));
    } catch (error) {
      console.error(error);
      setOrgAssistants([]); // Clear on error
    } finally {
      setLoadingAssistants(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchUsers();
      fetchOrgAssistants(); // Call updated function
    }
  }, [orgId]); // Removed refreshTrigger

  const handleAgentChange = async (userId: string, newAgentId: string) => {
    const previousUsers = users; // Store previous state for potential revert

    // Optimistic update of the UI
    setUsers(prevUsers =>
      prevUsers.map(user =>
        user.id === userId ? { ...user, agent_id: newAgentId === "" ? undefined : newAgentId } : user
      )
    );
    setUpdating(userId); // Show loading indicator for this user row

    try {
      const token = getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/org/assign-agent?user_id=${userId}&agent_id=${newAgentId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json', // Good practice, even if body is null
          },
          // No body needed as params are in URL for this specific endpoint
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to assign agent and parse error response.' }));
        throw new Error(errorData.detail || 'Failed to assign agent');
      }

      toast.success('Agent assigned successfully!');
      // Optionally, re-fetch users to ensure UI is in sync with the backend,
      // though optimistic update handles immediate UI change.
      // await fetchUsers(); // If you want to be absolutely sure.

    } catch (error: any) {
      toast.error(error.message || 'Error assigning agent.');
      console.error("Failed to assign agent:", error);
      // Revert optimistic update by restoring previous users state or refetching
      setUsers(previousUsers);
      // Or, for a full refresh from server:
      // await fetchUsers();
    } finally {
      setUpdating(null); // Remove loading indicator
    }
  };

  const handleQuotaChange = async (userId: string, limit: number) => {
    setUpdating(userId);
    const token = getToken();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/update-quota?user_id=${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ monthly_limit: limit, used: 0, reset_date: null }),
    });
    await fetchUsers();
    setUpdating(null);
  };

  const handleAddUser = async (userData: { email: string; password: string; name?: string }) => {
    if (!orgId) {
      toast.error("Organization ID is not available.");
      return;
    }
    const token = getToken();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/${orgId}/add-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        toast.success('User added successfully!');
        await fetchUsers(); // Refresh user list
        setIsAddUserModalOpen(false); // Close modal
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || 'Failed to add user.');
      }
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error('An unexpected error occurred while adding the user.');
    }
  };

  return (
    <motion.div
      className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md p-6 border border-gray-200 dark:border-zinc-700"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4"> {/* Restored outer div for justify-between */}
        <div className="flex items-center gap-3">
          <User className="text-sky-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organization Members</h2>
        </div>
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Add User
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-300">
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Agent</th>
              {/* <th className="px-3 py-2">Quota</th> */}
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t dark:border-zinc-700">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.agent_id || ""}
                    onChange={(e) => handleAgentChange(u.id, e.target.value)}
                    className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 border dark:border-zinc-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    disabled={updating === u.id || loadingAssistants}
                  >
                    <option value="">No Agent Assigned</option>
                    {orgAssistants.map((assistant) => (
                      <option key={assistant.id} value={assistant.id}>
                        {assistant.name}
                      </option>
                    ))}
                  </select>
                </td>
                {/* <td className="px-3 py-2">
                  <div className="flex gap-2 items-center">
                    <span>
                      {u.quota.used} / {u.quota.monthly_limit}
                    </span>
                    <button
                      onClick={() =>
                        handleQuotaChange(u.id, prompt("New quota limit:", u.quota.monthly_limit.toString()) as any)
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                </td> */}
                <td className="px-3 py-2">
                  {updating === u.id ? (
                    <RefreshCcw className="animate-spin w-4 h-4 text-gray-400" />
                  ) : (
                    <UserActionsDropdown
                      user={u}
                      orgId={orgId}
                      onActionComplete={fetchUsers}
                      onOpenQuota={() =>
                        handleQuotaChange(u.id, prompt("New quota limit:", u.quota.monthly_limit.toString()) as any)
                      }
                      currentUserRole={currentUserRole} // Pass currentUserRole
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSubmit={handleAddUser}
      />
    </motion.div>
  );
}
