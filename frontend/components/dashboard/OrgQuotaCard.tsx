import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart2 } from "lucide-react";
import { getToken } from "../../hooks/useAuth";

interface OrgQuotaCardProps {
  orgId: string;
}

export default function OrgQuotaCard({ orgId }: OrgQuotaCardProps) {
  const [used, setUsed] = useState<number>(0);
  const [limit, setLimit] = useState<number>(0);

  useEffect(() => {
    const fetchQuota = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsed(data.usage_quota?.used);
      setLimit(data.usage_quota?.total_limit);
    };

    fetchQuota();
  }, [orgId]);

  const usagePercent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <motion.div
      className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md p-6 border border-gray-200 dark:border-zinc-700"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <BarChart2 className="text-blue-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Organization Usage
        </h2>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
        Used: <strong>{used}</strong> / {limit} tokens
      </div>

      <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${usagePercent}%` }}
        />
      </div>

      <div className="text-xs text-gray-400 dark:text-zinc-400 mt-1">
        {usagePercent.toFixed(1)}% of monthly quota used
      </div>
    </motion.div>
  );
}
