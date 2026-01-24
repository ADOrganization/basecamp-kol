"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

interface OrganizationFormProps {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  variant?: "agency" | "client";
}

export function OrganizationForm({ organization, variant = "agency" }: OrganizationFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: organization.name,
    website: "",
    industry: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update organization");
      }

      setSuccess(true);
      router.refresh(); // Refresh server data
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization");
    } finally {
      setIsLoading(false);
    }
  };

  const colorClass = variant === "client" ? "teal" : "indigo";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Details</CardTitle>
        <CardDescription>
          {variant === "client" ? "View your organization's information" : "Manage your agency's information"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-6">
            <div className={`h-20 w-20 rounded-xl bg-${colorClass}-100 flex items-center justify-center`}>
              <Building2 className={`h-10 w-10 text-${colorClass}-600`} />
            </div>
            <div>
              <Button type="button" variant="outline" size="sm">Upload Logo</Button>
              <p className="text-xs text-muted-foreground mt-2">
                Recommended: 256x256px
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
              Organization updated successfully!
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">{variant === "client" ? "Identifier" : "Slug"}</Label>
              <Input id="org-slug" value={organization.slug} disabled />
              <p className="text-xs text-muted-foreground">
                {variant === "client" ? "Used internally for identification" : "Used in URLs and cannot be changed"}
              </p>
            </div>
            {variant === "client" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourcompany.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder="Cryptocurrency, DeFi, etc."
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isLoading}
              className={variant === "client" ? "bg-teal-600 hover:bg-teal-700" : ""}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
