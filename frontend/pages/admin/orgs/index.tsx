import React, { useState } from 'react';
import AdminLayout from '../../../components/Layouts/AdminLayout';
import AdminOrgTable from '../../../components/Admin/AdminOrgTable';
import AdminCreateOrgForm from '../../../components/Admin/AdminCreateOrgForm';
import { PlusCircle } from 'lucide-react';
import { Button } from '@headlessui/react';

const AdminOrgsPage: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger AdminOrgTable refresh

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleOrgCreated = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const handleOrgDeleted = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Manage Organizations
          </h1>
          <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
            <PlusCircle size={20} />
            Create New Organization
          </Button>
        </div>

        <AdminOrgTable refreshKey={refreshKey} onOrgDeleted={handleOrgDeleted} />

        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-md border dark:border-zinc-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Create Organization
                </h2>
                <button
                  onClick={handleCloseCreateModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  &times; {/* Simple X for close */}
                </button>
              </div>
              <AdminCreateOrgForm
                onSuccess={handleOrgCreated}
                onClose={handleCloseCreateModal}
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOrgsPage;
