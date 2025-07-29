import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  MoreVertical,
  Trash2,
  UserMinus,
  Shield,
  ShieldOff,
  ArrowUpRight,
} from "lucide-react";
import { getToken } from "../../hooks/useAuth";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  user: any;
  orgId: string;
  onActionComplete: () => void;
  onOpenQuota: () => void;
  currentUserRole?: string; // Added currentUserRole
}

export default function UserActionsDropdown({
  user,
  orgId,
  onActionComplete,
  onOpenQuota,
  currentUserRole, // Added currentUserRole
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  const requestConfirm = (message: string, action: () => void) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const performAction = async (
    endpoint: string,
    method: string,
    body?: any
  ) => {
    const token = getToken();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    onActionComplete();
  };

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="text-gray-500 hover:text-black dark:hover:text-white">
            <MoreVertical size={18} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-48 rounded-md bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black/5 border divide-y divide-gray-100 focus:outline-none"
          >
            <div className="px-1 py-1">
              {currentUserRole === 'admin' && (
                <button
                  onClick={() =>
                    requestConfirm(
                      `Are you sure you want to ${
                        user.role === "admin" ? "demote" : "promote"
                      } this user to admin?`,
                      () =>
                        performAction(
                          `/admin/orgs/${orgId}/update-role`, // This endpoint is admin-only
                          "PATCH",
                          {
                            userId: user.id, // Changed user._id to user.id
                            role: user.role === "admin" ? "member" : "admin",
                          }
                        )
                    )
                  }
                  className="w-full px-2 py-2 flex items-center text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
                >
                  {user.role === "admin" ? (
                    <ShieldOff size={16} className="mr-2 text-red-500" />
                  ) : (
                    <Shield size={16} className="mr-2 text-blue-500" />
                  )}
                  {user.role === "admin"
                    ? "Demote to Member"
                    : "Promote to Admin"}
                </button>
              )}
              <button
                onClick={() =>
                  requestConfirm(
                    `Are you sure you want to ${
                      user.is_active ? "deactivate" : "activate"
                    } this user?`,
                    () =>
                      performAction(`/org/${orgId}/toggle-active`, "PATCH", {
                        userId: user.id, // Changed user._id to user.id
                        is_active: !user.is_active,
                      })
                  )
                }
                className="w-full px-2 py-2 flex items-center text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
              >
                <UserMinus size={16} className="mr-2 text-yellow-500" />
                {user.is_active ? "Deactivate" : "Activate"} User
              </button>
              <button
                onClick={() =>
                  requestConfirm(
                    "Are you sure you want to permanently delete this user?",
                    () =>
                      performAction(
                        `/org/${orgId}/delete-user/${user.id}`, // Changed user._id to user.id
                        "DELETE"
                      )
                  )
                }
                className="w-full px-2 py-2 flex items-center text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-800 rounded"
              >
                <Trash2 size={16} className="mr-2" />
                Delete User
              </button>
              {/* <button
                onClick={onOpenQuota}
                className="w-full px-2 py-2 flex items-center text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
              >
                <ArrowUpRight size={16} className="mr-2 text-green-600" />
                Increase Quota
              </button> */}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <ConfirmDialog
        title="Confirm Action"
        open={confirmOpen}
        message={confirmMessage}
        onConfirm={() => {
          confirmAction();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
