'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ViewCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    if (!id) {
      router.replace('/customer_management');
      return;
    }

    window.sessionStorage.setItem('customer_management:selectedViewId', id);
    router.replace('/customer_management/view');
  }, [id, router]);

  return null;
}
