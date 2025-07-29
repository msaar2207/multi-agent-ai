import toast from "react-hot-toast";
import {
  CheckCircleIcon,
  XCircleIcon,
  InfoIcon,
} from "lucide-react";

const playSound = (type: "success" | "error" | "info") => {
  const soundMap = {
    success: "/sounds/success.mp3",
    error: "/sounds/error.mp3",
    info: "/sounds/info.mp3",
  };
  const audio = new Audio(soundMap[type]);
  audio.play().catch(() => {});
};

const baseStyle =
  "flex items-center gap-2 px-4 py-2 rounded-md shadow-lg text-sm font-medium transition-all";

export const useToast = () => {
  return {
    success: (msg: string) => {
      toast.custom(
        () => (
          <div
            className={`${baseStyle} border bg-green-50 border-green-300 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-100`}
          >
            <CheckCircleIcon className="w-5 h-5 shrink-0" />
            <span>{msg}</span>
          </div>
        ),
        { duration: 3000 }
      );
      playSound("success");
    },
    error: (msg: string) => {
      toast.custom(
        () => (
          <div
            className={`${baseStyle} border bg-red-50 border-red-300 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-100`}
          >
            <XCircleIcon className="w-5 h-5 shrink-0" />
            <span>{msg}</span>
          </div>
        ),
        { duration: 4000 }
      );
      playSound("error");
    },
    info: (msg: string) => {
      toast.custom(
        () => (
          <div
            className={`${baseStyle} border bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-100`}
          >
            <InfoIcon className="w-5 h-5 shrink-0" />
            <span>{msg}</span>
          </div>
        ),
        { duration: 3000 }
      );
      playSound("info");
    },
  };
};
