import { useState, useEffect, ChangeEvent } from 'react';
import { getToken } from '../../hooks/useAuth'; // Adjust if path is different
import { toast } from 'react-hot-toast';
import { ListChecks, Users, Save, Loader2 as ActionLoader, AlertCircle,TrendingUp } from 'lucide-react';

// TypeScript Interfaces based on backend Pydantic models
interface UserQuotaInfo {
  id: string;
  name: string | null;
  email: string;
  monthly_limit: number;
  monthly_used: number;
}

interface OrgQuotaInfo {
  id: string;
  name: string;
  total_quota_limit: number;
  total_quota_used: number;
}

interface OrgQuotaDetailsResponse {
  organization: OrgQuotaInfo;
  users: UserQuotaInfo[];
}

interface OrgQuotaManagerProps {
  orgId: string;
}

export default function OrgQuotaManager({ orgId }: OrgQuotaManagerProps) {
  const [orgQuotaDetails, setOrgQuotaDetails] = useState<OrgQuotaInfo | null>(null);
  const [usersQuotaInfo, setUsersQuotaInfo] = useState<UserQuotaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserQuotas, setEditingUserQuotas] = useState<{ [userId: string]: string }>({});
  const [updatingQuotaForUser, setUpdatingQuotaForUser] = useState<string | null>(null);

  const fetchQuotaDetails = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const token = getToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/${orgId}/quota-details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to fetch quota details.");
      }
      const data: OrgQuotaDetailsResponse = await res.json();
      setOrgQuotaDetails(data.organization);
      setUsersQuotaInfo(data.users);
      // Initialize editingUserQuotas with current limits
      const initialEditingQuotas: { [userId: string]: string } = {};
      data.users.forEach(user => {
        initialEditingQuotas[user.id] = String(user.monthly_limit);
      });
      setEditingUserQuotas(initialEditingQuotas);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Could not load quota details.");
      console.error("Fetch quota details error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotaDetails();
  }, [orgId]);

  const handleUserQuotaInputChange = (userId: string, value: string) => {
    setEditingUserQuotas(prev => ({ ...prev, [userId]: value }));
  };

  const handleUpdateUserQuota = async (userId: string) => {
    const newLimitString = editingUserQuotas[userId];
    if (newLimitString === undefined || newLimitString === null) {
      toast.error("New limit value is missing.");
      return;
    }

    const newNumericLimit = parseInt(newLimitString, 10);
    if (isNaN(newNumericLimit) || newNumericLimit < 0) {
      toast.error("Invalid quota limit. Must be a non-negative number.");
      return;
    }

    setUpdatingQuotaForUser(userId);
    const token = getToken();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/${orgId}/users/${userId}/quota`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ monthly_limit: newNumericLimit }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to update user quota.");
      }
      toast.success("User quota updated successfully!");
      await fetchQuotaDetails(); // Refresh all data to ensure consistency
    } catch (err: any) {
      toast.error(err.message || "Could not update user quota.");
      console.error("Update user quota error:", err);
    } finally {
      setUpdatingQuotaForUser(null);
    }
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center p-10">
        <ActionLoader className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading quota details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
        <div className="flex items-center text-red-700 dark:text-red-300">
          <AlertCircle size={20} className="mr-2" />
          <p className="text-sm font-medium">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!orgQuotaDetails) {
    return <p className="text-center text-gray-500 dark:text-gray-400 p-10">No organization quota details found.</p>;
  }

  const orgUsagePercentage = orgQuotaDetails.total_quota_limit > 0
    ? (orgQuotaDetails.total_quota_used / orgQuotaDetails.total_quota_limit) * 100
    : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-zinc-700 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
            <ListChecks className="text-indigo-500" size={28}/>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Organization Quota: {orgQuotaDetails.name}
            </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
            <p className="dark:text-zinc-300">
                Total Limit: <span className="font-semibold text-gray-700 dark:text-white">{orgQuotaDetails.total_quota_limit.toLocaleString()}</span> tokens
            </p>
            <p className="dark:text-zinc-300">
                Total Used: <span className="font-semibold text-gray-700 dark:text-white">{orgQuotaDetails.total_quota_used.toLocaleString()}</span> tokens
            </p>
        </div>
        <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-4">
            <div
                className={`h-4 rounded-full ${getProgressBarColor(orgUsagePercentage)}`}
                style={{ width: `${orgUsagePercentage}%` }}
                title={`Usage: ${orgUsagePercentage.toFixed(2)}%`}
            ></div>
        </div>
         <p className="text-xs text-right mt-1 text-gray-500 dark:text-zinc-400">{orgUsagePercentage.toFixed(2)}% used</p>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4">
            <Users className="text-indigo-500" size={24}/>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-white">User Quotas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Monthly Used</th>
                <th className="px-4 py-3 font-medium">Monthly Limit</th>
                <th className="px-4 py-3 font-medium">Set New Limit</th>
                <th className="px-4 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
              {usersQuotaInfo.map((user) => {
                const userUsagePercentage = user.monthly_limit > 0
                    ? (user.monthly_used / user.monthly_limit) * 100
                    : 0;
                return (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{user.name || 'N/A'}</div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                        <span className="text-gray-700 dark:text-gray-300 mr-2">{user.monthly_used.toLocaleString()}</span>
                        <div className="w-16 bg-gray-200 dark:bg-zinc-700 rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full ${getProgressBarColor(userUsagePercentage)}`}
                                style={{ width: `${userUsagePercentage}%`}}
                                title={`${userUsagePercentage.toFixed(1)}%`}
                            ></div>
                        </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.monthly_limit.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={editingUserQuotas[user.id] || ''}
                      onChange={(e) => handleUserQuotaInputChange(user.id, e.target.value)}
                      className="w-32 px-2 py-1.5 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-zinc-700 dark:text-white"
                      placeholder="Enter limit"
                      min="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleUpdateUserQuota(user.id)}
                      disabled={updatingQuotaForUser === user.id || editingUserQuotas[user.id] === String(user.monthly_limit)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed dark:focus:ring-offset-zinc-900"
                    >
                      {updatingQuotaForUser === user.id ? (
                        <ActionLoader className="animate-spin h-4 w-4" />
                      ) : (
                        <Save size={14} />
                      )}
                      {updatingQuotaForUser === user.id ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
