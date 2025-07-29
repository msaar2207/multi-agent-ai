/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Tree, NodeRendererProps } from "react-arborist";

import { getToken } from "../hooks/useAuth";
import api from "../utils/api";
import { useRouter } from "next/router";
import { Dialog } from "@headlessui/react";
import { motion } from "framer-motion";
import { AyahDetailView } from "../components/AyahDetails";
import { PageHeader } from "../components/PageHeader";
import Layout from "../components/Layout";

const ARABIC_ALPHABET = [
  "آ",
  "ا",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "ه",
  "و",
  "ي",
];

const normalizeArabic = (str: string) =>
  str
    .normalize("NFD")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[^؀-ۿ]/g, "");

export interface AyahDetail {
  verse: string;
  reference: string;
  translation_en: string;
  translation_ar: string;
  root_words: { [root: string]: string }[];
  keywords_en?: string;
  keywords_ar?: string;
  summary_en?: string;
  summary_ar?: string;
}

export default function RootLemmaTreeView() {
  const [search, setSearch] = useState("");
  const [ayahData, setAyahData] = useState<AyahDetail | null>(null);
  const [activeLetters, setActiveLetters] = useState<string[]>([]);
  const [fontFamily, setFontFamily] = useState("Scheherazade New");
  const [loadingAyah, setLoadingAyah] = useState(false);
  const [treeData, setTreeData] = useState<any[]>([]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const token = getToken();
  const router = useRouter();
  const effectiveSearch = normalizeArabic(search);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchQuranRootTree = async (search: string) => {
    const url = search
      ? `/quran/quran_root_tree?language=arabic&search=${encodeURIComponent(
          search
        )}`
      : `/quran/quran_root_tree?language=arabic`;
    const res = await api.get(url);
    return res.data;
  };

  const getAyahDetails = async (
    reference: string,
    token: string
  ): Promise<AyahDetail> => {
    const res = await api.get<AyahDetail>("/quran/find_ayat", {
      params: { reference },
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  useEffect(() => {
    const fetchTree = async () => {
      const data = await fetchQuranRootTree(effectiveSearch);
      setTreeData(data);
    };
    fetchTree();
  }, [effectiveSearch]);

  const handleClickAyah = async (ref: string, path: string[]) => {
    if (!token) return;
    setLoadingAyah(true);
    try {
      const res = await getAyahDetails(ref, token);
      setAyahData(res);
      setSelectedPath(path);
      if (window.innerWidth < 768) setShowDialog(true);
    } finally {
      setLoadingAyah(false);
    }
  };

  const handleLetterClick = (letter: string) => {
    if (activeLetters.length >= 2) return;
    const updated = [...activeLetters, letter];
    setActiveLetters(updated);
    setSearch(updated.join(""));
  };

  const handleBackspace = () => {
    const updated = activeLetters.slice(0, -1);
    setActiveLetters(updated);
    setSearch(updated.join(""));
  };

  const renderNode = ({ node }: NodeRendererProps<any>) => {
    const isLeaf = node.isLeaf;
    const toggle = () => node.toggle();
    const icon = isLeaf
      ? "📖"
      : node.level === 0
      ? "🌱"
      : node.level === 1
      ? ">"
      : "📝";
    const paddingLeft = `${node.level * 20}px`;

    return (
      <div
        onClick={() => {
          if (!isLeaf) toggle();
          else
            handleClickAyah(
              node.data.id,
              (() => {
                const path: string[] = [];
                let currentNode: typeof node | null = node;
                while (currentNode) {
                  path.unshift(currentNode.data.name);
                  currentNode = currentNode.parent;
                }
                return path;
              })()
            );
        }}
        className={`cursor-pointer flex items-center gap-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 ${
          isLeaf ? "text-blue-600" : "text-zinc-800 dark:text-white"
        }`}
        style={{ paddingLeft }}
      >
        <span style={{ fontFamily }}>{icon}</span>
        <span className="text-[1rem]">{node.data.name}</span>
      </div>
    );
  };

  return (
    <Layout>
      <div className="flex flex-col max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between px-4 py-2">
          <PageHeader
            title="📚 Qur'anic Root Explorer"
            breadcrumbs={["Home", "Qur'anic Root Explorer"]}
          />
          <div className="w-16" />
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row h-full overflow-hidden">
            <div className="w-full lg:w-[20%] px-3 py-4 space-y-4">
              <input
                type="text"
                dir="rtl"
                maxLength={2}
                value={search}
                placeholder="ابحث بالجذر"
                onChange={(e) => {
                  const val = normalizeArabic(e.target.value);
                  if (/^[\u0600-\u06FF]{0,2}$/.test(val)) {
                    setSearch(val);
                    setActiveLetters(val.split(""));
                  }
                }}
                className="w-full p-2 rounded-md text-sm text-right dark:bg-zinc-800"
              />
              <div className="grid grid-cols-6 gap-2" dir="rtl">
                {ARABIC_ALPHABET.map((letter) => (
                  <button
                    key={letter}
                    className={`rounded py-1 px-2 text-sm border ${
                      activeLetters.includes(letter)
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-zinc-700 text-black dark:text-white"
                    } hover:bg-blue-100 dark:hover:bg-blue-800`}
                    onClick={() => handleLetterClick(letter)}
                    disabled={activeLetters.length >= 2}
                  >
                    {letter}
                  </button>
                ))}
                <button
                  onClick={handleBackspace}
                  className="col-span-6 mt-2 py-1 text-sm bg-red-100 hover:bg-red-200 rounded text-red-700"
                >
                  ← Backspace
                </button>
              </div>
            </div>

            <div className="w-full lg:w-[40%] px-4 py-4 overflow-y-auto bg-white dark:bg-zinc-900">
              <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-100">
                🌱 Qur'anic Root Tree
              </h2>
              <Tree
                data={treeData}
                height={600}
                width="100%"
                children={renderNode}
                openByDefault={false}
                rowHeight={44}
              />
            </div>
            {!isMobileView && ayahData && (
              <div className="flex-1 px-4 py-4 overflow-y-auto bg-gray-50 dark:bg-zinc-900 rounded-lg">
                <h2 className="text-xl font-semibold mb-2 text-zinc-700 dark:text-white">
                  📖 Verse Preview
                </h2>
                {Array.isArray(selectedPath) && selectedPath.length > 0 && (
                  <div className="text-sm mb-2 text-zinc-500">
                    Path: {selectedPath.join(" / ")}
                  </div>
                )}
                <AyahDetailView ayahData={ayahData} fontFamily={fontFamily} />
              </div>
            )}
          </div>
        </div>

        {isMobileView && ayahData && (
          <Dialog
            open={showDialog}
            onClose={() => setShowDialog(false)}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-black/40" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative z-50 w-full max-w-xl bg-white dark:bg-zinc-900 p-6 rounded-md"
              >
                {/* <Dialog.Title className="text-lg font-semibold mb-4">Ayah Detail</Dialog.Title> */}
                <AyahDetailView ayahData={ayahData} fontFamily={fontFamily} />
                <div className="text-right mt-4">
                  <button
                    onClick={() => setShowDialog(false)}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
