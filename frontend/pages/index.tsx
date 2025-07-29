import Head from "next/head";
import Link from "next/link";

export default function Home() {
  const features = [
    {
      title: "Root Word Search",
      desc: "Explore meanings by Arabic roots and linguistic analysis.",
      link: "/lemma-tree",
    },
    {
      title: "AI-Powered Knowledge Base",
      desc: "Understand Qur'anic legal guidance with traceable ayat.",
      link: "/knowledge-base",
    },
    {
      title: "Qur'anic Topics",
      desc: "Citations in Arabic + English with context-aware explanation.",
      link: "/topics",
    },
  ];
  return (
    <>
      <Head>
        <title>GemAI - Your Personal Research Assistant</title>
      </Head>

      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-zinc-900 dark:text-white mb-4">
          Welcome to GemAI
        </h1>
        <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-300 max-w-2xl mb-6">
          Your AI-powered assistant for exploring the Knowledge. Ask questions,
          analyze texts, and discover insights with precision.
        </p>

        <Link
          href="/chat"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg font-medium transition"
        >
          Start Chatting Now
        </Link>

        {/* <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          {features.map((feature, i) => (
            <Link
              href={feature.link}
              key={i}
              className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg shadow-sm hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer block"
            >
              <h3 className="text-xl font-semibold text-zinc-800 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {feature.desc}
              </p>
            </Link>
          ))}
        </div> */}

        <footer className="mt-16 text-xs text-zinc-500 dark:text-zinc-400">
          © {new Date().getFullYear()} GemAI. All rights reserved.
        </footer>
      </div>
    </>
  );
}
