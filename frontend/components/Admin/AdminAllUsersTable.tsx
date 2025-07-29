import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Users, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'; // Example icons for status

interface AdminUserResponse {
  id: string;
  email: string;
  name?: string;
  role: string;
  organization_id?: string;
  organization_name?: string;
  created_at?: string;
  status?: string;
}

const StatusDisplay: React.FC<{ status?: string }> = ({ status }) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return <span className="flex items-center text-green-600 dark:text-green-400"><CheckCircle size={16} className="mr-1.5" /> Active</span>;
    case 'invited':
      return <span className="flex items-center text-blue-600 dark:text-blue-400"><Clock size={16} className="mr-1.5" /> Invited</span>;
    case 'inactive':
      return <span className="flex items-center text-red-600 dark:text-red-400"><XCircle size={16} className="mr-1.5" /> Inactive</span>;
    default:
      return <span className="flex items-center text-gray-500 dark:text-gray-400"><AlertTriangle size={16} className="mr-1.5" /> {status || 'Unknown'}</span>;
  }
};

const AdminAllUsersTable: React.FC = () => {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/admin/users');
        setUsers(response.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to fetch users.');
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
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

  if (users.length === 0 && !loading) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 dark:text-gray-400">No users found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mt-6">
      <div className="flex items-center gap-3 mb-4">
        <Users className="text-blue-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          All Platform Users
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created At</th>
              {/* Add Actions column if needed in future */}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-gray-900 dark:text-white">{user.email}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.name || 'N/A'}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 capitalize">{user.role}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.organization_name || 'N/A'}</td>
                <td className="px-4 py-3">
                  <StatusDisplay status={user.status} />
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAllUsersTable;
