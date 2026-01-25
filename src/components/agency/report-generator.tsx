"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Calendar, FileText, AlertCircle } from "lucide-react";

interface ReportGeneratorProps {
  campaignId: string;
  campaignName: string;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  open: boolean;
  onClose: () => void;
}

export function ReportGenerator({
  campaignId,
  campaignName,
  campaignStartDate,
  campaignEndDate,
  open,
  onClose,
}: ReportGeneratorProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize dates when dialog opens
  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Default to campaign dates if available, otherwise last 30 days
      if (campaignStartDate) {
        setStartDate(campaignStartDate.split("T")[0]);
      } else {
        setStartDate(thirtyDaysAgo);
      }

      if (campaignEndDate) {
        const campEnd = new Date(campaignEndDate);
        const todayDate = new Date();
        // Use the earlier of campaign end date or today
        setEndDate(campEnd < todayDate ? campaignEndDate.split("T")[0] : today);
      } else {
        setEndDate(today);
      }

      setError(null);
    }
  }, [open, campaignStartDate, campaignEndDate]);

  const handleQuickSelect = (days: number | "all") => {
    const today = new Date().toISOString().split("T")[0];

    if (days === "all") {
      if (campaignStartDate) {
        setStartDate(campaignStartDate.split("T")[0]);
      } else {
        // Default to 1 year ago if no campaign start date
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        setStartDate(oneYearAgo);
      }
      setEndDate(today);
    } else {
      const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      setStartDate(daysAgo);
      setEndDate(today);
    }
  };

  const handleGenerate = async () => {
    // Validate dates
    if (!startDate || !endDate) {
      setError("Please select both start and end dates");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date must be before end date");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate report");
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Generate filename
      const sanitizedName = campaignName
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 50);
      a.download = `${sanitizedName}-report-${startDate}-to-${endDate}.pdf`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <div className="p-2 bg-white/20 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              Generate Campaign Report
            </DialogTitle>
            <DialogDescription className="text-teal-100 mt-1">
              Create a downloadable PDF report with campaign analytics
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5 bg-slate-50">
          {/* Quick Select Buttons */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(7)}
                className="bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
              >
                Last 7 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(30)}
                className="bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
              >
                Last 30 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(90)}
                className="bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
              >
                Last 90 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect("all")}
                className="bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
              >
                All time
              </Button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Calendar className="h-4 w-4 text-teal-600" />
                Start Date
              </Label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Calendar className="h-4 w-4 text-teal-600" />
                End Date
              </Label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
              />
            </div>
          </div>

          {/* Report Contents Preview */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-2 shadow-sm">
            <Label className="text-sm font-medium text-slate-700">Report will include:</Label>
            <ul className="text-sm text-slate-600 space-y-1.5 ml-1">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                Campaign overview and status
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                Key performance metrics (impressions, engagement)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                KOL performance breakdown
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                Complete posts listing with metrics
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                KPI progress (if targets set)
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-slate-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !startDate || !endDate}
            className="bg-teal-600 hover:bg-teal-700 shadow-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
