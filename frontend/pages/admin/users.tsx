import React from 'react';
import AdminLayout from '../../components/Layouts/AdminLayout';
import AdminAllUsersTable from '../../components/Admin/AdminAllUsersTable';

const AdminAllUsersPage: React.FC = () => {
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Platform Users
          </h1>
          {/* Placeholder for potential future actions like "Invite User" */}
          {/* <Button className="flex items-center gap-2">
            <UserPlus size={20} />
            Invite New User
          </Button> */}
        </div>
        <AdminAllUsersTable />
      </div>
    </AdminLayout>
  );
};

export default AdminAllUsersPage;
