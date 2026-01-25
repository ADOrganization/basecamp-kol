"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Send,
  Users,
  RefreshCw,
  ExternalLink,
  Hash,
} from "lucide-react";

interface TelegramChat {
  id: string;
  telegramChatId: string;
  title: string | null;
  type: string;
  username: string | null;
  status: string;
  memberCount: number;
  kolLinks: Array<{
    id: string;
    kol: {
      id: string;
      name: string;
      twitterHandle: string;
      telegramUsername: string | null;
      avatarUrl: string | null;
    };
    campaignProgress: Array<{
      campaignId: string;
      campaignName: string;
      total: number;
      completed: number;
      percentage: number;
    }>;
  }>;
}

interface Message {
  id: string;
  content: string;
  direction: string;
  senderUsername: string | null;
  senderName: string | null;
  timestamp: string;
  replyToMessageId: string | null;
}

interface TelegramGroupChatProps {
  chat: TelegramChat;
  onClose: () => void;
  onMessageSent: () => void;
}

export function TelegramGroupChat({
  chat,
  onClose,
  onMessageSent,
}: TelegramGroupChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, [chat.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/telegram/chats/${chat.id}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages.reverse());
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || chat.status !== "ACTIVE") return;

    setSending(true);
    try {
      const response = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chat.id,
          content: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            id: data.message.id,
            content: data.message.content,
            direction: "OUTBOUND",
            senderUsername: null,
            senderName: "Bot",
            timestamp: data.message.timestamp,
            replyToMessageId: null,
          },
        ]);
        setNewMessage("");
        onMessageSent();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-indigo-100 text-indigo-600">
                {chat.type === "SUPERGROUP" ? (
                  <Hash className="h-5 w-5" />
                ) : (
                  <Users className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                {chat.title || "Unnamed Group"}
                <Badge
                  variant="outline"
                  className={
                    chat.status === "ACTIVE"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }
                >
                  {chat.status}
                </Badge>
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {chat.username && `@${chat.username} · `}
                {chat.memberCount} members
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMessages}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages Panel */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages yet</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.direction === "OUTBOUND"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.direction === "OUTBOUND"
                          ? "bg-indigo-600 text-white"
                          : "bg-muted"
                      }`}
                    >
                      {message.direction === "INBOUND" && message.senderName && (
                        <p className="text-xs font-medium mb-1 text-indigo-600">
                          {message.senderName}
                          {message.senderUsername && ` @${message.senderUsername}`}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.direction === "OUTBOUND"
                            ? "text-indigo-200"
                            : "text-muted-foreground"
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t p-4">
              {chat.status !== "ACTIVE" ? (
                <p className="text-center text-muted-foreground text-sm">
                  Bot is not active in this group
                </p>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={sending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* KOL Sidebar */}
          {chat.kolLinks.length > 0 && (
            <div className="w-72 border-l overflow-y-auto bg-muted/30">
              <div className="p-4 border-b">
                <h3 className="font-medium text-sm">Linked KOLs</h3>
              </div>
              <div className="p-2 space-y-2">
                {chat.kolLinks.map((link) => (
                  <div key={link.id} className="p-3 bg-background rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-10 w-10">
                        {link.kol.avatarUrl && (
                          <AvatarImage src={link.kol.avatarUrl} />
                        )}
                        <AvatarFallback className="bg-violet-100 text-violet-600">
                          {link.kol.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {link.kol.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{link.kol.twitterHandle}
                        </p>
                      </div>
                      <a
                        href={`/agency/kols/${link.kol.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    {/* Campaign Progress */}
                    {link.campaignProgress.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {link.campaignProgress.map((progress) => (
                          <div key={progress.campaignId}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground truncate">
                                {progress.campaignName}
                              </span>
                              <span
                                className={
                                  progress.percentage >= 100
                                    ? "text-green-600 font-medium"
                                    : "text-muted-foreground"
                                }
                              >
                                {progress.completed}/{progress.total}
                              </span>
                            </div>
                            <Progress
                              value={progress.percentage}
                              className="h-1.5"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
