import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FiMenu } from "react-icons/fi";
import { Plus, LogOut, MessageSquare } from "lucide-react";
import api from "../utils/api";
import { clearToken, getToken } from "../hooks/useAuth";
import clsx from "clsx";
import ChatListItem from "./Chat/ChatListItem";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../utils/toast";

interface ChatItem {
  id: string;
  title: string;
}
interface SidebarProps {
  onSelect: (id: string) => void;
  isOpen: boolean;
  setIsOpen?: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelect,
  isOpen,
  setIsOpen,
}) => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const router = useRouter();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const fetchChats = async () => {
    setLoading(true);
    const token = getToken();
    try {
      const res = await api.get("/chat/history");
      setChats(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch chats", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const res = await api.post("/chat/create", {});
    fetchChats();
    onSelect(res.data.id);
    setSelectedChatId(res.data.id);
  };

  const handleRename = async (chatId: string, oldTitle: string) => {
    const newTitle = prompt("Rename chat:", oldTitle);
    if (!newTitle || newTitle === oldTitle) return;
    await api.patch(`/chat/${chatId}`, { title: newTitle });
    fetchChats();
  };

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const openChat = (id: string) => {
    onSelect(id);
    setSelectedChatId(id);
    setIsOpen(false);
  };

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node) &&
        isOpen &&
        window.innerWidth < 768 // only on mobile
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.body.style.overflow =
      isOpen && window.innerWidth < 768 ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop only on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={sidebarRef}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, info) => {
              if (info.offset.x < -100) setIsOpen(false);
            }}
            className="fixed top-0 left-0 h-full w-64 z-50 md:relative bg-white dark:bg-zinc-900 border-r dark:border-zinc-700 overflow-hidden md:translate-x-0"
          >
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-zinc-800 dark:text-white">
                  <MessageSquare className="w-5 h-5" />
                  Chats
                </h2>
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              </div>

              {/* Scrollable section */}
              <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-4 scrollbar-hide scroll-smooth">
                {loading ? (
                  <div className="text-sm text-center text-gray-500">
                    Loading chats…
                  </div>
                ) : (
                  chats.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      id={chat.id}
                      title={chat.title}
                      selected={selectedChatId === chat.id}
                      onSelect={(id) => {
                        onSelect(id);
                        setSelectedChatId(id);
                        if (window.innerWidth < 768) {
                          setIsOpen(false);
                        }
                      }}
                      refreshChats={fetchChats}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
