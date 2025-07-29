import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme'; // Path should be correct
import { FaSun, FaMoon } from 'react-icons/fa';
import { Menu, MoreVertical, LogOut, Settings, Home } from 'lucide-react'; // Added Home
import { useRouter } from 'next/router';
import { useAuth, clearToken } from '../../hooks/useAuth'; // Path should be correct
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardIcon } from '@radix-ui/react-icons';

interface AdminToolbarProps { // Changed interface name
  title: string;
  onToggleSidebar?: () => void;
}

const AdminToolbar: React.FC<AdminToolbarProps> = ({ title, onToggleSidebar }) => { // Changed component name
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth(); // Will be used for user name and conditional dashboard link later

  // Calculate userName safely
  const userEmail = user?.email || '';
  const userName = userEmail.split("@")[0] || "User";

  let dashboardPath: string | null = null;
  let showDashboardLink = false;
  const userRoles = user?.role || []; // Default to empty array if user.role is undefined

  if (userRoles.includes("admin")) {
    dashboardPath = "/admin/dashboard";
    showDashboardLink = true;
  } else if (userRoles.includes("organization_head")) {
    dashboardPath = "/dashboard";
    showDashboardLink = true;
  }

  const handleNavigation = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  const handleLogout = () => {
    clearToken();
    router.push("/login");
    setMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const DropdownItem = ({ label, onClick, icon, red = false }: { label: string; onClick: () => void; icon: React.ReactNode; red?: boolean; }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition ${
        red ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 shadow transition-colors duration-300">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-blue-500 dark:hover:text-blue-500 transition-colors"
        >
          {theme === 'dark' ? <FaSun size={18} /> : <FaMoon size={18} />}
        </button>

        {user && ( // Only show dropdown if user is loaded
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md"
              aria-label="Open user menu"
            >
              <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-full font-bold text-xs">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:block">{userName}</span>
              <MoreVertical size={16} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 shadow-lg rounded-md z-50 overflow-hidden ring-1 ring-black ring-opacity-5"
                >
                  <div className="py-1">
                    {showDashboardLink && dashboardPath && (
                      <DropdownItem
                        label="Dashboard"
                        onClick={() => handleNavigation(dashboardPath!)} // Use non-null assertion
                        icon={<DashboardIcon  />}
                      />
                    )}
                    {/* <DropdownItem
                      label="Settings"
                      onClick={() => handleNavigation("/subscription-settings")}
                      icon={<Settings size={16} />}
                    /> */}
                    <DropdownItem
                      label="Logout"
                      onClick={handleLogout}
                      icon={<LogOut size={16} />}
                      red
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminToolbar; // Changed export name
