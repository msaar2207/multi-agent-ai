
import { useEffect, useState } from "react";
import { getToken } from "../../hooks/useAuth";

interface AssistantStats {
  organization: string;
  assistant_count: number;
  total_files: number;
}

export default function AdminAssistantOverview() {
  const [data, setData] = useState<AssistantStats[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/assistants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    };
    fetchData();
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mt-6">
      <h2 className="text-lg font-semibold mb-4">🤖 Assistants Overview by Organization</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-2">Organization</th>
              <th className="px-4 py-2">Assistants</th>
              <th className="px-4 py-2">Files Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-t dark:border-zinc-700">
                <td className="px-4 py-2">{row.organization}</td>
                <td className="px-4 py-2">{row.assistant_count}</td>
                <td className="px-4 py-2">{row.total_files}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
