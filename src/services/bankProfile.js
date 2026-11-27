import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

function getAuthData() {
  const storedAuthData = window.localStorage.getItem("authData");

  if (!storedAuthData) {
    throw new Error("Verified session data is unavailable. Please sign in again.");
  }

  try {
    const authData = JSON.parse(storedAuthData);
    if (!authData || typeof authData !== "object") {
      throw new Error("Invalid session data.");
    }
    return authData;
  } catch {
    throw new Error("Verified session data is invalid. Please sign in again.");
  }
}

function getErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const message = responseData?.message || responseData?.error;
    if (typeof message === "string" && message.trim()) return message;
    if (!error.response) {
      return "Unable to reach the bank profile service. Check your connection and try again.";
    }
  }

  return error instanceof Error ? error.message : "Unable to load the bank profile.";
}

export async function getBankProfile() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const authData = getAuthData();
  const organizationId = authData.organizationId ?? authData.organization_id;

  if (organizationId === undefined || organizationId === null || organizationId === "") {
    throw new Error("Organization ID is missing from the verified session.");
  }

  const headers = { Accept: "application/json" };
  if (authData.accessToken) {
    headers.Authorization = `Bearer ${authData.accessToken}`;
  }

  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/setup/banks/${encodeURIComponent(organizationId)}`,
      { headers },
    );
    const result = response.data;

    if (result?.success === false) {
      throw new Error(result.message || result.error || "Unable to load the bank profile.");
    }

    if (!result?.data || typeof result.data !== "object" || Array.isArray(result.data)) {
      throw new Error("The bank profile response did not include organization data.");
    }

    return result;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
