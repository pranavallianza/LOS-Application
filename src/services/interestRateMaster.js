
import axios from "axios";
import { getLoanProducts } from "./loanProducts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

// Headers without Bearer Token
function getHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const message = responseData?.message || responseData?.error;

    if (typeof message === "string" && message.trim()) {
      return message;
    }

    if (error.response?.status === 403) {
      return "Access forbidden. Please check the backend API permissions.";
    }

    if (error.response?.status === 401) {
      return "Unauthorized request. Please check the API authentication settings.";
    }

    if (!error.response) {
      return "Unable to reach the interest rate service. Check your connection and try again.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function getResultData(result) {
  return result?.data !== undefined ? result.data : result;
}

function extractRows(result) {
  const data = getResultData(result);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(result?.records)) return result.records;

  return [];
}

// Normalize Interest Rate Master response
export function normalizeInterestRateMaster(master) {
  if (!master) return null;

  const tiers = master.tiers || master.bands || master.rates || [];

  return {
    id: master.id ?? master.rateMasterId ?? master.rate_master_id,
    productCode: master.productCode ?? master.product_code ?? "",
    productName: master.productName ?? master.product_name ?? "",
    effectiveDate: master.effectiveDate ?? master.effective_date ?? "",
    status: master.status ?? "",
    editable: master.editable,
    currentlyApplied:
      master.currentlyApplied ?? master.currently_applied,

    bands: tiers.map((tier, index) => ({
      id: tier.id ?? tier.tierId ?? tier.tier_id ?? index + 1,
      upToAmount: tier.upToAmount ?? tier.up_to_amount ?? "",
      upToMonths: tier.upToMonths ?? tier.up_to_months ?? "",
      normalInterest:
        tier.normalRate ??
        tier.normal_interest_rate ??
        tier.normalInterest ??
        "",
      penalRate: tier.penalRate ?? tier.penal_rate ?? null,
      adhocRate: tier.adhocRate ?? tier.adhoc_rate ?? null,
    })),
  };
}

// GET All Interest Rate Masters
export async function getInterestRateMasters({
  productCode = "",
  page = 0,
  size = 100,
  signal,
} = {}) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/interest-rate-masters`,
      {
        headers: getHeaders(),
        signal,
        params: {
          ...(productCode ? { productCode } : {}),
          page,
          size,
        },
      }
    );

    if (response.data?.success === false) {
      throw new Error(
        response.data.message || "Unable to load interest rate masters."
      );
    }

    return extractRows(response.data)
      .map(normalizeInterestRateMaster)
      .filter(Boolean);
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to load interest rate masters.")
    );
  }
}

// GET Interest Rate Master By ID
export async function getInterestRateMaster(id, signal) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/interest-rate-masters/${encodeURIComponent(id)}`,
      {
        headers: getHeaders(),
        signal,
      }
    );

    return normalizeInterestRateMaster(getResultData(response.data));
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to load the interest rate master.")
    );
  }
}

// CREATE Interest Rate Master
export async function createInterestRateMaster(rateMaster) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/interest-rate-masters`,
      rateMaster,
      {
        headers: getHeaders(),
      }
    );

    if (response.data?.success === false) {
      throw new Error(
        response.data.message || "Unable to save the interest rate master."
      );
    }

    return {
      configured: true,
      result: response.data,
      data: normalizeInterestRateMaster(getResultData(response.data)),
    };
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to save the interest rate master.")
    );
  }
}

// SAVE Interest Rate Master
export async function saveInterestRateMaster(rateMaster) {
  return createInterestRateMaster(rateMaster);
}

// UPDATE Interest Rate Master
export async function updateInterestRateMaster(id, rateMaster) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/interest-rate-masters/${encodeURIComponent(id)}`,
      rateMaster,
      {
        headers: getHeaders(),
      }
    );

    return {
      result: response.data,
      data: normalizeInterestRateMaster(getResultData(response.data)),
    };
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to update the interest rate master.")
    );
  }
}

// DELETE Interest Rate Master
export async function deleteInterestRateMaster(id) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/interest-rate-masters/${encodeURIComponent(id)}`,
      {
        headers: getHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to delete the interest rate master.")
    );
  }
}

// GET Applicable Interest Rate
export async function getApplicableInterestRate({
  productCode,
  amount,
  tenureMonths,
  date,
  signal,
} = {}) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/interest-rate-masters/applicable-rate`,
      {
        headers: getHeaders(),
        signal,
        params: {
          productCode,
          amount,
          tenureMonths,
          ...(date ? { date } : {}),
        },
      }
    );

    return getResultData(response.data);
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to get the applicable interest rate.")
    );
  }
}

// APPROVE Interest Rate Master
export async function approveInterestRateMaster(id) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/interest-rate-masters/${encodeURIComponent(id)}/approve`,
      {},
      { headers: getHeaders() }
    );
    return {
      result: response.data,
      data: normalizeInterestRateMaster(getResultData(response.data)),
    };
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to approve the interest rate master.")
    );
  }
}

// REJECT Interest Rate Master
export async function rejectInterestRateMaster(id, reason) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/interest-rate-masters/${encodeURIComponent(id)}/reject`,
      { reason },
      { headers: getHeaders() }
    );
    return {
      result: response.data,
      data: normalizeInterestRateMaster(getResultData(response.data)),
    };
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to reject the interest rate master.")
    );
  }
}

// GET Loan Products
// Keep existing Product API authentication because it is already working.
export async function getInterestRateProducts(signal) {
  return getLoanProducts(signal);
}
