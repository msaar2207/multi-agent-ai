import { useRouter } from 'next/router';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { AssistantFileManager } from '../../components/AssitantFileManger';

export default function AssistantFilesPage() {
  const { query } = useRouter();
  const ready = useAdminGuard();
  const assistantId = query.id as string;

  if (!ready || !assistantId) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">📂 Manage Files for Assistant</h1>
      <AssistantFileManager assistantId={assistantId} />
    </div>
  );
}
