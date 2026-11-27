import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

function getBankCode() {
  const envBankCode = process.env.NEXT_PUBLIC_BANK_CODE?.trim();
  if (envBankCode) return envBankCode;

  if (typeof window !== "undefined") {
    try {
      const storedAuthData = window.localStorage.getItem("authData");
      if (storedAuthData) {
        const authData = JSON.parse(storedAuthData);
        const fromAuth =
          authData?.bankCode ||
          authData?.bank_code ||
          authData?.user?.bankCode ||
          authData?.user?.bank_code;
        if (typeof fromAuth === "string" && fromAuth.trim()) return fromAuth.trim();
      }
    } catch {
      // Ignore invalid auth data and fall back to default.
    }
  }

  return "sbi001";
}

function getAuthHeaders() {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Bank-Code": getBankCode(),
  };

  if (typeof window !== "undefined") {
    const storedAuthData = window.localStorage.getItem("authData");
    if (storedAuthData) {
      try {
        const authData = JSON.parse(storedAuthData);
        if (typeof authData?.accessToken === "string" && authData.accessToken) {
          headers.Authorization = `Bearer ${authData.accessToken}`;
        }
      } catch {
        // Ignore invalid auth data.
      }
    }
  }

  return headers;
}

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const message = responseData?.message || responseData?.error;
    if (typeof message === "string" && message.trim()) return message;

    const details = responseData?.errors || responseData?.details;
    if (Array.isArray(details)) {
      const detailMessage = details
        .map((item) => (typeof item === "string" ? item : item?.message))
        .filter((item) => typeof item === "string" && item.trim())
        .join(" ");
      if (detailMessage) return detailMessage;
    }

    if (details && typeof details === "object") {
      const detailMessage = Object.entries(details)
        .flatMap(([field, messages]) => {
          const values = Array.isArray(messages) ? messages : [messages];
          return values
            .filter((item) => typeof item === "string" && item.trim())
            .map((item) => `${field}: ${item}`);
        })
        .join(" ");
      if (detailMessage) return detailMessage;
    }

    if (!error.response) {
      return "Unable to reach the user service. Check your connection and try again.";
    }
  }

  return error instanceof Error && error.message ? error.message : fallbackMessage;
}

function ensureApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
}

function unwrapResponse(response, fallbackMessage) {
  const result = response?.data;
  if (result?.success === false) {
    throw new Error(result?.message || result?.error || fallbackMessage);
  }
  return result;
}

export async function getUsers() {
  ensureApiBaseUrl();

  try {
    const response = await axios.get(`${API_BASE_URL}/api/users`, {
      headers: getAuthHeaders(),
      params: { bankCode: getBankCode() },
    });
    const result = unwrapResponse(response, "Unable to load users.");
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.users)) return result.users;
    if (Array.isArray(result?.content)) return result.content;
    return [];
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load users."));
  }
}

export async function getUserById(userId) {
  ensureApiBaseUrl();
  if (userId === undefined || userId === null || String(userId).trim() === "") {
    throw new Error("User ID is required.");
  }

  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/users/${encodeURIComponent(String(userId).trim())}`,
      {
        headers: getAuthHeaders(),
        params: { bankCode: getBankCode() },
      },
    );
    const result = unwrapResponse(response, "Unable to load user details.");
    return result?.data ?? result;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load user details."));
  }
}

export async function createUser(userPayload) {
  ensureApiBaseUrl();

  try {
    const response = await axios.post(`${API_BASE_URL}/api/users`, userPayload, {
      headers: getAuthHeaders(),
    });
    const result = unwrapResponse(response, "Unable to create user.");
    return result?.data ?? result;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to create user."));
  }
}

export async function updateUser(userId, userPayload) {
  ensureApiBaseUrl();
  if (userId === undefined || userId === null || String(userId).trim() === "") {
    throw new Error("User ID is required.");
  }

  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/users/${encodeURIComponent(String(userId).trim())}`,
      userPayload,
      { headers: getAuthHeaders() },
    );
    const result = unwrapResponse(response, "Unable to update user.");
    return result?.data ?? result;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to update user."));
  }
}

export async function generateUserToken(userId, tokenPayload = {}, expirationHours = 48) {
  ensureApiBaseUrl();
  if (userId === undefined || userId === null || String(userId).trim() === "") {
    throw new Error("User ID is required.");
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/users/${encodeURIComponent(String(userId).trim())}/token`,
      tokenPayload,
      {
        headers: getAuthHeaders(),
        params: { expirationHours, bankCode: getBankCode() },
      },
    );
    const result = unwrapResponse(response, "Unable to generate user token.");
    return result?.data ?? result;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to generate user token."));
  }
}

export async function getBranches() {
  ensureApiBaseUrl();

  try {
    const response = await axios.get(`${API_BASE_URL}/api/bank-profile/branch`, {
      headers: getAuthHeaders(),
    });
    const result = unwrapResponse(response, "Unable to load branches.");
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.branches)) return result.branches;
    return [];
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to load branches."));
  }
}

export function normalizeUserRecord(user = {}) {
  const firstName = user.firstName || user.first_name || "";
  const middleName = user.middleName || user.middle_name || "";
  const lastName = user.lastName || user.last_name || "";
  const name =
    user.name ||
    user.fullName ||
    [firstName, middleName, lastName].filter(Boolean).join(" ") ||
    user.username ||
    "";
  const branchName =
    user.loginBranch ||
    user.branch ||
    user.branchName ||
    user.branch_name ||
    user.login_branch_name ||
    user.loginBranchName ||
    user.login_branch?.branchName ||
    user.login_branch?.branch_name ||
    user.login_branch?.name ||
    "";
  const statusRaw = String(user.status || "").trim().toUpperCase();
  const status =
    statusRaw === "ACTIVE" || statusRaw === "OPERATIVE"
      ? "Active"
      : statusRaw === "INACTIVE" || statusRaw === "INOPERATIVE"
        ? "Inactive"
        : statusRaw === "SUSPENDED"
          ? "Suspended"
          : user.status || "";

  const enabled = (...values) => {
    const value = values.find((candidate) => candidate !== undefined && candidate !== null);
    return value === true || ["Y", "YES", "TRUE", "1"].includes(String(value).toUpperCase());
  };

  return {
    ...user,
    id: user.id ?? user.userId ?? user.user_id ?? user.userCode ?? user.empNo ?? user.emp_no,
    empNo: user.empNo || user.emp_no || user.employeeId || user.employee_id || "",
    employeeId: user.employeeId || user.employee_id || user.empNo || user.emp_no || "",
    name,
    fullName: name,
    firstName,
    middleName,
    lastName,
    title: user.title || ({ MALE: "Mr.", FEMALE: "Ms." }[String(user.gender || "").toUpperCase()] || ""),
    gender: user.gender || "",
    userName: user.userName || user.username || "",
    mobile: user.mobile || user.mobileNumber || user.phoneNumber || "",
    dateOfBirth: String(user.dateOfBirth || user.dob || "").slice(0, 10),
    email: user.email || user.emailAddress || "",
    allow2FA: enabled(user.allow2FA, user.twoFaEnabled, user.twoFAEnabled),
    twoFAEnabled: enabled(user.allow2FA, user.twoFaEnabled, user.twoFAEnabled) ? "Y" : "N",
    allowMultiBranch: enabled(user.allowMultiBranch, user.multiBranchAccess),
    multiBranchAccess: enabled(user.allowMultiBranch, user.multiBranchAccess) ? "Y" : "N",
    allowLoginOnHolidays: enabled(user.allowLoginOnHolidays, user.loginOnHolidays),
    loginOnHolidays: enabled(user.allowLoginOnHolidays, user.loginOnHolidays) ? "Y" : "N",
    branch: branchName,
    loginBranch: branchName,
    loginBranchId: user.loginBranchId ?? user.login_branch_id ?? user.branchId ?? user.branch_id ?? "",
    designation: user.designation || user.jobTitle || user.position || "",
    userRole: user.userRole || user.user_role || user.role || "",
    roleId: user.roleId ?? user.role_id ?? "",
    systemRole: user.systemRole || user.system_role || "",
    sessionTimeout: user.sessionTimeout ?? user.idleTimeout ?? user.inactiveSessionTimeout ?? user.inactive_session_timeout ?? 900,
    idleTimeout: user.idleTimeout ?? user.sessionTimeout ?? user.inactiveSessionTimeout ?? user.inactive_session_timeout ?? 900,
    inactiveSessionTimeout: user.inactiveSessionTimeout ?? user.sessionTimeout ?? user.idleTimeout ?? user.inactive_session_timeout ?? 900,
    badLogins: user.badLogins ?? user.no_of_bad_logins ?? 0,
    loginTime: user.loginTime || user.login_time || "09:00:00",
    logoutTime: user.logoutTime || user.logout_time || "18:00:00",
    status,
  };
}

export { getBankCode };
