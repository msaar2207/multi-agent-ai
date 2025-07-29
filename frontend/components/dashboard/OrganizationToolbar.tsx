import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { FaSun, FaMoon } from 'react-icons/fa';
import { Menu, MoreVertical, LogOut, Settings } from 'lucide-react'; // Added Home
import { useRouter } from 'next/router';
import { clearToken, useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatBubbleIcon, DashboardIcon } from '@radix-ui/react-icons';

interface OrganizationToolbarProps {
  title: string;
  onToggleSidebar?: () => void;
}

const DropdownItem = ({ // Defined DropdownItem component
  label,
  onClick,
  icon,
  red = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  red?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition ${
      red
      ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
      : "text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
    }`}
  >
    {icon}
    {label}
  </button>
);

const OrganizationToolbar: React.FC<OrganizationToolbarProps> = ({ title, onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  // Fallback to "User" if email is not available or doesn't contain "@"
  const userName = user?.email?.includes('@') ? user.email.split("@")[0] : (user?.email || "User");

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
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 shadow transition-colors duration-300">
      {/* Left Side: Title and Optional Sidebar Toggle */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden text-xl text-gray-600 dark:text-white p-1 -ml-1" // Added some padding and negative margin for better click area
            aria-label="Toggle sidebar"
          >
            <Menu size={24} />
          </button>
        )}
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h1>
      </div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors"
        >
          {theme === 'dark' ? <FaSun size={20} /> : <FaMoon size={20} />}
        </button>

        {/* User Dropdown Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="User menu"
          >
            <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-full font-bold text-xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block text-sm">{userName}</span>
            <MoreVertical size={20} className="text-gray-500 dark:text-gray-400" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-zinc-800 shadow-lg rounded-md z-50 overflow-hidden ring-1 ring-black ring-opacity-5"
              >
                <div className="py-1">
                  <DropdownItem
                    label="Chat"
                    onClick={() => handleNavigation("/chat")} // Path from ChatHeader
                    icon={<ChatBubbleIcon />}
                  />
                  {showDashboardLink && dashboardPath && (
                    <DropdownItem
                      label="Dashboard"
                      onClick={() => handleNavigation(dashboardPath!)} // Use non-null assertion
                      icon={<DashboardIcon />}
                    />
                  )}
                  <DropdownItem
                    label="Questionnaire"
                    onClick={() => handleNavigation("/questionnaire")} // Path from ChatHeader
                    icon={<Settings size={16} />}
                  />
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
      </div>
    </div>
  );
};

export default OrganizationToolbar;
