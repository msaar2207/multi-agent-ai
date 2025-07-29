import { Dialog } from "@headlessui/react";
import { Fragment } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  open,
  message,
  onConfirm,
  onCancel,
  cancelText,
  confirmText: confrimText,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} as={Fragment}>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {title}
          </Dialog.Title>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
            {message}
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-white"
            >
              {cancelText || "Cancel"}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
            >
              {confrimText || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
