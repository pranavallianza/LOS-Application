import axios from "axios";

const API_V1_URL = "/api/lookup-proxy";

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
  try {
    const response = await axios({
      method: options.method || "GET",
      url: `${API_V1_URL}${path}`,
      data: options.body,
      params: options.params,
      signal: options.signal,
      headers: getRequestHeaders(),
    });
    const result = response.data;

    if (result?.success === false) {
      throw new Error(result.message || result.error || "The lookup request failed.");
    }

    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.response?.data?.error;
      if (typeof message === "string" && message.trim()) throw new Error(message);
      if (!error.response) {
        throw new Error("Unable to reach the lookup service. Check your connection and try again.");
      }
    }
    throw error instanceof Error ? error : new Error("The lookup request failed.");
  }
}

function toDisplayStatus(status, isActive = true) {
  const active = status ? status.toUpperCase() === "ACTIVE" : isActive;
  return active ? "Active" : "Inactive";
}

// export async function getLookupTypes(signal) {
//   const result = await requestLookupApi("/api/lookups?search=&status=ALL", {
//     method: "GET",
//     signal,
//   });
//   if (!Array.isArray(result?.data)) {
//     throw new Error("The lookup service returned an unsupported lookup list.");
//   }
//   return result.data.map((lookup) => ({
//     id: lookup.id ?? lookup.code,
//     code: lookup.code ?? "",
//     name: lookup.name ?? "",
//     description: lookup.description ?? "",
//     status: toDisplayStatus(lookup.status, lookup.isActive),
//     isFixed: Boolean(lookup.isFixed),
//     subLookups: [],
//   }));
// }

export async function getLookupTypes(signal) {
  const result = await requestLookupApi("/lookups", {
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
    subLookups: Array.isArray(lookup.subLookups) ? lookup.subLookups : [],
  }));
}

export async function getLookupOptions(lookupTypeCode, signal) {
  const result = await requestLookupApi(
    `/lookups/${encodeURIComponent(lookupTypeCode)}/sub-lookups`,
    { method: "GET", signal },
  );
  if (!Array.isArray(result?.data)) {
    throw new Error(`The lookup options for ${lookupTypeCode} were not returned as a list.`);
  }
  return result.data.map((option, index) => {
    const name = option.description || option.name || option.code || "";
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
  return requestLookupApi("/lookups", {
    method: "POST",
    body: JSON.stringify(lookupType),
  });
}

export async function updateLookupType(lookupId, lookupType) {
  return requestLookupApi(`/lookups/${encodeURIComponent(lookupId)}`, {
    method: "PUT",
    body: JSON.stringify(lookupType),
  });
}

export async function createLookupSubType(lookupTypeCode, subType) {
  return requestLookupApi(
    `/lookups/${encodeURIComponent(lookupTypeCode)}/sub-lookups`,
    {
      method: "POST",
      body: JSON.stringify(subType),
    },
  );
}

export async function updateLookupSubType(subLookupId, subType) {
  return requestLookupApi(`/sub-lookups/${encodeURIComponent(subLookupId)}`, {
    method: "PUT",
    body: JSON.stringify(subType),
  });
}

export async function setLookupTypeActive(lookupType, active) {
  return requestLookupApi(
    `/lookups/${encodeURIComponent(lookupType.id ?? lookupType.code)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: active ? "Active" : "Inactive" }),
    },
  );
}

export async function setLookupSubTypeActive(subTypeId, active) {
  return requestLookupApi(
    `/sub-lookups/${encodeURIComponent(subTypeId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: active ? "Active" : "Inactive" }),
    },
  );
}