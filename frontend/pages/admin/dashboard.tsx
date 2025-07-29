import { useState, useCallback } from 'react';
import AdminUsageChart from "../../components/Admin/AdminUsageChart";
import AdminOrgTable from "../../components/Admin/AdminOrgTable";
import AdminTopUsers from "../../components/Admin/AdminTopUsers";
import AdminQuotaRequests from "../../components/Admin/AdminQuotaRequests";
import AdminAssistantOverview from "../../components/Admin/AdminAssistantOverview";
import AdminBillingHistory from "../../components/Admin/AdminBillingHistory";
import AdminStatsCards from "../../components/Admin/AdminStatsCards";
// import { getToken } from "../../hooks/useAuth"; // No longer needed here
import AdminLayout from "../../components/Layouts/AdminLayout"; // Import AdminLayout
import AdminToolbar from '../../components/Admin/AdminToolbar'; // Import AdminToolbar

export default function AdminDashboardPage() {
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const handleOrgDeleted = useCallback(() => { setRefreshKey(prevKey => prevKey + 1); }, []);

  return (
    <AdminLayout>
      <div className="px-0 lg:px-6 py-6"> {/* Added py-6 for spacing below toolbar */}
        <div className="max-w-7xl mx-auto space-y-10">
          {/* Removed h1 "🧠 Admin Analytics" */}

        {/* Section: Summary Cards */}
        <AdminStatsCards />

        {/* Section: Usage Chart */}
        <AdminUsageChart />

        {/* Section: Organization Table */}
        <AdminOrgTable refreshKey={refreshKey} onOrgDeleted={handleOrgDeleted} />

        {/* Section: Top Token Users */}
        <AdminTopUsers />

        {/* Section: Quota Requests */}
        <AdminQuotaRequests />

        {/* Section: Assistant Overview */}
        <AdminAssistantOverview />

        {/* Section: Billing History */}
        <AdminBillingHistory />
      </div>
    </div>
    </AdminLayout>
  );
}
