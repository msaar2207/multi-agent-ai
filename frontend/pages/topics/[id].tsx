import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Dialog } from "@headlessui/react";
import { motion } from "framer-motion";
import { Copy } from "lucide-react";
import api from "../../utils/api";
import { AyahDetail } from "../lemma-tree";
import { getToken } from "../../hooks/useAuth";
import { AyahDetailView } from "../../components/AyahDetails";
import { PageHeader } from "../../components/PageHeader";
import Layout from "../../components/Layout";

interface TopicDetail {
  topic_en: string;
  topic_ar: string;
  alternate_names: string[];
  references: string[];
  subtopics: {
    sub_topic_en: string;
    sub_topic_ar: string;
    references: string[];
  }[];
}

export default function TopicDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [ayahPreview, setAyahPreview] = useState<string | null>(null);
  const [ayahText, setAyahText] = useState<{ arabic: string; english: string }>(
    { arabic: "", english: "" }
  );
  const [copied, setCopied] = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    if (!id) return;
    const fetchTopic = async () => {
      const res = await api.get(`/quran/topics/${id}`);
      setTopic(res.data);
    };
    fetchTopic();
  }, [id]);

  const handleCopy = async (ref: string) => {
    await navigator.clipboard.writeText(ref);
    setCopied(ref);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleAyahClick = async (ref: string) => {
    setAyahPreview(ref);
    const res = await api.get<AyahDetail>("/quran/find_ayat", {
      params: { reference: ref }, // ✅ fixed
      headers: { Authorization: `Bearer ${token}` },
    });
    setAyahText({
      arabic: res.data.verse,
      english: res.data.translation_en,
      ...res.data,
    });
  };

  if (!topic) return <div className="p-6 text-zinc-500">Loading topic...</div>;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto text-zinc-800 dark:text-zinc-100">
        <PageHeader
          title={`${topic.topic_en} - ${topic.topic_ar}`}
          breadcrumbs={["Home", "Topics", topic.topic_en]}
          showBack={true}
        />
        <p className="text-sm text-zinc-500 mb-4">
          Alternate Names: {topic?.alternate_names?.join(", ")}
        </p>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Verses Mentioning {topic.topic_en}
          </h2>
          <div className="flex flex-wrap gap-2">
            {topic.references.map((ref) => (
              <div
                key={ref}
                className="px-3 py-1 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center gap-2 cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-600"
                onClick={() => handleAyahClick(ref)}
              >
                {ref}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(ref);
                  }}
                  className="text-xs text-zinc-500 hover:text-green-500"
                >
                  <Copy size={14} />
                </button>
                {copied === ref && (
                  <span className="text-green-600 text-xs">Copied</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Subtopics</h2>
          {topic.subtopics.map((sub, idx) => (
            <div
              key={idx}
              className="mb-4 p-4 border border-zinc-300 dark:border-zinc-700 rounded-md"
            >
              <h3 className="font-semibold">
                {sub.sub_topic_en} -{" "}
                <span className="text-green-600">{sub.sub_topic_ar}</span>
              </h3>
              <div className="mt-2 flex gap-2 flex-wrap">
                {sub.references.map((ref) => (
                  <span
                    key={ref}
                    onClick={() => handleAyahClick(ref)}
                    className="cursor-pointer bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 px-3 py-1 rounded-full"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Dialog
          open={!!ayahPreview}
          onClose={() => setAyahPreview(null)}
          className="fixed inset-0 z-50"
        >
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black/40" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative z-50 w-full max-w-lg bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl"
            >
              <Dialog.Title className="text-lg font-semibold mb-4">
                {ayahPreview}
              </Dialog.Title>
              <AyahDetailView
                ayahData={ayahText}
                fontFamily="Scheherazade New"
              />
              <div className="text-right mt-6">
                <button
                  onClick={() => setAyahPreview(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </Dialog>
      </div>
    </Layout>
  );
}
