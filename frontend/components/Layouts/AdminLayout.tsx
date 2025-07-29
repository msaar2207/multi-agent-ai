import React, { useEffect, useState } from 'react';
import Link from 'next/link'; // Import Link for Next.js navigation
import { useRouter } from 'next/router';
import { LayoutDashboard, Building, Users, Settings } from 'lucide-react'; // Example icons
import api from '../../utils/api'; // Import your API utility
import AdminToolbar from '../Admin/AdminToolbar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (data && data.role === 'admin') {
          setIsAuthorized(true);
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Authorization check failed:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [router]);

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/orgs', label: 'Organizations', icon: Building },
    { href: '/admin/users', label: 'Users (Platform)', icon: Users }, // Example: Platform-wide user management
    { href: '/admin/settings', label: 'Settings', icon: Settings }, // Example: Platform settings
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p> {/* Or use a spinner component */}
      </div>
    );
  }

  if (!isAuthorized) {
    // router.replace should have already handled the redirect,
    // but this is a fallback to prevent rendering children if not authorized.
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-zinc-900">
      {/* Sidebar */}
      
      <aside className="w-64 bg-gray-800 dark:bg-zinc-800 text-white flex flex-col">
        <div className="p-5 border-b border-gray-700 dark:border-zinc-700">
          <Link href="/admin/dashboard" legacyBehavior>
            <a className="text-2xl font-semibold hover:text-gray-300 transition-colors">Admin Panel</a>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} legacyBehavior>
              <a className="flex items-center p-3 hover:bg-gray-700 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                <item.icon size={20} className="mr-3" />
                {item.label}
              </a>
            </Link>
          ))}
        </nav>
        <div className="p-5 border-t border-gray-700 dark:border-zinc-700">
          <p className="text-xs text-gray-400 dark:text-zinc-500">© {new Date().getFullYear()} Admin Panel</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
      <AdminToolbar title="Admin Dashboard" />

        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
