"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-border bg-card/50 backdrop-blur">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-rose-600 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
        <CardDescription className="text-base">
          {errorInfo.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
