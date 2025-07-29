import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Footnote } from "../components/ChatWindow";

const isEmptyNode = (node: any): boolean => {
  if (!node) return true;

  if (typeof node === "string") return node.trim().length === 0;

  if (Array.isArray(node)) {
    return node.every(isEmptyNode);
  }

  if (React.isValidElement(node)) {
    const children = node.props?.children;
    return isEmptyNode(children);
  }

  return true;
};

const flattenListItem = (node: any): any => {
  if (!node) return null;

  if (node.type === "li") {
    return flattenListItem(node.props.children);
  }

  if (node.type === "p") {
    return flattenListItem(node.props.children);
  }

  if (Array.isArray(node)) {
    return node.flatMap((n, i) => flattenListItem(n));
  }

  return node;
};

const AyahTooltip = ({ refId, arabic, english }: Footnote) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <span className="text-blue-600 cursor-help hover:underline">
        ({refId})
      </span>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="top"
      align="center"
      className="bg-gray-800 text-white p-2 rounded shadow-lg max-w-sm z-50"
    >
      <div className="text-sm text-left">
        <div dir="rtl" className="font-quran text-base">
          {arabic}
        </div>
        <div className="mt-1 text-gray-200">{english}</div>
      </div>
      <Tooltip.Arrow className="fill-gray-800" />
    </Tooltip.Content>
  </Tooltip.Root>
);

const formatTextWithTooltips = (text: string, footnotes: Footnote[] = []) => {
  const refRegex = /\((\d{1,3}:\d{1,3})\)/g;
  console.log(footnotes)
  const renderTextWithTooltips = (content: string) => {
    const parts = content.split(refRegex);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const match = footnotes?.find((f) => f.reference === part);
        return match ? (
          <AyahTooltip key={index} refId={part} {...match} />
        ) : (
          <span key={index}>({part})</span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) =>
          isEmptyNode(children) ? null : (
            <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>
          ),
        h2: ({ children }) =>
          isEmptyNode(children) ? null : (
            <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>
          ),
        h3: ({ children }) =>
          isEmptyNode(children) ? null : (
            <h3 className="text-base font-semibold mb-1 mt-2">{children}</h3>
          ),
        p: ({ children }) =>
          isEmptyNode(children) ? null : (
            <p className="text-[15px] leading-relaxed text-gray-900 dark:text-gray-100">
              {children}
            </p>
          ),
        ul: ({ children }) => (
          <ul className="pl-5 list-disc mt-1 mb-1 space-y-1">
            {React.Children.toArray(children)
              .filter((child) => !isEmptyNode(child))
              .map((child, idx) => (
                <li
                  key={idx}
                  className="text-[15px] leading-snug text-gray-800 dark:text-gray-100"
                >
                  {flattenListItem(child)}
                </li>
              ))}
          </ul>
        ),

        ol: ({ children }) => (
          <ol className="pl-5 list-decimal mt-1 mb-1 space-y-1">
            {React.Children.toArray(children)
              .filter((child) => !isEmptyNode(child))
              .map((child, idx) => (
                <li
                  key={idx}
                  className="text-[15px] leading-snug text-gray-800 dark:text-gray-100"
                >
                  {flattenListItem(child)}
                </li>
              ))}
          </ol>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-sm">
            {children}
          </code>
        ),
        a: ({ href, children }) => (
          <a
            href={href || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {children}
          </a>
        ),
        text: ({ children }) => renderTextWithTooltips(String(children)),
      }}
    >
      {text}
    </ReactMarkdown>
  );
};

export default formatTextWithTooltips;
