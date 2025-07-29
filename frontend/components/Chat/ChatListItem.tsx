import { useState } from "react";
import clsx from "clsx";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import api from "../../utils/api";
import { useToast } from "../../utils/toast";

interface ChatListItemProps {
  id: string;
  title: string;
  selected: boolean;
  onSelect: (id: string) => void;
  refreshChats: () => void;
}

const ChatListItem: React.FC<ChatListItemProps> = ({
  id,
  title,
  selected,
  onSelect,
  refreshChats,
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const toast = useToast();

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === title) return;
    try {
      await api.patch(`/chat/${id}`, { title: newTitle });
      refreshChats();
      toast.success("Chat title updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update title");
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/chat/${id}`);
      refreshChats();
      onSelect("");
      toast.success("Chat deleted");
      setDeleteOpen(false);
    } catch {
      toast.error("Failed to delete chat");
    }
  };
  return (
    <>
      <div
        onClick={() => onSelect(id)}
        className={clsx(
          "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer group",
          selected
            ? "bg-blue-100 dark:bg-zinc-700 text-blue-800 dark:text-white"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
        )}
      >
        <button className="truncate text-sm text-left flex-1">
          {title || "Untitled"}
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="text-gray-400 opacity-0 group-hover:opacity-100 transition">
              <DotsVerticalIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content className="z-50 bg-white dark:bg-zinc-800 shadow-md border rounded-md p-1 text-sm">
            <DropdownMenu.Item
              onSelect={() => {
                setNewTitle(title);
                setEditOpen(true);
              }}
              className="cursor-pointer px-3 py-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
            >
              Edit Chat Title
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setDeleteOpen(true)}
              className="cursor-pointer px-3 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded"
            >
              Delete Chat
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {/* Edit Modal */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-lg">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Edit Chat Title
            </Dialog.Title>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              placeholder="Enter new title"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 text-sm rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Modal */}
      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-lg">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Delete Chat
            </Dialog.Title>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently delete this chat?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 text-sm rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};

export default ChatListItem;
