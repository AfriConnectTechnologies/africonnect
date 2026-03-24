"use client";

import { SignIn } from "@clerk/nextjs";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { extractBankReferralCode, storeBankReferralCode } from "@/lib/bank-referrals";

export default function SignInPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const referralCode = extractBankReferralCode(searchParams);
    if (referralCode) {
      storeBankReferralCode(referralCode);
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}

