import React from "react";
import { useUsage } from "../hooks/useUsage";
import { getToken } from "../hooks/useAuth";
import Layout from "../components/Layout";

export default function SubscriptionSettings() {
  const { usage, loading } = useUsage();
  const token = getToken();
  const handleUpgrade = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/billing/create-checkout-session`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    window.location.href = data.url;
  };

  const handleCancel = async () => {
    const confirmed = confirm(
      "Are you sure you want to cancel your subscription?"
    );
    if (!confirmed) return;

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/billing/cancel-subscription`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    alert("Subscription cancelled. You've been downgraded to Free.");
    window.location.reload();
  };

  if (loading || !usage) return <div>Loading subscription settings...</div>;

  const isPro = usage.tier === "pro";

  return (
    <Layout>
      <div className="max-w-xl mx-auto p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-md border dark:border-zinc-700">
        <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
          Manage Your Subscription
        </h2>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Current Plan
            </span>
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase">
              {usage.tier}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                usage.token_usage_monthly >= usage.limits.tokens
                  ? "bg-red-600"
                  : usage.token_usage_monthly >= 0.9 * usage.limits.tokens
                  ? "bg-yellow-400"
                  : "bg-green-500"
              }`}
              style={{
                width: `${
                  (usage.token_usage_monthly / usage.limits.tokens) * 100
                }%`,
              }}
            />
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {usage.token_usage_monthly} / {usage.limits.tokens} tokens used this
            month
          </div>
        </div>

        <div className="space-y-4">
          <div className="border p-4 rounded-lg shadow-sm dark:border-zinc-700">
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
              Free Plan
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Includes 5,000 tokens and 100 messages per month.
            </p>
          </div>

          <div className="border p-4 rounded-lg shadow-sm dark:border-zinc-700 bg-blue-50 dark:bg-zinc-800">
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
              Pro Plan
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Includes 100,000 tokens and 2,000 messages per month. Ideal for
              power users and advanced research.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {!isPro ? (
            <button
              onClick={handleUpgrade}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded shadow"
            >
              Upgrade to Pro
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded shadow"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
