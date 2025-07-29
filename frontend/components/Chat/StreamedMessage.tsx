import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BsRobot } from "react-icons/bs";

interface Props {
  content: string;
}

export default function StreamedMessage({ content }: Props) {
  return (
    <div className="flex gap-3 items-start text-sm">
      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-white">
        <BsRobot className="text-lg" />
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-full text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
