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
  tier: z.enum(["NANO", "MICRO", "MID", "MACRO", "MEGA"]),
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
  totalBudget: z.number().min(0, "Budget must be positive"),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  kpis: z.object({
    impressions: z.number().optional(),
    engagement: z.number().optional(),
    clicks: z.number().optional(),
    followers: z.number().optional(),
  }).optional(),
});

export const campaignKolSchema = z.object({
  kolId: z.string().min(1, "KOL is required"),
  assignedBudget: z.number().min(0, "Budget must be positive"),
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
});

export const postApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
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
