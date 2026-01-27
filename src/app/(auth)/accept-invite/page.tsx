"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, AlertCircle, ArrowRight } from "lucide-react";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState<{
    email: string;
    organizationName: string;
    role: string;
    inviterName: string;
  } | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError("Invalid invitation link");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setError(data.error || "Invalid or expired invitation");
          setIsLoading(false);
          return;
        }

        setInvitation(data.invitation);
      } catch {
        setError("Failed to verify invitation");
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      router.push(data.redirectTo);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#14B8A6]" />
      </div>
    );
  }

  if (error && !invitation) {
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
                Invalid Invitation
              </h1>
              <p className="text-[#6B6B80]">
                {error}
              </p>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-sm text-[#A0A0B0] text-center">
                Please contact your administrator for a new invitation.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-[#14B8A6]/5 to-[#0D9488]/5 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] mb-6 shadow-xl" style={{ boxShadow: "0 8px 32px rgba(20, 184, 166, 0.3)" }}>
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2 text-white">
              You&apos;re Invited!
            </h1>
            <p className="text-[#6B6B80]">
              <span className="text-white font-medium">{invitation?.inviterName}</span> has invited you to join{" "}
              <span className="text-white font-medium">{invitation?.organizationName}</span> as a{" "}
              <span className="capitalize">{invitation?.role?.toLowerCase()}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-sm text-[#6B6B80]">
                Email: <span className="text-white">{invitation?.email}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-[#A0A0B0] font-medium">Your Name (optional)</Label>
              <div className="relative">
                <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B80]" />
                <Input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12 pl-12 bg-white/5 border-white/10 text-white placeholder:text-[#6B6B80] rounded-xl focus:border-[#14B8A6] focus:ring-[#14B8A6]/20 transition-all duration-300"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] hover:from-[#0D9488] hover:to-[#14B8A6] text-white font-semibold rounded-xl shadow-xl transition-all duration-300"
                          >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Accept & Join
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-[#14B8A6]" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
