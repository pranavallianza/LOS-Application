import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

function getBankCode() {
  const envBankCode = process.env.NEXT_PUBLIC_BANK_CODE?.trim();
  if (envBankCode) return envBankCode;

  if (typeof window !== "undefined") {
    try {
      const authData = JSON.parse(window.localStorage.getItem("authData") || "{}");
      const bankCode =
        authData?.bankCode ||
        authData?.bank_code ||
        authData?.user?.bankCode ||
        authData?.user?.bank_code;
      if (typeof bankCode === "string" && bankCode.trim()) return bankCode.trim();
    } catch {
      // Ignore invalid session data.
    }
  }

  return "";
}

const getProductRows = (result) => [
  result?.data,
  result?.data?.items,
  result?.data?.products,
  result?.data?.records,
  result?.data?.content,
  result?.items,
  result?.products,
  result?.records,
  result?.content,
].find(Array.isArray);

export async function getLoanProducts(signal) {
  if (!API_BASE_URL) throw new Error("NEXT_PUBLIC_API_URL is not configured.");

  const headers = { Accept: "application/json" };
  const bankCode = getBankCode();
  if (bankCode) headers["X-Bank-Code"] = bankCode;

  let response;
  try {
    response = await axios.get(`${API_BASE_URL}/api/loan-products`, {
      headers,
      signal,
      params: { page: 0, size: 10 },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (error.response ? "Unable to load loan products from the backend." : "Unable to reach the loan product service.");
      throw new Error(message);
    }
    throw error;
  }

  const result = response.data;
  const rows = getProductRows(result);
  if (!rows) throw new Error('The backend returned an unsupported loan product response.');

  return rows
    .filter((product) => product && product.active !== false && product.status?.toUpperCase() !== 'INACTIVE')
    .map((product) => {
      const name = product.name || product.product_name || product.productName || product.label;
      const rawCode = product.product_code ?? product.productCode ?? product.code;
      const code = rawCode == null ? '' : String(rawCode).trim();
      const rawRate = product.annual_interest_rate
        ?? product.annualInterestRate
        ?? product.interest_rate
        ?? product.interestRate
        ?? product.interest_rate_pa
        ?? product.interestRatePa;
      const annualInterestRate = rawRate === undefined || rawRate === null || rawRate === '' ? null : Number(rawRate);

      return {
        id: product.id ?? product.code ?? name,
        code,
        name,
        annualInterestRate: Number.isFinite(annualInterestRate) && annualInterestRate >= 0 ? annualInterestRate : null,
      };
    })
    .filter((product) => typeof product.name === 'string' && product.name.trim());
}