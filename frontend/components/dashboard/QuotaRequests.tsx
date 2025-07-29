import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { getToken } from "../../hooks/useAuth";

interface QuotaRequest {
  _id: string;
  user_id: string;
  reason: string;
  status: string;
}

interface UserMeta {
  id: string;
  email: string;
}

interface QuotaRequestsProps {
  orgId: string;
}

export default function QuotaRequests({ orgId }: QuotaRequestsProps) {
  const [requests, setRequests] = useState<QuotaRequest[]>([]);
  const [users, setUsers] = useState<Record<string, UserMeta>>({});

  const fetchRequests = async () => {
    const token = getToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/quota-requests?org_id=${orgId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setRequests(data);
  };

  const fetchUsers = async () => {
    const token = getToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/users?org_id=${orgId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const mapped = Object.fromEntries(data.map((u: any) => [u.id, u]));
    setUsers(mapped);
  };

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, [orgId]);

  const updateStatus = async (id: string, status: string) => {
    const token = getToken();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/quota-requests/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ request_id: id, status }),
    });
    await fetchRequests();
  };

  return (
    <motion.div
      className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md p-6 border border-gray-200 dark:border-zinc-700"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="text-yellow-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Quota Requests</h2>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No pending requests.</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((req) => (
            <li
              key={req._id}
              className="p-4 rounded-md bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {users[req.user_id]?.email || req.user_id}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{req.reason}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => updateStatus(req._id, "approved")}
                  className="text-green-600 hover:text-green-700 transition"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => updateStatus(req._id, "denied")}
                  className="text-red-600 hover:text-red-700 transition"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
