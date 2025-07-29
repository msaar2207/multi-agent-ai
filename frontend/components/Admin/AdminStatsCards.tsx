import { useEffect, useState } from "react";
import { Users, Building2, RefreshCcw, MailOpen } from "lucide-react";
import { getToken } from "../../hooks/useAuth";

interface Stats {
  users_total: number;
  users_breakdown: Record<string, number>;
  orgs_total: number;
  tokens_used: number;
  quota_requests_pending: number;
}

export default function AdminStatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    };

    fetchStats();
  }, []);

  if (!stats) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Loading stats...</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        icon={<Users className="text-sky-500" />}
        label="Total Users"
        value={stats.users_total.toLocaleString()}
        description={`Admins: ${stats.users_breakdown.admin ?? 0}, Heads: ${stats.users_breakdown.organization_head ?? 0}, Members: ${stats.users_breakdown.organization_user ?? 0}`}
      />
      <StatCard
        icon={<Building2 className="text-emerald-500" />}
        label="Organizations"
        value={stats.orgs_total.toString()}
        description="Active organizations"
      />
      <StatCard
        icon={<RefreshCcw className="text-indigo-500" />}
        label="Tokens Used"
        value={stats.tokens_used.toLocaleString()}
        description="This month's total usage"
      />
      <StatCard
        icon={<MailOpen className="text-yellow-500" />}
        label="Pending Requests"
        value={stats.quota_requests_pending.toString()}
        description="Quota increase requests"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm">
      <div className="flex items-center gap-3 mb-2">{icon}<h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</h3></div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
}
