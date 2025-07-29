import React from "react";

export default function UserUsageBar({ used, limit }: { used: number; limit: number }) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  let colorClass = "bg-green-500";
  if (percentage > 80) colorClass = "bg-red-500";
  else if (percentage > 50) colorClass = "bg-yellow-500";

  return (
    <div className="w-full max-w-xs mt-1 group relative">
      <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2 rounded relative">
        <div
          className={`h-2 rounded ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
        {/* Tooltip */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-7 opacity-0 group-hover:opacity-100 transition-all bg-black text-white text-xs rounded px-2 py-1 shadow z-10">
          {percentage.toFixed(1)}%
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {used.toLocaleString()} / {limit.toLocaleString()} tokens
      </p>
    </div>
  );
}
