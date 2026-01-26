import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Types
interface KOLData {
  id: string;
  name: string;
  twitterHandle: string;
  tier: string;
  followersCount: number;
}

interface PostData {
  id: string;
  content: string | null;
  postedAt: string | null;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  kol: KOLData | null;
}

interface CampaignKOL {
  id: string;
  assignedBudget: number;
  kol: KOLData;
}

interface CampaignData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalBudget: number;
  startDate: string | null;
  endDate: string | null;
  kpis: {
    impressions?: number;
    engagement?: number;
    clicks?: number;
    followers?: number;
  } | null;
  campaignKols: CampaignKOL[];
}

interface Metrics {
  totalPosts: number;
  totalImpressions: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalQuotes: number;
  totalBookmarks: number;
  totalEngagement: number;
  engagementRate: string;
}

interface CampaignReportDocumentProps {
  campaign: CampaignData;
  posts: PostData[];
  metrics: Metrics;
  dateRange: { startDate: string; endDate: string };
  generatedAt: string;
  hideClientBudgetData?: boolean;
}

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
  },
  coverPage: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0d9488",
    marginBottom: 8,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#0d9488",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0d9488",
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 10,
    marginBottom: 4,
    color: "#475569",
  },
  boldText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
  },
  mutedText: {
    fontSize: 9,
    color: "#64748b",
  },
  // Cover page styles
  coverTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0d9488",
    marginBottom: 16,
    textAlign: "center",
  },
  coverSubtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 40,
    textAlign: "center",
  },
  coverCampaignName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  coverDateRange: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 60,
    textAlign: "center",
  },
  coverFooter: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    textAlign: "center",
  },
  // Metrics box styles
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  metricBox: {
    width: "25%",
    padding: 12,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0d9488",
  },
  metricLabel: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  // Table styles
  table: {
    marginTop: 8,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: "#fafafa",
  },
  tableCell: {
    fontSize: 9,
    paddingHorizontal: 4,
  },
  tableCellHeader: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#475569",
    paddingHorizontal: 4,
  },
  // Summary box
  summaryBox: {
    backgroundColor: "#f0fdfa",
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94a3b8",
  },
  // Info row
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: 120,
    fontSize: 10,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
  },
});

// Helper functions
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncateContent(content: string | null, maxLength: number = 80): string {
  if (!content) return "No content";
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + "...";
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    MACRO: "Macro (75K+)",
    LARGE: "Large (20K-75K)",
    MID: "Mid (10K-20K)",
    SMALL: "Small (1-10K)",
    // Legacy
    MEGA: "Macro (75K+)",
    RISING: "Large (20K-75K)",
    MICRO: "Mid (10K-20K)",
    NANO: "Small (1-10K)",
  };
  return labels[tier] || tier;
}

// Cover Page Component
function CoverPage({
  campaign,
  dateRange,
  generatedAt,
}: {
  campaign: CampaignData;
  dateRange: { startDate: string; endDate: string };
  generatedAt: string;
}) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={styles.coverTitle}>Campaign Report</Text>
        <Text style={styles.coverSubtitle}>Performance Analytics</Text>
        <Text style={styles.coverCampaignName}>{campaign.name}</Text>
        <Text style={styles.coverDateRange}>
          {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
        </Text>
      </View>
      <View style={styles.coverFooter}>
        <Text style={styles.mutedText}>Generated on {formatDate(generatedAt)}</Text>
        <Text style={[styles.mutedText, { marginTop: 4 }]}>
          Generated by Basecamp KOL Platform
        </Text>
      </View>
    </Page>
  );
}

// Executive Summary Page
function ExecutiveSummaryPage({
  campaign,
  metrics,
  dateRange,
  hideClientBudgetData,
}: {
  campaign: CampaignData;
  metrics: Metrics;
  dateRange: { startDate: string; endDate: string };
  hideClientBudgetData?: boolean;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.subHeader}>Executive Summary</Text>

      {/* Campaign Info */}
      <View style={styles.summaryBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Campaign Name:</Text>
          <Text style={styles.infoValue}>{campaign.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={styles.infoValue}>{campaign.status}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Report Period:</Text>
          <Text style={styles.infoValue}>
            {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
          </Text>
        </View>
        {campaign.startDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Campaign Dates:</Text>
            <Text style={styles.infoValue}>
              {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
            </Text>
          </View>
        )}
        {!hideClientBudgetData && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Budget:</Text>
            <Text style={styles.infoValue}>{formatCurrency(campaign.totalBudget)}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>KOLs Assigned:</Text>
          <Text style={styles.infoValue}>{campaign.campaignKols.length}</Text>
        </View>
      </View>

      {/* Key Metrics */}
      <Text style={styles.sectionTitle}>Key Performance Metrics</Text>
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{formatNumber(metrics.totalImpressions)}</Text>
          <Text style={styles.metricLabel}>Total Impressions</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{formatNumber(metrics.totalEngagement)}</Text>
          <Text style={styles.metricLabel}>Total Engagement</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{metrics.engagementRate}%</Text>
          <Text style={styles.metricLabel}>Engagement Rate</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{metrics.totalPosts}</Text>
          <Text style={styles.metricLabel}>Total Posts</Text>
        </View>
      </View>

      {/* Engagement Breakdown */}
      <Text style={styles.sectionTitle}>Engagement Breakdown</Text>
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: "#ef4444" }]}>{formatNumber(metrics.totalLikes)}</Text>
          <Text style={styles.metricLabel}>Likes</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: "#22c55e" }]}>{formatNumber(metrics.totalRetweets)}</Text>
          <Text style={styles.metricLabel}>Reposts</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: "#3b82f6" }]}>{formatNumber(metrics.totalReplies)}</Text>
          <Text style={styles.metricLabel}>Replies</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: "#8b5cf6" }]}>{formatNumber(metrics.totalQuotes)}</Text>
          <Text style={styles.metricLabel}>Quotes</Text>
        </View>
      </View>

      {/* KPI Progress (if defined) */}
      {campaign.kpis && (campaign.kpis.impressions || campaign.kpis.engagement) && (
        <>
          <Text style={styles.sectionTitle}>KPI Progress</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCellHeader, { width: "30%" }]}>Metric</Text>
              <Text style={[styles.tableCellHeader, { width: "25%" }]}>Target</Text>
              <Text style={[styles.tableCellHeader, { width: "25%" }]}>Actual</Text>
              <Text style={[styles.tableCellHeader, { width: "20%" }]}>Progress</Text>
            </View>
            {campaign.kpis.impressions && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "30%" }]}>Impressions</Text>
                <Text style={[styles.tableCell, { width: "25%" }]}>{formatNumber(campaign.kpis.impressions)}</Text>
                <Text style={[styles.tableCell, { width: "25%" }]}>{formatNumber(metrics.totalImpressions)}</Text>
                <Text style={[styles.tableCell, { width: "20%" }]}>
                  {((metrics.totalImpressions / campaign.kpis.impressions) * 100).toFixed(0)}%
                </Text>
              </View>
            )}
            {campaign.kpis.engagement && (
              <View style={styles.tableRowAlt}>
                <Text style={[styles.tableCell, { width: "30%" }]}>Engagement</Text>
                <Text style={[styles.tableCell, { width: "25%" }]}>{formatNumber(campaign.kpis.engagement)}</Text>
                <Text style={[styles.tableCell, { width: "25%" }]}>{formatNumber(metrics.totalEngagement)}</Text>
                <Text style={[styles.tableCell, { width: "20%" }]}>
                  {((metrics.totalEngagement / campaign.kpis.engagement) * 100).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text>Basecamp KOL Platform</Text>
        <Text>Page 2</Text>
      </View>
    </Page>
  );
}

// KOL Performance Page
function KOLPerformancePage({
  campaignKols,
  posts,
  hideClientBudgetData,
}: {
  campaignKols: CampaignKOL[];
  posts: PostData[];
  hideClientBudgetData?: boolean;
}) {
  // Calculate per-KOL metrics
  const kolMetrics = campaignKols.map((ck) => {
    const kolPosts = posts.filter((p) => p.kol?.id === ck.kol.id);
    const impressions = kolPosts.reduce((sum, p) => sum + p.impressions, 0);
    const engagement = kolPosts.reduce(
      (sum, p) => sum + p.likes + p.retweets + p.replies,
      0
    );
    return {
      ...ck,
      postsCount: kolPosts.length,
      impressions,
      engagement,
    };
  });

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.subHeader}>KOL Performance</Text>

      <Text style={styles.text}>
        Performance breakdown by Key Opinion Leader during the reporting period.
      </Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: "25%" }]}>KOL</Text>
          <Text style={[styles.tableCellHeader, { width: "15%" }]}>Tier</Text>
          <Text style={[styles.tableCellHeader, { width: "12%" }]}>Posts</Text>
          <Text style={[styles.tableCellHeader, { width: "16%" }]}>Impressions</Text>
          <Text style={[styles.tableCellHeader, { width: "16%" }]}>Engagement</Text>
          {!hideClientBudgetData && (
            <Text style={[styles.tableCellHeader, { width: "16%" }]}>Budget</Text>
          )}
        </View>
        {kolMetrics.map((kol, index) => (
          <View key={kol.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <View style={{ width: "25%" }}>
              <Text style={[styles.tableCell, { fontWeight: "bold" }]}>{kol.kol.name}</Text>
              <Text style={[styles.tableCell, { color: "#64748b", fontSize: 8 }]}>
                @{kol.kol.twitterHandle}
              </Text>
            </View>
            <Text style={[styles.tableCell, { width: "15%" }]}>{getTierLabel(kol.kol.tier)}</Text>
            <Text style={[styles.tableCell, { width: "12%" }]}>{kol.postsCount}</Text>
            <Text style={[styles.tableCell, { width: "16%" }]}>{formatNumber(kol.impressions)}</Text>
            <Text style={[styles.tableCell, { width: "16%" }]}>{formatNumber(kol.engagement)}</Text>
            {!hideClientBudgetData && (
              <Text style={[styles.tableCell, { width: "16%" }]}>{formatCurrency(kol.assignedBudget)}</Text>
            )}
          </View>
        ))}
      </View>

      {kolMetrics.length === 0 && (
        <Text style={[styles.text, { textAlign: "center", marginTop: 40 }]}>
          No KOLs assigned to this campaign.
        </Text>
      )}

      <View style={styles.footer}>
        <Text>Basecamp KOL Platform</Text>
        <Text>Page 3</Text>
      </View>
    </Page>
  );
}

// Posts Listing Page
function PostsListingPage({ posts }: { posts: PostData[] }) {
  // Split posts into chunks for pagination (max 15 per page)
  const postsPerPage = 15;
  const pages: PostData[][] = [];
  for (let i = 0; i < posts.length; i += postsPerPage) {
    pages.push(posts.slice(i, i + postsPerPage));
  }

  if (posts.length === 0) {
    return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.subHeader}>Posts</Text>
        <Text style={[styles.text, { textAlign: "center", marginTop: 40 }]}>
          No posts found in the selected date range.
        </Text>
        <View style={styles.footer}>
          <Text>Basecamp KOL Platform</Text>
          <Text>Page 4</Text>
        </View>
      </Page>
    );
  }

  return (
    <>
      {pages.map((pagePosts, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          <Text style={styles.subHeader}>
            Posts {pageIndex === 0 ? "" : `(continued)`}
          </Text>

          {pageIndex === 0 && (
            <Text style={styles.text}>
              All posts published during the reporting period, sorted by date.
            </Text>
          )}

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCellHeader, { width: "12%" }]}>Date</Text>
              <Text style={[styles.tableCellHeader, { width: "15%" }]}>KOL</Text>
              <Text style={[styles.tableCellHeader, { width: "33%" }]}>Content</Text>
              <Text style={[styles.tableCellHeader, { width: "10%" }]}>Views</Text>
              <Text style={[styles.tableCellHeader, { width: "10%" }]}>Likes</Text>
              <Text style={[styles.tableCellHeader, { width: "10%" }]}>Reposts</Text>
              <Text style={[styles.tableCellHeader, { width: "10%" }]}>Replies</Text>
            </View>
            {pagePosts.map((post, index) => (
              <View key={post.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.tableCell, { width: "12%" }]}>
                  {formatDate(post.postedAt)}
                </Text>
                <Text style={[styles.tableCell, { width: "15%" }]}>
                  {post.kol?.name || "Unknown"}
                </Text>
                <Text style={[styles.tableCell, { width: "33%" }]}>
                  {truncateContent(post.content)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatNumber(post.impressions)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatNumber(post.likes)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatNumber(post.retweets)}
                </Text>
                <Text style={[styles.tableCell, { width: "10%" }]}>
                  {formatNumber(post.replies)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Text>Basecamp KOL Platform</Text>
            <Text>Page {4 + pageIndex}</Text>
          </View>
        </Page>
      ))}
    </>
  );
}

// Main Document Component
export function CampaignReportDocument({
  campaign,
  posts,
  metrics,
  dateRange,
  generatedAt,
  hideClientBudgetData = false,
}: CampaignReportDocumentProps) {
  return (
    <Document>
      <CoverPage campaign={campaign} dateRange={dateRange} generatedAt={generatedAt} />
      <ExecutiveSummaryPage
        campaign={campaign}
        metrics={metrics}
        dateRange={dateRange}
        hideClientBudgetData={hideClientBudgetData}
      />
      <KOLPerformancePage
        campaignKols={campaign.campaignKols}
        posts={posts}
        hideClientBudgetData={hideClientBudgetData}
      />
      <PostsListingPage posts={posts} />
    </Document>
  );
}

// Export types for use in API route
export type { CampaignReportDocumentProps, CampaignData, PostData, Metrics };
