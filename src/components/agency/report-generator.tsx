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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            Generate Campaign Report
          </DialogTitle>
          <DialogDescription>
            Create a downloadable PDF report with campaign analytics for the selected date range.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Select Buttons */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(7)}
              >
                Last 7 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(30)}
              >
                Last 30 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(90)}
              >
                Last 90 days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect("all")}
              >
                All time
              </Button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                End Date
              </Label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Report Contents Preview */}
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <Label className="text-sm font-medium">Report will include:</Label>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Campaign overview and status</li>
              <li>• Key performance metrics (impressions, engagement)</li>
              <li>• KOL performance breakdown</li>
              <li>• Complete posts listing with metrics</li>
              <li>• KPI progress (if targets set)</li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !startDate || !endDate}
            className="bg-teal-600 hover:bg-teal-700"
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
