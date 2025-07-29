import React from 'react';

export default function UpgradeButton() {
  const handleUpgrade = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/create-checkout-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    window.location.href = data.url;
  };

  return (
    <button
      onClick={handleUpgrade}
      className="px-4 py-2 mt-2 text-white bg-blue-600 hover:bg-blue-700 rounded"
    >
      Upgrade to Pro
    </button>
  );
}
