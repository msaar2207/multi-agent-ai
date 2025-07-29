import React, { useState } from "react";
import ConfirmationModal from '../SharedComponents/ConfirmationModal'; // Adjust path as necessary
import { toast } from 'react-hot-toast'; // Using react-hot-toast for consistency

const CancelSubscriptionButton: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenConfirmModal = () => {
    setIsModalOpen(true);
  };

  const executeSubscriptionCancel = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error("Authentication token not found. Please log in again.");
      setIsLoading(false);
      setIsModalOpen(false); // Close modal on auth error
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/cancel-subscription`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to cancel subscription. Please try again." }));
        throw new Error(errorData.detail);
      }

      toast.success("Subscription cancelled. You’ve been downgraded to the Free plan.");
      // Optionally, trigger a page reload or redirect if needed, e.g., to update subscription status display
      // window.location.reload();
    } catch (error: any) {
      console.error("Subscription cancellation error:", error);
      toast.error(error.message || "An error occurred while cancelling the subscription.");
    } finally {
      setIsLoading(false);
      setIsModalOpen(false); // Ensure modal is closed after action
    }
  };

  return (
    <>
      <button
        onClick={handleOpenConfirmModal}
        disabled={isLoading}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : 'Cancel Subscription'}
      </button>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={executeSubscriptionCancel} // executeSubscriptionCancel now also closes the modal
        title="Confirm Subscription Cancellation"
        message="Are you sure you want to cancel your subscription? This will downgrade you to the Free plan and revoke access to paid features at the end of your current billing cycle."
        confirmButtonText={isLoading ? "Confirming..." : "Confirm Cancellation"}
        confirmButtonVariant="danger"
        // Optional: disable confirm button while isLoading (though HeadlessUI might not directly support disabled state on its internal buttons easily, the action itself is guarded by isLoading)
      />
    </>
  );
};

export default CancelSubscriptionButton;