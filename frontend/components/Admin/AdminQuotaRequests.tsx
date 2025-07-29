import { useEffect, useState } from "react";
import { MailOpen, CheckCircle, XCircle } from "lucide-react";
import { getToken } from "../../hooks/useAuth";

interface QuotaRequest {
  _id: string;
  user_email: string;
  reason: string;
  status: string;
}

export default function AdminQuotaRequests() {
  const [requests, setRequests] = useState<QuotaRequest[]>([]);

  const fetchRequests = async () => {
    const token = getToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/quota-requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setRequests(data);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const token = getToken();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/quota-requests/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ request_id: id, status }),
    });
    fetchRequests();
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mt-6">
      <div className="flex items-center gap-3 mb-4">
        <MailOpen className="text-yellow-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quota Requests (All)</h2>
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
                <p className="text-sm font-medium text-gray-900 dark:text-white">{req.user_email}</p>
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
    </div>
  );
}
