import { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken } from './useAuth';

interface UsageLimits {
  tokens: number;
  messages: number;
}

interface UsageStatus {
  tier: string;
  token_usage_monthly: number;
  message_count_monthly: number;
  limits: UsageLimits;
  reset_date: string;
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(true);
    const token =  getToken();
  
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/usage/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsage(res.data);
      } catch (err) {
        console.error('Failed to fetch usage status', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  return { usage, loading };
}
