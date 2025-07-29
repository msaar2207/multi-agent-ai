import { useAuthGuard } from "../hooks/useAuthGuard";
import { Sidebar } from "../components/Sidebar";
import { ChatWindow } from "../components/ChatWindow";
import { useState } from "react";

export default function ChatPage() {
  useAuthGuard();
  const [chatId, setChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen">
      <Sidebar
        onSelect={setChatId}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      <div className="flex-1">
        <ChatWindow
          chatId={chatId}
          setChatId={setChatId}
          setSidebarOpen={setSidebarOpen}
        />
      </div>
    </div>
  );
}
