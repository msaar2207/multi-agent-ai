// components/MessageList.tsx
import React from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BsPerson, BsRobot } from "react-icons/bs";
import { Message } from "../ChatWindow";
import formatTextWithTooltips from "../../utils/footnotes";
import FootnoteBlock from "../FootnoteAccordion";

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <>
      {messages.map((m, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`flex items-start gap-3 ${
            m.role === "user"
              ? "flex-row-reverse justify-start"
              : "justify-start"
          }`}
        >
          <div className="mt-1">
            {m.role === "user" ? (
              <BsPerson className="text-2xl text-gray-600" />
            ) : (
              <BsRobot className="text-2xl text-blue-600" />
            )}
          </div>
          <div
            title={m.timestamp ? new Date(m.timestamp).toLocaleString() : ""}
            className={`max-w-3xl p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-sm md:text-lg whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-blue-100 dark:bg-blue-800 text-right"
                : "text-left bg-gray-100 dark:bg-gray-800"
            }`}
          >
            {m.role === "assistant" ? (
              <div className="text-base leading-relaxed text-left text-gray-800 dark:text-gray-100">
                {formatTextWithTooltips(m.content, m.footnotes)}
                {
                  m.footnotes &&
                  m.footnotes.length > 0 && (
                    <FootnoteBlock footnotes={m.footnotes} />
                  )}
              </div>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.content}
              </ReactMarkdown>
            )}
          </div>
        </motion.div>
      ))}
    </>
  );
};

export default MessageList;
