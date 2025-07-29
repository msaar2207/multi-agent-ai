import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AgentManager from "../../components/dashboard/AgentManager";
import UserTable from "../../components/dashboard/UserTable";
import QuotaRequests from "../../components/dashboard/QuotaRequests";
import OrgFileManager from "../../components/dashboard/OrgFileManager";
import OrgQuotaManager from "../../components/dashboard/OrgQuotaManager"; // Import OrgQuotaManager
import OrganizationToolbar from "../../components/dashboard/OrganizationToolbar";
// import AddUserModal from "../../components/Organization/AddUserModal"; // Removed
import { LoaderCircle } from "lucide-react";
import { motion } from "framer-motion";
import { getToken } from "../../hooks/useAuth";
// import { useToast } from "../../utils/toast"; // Removed
import OrgQuotaCard from "../../components/dashboard/OrgQuotaCard";

export default function OrgDashboardPage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null); // State to hold user data

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = getToken();
        // Changed URL from /auth/me to /auth/user_details
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/user_details`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) {
          // Handle non-OK responses explicitly, e.g., if token is invalid or expired
          console.error("Failed to fetch user details, status:", res.status);
          router.push("/"); // Redirect to home or login page
          return;
        }

        const data = await res.json();
        setUser(data); // Set user data to state
        if (
          !data.role ||
          (!data.role.includes("organization_head") &&
            !data.role.includes("admin"))
        ) {
          console.warn(
            "User does not have required role or role is undefined."
          );
          router.push("/");
          return;
        }

        if (!data.organization_id) {
          console.warn("Organization ID not found for user.");
        }

        setOrgId(data.organization_id);
      } catch (err) {
        console.error("Error fetching user details:", err); // Added more specific error message
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoaderCircle className="animate-spin h-8 w-8 text-gray-500" />
      </div>
    );
  }

  if (!orgId) return null;

  return (
    <div className="flex-1 flex flex-col">
      <OrganizationToolbar title="Organization Dashboard" />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* The h1 previously here has been removed as OrganizationToolbar now provides the title */}

        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <OrgQuotaCard orgId={orgId} />
        </motion.div> */}
        {/* Added OrgQuotaManager */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }} // New delay
        >
          <OrgQuotaManager orgId={orgId} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AgentManager orgId={orgId} />
        </motion.div>

        {/* Added OrgFileManager */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }} // Adjusted delay
        >
          <OrgFileManager orgId={orgId} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <UserTable orgId={orgId} currentUserRole={user?.role} /> {/* Removed refreshTrigger prop */}
        </motion.div>

        

        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <QuotaRequests orgId={orgId} />
        </motion.div> */}
        {/* Removed AddUserModal rendering */}
      </div>
    </div>
  );
}
