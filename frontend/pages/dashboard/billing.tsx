import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getToken } from "../../hooks/useAuth";
import BillingHistoryCard from "../../components/dashboard/BillingHistoryCard";

export default function BillingDashboard() {
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchOrg = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/user_details`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = await res.json();
      console.log("🚀 User data:", user);
      if (user.role !== "organization_head" || user.role !== "admin") {
        // router.push("/");
        // return;
      }

      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/org/${user.organization_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const orgData = await orgRes.json();
      setOrg(orgData);
      setLoading(false);
    };

    fetchOrg();
  }, [router]);

  const handleUpgrade = async () => {
    const token = getToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/create-checkout-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    window.location.href = data.url;
  };

  const handleCancel = async () => {
    const confirmed = window.confirm("Are you sure you want to cancel your Pro subscription?");
    if (!confirmed) return;

    const token = getToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      alert("✅ Subscription canceled. You have been downgraded.");
      router.reload();
    } else {
      const err = await res.json();
      alert("❌ Failed to cancel: " + err.detail);
    }
  };

  if (loading || !org) {
    return <div className="text-center py-20 text-gray-500 dark:text-gray-400">Loading billing info...</div>;
  }

  const plan = org.plan || "free";
  const used = org.usage_quota?.used ?? 0;
  const limit = org.usage_quota?.total_limit ?? 10000;
  const percentUsed = Math.min((used / limit) * 100, 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📦 Billing & Subscription</h1>
      <BillingHistoryCard />
      <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-700 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm capitalize text-gray-600 dark:text-gray-300">{plan} plan</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  plan === "pro"
                    ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300"
                    : "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-300"
                }`}
              >
                {plan === "pro" ? "Pro Access" : "Free Tier"}
              </span>
            </div>
          </div>

          {plan === "free" && (
            <button
              onClick={handleUpgrade}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
            >
              Upgrade to Pro 🚀
            </button>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Token Usage</h2>
          <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {used.toLocaleString()} / {limit.toLocaleString()} tokens used
          </p>
        </div>
      </div>

      {/* Plan Comparison Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compare Plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300 border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-zinc-800">
                <th className="px-4 py-2">Feature</th>
                <th className="px-4 py-2">Free Plan</th>
                <th className="px-4 py-2">Pro Plan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t dark:border-zinc-700">
                <td className="px-4 py-2">Monthly Token Limit</td>
                <td className="px-4 py-2">10,000</td>
                <td className="px-4 py-2">250,000</td>
              </tr>
              <tr className="border-t dark:border-zinc-700">
                <td className="px-4 py-2">Assistant Agents</td>
                <td className="px-4 py-2">1</td>
                <td className="px-4 py-2">Unlimited</td>
              </tr>
              <tr className="border-t dark:border-zinc-700">
                <td className="px-4 py-2">Priority Support</td>
                <td className="px-4 py-2 text-gray-400">—</td>
                <td className="px-4 py-2">✅</td>
              </tr>
              <tr className="border-t dark:border-zinc-700">
                <td className="px-4 py-2">Quota Requests</td>
                <td className="px-4 py-2 text-gray-400">—</td>
                <td className="px-4 py-2">✅</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Subscription */}
      {plan === "pro" && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-700 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Cancel Subscription</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Canceling will immediately downgrade your organization to the Free Plan. Your quota will be reduced and Pro features will be disabled.
          </p>
          <button
            onClick={handleCancel}
            className="text-red-600 border border-red-600 hover:bg-red-600 hover:text-white font-medium text-sm px-4 py-2 rounded-md transition"
          >
            Cancel Pro Plan
          </button>
        </div>
      )}
    </div>
  );
}
