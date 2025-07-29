import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { getToken } from "../../hooks/useAuth";

interface TopUser {
  email: string;
  role: string;
  organization?: string;
  tokens_used: number;
}

export default function AdminTopUsers() {
  const [users, setUsers] = useState<TopUser[]>([]);

  useEffect(() => {
    const fetchTopUsers = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/top-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data);
    };

    fetchTopUsers();
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mt-6">
      <div className="flex items-center gap-3 mb-4">
        <Flame className="text-orange-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Users (by Token Usage)</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-300 border-b dark:border-zinc-700">
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Organization</th>
              <th className="px-3 py-2">Tokens Used</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr key={idx} className="border-b dark:border-zinc-800">
                <td className="px-3 py-2 text-gray-900 dark:text-white">{user.email}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{user.role}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                  {user.organization || "—"}
                </td>
                <td className="px-3 py-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                  {user.tokens_used.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
