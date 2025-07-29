import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Library,
  TreeDeciduous,
  ListTree,
  Settings,
  LogOut,
} from "lucide-react";
import { FaSun, FaMoon } from "react-icons/fa";
import { FiMoreVertical, FiBookOpen, FiLogOut } from "react-icons/fi";
import { useAuth, clearToken } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const userName = user?.email?.split("@")[0] || "User";

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const handleNavigation = (path: string) => {
    setMenuOpen(false);
    router.push(path);
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
    <>
      <Head>
        <title> GEM AI</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Toolbar */}
      <header className="fixed w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 shadow-sm">
        <div className=" mx-auto px-4 py-3 flex justify-between items-center">
          <h1
            onClick={() => handleNavigation("/chat")}
            className="text-lg font-semibold text-zinc-800 dark:text-white cursor-pointer"
          >
             GEMAI
          </h1>

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
                      <DropdownItem
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
                      />
                      <DropdownItem
                        label="Settings"
                        onClick={() =>
                          handleNavigation("/subscription-settings")
                        }
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
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-200px)] pt-8 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs py-4 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
        © {new Date().getFullYear()} Smart DCC Technologies LLC QuranAI. All
        rights reserved.
      </footer>
    </>
  );
}

// 🔄 Reusable dropdown item component
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
