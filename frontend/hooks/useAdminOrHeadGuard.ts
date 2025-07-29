import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../utils/api';

export const useAdminOrHeadGuard = () => {
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        const role = res.data.role;
        if (role === 'admin' || role === 'organization_head') {
          setChecked(true);
        } else {
          router.replace('/login');
        }
      })
      .catch(() => router.replace('/login'));
  }, []);

  return checked;
};
