import { useState } from 'react';
import api from '../utils/api';
import { setToken } from '../hooks/useAuth';
import { useRouter } from 'next/router';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/signup', { email, password });
      setToken(res.data.access_token);
      router.push('/');
    } catch (err) {
      alert('Registration failed');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
      <form
        onSubmit={handleRegister}
        className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md"
      >
        <h2 className="text-xl font-bold mb-6 text-center text-gray-800 dark:text-white">Register</h2>
        <input
          className="mb-4 p-3 w-full rounded border dark:bg-gray-700 dark:text-white"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="mb-4 p-3 w-full rounded border dark:bg-gray-700 dark:text-white"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700">
          Sign Up
        </button>
        <p className="text-sm text-center mt-4">
          Already have an account? <a href="/login" className="text-blue-500">Login</a>
        </p>
      </form>
    </div>
  );
}