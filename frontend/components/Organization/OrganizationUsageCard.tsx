import React, { useEffect, useState } from "react";
import { getToken } from "../../hooks/useAuth"; // Assuming getToken is in this path

interface Props {
  orgId: string;
}

export default function OrganizationUsageCard({ orgId }: Props) {
  const [used, setUsed] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setError("Organization ID is not provided.");
      return;
    }

    const fetchUsageData = async () => {
      setLoading(true);
      setError(null);
      const token = getToken();

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/org/${orgId}/usage`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Failed to fetch usage data" }));
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setUsed(data.used || 0);
        setTotal(data.total_limit || 0);
      } catch (err: any) {
        console.error("Failed to fetch organization usage:", err);
        setError(err.message || "An unexpected error occurred.");
        setUsed(0); // Reset on error
        setTotal(0); // Reset on error
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, [orgId]);

  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

  if (loading) {
    return (
      <div className="border rounded-lg p-4 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow">
        <h2 className="text-lg font-semibold mb-2">📊 Usage Overview</h2>
        <p>Loading usage data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow">
        <h2 className="text-lg font-semibold mb-2">📊 Usage Overview</h2>
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow">
      <h2 className="text-lg font-semibold mb-2">📊 Usage Overview</h2>

      <div className="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>
          Tokens Used: <strong>{used.toLocaleString()}</strong>
        </span>
        {/* Plan information removed for now */}
      </div>

      <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded h-4 overflow-hidden">
        <div
          className={`h-4 ${percentage > 85 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <p className="text-xs mt-2 text-right text-gray-500 dark:text-gray-400">
        {percentage}% of {total.toLocaleString()} token quota used
      </p>
    </div>
  );
}
