import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { FaSun, FaMoon } from "react-icons/fa";
import { FiMenu, FiMoreVertical, FiLogOut, FiBookOpen } from "react-icons/fi";
import { useRouter } from "next/router";
import { clearToken, useAuth } from "../../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import UsageBar from "../UsageBar";
import {
  Library,
  ListTree,
  LogOut,
  Settings,
  TreeDeciduous,
} from "lucide-react";
import { ChatBubbleIcon, DashboardIcon } from "@radix-ui/react-icons";

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
}

const ChatHeader: React.FC<HeaderProps> = ({ title, onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const userName = user?.email?.split("@")[0] || "User";

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

  const DropdownItem = ({
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
        red ? "text-red-500" : "text-zinc-700 dark:text-white"
      } hover:bg-zinc-100 dark:hover:bg-zinc-700`}
    >
      {icon}
      {label}
    </button>
  );
  const gotoDashboard = () => {
    setMenuOpen(false);
    if (user.role === "admin") {
      handleNavigation("/admin/dashboard");
      return;
    }
    if (user.role === "organization_head") {
      handleNavigation("/dashboard");
      return;
    }
  };
  return (
    <div className="relative flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 shadow transition-colors duration-300">
      {/* <UsageBar /> */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden text-xl text-gray-600 dark:text-white"
        >
          <FiMenu />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="text-gray-500 dark:text-gray-300 hover:text-blue-500"
        >
          {theme === "dark" ? <FaSun size={18} /> : <FaMoon size={18} />}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
          >
            <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center rounded-full font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block">{userName}</span>
            <FiMoreVertical size={16} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 shadow-lg rounded-md z-50 overflow-hidden"
              >
                <div className="py-1">
                  {/* <DropdownItem
                    label="Knowledge Base"
                    onClick={() => handleNavigation("/knowledge-base")}
                    icon={<Library size={16} />}
                  />
                  <DropdownItem
                    label="Qur'an Tree"
                    onClick={() => handleNavigation("/lemma-tree")}
                    icon={<TreeDeciduous size={16} />}
                  />
                  <DropdownItem
                    label="Qur'an Topics"
                    onClick={() => handleNavigation("/topics")}
                    icon={<ListTree size={16} />}
                  /> */}
                  <DropdownItem
                    label="Chat"
                    onClick={() => handleNavigation("/chat")} // Path from ChatHeader
                    icon={<ChatBubbleIcon />}
                  />
                  {["admin", "organization_head"].includes(user.role) && (
                    <DropdownItem
                      label="Dashboard"
                      onClick={() => gotoDashboard()}
                      icon={<DashboardIcon />}
                    />
                  )}
                  <DropdownItem
                    label="Questionnaire"
                    onClick={() => handleNavigation("/questionnaire")} // Path from ChatHeader
                    icon={<Settings size={16} />}
                  />
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
      </div>
    </div>
  );
};

export default ChatHeader;
