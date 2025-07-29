import { Dialog } from "@headlessui/react";
import { useState } from "react";
import { getToken } from "../../hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  onUpdated: () => void;
}

export default function QuotaModal({ open, onClose, userId, onUpdated }: Props) {
  const [monthlyLimit, setMonthlyLimit] = useState(10000);
  const [loading, setLoading] = useState(false);

  const updateQuota = async () => {
    const token = getToken();
    setLoading(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/update-quota`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id: userId,
        quota: {
          monthly_limit: monthlyLimit,
          used: 0,
          reset_date: null,
        },
      }),
    });
    setLoading(false);
    onClose();
    onUpdated();
  };

  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-xl">
          <Dialog.Title className="text-lg font-bold mb-4">Adjust User Quota</Dialog.Title>

          <label className="block text-sm font-medium mb-1">Monthly Token Limit</label>
          <input
            type="number"
            min={0}
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(Number(e.target.value))}
            className="w-full border px-3 py-2 rounded mb-4"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-zinc-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={updateQuota}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              disabled={loading}
            >
              {loading ? "Saving..." : "Update Quota"}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
