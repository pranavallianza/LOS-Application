const STORAGE_KEY = 'los_lead_records';

export function getLeads() {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Keep the lead list usable when browser storage is unavailable or invalid.
    }
  }

  return [];
}

export function saveLeads(leads) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch {
      // Keep the current in-memory lead list available when browser storage is unavailable.
    }
  }

  return leads;
}
