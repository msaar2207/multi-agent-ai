
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import api from '../../utils/api';

export default function AdminUsageChart() {
  const [view, setView] = useState<"line" | "bar">("bar");
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        const response = await api.get('/admin/stats/timeline');
        let timeline = response.data; 
        console.log('AdminUsageChart fetched data (raw):', timeline);

        if (Array.isArray(timeline)) {
          // Filter out entries with null or undefined dates
          const filteredTimeline = timeline.filter(entry => entry.date != null);
          
          if (filteredTimeline.length > 0) {
            setData(filteredTimeline);
            console.log('AdminUsageChart processed data (filtered):', filteredTimeline);
          } else {
            console.warn('AdminUsageChart: No valid data (after filtering null dates) or empty data received for timeline.');
            setData([]); 
          }
        } else {
          console.warn('AdminUsageChart: Data received is not an array.');
          setData([]); 
        }
      } catch (error) {
        console.error('Error fetching usage data for AdminUsageChart:', error);
        setData([]); 
      }
    };
    fetchUsageData();
  }, []);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">📊 Token Usage Over Time</h2>
        <div>
          <button
            className="mr-2 px-2 py-1 text-sm border rounded"
            onClick={() => setView("bar")}
          >
            Bar
          </button>
          <button
            className="px-2 py-1 text-sm border rounded"
            onClick={() => setView("line")}
          >
            Line
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {view === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="tokens" fill="#8884d8" />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="tokens" stroke="#82ca9d" />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
