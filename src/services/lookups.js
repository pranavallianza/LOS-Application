const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL
).replace(/\/+$/, "");
const API_V1_URL = /\/api\/v\d+$/i.test(API_BASE_URL)
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

const LOOKUP_ROUTES = {
  list: process.env.NEXT_PUBLIC_LOOKUPS_ROUTE,
  byId: process.env.NEXT_PUBLIC_LOOKUP_BY_ID_ROUTE,
  status: process.env.NEXT_PUBLIC_LOOKUP_STATUS_ROUTE,
  subLookups: process.env.NEXT_PUBLIC_LOOKUP_SUBLOOKUPS_ROUTE,
  subLookupById: process.env.NEXT_PUBLIC_SUBLOOKUP_BY_ID_ROUTE,
  subLookupStatus: process.env.NEXT_PUBLIC_SUBLOOKUP_STATUS_ROUTE,
};

function buildLookupRoute(template, values = {}) {
  if (!template) {
    throw new Error("Lookup API routes are not configured in the environment.");
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (values[key] === undefined || values[key] === null) {
      throw new Error(`Missing value for lookup API route parameter: ${key}.`);
    }
    return encodeURIComponent(values[key]);
  });
}

function getRequestHeaders() {
  const storedAuthData = window.localStorage.getItem("authData");
  if (!storedAuthData) {
    throw new Error("Your session is unavailable. Please sign in again.");
  }

  let authData;
  try {
    authData = JSON.parse(storedAuthData);
  } catch {
    throw new Error("Your session is invalid. Please sign in again.");
  }

  if (!authData?.accessToken) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${authData.accessToken}`,
  };
}

async function requestLookupApi(path, options = {}) {
  const response = await fetch(`${API_V1_URL}${path}`, {
    ...options,
    headers: getRequestHeaders(),
    cache: "no-store",
  });
  console.log(`Lookup API request to ${path} returned status ${response.status}`);
  console.log(response, "ad");
  console.log(options, "options");

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.message || result?.error || `Lookup request failed (${response.status}).`,
    );
  }

  return result;
}

function toDisplayStatus(status, isActive = true) {
  const active = status ? status.toUpperCase() === "ACTIVE" : isActive;
  return active ? "Active" : "Inactive";
}

export async function getLookupTypes(signal) {
  const result = await requestLookupApi(buildLookupRoute(LOOKUP_ROUTES.list), {
    method: "GET",
    params: {
      search: "",
      status: "ALL",
    },
    signal,
  });

  if (!Array.isArray(result?.data)) {
    throw new Error("The lookup service returned an unsupported lookup list.");
  }

  return result.data.map((lookup) => ({
    id: lookup.id ?? lookup.code,
    code: lookup.code ?? "",
    name: lookup.name ?? "",
    description: lookup.description ?? "",
    status: toDisplayStatus(lookup.status, lookup.isActive),
    isFixed: Boolean(lookup.isFixed),
    subLookups: [],
  }));
}

export async function getLookupOptions(lookupTypeCode, signal) {
  const result = await requestLookupApi(
    buildLookupRoute(LOOKUP_ROUTES.subLookups, { lookupCode: lookupTypeCode }),
    { method: "GET", signal },
  );
  if (!Array.isArray(result?.data)) {
    throw new Error(`The lookup options for ${lookupTypeCode} were not returned as a list.`);
  }
  return result.data.map((option, index) => {
    const name = option.description ?? option.name ?? option.code ?? "";
    return {
      id: option.id ?? option.code ?? `${lookupTypeCode}-${index}`,
      code: option.code ?? "",
      name,
      description: option.description ?? "",
      status: toDisplayStatus(option.status, option.isActive),
      displayOrder: option.display_order ?? option.displayOrder ?? index + 1,
    };
  });
}

export async function createLookupType(lookupType) {
  return requestLookupApi(buildLookupRoute(LOOKUP_ROUTES.list), {
    method: "POST",
    body: JSON.stringify(lookupType),
  });
}

export async function updateLookupType(lookupId, lookupType) {
  return requestLookupApi(buildLookupRoute(LOOKUP_ROUTES.byId, { lookupId }), {
    method: "PUT",
    body: JSON.stringify(lookupType),
  });
}

export async function createLookupSubType(lookupTypeCode, subType) {
  return requestLookupApi(
    buildLookupRoute(LOOKUP_ROUTES.subLookups, { lookupCode: lookupTypeCode }),
    {
      method: "POST",
      body: JSON.stringify(subType),
    },
  );
}

export async function updateLookupSubType(subLookupId, subType) {
  return requestLookupApi(
    buildLookupRoute(LOOKUP_ROUTES.subLookupById, { subLookupId }),
    {
      method: "PUT",
      body: JSON.stringify(subType),
    },
  );
}

export async function setLookupTypeActive(lookupType, active) {
  return requestLookupApi(
    buildLookupRoute(LOOKUP_ROUTES.status, {
      lookupId: lookupType.id ?? lookupType.code,
    }),
    {
      method: "PATCH",
      body: JSON.stringify({ status: active ? "Active" : "Inactive" }),
    },
  );
}

export async function setLookupSubTypeActive(subTypeId, active) {
  return requestLookupApi(
    buildLookupRoute(LOOKUP_ROUTES.subLookupStatus, { subLookupId: subTypeId }),
    {
      method: "PATCH",
      body: JSON.stringify({ status: active ? "Active" : "Inactive" }),
    },
  );
}