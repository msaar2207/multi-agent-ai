import { useEffect, useRef, useState } from 'react';

export const ChatInput = ({ onSend }: { onSend: (msg: string) => void }) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
      inputRef.current?.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
      <input
        ref={inputRef}
        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask something..."
      />
    </form>
  );
};
