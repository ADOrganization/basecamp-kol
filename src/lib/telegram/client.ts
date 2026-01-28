import type {
  TelegramApiResponse,
  TelegramBotInfo,
  TelegramChat,
  TelegramChatMember,
  TelegramMessage,
  TelegramUpdate,
  TelegramWebhookInfo,
  SendMessageOptions,
} from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramClient {
  private token: string;
  private baseUrl: string;

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `${TELEGRAM_API_BASE}/bot${token}`;
  }

  private async request<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<TelegramApiResponse<T>> {
    const url = `${this.baseUrl}/${method}`;

    try {
      console.log(`[TelegramClient] Calling ${method}`, params ? JSON.stringify(params).slice(0, 200) : "");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: params ? JSON.stringify(params) : undefined,
      });

      const data = (await response.json()) as TelegramApiResponse<T>;

      if (!data.ok) {
        console.error(`[TelegramClient] API error for ${method}: ${data.description || "Unknown error"}`, {
          error_code: data.error_code,
          params: params ? JSON.stringify(params).slice(0, 200) : undefined,
        });
      } else {
        console.log(`[TelegramClient] ${method} succeeded`);
      }

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`[TelegramClient] Exception in ${method}:`, errorMessage, {
        params: params ? JSON.stringify(params).slice(0, 200) : undefined,
      });
      return {
        ok: false,
        description: errorMessage,
      };
    }
  }

  /**
   * Verify the bot token and get bot info
   */
  async getMe(): Promise<TelegramApiResponse<TelegramBotInfo>> {
    return this.request<TelegramBotInfo>("getMe");
  }

  /**
   * Set webhook URL for receiving updates
   */
  async setWebhook(
    url: string,
    options?: {
      secret_token?: string;
      max_connections?: number;
      allowed_updates?: string[];
      drop_pending_updates?: boolean;
    }
  ): Promise<TelegramApiResponse<boolean>> {
    return this.request<boolean>("setWebhook", {
      url,
      ...options,
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(
    dropPendingUpdates = false
  ): Promise<TelegramApiResponse<boolean>> {
    return this.request<boolean>("deleteWebhook", {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  /**
   * Get current webhook info
   */
  async getWebhookInfo(): Promise<TelegramApiResponse<TelegramWebhookInfo>> {
    return this.request<TelegramWebhookInfo>("getWebhookInfo");
  }

  /**
   * Send a message to a chat
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    return this.request<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  /**
   * Get information about a chat
   */
  async getChat(chatId: string | number): Promise<TelegramApiResponse<TelegramChat>> {
    return this.request<TelegramChat>("getChat", {
      chat_id: chatId,
    });
  }

  /**
   * Get chat member count
   */
  async getChatMemberCount(chatId: string | number): Promise<TelegramApiResponse<number>> {
    return this.request<number>("getChatMemberCount", {
      chat_id: chatId,
    });
  }

  /**
   * Get chat administrators
   */
  async getChatAdministrators(
    chatId: string | number
  ): Promise<TelegramApiResponse<TelegramChatMember[]>> {
    return this.request<TelegramChatMember[]>("getChatAdministrators", {
      chat_id: chatId,
    });
  }

  /**
   * Get a specific chat member
   */
  async getChatMember(
    chatId: string | number,
    userId: number
  ): Promise<TelegramApiResponse<TelegramChatMember>> {
    return this.request<TelegramChatMember>("getChatMember", {
      chat_id: chatId,
      user_id: userId,
    });
  }

  /**
   * Get updates (for polling mode - useful for manual sync)
   */
  async getUpdates(options?: {
    offset?: number;
    limit?: number;
    timeout?: number;
    allowed_updates?: string[];
  }): Promise<TelegramApiResponse<TelegramUpdate[]>> {
    return this.request<TelegramUpdate[]>("getUpdates", options);
  }

  /**
   * Leave a chat
   */
  async leaveChat(chatId: string | number): Promise<TelegramApiResponse<boolean>> {
    return this.request<boolean>("leaveChat", {
      chat_id: chatId,
    });
  }
}

/**
 * Create a TelegramClient instance from an organization's bot token
 */
export function createTelegramClient(token: string): TelegramClient {
  return new TelegramClient(token);
}

/**
 * Verify a bot token is valid
 */
export async function verifyBotToken(
  token: string
): Promise<{ valid: boolean; username?: string; error?: string }> {
  const client = new TelegramClient(token);
  const response = await client.getMe();

  if (response.ok && response.result) {
    return {
      valid: true,
      username: response.result.username,
    };
  }

  return {
    valid: false,
    error: response.description || "Invalid bot token",
  };
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

/**
 * Convert Telegram chat type to our enum value
 */
export function mapTelegramChatType(
  type: "private" | "group" | "supergroup" | "channel"
): "PRIVATE" | "GROUP" | "SUPERGROUP" | "CHANNEL" {
  return type.toUpperCase() as "PRIVATE" | "GROUP" | "SUPERGROUP" | "CHANNEL";
}
