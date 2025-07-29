import { FiMessageSquare } from "react-icons/fi";

interface Props {
  onStartNew: () => void;
}

const EmptyChatState: React.FC<Props> = ({ onStartNew }) => {
  return (
    <div className="flex flex-col h-full items-center justify-center text-center px-6 bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-4">
        <FiMessageSquare className="text-5xl text-blue-600 dark:text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
          Start a new conversation
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Welcome to GemAI <br />
          Click below to begin a chat session.
        </p>
        <button
          onClick={onStartNew}
          className="mt-4 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow"
        >
          + New Chat
        </button>
      </div>
    </div>
  );
};

export default EmptyChatState;
