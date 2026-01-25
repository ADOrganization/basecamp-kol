"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, Search, Circle, Send, AlertCircle } from "lucide-react";

interface Message {
  id: string;
  content: string;
  direction: string;
  isRead: boolean;
  timestamp: Date;
}

interface KOL {
  id: string;
  name: string;
  telegramUsername: string | null;
  messages: Message[];
}

interface TelegramConversationsProps {
  kols: KOL[];
  unreadCount: number;
}

export function TelegramConversations({ kols: initialKols, unreadCount }: TelegramConversationsProps) {
  const [kols, setKols] = useState<KOL[]>(initialKols);
  const [selectedKol, setSelectedKol] = useState<KOL | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredKols = kols.filter(kol =>
    kol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kol.telegramUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (!selectedKol || !newMessage.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kolId: selectedKol.id,
          content: newMessage.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Add the new message to the UI
        const newMsg: Message = {
          id: data.message.id,
          content: newMessage.trim(),
          direction: "OUTBOUND",
          isRead: true,
          timestamp: new Date(),
        };

        // Update the selected KOL's messages
        const updatedKol = {
          ...selectedKol,
          messages: [newMsg, ...selectedKol.messages],
        };
        setSelectedKol(updatedKol);

        // Update the kols list
        setKols(kols.map(k => k.id === selectedKol.id ? updatedKol : k));

        setNewMessage("");
      } else {
        setError(data.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conversations</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="default">{unreadCount} unread</Badge>
            )}
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredKols.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                {kols.length === 0 ? "No KOLs with Telegram connected yet" : "No matching conversations"}
              </p>
            </div>
          ) : (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {filteredKols.map((kol) => {
                const lastMessage = kol.messages[0];
                const hasUnread = lastMessage && !lastMessage.isRead && lastMessage.direction === "INBOUND";

                return (
                  <button
                    key={kol.id}
                    onClick={() => setSelectedKol(kol)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-muted transition-colors text-left ${
                      selectedKol?.id === kol.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-indigo-100 text-indigo-600">
                          {kol.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {hasUnread && (
                        <Circle className="absolute -top-0.5 -right-0.5 h-3 w-3 fill-indigo-500 text-indigo-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium truncate ${hasUnread ? "text-foreground" : ""}`}>
                          {kol.name}
                        </p>
                        {lastMessage && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(lastMessage.timestamp).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        @{kol.telegramUsername}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Area */}
      <Card className="lg:col-span-2">
        {selectedKol ? (
          <div className="flex flex-col h-[600px]">
            {/* Header */}
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-indigo-100 text-indigo-600">
                    {selectedKol.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{selectedKol.name}</h3>
                  <p className="text-sm text-muted-foreground">@{selectedKol.telegramUsername}</p>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedKol.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    The KOL needs to message your bot first before you can send them messages.
                    Share your bot link: <span className="font-mono text-xs">t.me/YourBotUsername</span>
                  </p>
                </div>
              ) : (
                selectedKol.messages.slice().reverse().map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.direction === "OUTBOUND"
                          ? "bg-indigo-600 text-white"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.direction === "OUTBOUND" ? "text-indigo-200" : "text-muted-foreground"
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>

            {/* Input */}
            <div className="border-t p-4 space-y-2">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <CardContent className="flex flex-col items-center justify-center h-[600px]">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-muted-foreground mt-1">
                  Choose a KOL from the list to view messages
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
