import { useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { getToken } from "../../hooks/useAuth";

interface Invoice {
  amount: number;
  currency: string;
  date: string;
  status: string;
  url: string;
}

export default function BillingHistoryCard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setInvoices(data);
      setLoading(false);
    };

    fetchHistory();
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mt-8">
      <div className="flex items-center gap-3 mb-4">
        <ReceiptText className="text-purple-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Billing History</h2>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading invoices...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No invoices found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-300 border-b dark:border-zinc-700">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => (
                <tr key={idx} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2">{inv.date}</td>
                  <td className="px-3 py-2">
                    {inv.amount.toFixed(2)} {inv.currency}
                  </td>
                  <td className="px-3 py-2 capitalize text-sm text-gray-600 dark:text-gray-300">
                    {inv.status}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={inv.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
