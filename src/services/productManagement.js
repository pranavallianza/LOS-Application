import axios from 'axios';

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message || error.response?.data?.error;
    if (typeof message === 'string' && message.trim()) return message;
    if (!error.response) {
      return 'Unable to reach the loan products service. Check your connection and try again.';
    }
  }
  return error instanceof Error ? error.message : fallback;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const storedAuthData = window.localStorage.getItem('authData');
  if (!storedAuthData) {
    throw new Error('Your session is unavailable. Please sign in again.');
  }

  let authData;
  try {
    authData = JSON.parse(storedAuthData);
  } catch {
    throw new Error('Your sign-in session is invalid. Please sign in again.');
  }

  if (!authData?.accessToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  headers.Authorization = `Bearer ${authData.accessToken}`;
  return headers;
}

function normalizeProduct(product, index) {
  const delegationPower = product.delegation_of_power
    ?? product.delegationOfPower
    ?? product.delegationPower;

  return {
    ...product,
    id: product.id ?? product.product_id ?? product.product_code ?? product.productCode ?? `product-${index}`,
    productCode: String(product.product_code ?? product.productCode ?? product.code ?? ''),
    productName: String(product.product_name ?? product.productName ?? product.name ?? ''),
    emiFixedDate: product.emi_fixed_date ?? product.emiFixedDate ?? '',
    emi: String(product.emi ?? ''),
    emiType: String(product.emi_type ?? product.emiType ?? ''),
    minTenure: String(product.min_tenure_months ?? product.minTenure ?? ''),
    minTenureUnit: 'Months',
    maxTenure: String(product.max_tenure_months ?? product.maxTenure ?? ''),
    maxTenureUnit: 'Months',
    minAmount: String(product.min_amount ?? product.minAmount ?? ''),
    maxAmount: String(product.max_amount ?? product.maxAmount ?? ''),
    penalty: product.penalty ?? false,
    penaltyPercent: String(product.penalty_percent ?? product.penaltyPercent ?? ''),
    daysInYear: String(product.no_of_days_in_year ?? product.daysInYear ?? ''),
    intBaseMethod: String(product.int_base_method ?? product.intBaseMethod ?? ''),
    interestFrequency: String(product.interest_calculation_frequency ?? product.interestFrequency ?? ''),
    calculationMode: String(product.interest_calculation_mode ?? product.calculationMode ?? ''),
    delegationPower: Array.isArray(delegationPower)
      ? delegationPower.map((row, rowIndex) => ({
        ...row,
        id: row.id ?? rowIndex + 1,
        limit: String(row.limit ?? ''),
        power: String(row.power ?? ''),
      }))
      : [],
  };
}

export async function getProductManagementProducts({ page = 0, size = 10, signal } = {}) {
  try {
    const response = await axios.get('/api/loan-products', {
      params: { page, size },
      signal,
      headers: authHeaders(),
    });
    const payload = response.data;
    if (payload?.success === false) {
      throw new Error(payload.message || payload.error || 'Unable to load loan products.');
    }

    const pageData = payload?.data ?? payload;
    const items = Array.isArray(pageData)
      ? pageData
      : [
        pageData?.content,
        pageData?.items,
        pageData?.products,
        pageData?.records,
        payload?.items,
        payload?.products,
        payload?.records,
      ].find(Array.isArray);
    if (!items) {
      throw new Error('The loan products service returned an unsupported product list.');
    }

    const totalElementsValue = Number(
      pageData?.totalElements
      ?? pageData?.totalCount
      ?? pageData?.total
      ?? payload?.totalElements
      ?? items.length,
    );
    const totalElements = Number.isFinite(totalElementsValue) ? totalElementsValue : items.length;
    const totalPagesValue = Number(pageData?.totalPages ?? payload?.totalPages);
    const totalPages = Number.isFinite(totalPagesValue) && totalPagesValue > 0
      ? totalPagesValue
      : Math.max(1, Math.ceil(totalElements / size));

    return {
      items: items.map(normalizeProduct),
      totalElements,
      totalPages,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load loan products.'));
  }
}

export async function saveProductManagementProduct(product) {
  try {
    const response = await axios.post('/api/loan-products', product, {
      headers: authHeaders(),
    });
    const result = response.data;
    if (result?.success === false) {
      throw new Error(result.message || result.error || 'Unable to save the product.');
    }
    return { configured: true, result };
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to save the product.'));
  }
}

export async function updateProductManagementProduct(productId, product) {
  if (productId === undefined || productId === null || productId === '') {
    throw new Error('The product ID is missing.');
  }

  try {
    const response = await axios.put(
      `/api/loan-products/${encodeURIComponent(productId)}`,
      product,
      { headers: authHeaders() },
    );
    const result = response.data;
    if (result?.success === false) {
      throw new Error(result.message || result.error || 'Unable to update the product.');
    }
    return { configured: true, result };
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update the product.'));
  }
}