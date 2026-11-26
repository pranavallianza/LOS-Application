import axios from 'axios';

const API_ROOT = '/api/lead-proxy';
let lookupsRequest;

function getApiUrl() {
  return API_ROOT;
}

function getHeaders() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (typeof window === 'undefined') return headers;

  const storedAuthData = window.localStorage.getItem('authData');
  if (!storedAuthData) return headers;

  let authData;
  try {
    authData = JSON.parse(storedAuthData);
  } catch {
    throw new Error('Authentication data is invalid. Please sign in again.');
  }

  if (authData?.accessToken) {
    headers.Authorization = `Bearer ${authData.accessToken}`;
  }
  return headers;
}

function getErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const message = responseData?.message || responseData?.error;
    if (typeof message === 'string' && message.trim()) return message;
    if (!error.response) return 'Unable to reach the lead service. Check your connection and try again.';
  }
  return error instanceof Error ? error.message : 'The lead service request failed.';
}

function unwrapResponse(responseData) {
  if (responseData?.success === false) {
    throw new Error(responseData.message || responseData.error || 'The lead service request failed.');
  }
  return responseData?.data ?? responseData;
}

async function request(method, path, { data, params } = {}) {
  try {
    const response = await axios({
      method,
      url: `${getApiUrl()}${path}`,
      data,
      params,
      headers: getHeaders(),
    });
    return unwrapResponse(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getRetailLookups({ refresh = false } = {}) {
  if (refresh) lookupsRequest = null;
  if (!lookupsRequest) {
    lookupsRequest = request('GET', '/lookups', {
      params: { search: '', status: 'ALL' },
    }).then((result) => {
      if (!Array.isArray(result)) {
        throw new Error('The lookup service returned an unsupported lookup list.');
      }
      return result.map((lookup) => ({
        ...lookup,
        subLookups: Array.isArray(lookup.subLookups) ? lookup.subLookups : [],
      }));
    }).catch((error) => {
      lookupsRequest = null;
      throw error;
    });
  }
  return lookupsRequest;
}

export async function getRetailLeads({ page = 0, size = 10, status = '', search = '' } = {}) {
  const result = await request('GET', '/leads', {
    params: { page, size, status, search },
  });
  const items = Array.isArray(result)
    ? result
    : [result?.content, result?.items, result?.leads, result?.records, result?.data?.content]
      .find(Array.isArray);

  if (!items) {
    throw new Error('The lead service returned an unsupported lead list.');
  }

  const totalCount = Number(
    result?.totalElements
    ?? result?.totalCount
    ?? result?.total
    ?? result?.data?.totalElements
    ?? items.length,
  );
  return {
    items,
    totalElements: Number.isFinite(totalCount) ? totalCount : items.length,
  };
}

export async function getAllRetailLeads({ status = '', search = '' } = {}) {
  const size = 10;
  const firstPage = await getRetailLeads({ page: 0, size, status, search });
  const items = [...firstPage.items];
  const pageCount = Math.ceil(firstPage.totalElements / size);

  for (let page = 1; page < pageCount; page += 1) {
    const result = await getRetailLeads({ page, size, status, search });
    if (!result.items.length) {
      throw new Error('The lead service returned an incomplete paginated result.');
    }
    items.push(...result.items);
  }

  if (items.length < firstPage.totalElements) {
    throw new Error('The lead service returned an incomplete paginated result.');
  }

  return { items, totalElements: firstPage.totalElements };
}

export async function getRetailLead(leadId) {
  if (!leadId) throw new Error('The lead ID is missing.');
  return request('GET', `/leads/${encodeURIComponent(leadId)}`);
}

export async function createRetailLead(lead) {
  return request('POST', '/leads', { data: lead });
}

export async function updateRetailLead(leadId, lead) {
  if (!leadId) throw new Error('The lead ID is missing.');
  return request('PUT', `/leads/${encodeURIComponent(leadId)}`, { data: lead });
}

export async function assignRetailLead(leadId, assignment) {
  if (!leadId) throw new Error('The lead ID is missing.');
  return request('PUT', `/leads/${encodeURIComponent(leadId)}/assign`, { data: assignment });
}