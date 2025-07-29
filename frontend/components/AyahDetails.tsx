import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Info, FileText } from "lucide-react";

interface AyahDetailProps {
  ayahData: any;
  fontFamily: string;
}

export const AyahDetailView: React.FC<AyahDetailProps> = ({ ayahData, fontFamily = "Scheherazade New" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!ayahData?.verse) return;
    const text = ayahData.verse;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        const successful = document.execCommand("copy");
        if (successful) setCopied(true);
      } catch (e) {
        console.error("Fallback: Copy failed", e);
      }
      document.body.removeChild(textarea);
    }

    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-100">
      <h2 className="text-xl font-semibold">Ayah Detail</h2>

      <div className="text-sm text-zinc-600 dark:text-zinc-400">📖 {ayahData?.reference}</div>

      <div className="text-right text-2xl border border-zinc-200 dark:border-zinc-700 bg-green-50 dark:bg-zinc-800 rounded-md">
        <div className="max-h-52 overflow-y-auto px-4 py-3 text-right leading-loose" style={{ fontFamily }}>
          {ayahData?.verse}
        </div>
      </div>

      <div className="flex justify-end gap-2 text-sm">
        <motion.button
          onClick={handleCopy}
          animate={{
            scale: copied ? 1.1 : 1,
            backgroundColor: copied ? "#4ade80" : undefined,
          }}
          transition={{ type: "spring", stiffness: 300 }}
          className="flex items-center gap-1 px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded"
        >
          <Copy size={14} /> {copied ? "Copied!" : "Copy"}
        </motion.button>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
        {ayahData?.translation_en && (
          <div><strong>Translation:</strong> {ayahData.translation_en}</div>
        )}

        {ayahData?.translation_ar && (
          <div className="text-right"><strong>تفسير:</strong> {ayahData.translation_ar}</div>
        )}

        {ayahData?.summary_en && (
          <div className="bg-gray-50 dark:bg-zinc-700 p-3 rounded-md flex items-start gap-2">
            <Info className="mt-1 text-blue-600 dark:text-blue-400" size={18} />
            <div>
              <strong>Summary (EN):</strong> {ayahData.summary_en}
            </div>
          </div>
        )}

        {ayahData?.summary_ar && (
          <div className="bg-gray-50 dark:bg-zinc-700 p-3 rounded-md text-right flex items-start gap-2">
            <Info className="mt-1 text-blue-600 dark:text-blue-400" size={18} />
            <div>
              <strong>الملخص:</strong> {ayahData.summary_ar}
            </div>
          </div>
        )}

        {ayahData?.root_words && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="text-green-600 dark:text-green-400" size={18} />
              <strong>Root Words (Above verse):</strong>
            </div>
            <ul className="list-disc list-inside">
              {ayahData.root_words.map((entry: any, idx: number) => {
                const root = Object.keys(entry)[0];
                const meaning = entry[root];
                return (
                  <li key={idx}>{root}: {meaning}</li>
                );
              })}
            </ul>
          </div>
        )}

        {ayahData?.keywords_en && (
          <div><strong>Keywords (EN):</strong> {ayahData.keywords_en}</div>
        )}

        {ayahData?.keywords_ar && (
          <div className="text-right text-red-500">
            <strong>Keywords (AR):</strong> {ayahData.keywords_ar}
          </div>
        )}
      </div>
    </div>
  );
};