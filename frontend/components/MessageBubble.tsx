import React from 'react';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export const MessageBubble = ({ role, content }: MessageProps) => {
  return (
    <div className={`my-2 flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl p-3 shadow-md text-sm whitespace-pre-wrap ${
          role === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white'
        }`}
      >
        {content}
      </div>
    </div>
  );
};