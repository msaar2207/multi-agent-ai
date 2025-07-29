import { useState } from 'react';
import api from '../utils/api';
import { setToken } from '../hooks/useAuth';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { email, password });
      console.log('Login successful:', res.data);
      setToken(res.data.access_token);
      router.push('/');
    } catch (err) {
      console.log(err);
      console.log('Login failed:', err.response?.data || err.message);
      alert('Login failed ' + (err.response?.data?.detail || 'Please try again.'));
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
      <form
        onSubmit={handleLogin}
        className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md"
      >
        <h2 className="text-xl font-bold mb-6 text-center text-gray-800 dark:text-white">Login</h2>
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
        <button className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700">
          Sign In
        </button>
        <p className="text-sm text-center mt-4">
          Don't have an account? <a href="/register" className="text-blue-500">Register</a>
        </p>
      </form>
    </div>
  );
}