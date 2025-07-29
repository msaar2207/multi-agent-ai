// components/PageHeader.tsx
import { useRouter } from "next/router";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  breadcrumbs?: string[];
  showBack?: boolean;
}

export function PageHeader({ title, breadcrumbs = [], showBack = false }: PageHeaderProps) {
  const router = useRouter();
  return (
    <div className="mb-6">
      {showBack && (
        <button
          onClick={() => router.back()}
          className="text-sm text-blue-600 hover:underline flex items-center mb-2"
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      {breadcrumbs.length > 0 && (
        <nav className="text-sm text-zinc-500">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx}>
              {idx > 0 && " / "}
              {idx < breadcrumbs.length - 1 ? (
                <button onClick={() => router.push(`/${crumb.toLowerCase() === 'home' ? '' : crumb.toLowerCase()}`)} className="hover:underline">
                  {crumb}
                </button>
              ) : (
                <span className="text-zinc-700 dark:text-zinc-300">{crumb}</span>
              )}
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}
