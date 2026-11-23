'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomerProfileView from '../../../components/CustomerProfileView';

const SELECTED_CUSTOMER_KEY = 'customer_management:selectedViewId';

export default function ViewCustomerPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');

  useEffect(() => {
    const selectedCustomerId = window.sessionStorage.getItem(SELECTED_CUSTOMER_KEY);
    if (selectedCustomerId) {
      setCustomerId(selectedCustomerId);
      return;
    }

    router.replace('/customer_management');
  }, [router]);

  return customerId ? <CustomerProfileView customerId={customerId} /> : null;
}
