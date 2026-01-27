"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

const errorMessages: Record<string, { title: string; message: string }> = {
  InvalidLink: {
    title: "Invalid Sign-in Link",
    message: "This sign-in link is invalid or has already been used. Please request a new one.",
  },
  Expired: {
    title: "Link Expired",
    message: "This sign-in link has expired. Links are valid for 15 minutes. Please request a new one.",
  },
  AccountDisabled: {
    title: "Account Disabled",
    message: "Your account has been disabled by an administrator. Please contact your organization for assistance.",
  },
  UserNotFound: {
    title: "Account Not Found",
    message: "No account was found with this email address. Please check your email or contact your administrator.",
  },
  NoOrganization: {
    title: "No Organization",
    message: "Your account is not associated with any organization. Please contact your administrator.",
  },
  RateLimit: {
    title: "Too Many Attempts",
    message: "You've made too many requests. Please wait a few minutes before trying again.",
  },
  ServerError: {
    title: "Server Error",
    message: "An unexpected error occurred. Please try again later.",
  },
  Default: {
    title: "Authentication Error",
    message: "An error occurred during sign-in. Please try again.",
  },
};

export default function AuthErrorPage() {
  const [errorInfo, setErrorInfo] = useState(errorMessages.Default);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errorCode = params.get("error") || "Default";
      setErrorInfo(errorMessages[errorCode] || errorMessages.Default);
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-red-500/5 to-rose-500/5 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 mb-6 shadow-xl" >
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2 text-white">
              {errorInfo.title}
            </h1>
            <p className="text-[#6B6B80]">
              {errorInfo.message}
            </p>
          </div>

          <Button
            asChild
            className="w-full h-12 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] hover:from-[#0D9488] hover:to-[#14B8A6] text-white font-semibold rounded-xl shadow-xl transition-all duration-300"
                      >
            <Link href="/login">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Sign In
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
