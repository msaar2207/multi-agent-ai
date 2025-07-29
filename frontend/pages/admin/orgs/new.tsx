import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getToken } from "../../../hooks/useAuth";
import AdminCreateOrgForm from "../../../components/Admin/AdminCreateOrgForm";

export default function NewOrgPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = await res.json();
      if (user.role === "admin") {
        setIsAdmin(true);
      } else {
        router.push("/");
      }

      setLoading(false);
    };

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">
        Loading admin view...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          🏢 Create New Organization
        </h1>
        {isAdmin && <AdminCreateOrgForm />}
      </div>
    </div>
  );
}
