"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatProvider, useChatContext, ChatWindow } from "@/components/chat";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Chat,
  ChannelList,
  ChannelPreviewUIComponentProps,
} from "stream-chat-react";
import { Channel as StreamChannel } from "stream-chat";
import { cn } from "@/lib/utils";

import "stream-chat-react/dist/css/v2/index.css";

// Custom styles to hide default Stream Chat elements we're overriding
const customStyles = `
  .str-chat__channel-list-messenger {
    background: transparent !important;
  }
  .str-chat__channel-preview-messenger--unread-count {
    display: none !important;
  }
  .str-chat__channel-list-messenger__main {
    padding: 0 !important;
  }
`;

function MessagesContent() {
  const { client, isConnected, isConnecting } = useChatContext();
  const [selectedChannel, setSelectedChannel] = useState<StreamChannel | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [listKey, setListKey] = useState(0); // Key to force refresh ChannelList
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("chat");

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle channel from URL - create with members if new conversation
  useEffect(() => {
    const channelId = searchParams.get("channel");
    if (!channelId || !client || !isConnected || !client.userID) {
      return;
    }

    const initChannel = async () => {
      try {
        // Check if this is a new conversation (has product or business param)
        const productId = searchParams.get("product");
        const productName = searchParams.get("productName");
        const businessId = searchParams.get("business");
        const businessName = searchParams.get("businessName");
        const membersParam = searchParams.get("members");
        const memberNamesParam = searchParams.get("memberNames");
        const sellerName = searchParams.get("sellerName");
        
        // Parse members and names from URL
        const members = membersParam ? membersParam.split(",") : undefined;
        const memberNames = memberNamesParam ? memberNamesParam.split(",") : undefined;
        
        // Build channel data with custom fields
        const channelData: Record<string, unknown> = {};
        if (productId) channelData.productId = productId;
        if (productName) channelData.productName = productName;
        if (businessId) channelData.businessId = businessId;
        if (businessName) channelData.businessName = businessName;
        if (sellerName) channelData.sellerName = sellerName;
        
        // If we have members, create/update channel via server API
        // This ensures proper member addition with server-side permissions
        if (members && members.length > 0) {
          try {
            await fetch("/api/chat/channel", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channelId,
                channelType: "messaging",
                members,
                memberNames, // Pass names so users can be synced to Stream Chat
                data: channelData,
              }),
            });
            // Force refresh the channel list
            setListKey((k) => k + 1);
          } catch (apiErr) {
            console.warn("Server channel creation failed, falling back to client:", apiErr);
          }
        }
        
        // Now watch the channel client-side
        const channel = client.channel("messaging", channelId, channelData);
        await channel.watch();
        
        // Mark channel as read when opened
        try {
          await channel.markRead();
        } catch {
          // Ignore errors - channel might already be read
        }
        
        setSelectedChannel(channel);
        
        // Clean up URL params after channel is created
        if (productId || businessId || membersParam) {
          router.replace(`/messages?channel=${channelId}`, { scroll: false });
        }
      } catch (err) {
        console.error("Failed to initialize channel:", err);
      }
    };

    initChannel();
  }, [searchParams, client, isConnected, router]);

  const handleChannelSelect = useCallback(async (channel: StreamChannel) => {
    setSelectedChannel(channel);
    
    // Mark channel as read when selected
    try {
      await channel.markRead();
    } catch {
      // Ignore errors - channel might already be read
    }
    
    // Update URL with channel ID for sharing/bookmarking
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("channel", channel.id || "");
    router.replace(`/messages?${newParams.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleBackToList = () => {
    setSelectedChannel(null);
    router.replace("/messages", { scroll: false });
  };

  // Custom channel preview component
  const CustomPreview = useCallback((props: ChannelPreviewUIComponentProps) => {
    const { channel, unread, lastMessage } = props;
    const channelData = channel.data as Record<string, unknown> | undefined;
    const productName = channelData?.productName as string | undefined;
    const businessName = channelData?.businessName as string | undefined;
    
    // Get members excluding the current user
    const currentUserId = client?.userID;
    const membersList = Object.values(channel.state.members || {});
    const otherMembers = membersList.filter((m) => m.user?.id !== currentUserId);
    
    // Get display name - show other member's name
    const getDisplayTitle = () => {
      if (otherMembers.length === 0) {
        // Fallback: show all member names
        const allNames = membersList.map((m) => m.user?.name || "Unknown");
        return allNames.length > 0 ? allNames.join(" & ") : "Conversation";
      }
      if (otherMembers.length === 1) {
        return otherMembers[0].user?.name || otherMembers[0].user?.id || "Unknown";
      }
      // Multiple other members
      const names = otherMembers.map((m) => m.user?.name || "Unknown");
      return names.slice(0, 2).join(" & ") + (names.length > 2 ? ` +${names.length - 2}` : "");
    };

    const getLastMessagePreview = () => {
      if (!lastMessage) return t("noMessages");
      if (lastMessage.text) {
        return lastMessage.text.length > 40
          ? `${lastMessage.text.substring(0, 40)}...`
          : lastMessage.text;
      }
      if (lastMessage.attachments?.length) {
        return "📎 Attachment";
      }
      return t("noMessages");
    };

    const getTimeAgo = () => {
      if (!lastMessage?.created_at) return "";
      const date = new Date(lastMessage.created_at);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "now";
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString();
    };
    
    // Get member for avatar - prefer other member, fallback to any member
    const displayMember = otherMembers[0] || membersList[0];
    const displayMemberName = displayMember?.user?.name || displayMember?.user?.id || "?";
    const avatarInitial = displayMemberName.charAt(0).toUpperCase();
    
    // Check if unread
    const hasUnread = typeof unread === "number" && unread > 0;

    return (
      <button
        onClick={() => handleChannelSelect(channel)}
        className={cn(
          "w-full p-3 text-left transition-colors hover:bg-accent/50 border-b",
          selectedChannel?.id === channel.id && "bg-accent",
          hasUnread && "bg-accent/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <span className="text-base font-semibold text-primary">
                {avatarInitial}
              </span>
            </div>
            {hasUnread && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "font-medium truncate text-sm",
                hasUnread && "font-bold"
              )}>
                {getDisplayTitle()}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {getTimeAgo()}
              </span>
            </div>
            {(productName || businessName) && (
              <p className="text-xs text-primary/70 truncate">
                {productName ? `Re: ${productName}` : businessName}
              </p>
            )}
            <p className={cn(
              "text-xs truncate mt-0.5",
              hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {getLastMessagePreview()}
            </p>
          </div>
        </div>
      </button>
    );
  }, [client?.userID, handleChannelSelect, selectedChannel?.id, t]);

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Connecting to chat...</p>
        </div>
      </div>
    );
  }

  if (!client || !isConnected) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Unable to connect to chat service
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Query channels where user is a member OR created by the user
  const filters = { 
    type: "messaging",
    members: { $in: [client.userID!] }
  };
  const sort = { last_message_at: -1 as const };
  const options = { 
    state: true, 
    watch: true, 
    presence: true,
    limit: 30, // Ensure we get enough channels
  };

  // Mobile view - show either list or chat
  if (isMobile) {
    if (selectedChannel) {
      return (
        <div className="h-[calc(100vh-12rem)]">
          <ChatWindow
            channelId={selectedChannel.id || ""}
            showBackButton
            onBack={handleBackToList}
          />
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-12rem)]">
        <Card className="h-full overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-card">
            <h2 className="font-semibold">{t("conversations")}</h2>
          </div>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <Chat client={client} theme="str-chat__theme-light">
              <ChannelList
                key={`mobile-${listKey}`}
                filters={filters}
                sort={sort}
                options={options}
                Preview={CustomPreview}
                showChannelSearch={false}
                EmptyStateIndicator={() => (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">
                      {t("noMessages")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("startConversation")}
                    </p>
                  </div>
                )}
              />
            </Chat>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Desktop view - two panel layout
  return (
    <div className="h-[calc(100vh-12rem)] flex gap-4">
      {/* Conversations List - Left Panel */}
      <div className="w-80 shrink-0">
        <Card className="h-full overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-card">
            <h2 className="font-semibold">{t("conversations")}</h2>
          </div>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <Chat client={client} theme="str-chat__theme-light">
              <ChannelList
                key={`desktop-${listKey}`}
                filters={filters}
                sort={sort}
                options={options}
                Preview={CustomPreview}
                showChannelSearch={false}
                EmptyStateIndicator={() => (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">
                      {t("noMessages")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("startConversation")}
                    </p>
                  </div>
                )}
              />
            </Chat>
          </CardContent>
        </Card>
      </div>

      {/* Chat Window - Right Panel */}
      <div className="flex-1">
        {selectedChannel ? (
          <Card className="h-full overflow-hidden">
            <ChatWindow channelId={selectedChannel.id || ""} />
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">{t("selectConversation")}</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                {t("selectConversationDescription")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const t = useTranslations("chat");

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div>
        <h1 className="text-2xl font-bold">{t("messages")}</h1>
        <p className="text-muted-foreground">{t("messagesDescription")}</p>
      </div>
      <ChatProvider>
        <MessagesContent />
      </ChatProvider>
    </div>
  );
}
