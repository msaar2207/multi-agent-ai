import React from "react";
import { PaperPlaneIcon } from "@radix-ui/react-icons";
import { playSound } from "../../utils/sound";

interface MessageInputProps {
  input: string;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  input,
  onChange,
  onSubmit,
  textareaRef,
  disabled,
}) => {
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div
      className="sticky bottom-0 w-full px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-10"
      style={{ margin: "auto", maxWidth: "600px" }}
    >
      <div className="mx-auto max-w-3xl flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            disabled={disabled}
            rows={1}
            style={{
              height: textareaRef.current?.scrollHeight || "auto",
              overflow: "hidden",
              maxHeight: "80px",
            }}
            placeholder="Send a message"
            className="w-full resize-none rounded-full px-5 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-base sm:text-sm md:text-base text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                playSound("send");
                onSubmit(input);
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            playSound("send");
            onSubmit(input);
          }}
          disabled={disabled || input.trim() === ""}
          className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition"
        >
          <PaperPlaneIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
