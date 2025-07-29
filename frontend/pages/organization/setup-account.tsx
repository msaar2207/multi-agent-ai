import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Eye, EyeOff } from "lucide-react";

export default function SetupAccountPage() {
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!token || !password || password !== confirm) {
      setMessage("❌ Passwords must match and be non-empty");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Account activated. Redirecting to login...");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setMessage(`❌ ${data.detail || "Something went wrong."}`);
      }
    } catch (err) {
      setMessage("❌ Network error. Try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-zinc-900 dark:to-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border dark:border-zinc-800">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
          🕌 Setup Your QuranAI Account
        </h1>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
          Complete your invite by setting a secure password.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <div className="relative">
              <input
                type={visible ? "text" : "password"}
                className="w-full px-4 py-2 rounded-md border dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute top-2 right-3 text-gray-500 dark:text-gray-400"
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm Password
            </label>
            <input
              type={visible ? "text" : "password"}
              className="w-full px-4 py-2 rounded-md border dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-4 py-2 transition"
          >
            {loading ? "Activating..." : "Activate Account"}
          </button>

          {message && (
            <div className="text-sm text-center mt-3 text-red-500 dark:text-red-400">{message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
