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
  twitterHandle: z.string().min(1, "X handle is required").regex(/^@?[\w]+$/, "Invalid X handle"),
  telegramUsername: z.string().optional(),
  telegramGroupId: z.string().min(1, "Telegram group is required"),
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

// Client access user schema
export const clientUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
});

// Campaign validations
export const campaignSchema = z.object({
  name: z.string().min(2, "Campaign name must be at least 2 characters"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  projectTwitterHandle: z.string().min(1, "Project X handle is required"),
  clientTelegramChatId: z.string().min(1, "Client Telegram group is required"),
  keywords: z.array(z.string()).optional(),
  totalBudget: z.number().min(0, "Budget must be positive").default(0),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  clientUsers: z.array(clientUserSchema).optional(),
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

// ============================================
// KOL PORTAL VALIDATIONS
// ============================================

// KOL Portal login
export const kolLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// KOL Portal registration (from invitation)
export const kolRegisterSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// KOL Profile update
export const kolProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  categories: z.array(z.string()).max(10, "Maximum 10 categories").optional(),
  twitterHandle: z.string().regex(/^@?[\w]+$/, "Invalid X handle").optional(),
  telegramUsername: z.string().optional(),
});

// KOL Rates update
export const kolRatesSchema = z.object({
  ratePerPost: z.number().min(0, "Rate must be positive").optional(),
  ratePerThread: z.number().min(0, "Rate must be positive").optional(),
  ratePerRetweet: z.number().min(0, "Rate must be positive").optional(),
  ratePerSpace: z.number().min(0, "Rate must be positive").optional(),
});

// Wallet address validation based on network
const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const kolWalletSchema = z.object({
  network: z.enum(["ETHEREUM", "POLYGON", "ARBITRUM", "OPTIMISM", "BASE", "BSC", "SOLANA"]),
  address: z.string().min(1, "Wallet address is required"),
  label: z.string().max(50, "Label must be 50 characters or less").optional(),
  isPrimary: z.boolean().optional(),
}).refine((data) => {
  if (data.network === "SOLANA") {
    return solanaAddressRegex.test(data.address);
  }
  return evmAddressRegex.test(data.address);
}, {
  message: "Invalid wallet address for the selected network",
  path: ["address"],
});

// Campaign join request
export const joinRequestSchema = z.object({
  message: z.string().max(500, "Message must be 500 characters or less").optional(),
});

// Join request response (for agency)
export const joinRequestResponseSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED"]),
  responseNote: z.string().max(500).optional(),
});

// Campaign visibility update
export const campaignVisibilitySchema = z.object({
  visibility: z.enum(["PRIVATE", "OPEN"]),
  applicationDeadline: z.string().datetime().optional().nullable(),
  maxKolCount: z.number().min(1).optional().nullable(),
});

// KOL invitation
export const kolInvitationSchema = z.object({
  kolId: z.string().min(1, "KOL ID is required"),
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

// KOL Portal type exports
export type KOLLoginInput = z.infer<typeof kolLoginSchema>;
export type KOLRegisterInput = z.infer<typeof kolRegisterSchema>;
export type KOLProfileInput = z.infer<typeof kolProfileSchema>;
export type KOLRatesInput = z.infer<typeof kolRatesSchema>;
export type KOLWalletInput = z.infer<typeof kolWalletSchema>;
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type JoinRequestResponseInput = z.infer<typeof joinRequestResponseSchema>;
export type CampaignVisibilityInput = z.infer<typeof campaignVisibilitySchema>;
export type KOLInvitationInput = z.infer<typeof kolInvitationSchema>;
