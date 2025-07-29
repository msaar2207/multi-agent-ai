import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getToken } from './useAuth';

export const useAuthGuard = () => {
  const router = useRouter();
  useEffect(() => {
    const token = getToken();
    if (!token) router.replace('/login');
  }, []);
};
