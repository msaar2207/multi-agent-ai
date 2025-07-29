import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import QuestionnaireProcessor from '../components/QuestionnaireProcessor';
import OrganizationToolbar from '../components/dashboard/OrganizationToolbar';
import { getToken } from '../hooks/useAuth';
import { useAdminOrHeadGuard } from '../hooks/useAdminOrHeadGuard';

export default function QuestionnairePage() {
  // const checked = useAdminOrHeadGuard();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // if (!checked) return;
    const fetchUser = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/user_details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed');
        const user = await res.json();
        // if (!['admin', 'organization_head'].includes(user.role)) {
        //   router.replace('/');
        //   return;
        // }
        setOrgId(user.organization_id);
      } catch (err) {
        router.replace('/');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [ router]);

  if (loading) return null;
  if (!orgId) return <p className="text-center mt-20 text-gray-500 dark:text-gray-400">Organization not found.</p>;

  return (
    <div className="flex flex-col min-h-screen">
      <OrganizationToolbar title="Questionnaire Processor" />
      <main className="flex-1 p-6">
        <QuestionnaireProcessor orgId={orgId} />
      </main>
    </div>
  );
}
