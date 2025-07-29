
import { useEffect, useState } from "react";
import { getToken } from "../../hooks/useAuth";

interface BillingEvent {
  organization: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
}

export default function AdminBillingHistory() {
  const [history, setHistory] = useState<BillingEvent[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/billing-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data);
    };
    fetchHistory();
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mt-6">
      <h2 className="text-lg font-semibold mb-4">💳 Billing History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-2">Organization</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Currency</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, idx) => (
              <tr key={idx} className="border-t dark:border-zinc-700">
                <td className="px-4 py-2">{item.organization}</td>
                <td className="px-4 py-2">{item.amount}</td>
                <td className="px-4 py-2">{item.currency}</td>
                <td className="px-4 py-2">{item.status}</td>
                <td className="px-4 py-2">{item.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
