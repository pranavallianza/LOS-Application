const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || '';
const API_ROOT = `${API_BASE_URL.replace(/\/api(?:\/v\d+)?$/i, '')}/api`;

function getHeaders() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const storedAuthData = window.localStorage.getItem('authData');
  if (!storedAuthData) {
    throw new Error('Your session is unavailable. Please sign in again.');
  }

  let authData;
  try {
    authData = JSON.parse(storedAuthData);
  } catch {
    throw new Error('Your session is invalid. Please sign in again.');
  }

  if (!authData?.accessToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  headers.Authorization = `Bearer ${authData.accessToken}`;
  return headers;
}

async function requestCustomersApi(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: { ...getHeaders(), ...options.headers },
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the customer service. Check your connection and try again.');
    }
    throw error;
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.message || result?.error || `Customer request failed (${response.status}).`,
    );
  }

  return result;
}

function getList(result, description) {
  const candidates = [
    result,
    result?.data,
    result?.customers,
    result?.documents,
    result?.items,
    result?.content,
    result?.data?.customers,
    result?.data?.documents,
    result?.data?.items,
    result?.data?.content,
  ];
  const list = candidates.find(Array.isArray);
  if (!list) {
    throw new Error(`The customer service returned an unexpected ${description} list.`);
  }
  return list;
}

export async function createIndividualCustomer(customer) {
  return requestCustomersApi('/customers', {
    method: 'POST',
    body: JSON.stringify(customer, (_key, value) => {
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return {
          name: typeof File !== 'undefined' && value instanceof File ? value.name : '',
          type: value.type,
          size: value.size,
        };
      }
      return value;
    }),
  });
}

export async function getIndividualCustomers() {
  const result = await requestCustomersApi('/customers', { method: 'GET' });
  return getList(result, 'customer');
}

export async function getIndividualCustomerDocuments(customerCode) {
  if (!customerCode) {
    throw new Error('The customer code is missing.');
  }
  const result = await requestCustomersApi(
    `/customers/${encodeURIComponent(customerCode)}/documents`,
    { method: 'GET' },
  );
  return getList(result, 'customer document');
}
