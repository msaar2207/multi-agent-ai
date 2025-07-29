import { ChunkedAssistantUploader } from '../components/ChunkAssistantUploader';
import { useAdminGuard } from '../hooks/useAdminGuard';

export default function AdminChunkPage() {
  const ok = useAdminGuard();
  if (!ok) return null;
  return <ChunkedAssistantUploader />;
}