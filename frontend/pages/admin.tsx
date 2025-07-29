import { useAdminGuard } from '../hooks/useAdminGuard';
import { AssistantCreator } from '../components/AssistantCreator';

export default function AdminPage() {
  const ready = useAdminGuard();
  if (!ready) return null;
  return <AssistantCreator />;
}