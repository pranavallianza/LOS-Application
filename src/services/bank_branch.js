import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

function getErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const message = responseData?.message || responseData?.error;
    if (typeof message === "string" && message.trim()) return message;
    if (!error.response) {
      return "Unable to reach the bank branch service. Check your connection and try again.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Unable to submit the bank branch.";
}

export async function createBankBranch(branch) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/bank-profile/branch`,
      branch,
      { headers: { "Content-Type": "application/json" } },
    );
    const result = response.data;

    if (result?.success === false) {
      throw new Error(
        result.message || result.error || "Unable to submit the bank branch.",
      );
    }

    return result;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getBankBranches(signal) {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

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

  try {
    const response = await fetch(`${API_BASE_URL}/api/bank-profile/branch`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authData.accessToken}`,
      },
      cache: "no-store",
      signal,
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || result?.success === false) {
      throw new Error(
        result?.message || result?.error || `Unable to load branches (${response.status}).`,
      );
    }

    if (!Array.isArray(result?.data)) {
      throw new Error("The branch service returned an unsupported branch list.");
    }

    return result.data;
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(getErrorMessage(error));
  }
}
