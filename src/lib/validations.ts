import { z } from "zod";

// Auth validations
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  organizationType: z.enum(["AGENCY", "CLIENT"]),
});

// KOL validations
export const kolSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  twitterHandle: z.string().min(1, "Twitter handle is required").regex(/^@?[\w]+$/, "Invalid Twitter handle"),
  telegramUsername: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  tier: z.enum(["SMALL", "MID", "LARGE", "MACRO"]),
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED", "PENDING"]),
  ratePerPost: z.number().min(0).optional(),
  ratePerThread: z.number().min(0).optional(),
  ratePerRetweet: z.number().min(0).optional(),
  ratePerSpace: z.number().min(0).optional(),
  walletAddress: z.string().optional(),
  paymentNotes: z.string().optional(),
  notes: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

export const kolTagSchema = z.object({
  name: z.string().min(1, "Tag name is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
});

// Campaign validations
export const campaignSchema = z.object({
  name: z.string().min(2, "Campaign name must be at least 2 characters"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  projectTwitterHandle: z.string().min(1, "Project Twitter handle is required"),
  clientTelegramChatId: z.string().min(1, "Client Telegram group is required"),
  keywords: z.array(z.string()).optional(),
  totalBudget: z.number().min(0, "Budget must be positive").default(0),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const campaignKolSchema = z.object({
  kolId: z.string().min(1, "KOL is required"),
  assignedBudget: z.number().min(0, "Budget must be positive").default(0),
  requiredPosts: z.number().min(0).default(0),
  requiredThreads: z.number().min(0).default(0),
  requiredRetweets: z.number().min(0).default(0),
  requiredSpaces: z.number().min(0).default(0),
  deliverables: z.array(z.object({
    type: z.enum(["POST", "THREAD", "RETWEET", "QUOTE", "SPACE"]),
    quantity: z.number().min(1),
  })).optional(),
  notes: z.string().optional(),
});

// Post validations
export const postSchema = z.object({
  kolId: z.string().min(1, "KOL is required"),
  campaignId: z.string().min(1, "Campaign is required"),
  type: z.enum(["POST", "THREAD", "RETWEET", "QUOTE", "SPACE"]),
  content: z.string().optional(),
  scheduledFor: z.string().optional(),
  tweetUrl: z.string().url().optional().or(z.literal("")),
  postedAt: z.string().optional(),
  // Metrics (for manual entry)
  impressions: z.number().min(0).optional(),
  likes: z.number().min(0).optional(),
  retweets: z.number().min(0).optional(),
  replies: z.number().min(0).optional(),
  quotes: z.number().min(0).optional(),
  bookmarks: z.number().min(0).optional(),
  clicks: z.number().min(0).optional(),
});

export const postApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  clientNotes: z.string().optional(),
});

// Payment validations
export const paymentSchema = z.object({
  kolId: z.string().min(1, "KOL is required"),
  campaignId: z.string().optional(),
  amount: z.number().min(1, "Amount must be positive"),
  currency: z.string().default("USD"),
  method: z.enum(["CRYPTO", "BANK_TRANSFER", "PAYPAL", "OTHER"]),
  walletAddress: z.string().optional(),
  network: z.string().optional(),
  notes: z.string().optional(),
});

// Telegram validations
export const telegramSendMessageSchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  content: z.string().min(1, "Message content is required").max(4096, "Message too long"),
});

export const telegramSendToKolSchema = z.object({
  kolId: z.string().min(1, "KOL ID is required"),
  content: z.string().min(1, "Message content is required").max(4096, "Message too long"),
});

export const telegramBroadcastSchema = z.object({
  content: z.string().min(1, "Message content is required").max(4096, "Message too long"),
  targetType: z.enum(["groups", "dms"]).default("groups"),
  filterType: z.enum(["all", "met_kpi", "not_met_kpi", "campaign"]),
  filterCampaignId: z.string().optional(),
});

export const telegramChatFilterSchema = z.object({
  status: z.enum(["ACTIVE", "LEFT", "KICKED", "all"]).optional(),
  hasKol: z.boolean().optional(),
  campaignId: z.string().optional(),
  kpiStatus: z.enum(["met", "not_met", "any"]).optional(),
  search: z.string().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type KOLInput = z.infer<typeof kolSchema>;
export type KOLTagInput = z.infer<typeof kolTagSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type CampaignKOLInput = z.infer<typeof campaignKolSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type PostApprovalInput = z.infer<typeof postApprovalSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type TelegramSendMessageInput = z.infer<typeof telegramSendMessageSchema>;
export type TelegramSendToKolInput = z.infer<typeof telegramSendToKolSchema>;
export type TelegramBroadcastInput = z.infer<typeof telegramBroadcastSchema>;
export type TelegramChatFilterInput = z.infer<typeof telegramChatFilterSchema>;
