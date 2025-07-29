import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import mammoth from "mammoth";

interface Props {
  filename: string;
  open: boolean;
  onClose: () => void;
}

export default function DocxViewerModal({ filename, open, onClose }: Props) {
  const [docContent, setDocContent] = useState("");

  useEffect(() => {
    const fetchDoc = async () => {
      if (!filename || !open) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/get-docx-file?filename=${filename}`);
        const arrayBuffer = await res.arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        setDocContent(value);
      } catch (err) {
        console.error("❌ Failed to load document", err);
        setDocContent("<p class='text-red-500'>Failed to load document.</p>");
      }
    };
    fetchDoc();
  }, [filename, open]);

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black opacity-40" />
      <div className="relative bg-white dark:bg-zinc-900 max-w-4xl w-full mx-auto rounded-xl shadow-lg flex flex-col max-h-[90vh] z-50">
        
        {/* Sticky Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <Dialog.Title className="text-lg font-bold text-zinc-800 dark:text-white truncate">
            {filename}
          </Dialog.Title>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-6 py-4 text-sm prose dark:prose-invert max-w-none text-zinc-800 dark:text-white flex-1">
          <div dangerouslySetInnerHTML={{ __html: docContent }} />
        </div>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}
