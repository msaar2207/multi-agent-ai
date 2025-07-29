import { useEffect, useState } from "react";
import DocxViewerModal from "../components/SharedComponents/DocxViewerModal";
import { PageHeader } from "../components/PageHeader";
import Layout from "../components/Layout";
import api from "../utils/api";
import { ChevronUp, ChevronDown } from "lucide-react";
import React from "react";
import { useToast } from "../utils/toast";
import { Toaster } from "react-hot-toast";

interface FileEntry {
  id: string;
  filename: string;
  createdAt: number;
}

const PAGE_SIZE = 20;

export default function KnowledgeBase() {
  const toast = useToast();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilename, setSelectedFilename] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileEntry | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<"filename" | "createdAt">(
    "createdAt"
  );
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const userRes = await api.get("/auth/me");
        setIsAdmin(userRes.data?.role === "admin");

        const res = await api.get("/documents/openai-files");
        setFiles(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load files.");
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  const handleViewFile = async (file: FileEntry) => {
    setSelectedFilename(file.filename);
    setIsModalOpen(true);
  };

  const confirmDeleteFile = (file: FileEntry) => {
    setFileToDelete(file);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      await api.delete(`/documents/openai-files/${fileToDelete.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      toast.success(`Deleted ${fileToDelete.filename}`);
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete file.");
    } finally {
      setIsDeleteModalOpen(false);
      setFileToDelete(null);
    }
  };

  const handleSort = (field: "filename" | "createdAt") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredFiles = files
    .filter((f) => f.filename.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortAsc ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

  const paginatedFiles = filteredFiles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const totalPages = Math.ceil(filteredFiles.length / PAGE_SIZE);
  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const toggleSelectAllOnPage = () => {
    const currentIds = paginatedFiles.map((f) => f.id);
    const allSelected = currentIds.every((id) => selectedFileIds.includes(id));
    if (allSelected) {
      setSelectedFileIds((prev) =>
        prev.filter((id) => !currentIds.includes(id))
      );
    } else {
      setSelectedFileIds((prev) => [...new Set([...prev, ...currentIds])]);
    }
  };

  const handleBulkDelete = async () => {
    const toDelete = files.filter((f) => selectedFileIds.includes(f.id));
    const confirmed = window.confirm(`Delete ${toDelete.length} files?`);
    if (!confirmed) return;

    try {
      await api.delete("/documents/openai-files/bulk", {
        data: selectedFileIds, // e.g., ['file-abc123', 'file-def456']
      });
      setFiles((prev) => prev.filter((f) => !selectedFileIds.includes(f.id)));
      setSelectedFileIds([]);
      toast.success("Deleted selected files");
    } catch (err) {
      toast.error("Some deletions failed");
    }
  };

  return (
    <Layout>
      <Toaster />
      <div className="max-w-6xl mx-auto p-8">
        <PageHeader
          title="📚 Knowledge Base"
          breadcrumbs={["Home", "Knowledge Base"]}
        />
        {loading ? (
          <p className="text-gray-500">Loading files...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <input
              type="text"
              placeholder="Search files..."
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-700 dark:text-white mb-4"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <div className="overflow-x-auto rounded-md border border-zinc-300 dark:border-zinc-600">
              {isAdmin && selectedFileIds.length > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    {selectedFileIds.length} selected
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete Selected
                  </button>
                </div>
              )}
              <div className="relative">
                <table className="min-w-full text-sm text-left bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white">
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-700 z-10">
                    <tr>
                      {isAdmin && (
                        <th className="px-4 py-2">
                          <input
                            type="checkbox"
                            onChange={toggleSelectAllOnPage}
                            checked={paginatedFiles.every((f) =>
                              selectedFileIds.includes(f.id)
                            )}
                          />
                        </th>
                      )}
                      <th
                        className="px-4 py-2 cursor-pointer select-none  w-[60%]"
                        onClick={() => handleSort("filename")}
                      >
                        <div className="flex items-center gap-1">
                          Name{" "}
                          {sortField === "filename" &&
                            (sortAsc ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th
                        className="px-4 py-2 cursor-pointer select-none  w-[30%]"
                        onClick={() => handleSort("createdAt")}
                      >
                        <div className="flex items-center gap-1">
                          Created At{" "}
                          {sortField === "createdAt" &&
                            (sortAsc ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-2 text-right  w-[10%]">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                </table>

                <div className="max-h-[440px] overflow-y-auto border-t border-zinc-300 dark:border-zinc-600">
                  <table className="min-w-full text-sm text-left bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white">
                    <tbody>
                      {paginatedFiles.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-4 text-center text-gray-500"
                          >
                            No files found.
                          </td>
                        </tr>
                      ) : (
                        paginatedFiles.map((file) => (
                          <tr
                            key={file.id}
                            className="border-t border-zinc-200 dark:border-zinc-600 group hover:bg-zinc-50 dark:hover:bg-zinc-700"
                          >
                            {isAdmin && (
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedFileIds.includes(file.id)}
                                  onChange={() => toggleFileSelection(file.id)}
                                />
                              </td>
                            )}
                            <td className="px-4 py-2  w-[60%]">
                              <button
                                onClick={() => handleViewFile(file)}
                                className="text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {file.filename}
                              </button>
                            </td>
                            <td className="px-4 py-2  w-[30%]">
                              {new Date(
                                file.createdAt * 1000
                              ).toLocaleDateString()}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-2 text-right  w-[10%]">
                                <button
                                  onClick={() => confirmDeleteFile(file)}
                                  className="text-red-600 text-sm hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    className="px-3 py-1 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-white disabled:opacity-40"
                  >
                    « Prev
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(currentPage - page) <= 2) return true;
                      return false;
                    })
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && page - arr[idx - 1] > 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 text-sm rounded-md border ${
                            page === currentPage
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-white"
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    className="px-3 py-1 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-white disabled:opacity-40"
                  >
                    Next »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DocxViewerModal
        filename={selectedFilename}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-lg max-w-sm w-full">
            <p className="text-sm text-zinc-800 dark:text-white mb-4">
              Are you sure you want to delete{" "}
              <strong>{fileToDelete?.filename}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3 py-1 text-sm rounded-md bg-gray-200 dark:bg-zinc-700 text-zinc-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                className="px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
