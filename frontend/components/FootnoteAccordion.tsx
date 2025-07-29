import React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { Copy, Share2, BookOpen } from "lucide-react";
import { Footnote } from "../components/ChatWindow";
import { useToast } from "../utils/toast";
type Props = {
  footnotes: Footnote[];
};

export default function FootnoteAccordion({ footnotes }: Props) {
  if (!footnotes || footnotes.length === 0) return null;
  const toast = useToast();
  const handleCopy = (arabic: string, english: string, reference: string) => {
    const text = `(${reference})\n${arabic}\n${english}`;
  
    // Modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Copied ayah to clipboard!");
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };
  
  const fallbackCopy = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed"; // Avoid scrolling to bottom
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
  
    try {
      const successful = document.execCommand("copy");
      toast.success(successful ? "Copied!" : "Copy failed");
    } catch (err) {
      toast.error("Unable to copy");
    }
  
    document.body.removeChild(textarea);
  };


  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue="footnotes"
      className="w-full mt-4 border rounded-xl bg-white dark:bg-zinc-900"
    >
      <Accordion.Item value="footnotes" className="border-b">
        <Accordion.Header>
          <Accordion.Trigger className="flex justify-between w-full p-4 font-semibold text-left hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
            <div className="flex items-center gap-2">
              <span>📖 Referenced Ayat</span>
            </div>
            <span className="ml-auto">▼</span>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="px-4 pb-4 space-y-4">
          {footnotes.map((fn, idx) => (
            <div
              key={idx}
              id={`ayah-${fn.reference.replace(":", "-")}`}
              className="border rounded-md p-3 bg-blue-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-500">{fn.reference}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(fn.arabic, fn.english, fn.reference)}
                    className="text-gray-500 hover:text-blue-600"
                    title="Copy"
                  >
                    <Copy size={16} />
                  </button>
                  
                </div>
              </div>
              <p
                className="text-xl font-bold text-blue-900 dark:text-gray-200 font-quran leading-loose text-right"
                dir="rtl"
              >
                {fn.arabic}
              </p>
              <p className="text-sm italic text-gray-700 dark:text-gray-200 mt-2">
                {fn.english}
              </p>
            </div>
          ))}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
