const BANK_REFERRAL_STORAGE_KEY = "africonnect-bank-referral-code";

export function extractBankReferralCode(searchParams: URLSearchParams) {
  return (
    searchParams.get("bank_ref") ||
    searchParams.get("ref") ||
    undefined
  );
}

export function storeBankReferralCode(code?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!code) {
    window.localStorage.removeItem(BANK_REFERRAL_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(BANK_REFERRAL_STORAGE_KEY, code);
}

export function getStoredBankReferralCode() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(BANK_REFERRAL_STORAGE_KEY);
}

export function clearStoredBankReferralCode() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BANK_REFERRAL_STORAGE_KEY);
}
