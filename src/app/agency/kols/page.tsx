"use client";

import { useState, useEffect } from "react";
import { KOLTable } from "@/components/agency/kol-table";
import { KOLForm } from "@/components/agency/kol-form";

interface KOL {
  id: string;
  name: string;
  twitterHandle: string;
  tier: string;
  status: string;
  followersCount: number;
  avgEngagementRate: number;
  tags: { id: string; name: string; color: string }[];
  _count: {
    campaignKols: number;
    posts: number;
  };
}

export default function KOLsPage() {
  const [kols, setKols] = useState<KOL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchKols();
  }, []);

  const fetchKols = async () => {
    try {
      const response = await fetch("/api/kols");
      if (response.ok) {
        const data = await response.json();
        setKols(data);
      }
    } catch (error) {
      console.error("Failed to fetch KOLs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KOL Roster</h1>
        <p className="text-muted-foreground mt-1">
          Manage your influencer network and track their performance.
        </p>
      </div>

      <KOLTable kols={kols} onAddNew={() => setShowForm(true)} />

      <KOLForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          fetchKols();
        }}
      />
    </div>
  );
}
