import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import api from "../../utils/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import Layout from "../../components/Layout";

interface SubTopic {
  sub_topic_en: string;
  sub_topic_ar: string;
  references: string[];
}

interface Topic {
  _id: string;
  topic_en: string;
  topic_ar: string;
  alternate_names: string[];
  tags?: string[];
  subtopics?: SubTopic[];
}

function normalizeArabic(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^؀-ۿ\s]/g, "");
}

function getPaginationRange(current: number, total: number): (number | string)[] {
  const delta = 2;
  const range: (number | string)[] = [];
  for (
    let i = Math.max(2, current - delta);
    i <= Math.min(total - 1, current + delta);
    i++
  ) {
    range.push(i);
  }
  if (current - delta > 2) range.unshift("...");
  if (current + delta < total - 1) range.push("...");
  range.unshift(1);
  if (total > 1) range.push(total);
  return Array.from(new Set(range));
}

export default function TopicsIndexPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [sortKey, setSortKey] = useState<"topic_en" | "topic_ar">("topic_en");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    const fetchTopics = async () => {
      const res = await api.get("/quran/topics");
      setTopics(res.data);
    };
    fetchTopics();
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
    setCurrentPage(1);
  }, [search, selectedTag]);

  const searchLower = search.toLowerCase();
  const normalizedSearchAr = normalizeArabic(search);
  const isArabicSearch = /[؀-ۿ]/.test(search);

  const filtered = useMemo(() => {
    return topics.filter((t) => {
      const matchesEn =
        !isArabicSearch && t.topic_en.toLowerCase().includes(searchLower);

      const matchesAr =
        isArabicSearch &&
        normalizeArabic(t.topic_ar).includes(normalizedSearchAr);

      const matchesAlt = t.alternate_names?.some((n) =>
        isArabicSearch
          ? normalizeArabic(n).includes(normalizedSearchAr)
          : n.toLowerCase().includes(searchLower)
      ) || false;

      const matchesSubtopic = t.subtopics?.some((sub) =>
        isArabicSearch
          ? normalizeArabic(sub.sub_topic_ar).includes(normalizedSearchAr)
          : sub.sub_topic_en.toLowerCase().includes(searchLower)
      ) || false;

      const matchesTag = selectedTag ? t.tags?.includes(selectedTag) : true;

      return (matchesEn || matchesAr || matchesAlt || matchesSubtopic) && matchesTag;
    });
  }, [topics, search, selectedTag]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered.length]);

  const sorted = [...filtered].sort((a, b) =>
    a[sortKey].localeCompare(b[sortKey], undefined, { sensitivity: "base" })
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = useMemo(() => {
    return sorted.slice(startIndex, startIndex + itemsPerPage);
  }, [sorted, currentPage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setHighlightedIndex((prev) => Math.min(prev + 1, paginated.length - 1));
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && paginated[highlightedIndex]) {
      const topic = paginated[highlightedIndex];
      const keyword = topic.topic_en || topic.topic_ar;
      if (keyword) {
        setSearch(keyword);
        setCurrentPage(1);
      }
    } else if (e.key === "Escape") {
      setSearch("");
      setCurrentPage(1);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto text-zinc-800 dark:text-zinc-100">
        <PageHeader title="📚 Qur'anic Topics" breadcrumbs={["Home", "Topics"]} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <input
            type="text"
            placeholder="Search topics by name or sub-topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full sm:w-1/2 p-3 rounded border dark:bg-zinc-800"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="p-2 rounded border dark:bg-zinc-800"
          >
            <option value="topic_en">Sort by English</option>
            <option value="topic_ar">Sort by Arabic</option>
          </select>
        </div>

        <p className="text-sm mb-2">
          Showing {startIndex + 1}–
          {Math.min(startIndex + paginated.length, filtered.length)} of{" "}
          {filtered.length} results
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paginated.map((topic, index) => (
            <div
              key={topic.topic_en}
              onClick={() => router.push(`/topics/${topic.topic_en}`)}
              className={`cursor-pointer p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md hover:shadow transition ${
                highlightedIndex === index ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <h2 className="text-lg font-semibold">{topic.topic_en}</h2>
              <p className="text-sm text-green-600 mb-1">{topic.topic_ar}</p>
              {topic.alternate_names?.length > 0 && (
                <p className="text-xs text-zinc-500">
                  Also known as: {topic.alternate_names.join(", ")}
                </p>
              )}
              {topic.tags?.length && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {topic.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-2 py-1 text-sm rounded border dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} />
          </button>
          {getPaginationRange(currentPage, totalPages).map((page, idx) => (
            <button
              key={idx}
              onClick={() => typeof page === "number" && setCurrentPage(page)}
              disabled={page === "..."}
              className={`px-3 py-1 text-sm rounded ${
                page === currentPage
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-zinc-800 border dark:border-zinc-700"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-2 py-1 text-sm rounded border dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </Layout>
  );
}
