import { DocumentUploader } from '../components/DocumentUploader';
import { useAdminGuard } from '../hooks/useAdminGuard';

export default function UploadPage() {
  const isReady = useAdminGuard();
  if (!isReady) return null;
  return <DocumentUploader />;
}
