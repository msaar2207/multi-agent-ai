import React from "react";

export default function OrganizationBillingHistory({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-2">💳 Billing History</h2>
      <table className="min-w-full text-sm border rounded overflow-hidden">
        <thead className="bg-gray-100 dark:bg-zinc-800">
          <tr>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Plan</th>
            <th className="px-4 py-2 text-left">Amount</th>
            <th className="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item, i) => (
            <tr key={i} className="border-t dark:border-zinc-700">
              <td className="px-4 py-2">{item.date}</td>
              <td className="px-4 py-2 capitalize">{item.plan}</td>
              <td className="px-4 py-2">${item.amount}</td>
              <td className="px-4 py-2 capitalize">{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
