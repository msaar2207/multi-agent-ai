import React from "react";
import { useUsage } from "../hooks/useUsage";
import UpgradeButton from "./Stripe/UpgradeButton";

export default function UsageBar() {
  const { usage, loading } = useUsage();

  if (loading || !usage) return null;

  const percentUsed = Math.min(
    (usage.token_usage_monthly / usage?.limits?.tokens) * 100,
    100
  ).toFixed(0);

  const nearLimit = parseFloat(percentUsed) >= 80;
  const exceeded = usage.token_usage_monthly >= usage?.limits?.tokens;

  return (
    <div
      className="w-full p-4 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700"
      style={{ position: "absolute", top: 55, left: 0, zIndex: 10 }}
    >
      <div className="flex justify-between text-sm mb-1 text-gray-800 dark:text-zinc-100">
        <span>
          Plan: <strong className="uppercase">{usage.tier}</strong>
        </span>
        <span>
          {usage.token_usage_monthly} / {usage?.limits?.tokens} tokens
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
        <div
          className={`
            h-full transition-all duration-500
            ${
              exceeded
                ? "bg-red-600"
                : nearLimit
                ? "bg-yellow-500"
                : "bg-blue-500"
            }
          `}
          style={{ width: `${percentUsed}%` }}
        ></div>
      </div>
      {exceeded && (
        <>
          <div className="mt-2 text-xs text-red-600">
            🚫 You’ve used all your tokens. Please upgrade to Pro or wait until
            next reset.
          </div>
          <UpgradeButton />
        </>
      )}
      {nearLimit && !exceeded && (
        <div className="mt-2 text-xs text-yellow-600">
          ⚠️ You’re nearing your monthly quota. Consider upgrading.
        </div>
      )}
    </div>
  );
}
