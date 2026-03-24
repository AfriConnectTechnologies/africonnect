"use client";

import { SignUp } from "@clerk/nextjs";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { extractBankReferralCode, storeBankReferralCode } from "@/lib/bank-referrals";

export default function SignUpPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const referralCode = extractBankReferralCode(searchParams);
    if (referralCode) {
      storeBankReferralCode(referralCode);
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}

