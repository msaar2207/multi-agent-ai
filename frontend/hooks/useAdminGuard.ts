import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../utils/api';

export const useAdminGuard = () => {
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        if (res.data.role !== 'admin') throw new Error();
        setChecked(true);
      })
      .catch(() => router.replace('/login'));
  }, []);

  return checked;
};
