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
