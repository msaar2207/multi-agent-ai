import React, { useEffect, useRef, useState } from "react";
import { getToken } from "../hooks/useAuth";
import api from "../utils/api";
import ChatHeader from "./Chat/ChatHeader";
import MessageList from "./Chat/MessageList";
import StreamedMessage from "./Chat/StreamedMessage";
import MessageInput from "./Chat/MessageInput";
import { playSound } from "../utils/sound";
import { BsRobot } from "react-icons/bs";
import EmptyChatState from "./Chat/EmptyChat";
import { ArrowDown } from "lucide-react";
import { useToast } from "../utils/toast";
export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  footnotes?: Footnote[]; // Add this
}

export interface Footnote {
  reference: string;
  arabic: string;
  english: string;
  refId?: string;
}

interface ChatWindowProps {
  chatId: string | null;
  setChatId: (id: string) => void;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const thinkingPhrases = [
  "Reflecting on Knowledge",
  "Analyzing your Query",
  "Gathering relevant Context",
  "Interpreting Context",
  "Formulating Response",
  "Synthesizing Information",
  "Giving a Thoughtful Response",
  "Processing your Request",
];

let debounceTimeout: NodeJS.Timeout;

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatId,
  setChatId,
  setSidebarOpen,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const toast = useToast();
  const [chatTitle, setChatTitle] = useState("Chat");
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [thinkingText, setThinkingText] = useState("");
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const fetchMessages = async () => {
      const res = await api.get(`/chat/history`);
      const chat = res.data.find((c: any) => c.id === chatId);
      if (chat) {
        setMessages(chat.messages || []);
        setChatTitle(chat.title || "Chat");
      }
    };
    if (chatId) fetchMessages();
  }, [chatId]);

  useEffect(() => {
    if (streamingChatId === chatId) {
      const idx = Math.floor(Math.random() * thinkingPhrases.length);
      setThinkingText(thinkingPhrases[idx]);
    }
  }, [streamingChatId, chatId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timeout);
  }, [messages, streamingMessage]);

  useEffect(() => {
    const handleFocus = () => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };
    const el = textareaRef.current;
    el?.addEventListener("focus", handleFocus);
    return () => el?.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const nearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        150;
      setShowScrollDown(!nearBottom);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSend = async (msg: string) => {
    if (!msg.trim()) return;
    const token = getToken();
  
    setInput("");
    setStreamingChatId(chatId);
    setStreamingMessage("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
  
    try {
      // Save user message
      await api.post(`/chat/${chatId}/message`, { role: "user", content: msg });
    } catch (err) {
      toast.error("Failed to send message. Please check your connection.");
      setStreamingChatId(null);
      return;
    }
  
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/assistant/stream`,
        {
          method: "POST",
          body: JSON.stringify({ chat_id: chatId, question: msg }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
  
      if (!response.ok) {
        toast.error("Assistant service unavailable.");
        setStreamingChatId(null);
        return;
      }
  
      if (!response.body) {
        toast.error("No response from assistant.");
        setStreamingChatId(null);
        return;
      }
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantMessage = "";
  
      const stream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          buffer += chunk;
  
          while (buffer.includes("\n\n")) {
            const splitIndex = buffer.indexOf("\n\n");
            const raw = buffer.slice(0, splitIndex).trim();
            buffer = buffer.slice(splitIndex + 2);
  
            if (!raw.startsWith("data: ")) continue;
            const dataStr = raw.slice(6).trim();
            if (!dataStr) continue;
  
            let json;
            try {
              json = JSON.parse(dataStr);
            } catch {
              continue;
            }
  
            if (json.type === "token") {
              assistantMessage += json.content + " ";
              clearTimeout(debounceTimeout);
              debounceTimeout = setTimeout(() => {
                setStreamingMessage(assistantMessage.trim());
              }, 20);
            } else if (json.type === "done") {
              setStreamingChatId(null);
              setStreamingMessage("");
              playSound("receive");
  
              const res = await api.get(`/chat/history`);
              const chat = res.data.find((c: any) => c.id === chatId);
              if (chat) {
                if (chat) setMessages(chat.messages || []);
                setChatTitle(chat.title || "Chat");
              };
            } else if (json.type === "error") {
              toast.error(`Error: ${json.error}`);
              setStreamingChatId(null);
            }
          }
        }
      };
  
      stream();
    } catch (err) {
      console.error("❌ Streaming error:", err);
      toast.error("Network not available. Please check your internet.");
      setStreamingChatId(null);
    }
  };
  
  if (!chatId) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        <ChatHeader
          title=""
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <EmptyChatState
          onStartNew={async () => {
            const res = await api.post("/chat/create", {});
            setChatId(res.data.id);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 relative">
      <ChatHeader
        title={chatTitle}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-20 space-y-4 scrollbar-hide transition-all duration-300"
        style={{ maxWidth: "1200px", margin: "0 auto" }}
      >
        <MessageList messages={messages} />
        {streamingChatId === chatId && streamingMessage && (
          <StreamedMessage content={streamingMessage} />
        )}
        {streamingChatId === chatId && !streamingMessage && (
          <div className="flex items-center gap-2 text-gray-500 px-2">
            <BsRobot className="text-xl" />
            <div className="text-sm font-medium">{thinkingText}</div>
            <div className="flex items-end gap-1 ml-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce delay-100">.</span>
              <span className="animate-bounce delay-200">.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {showScrollDown && (
        <button
          onClick={() =>
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }
          className="fixed bottom-24 right-4 z-50 p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      <MessageInput
        input={input}
        textareaRef={textareaRef}
        onChange={setInput}
        onSubmit={handleSend}
        disabled={streamingChatId === chatId}
      />
    </div>
  );
};
