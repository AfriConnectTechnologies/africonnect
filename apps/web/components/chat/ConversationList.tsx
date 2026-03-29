"use client";

import { useChatContext } from "./ChatProvider";
import {
  Chat,
  ChannelList,
  ChannelPreviewUIComponentProps,
} from "stream-chat-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

import "stream-chat-react/dist/css/v2/index.css";


function CustomChannelPreview(props: ChannelPreviewUIComponentProps) {
  const { channel, setActiveChannel, unread, lastMessage, displayTitle } = props;
  const channelData = channel.data as Record<string, unknown> | undefined;
  const productName = channelData?.productName as string | undefined;

  const handleClick = () => {
    setActiveChannel?.(channel);
  };

  // Format last message preview
  const getLastMessagePreview = () => {
    if (!lastMessage) return "No messages yet";
    if (lastMessage.text) {
      return lastMessage.text.length > 50
        ? `${lastMessage.text.substring(0, 50)}...`
        : lastMessage.text;
    }
    if (lastMessage.attachments?.length) {
      return "Sent an attachment";
    }
    return "No messages yet";
  };

  // Format time
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

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full p-4 text-left transition-colors hover:bg-accent/50 border-b",
        unread && unread > 0 && "bg-accent/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "font-medium truncate",
              unread && unread > 0 && "font-semibold"
            )}>
              {displayTitle || "Conversation"}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {getTimeAgo()}
            </span>
          </div>
          {productName && (
            <p className="text-xs text-muted-foreground truncate">
              Re: {productName}
            </p>
          )}
          <p className={cn(
            "text-sm truncate mt-1",
            unread && unread > 0 ? "text-foreground" : "text-muted-foreground"
          )}>
            {getLastMessagePreview()}
          </p>
        </div>
        {unread && unread > 0 && (
          <Badge variant="default" className="shrink-0">
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </div>
    </button>
  );
}

export function ConversationList() {
  const { client, isConnected, isConnecting, error } = useChatContext();
  const t = useTranslations("chat");

  if (isConnecting) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading conversations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <p className="mt-4 text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!client || !isConnected) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">{t("noMessages")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filters = { members: { $in: [client.userID!] } };
  const sort = { last_message_at: -1 as const };
  const options = { state: true, watch: true, presence: true };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t("conversations")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full overflow-y-auto conversation-list">
          <Chat client={client} theme="str-chat__theme-light">
            <ChannelList
              filters={filters}
              sort={sort}
              options={options}
              Preview={(props) => (
                <CustomChannelPreview
                  {...props}
                />
              )}
              EmptyStateIndicator={() => (
                <div className="p-8 text-center">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">{t("noMessages")}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("startConversation")}
                  </p>
                </div>
              )}
              showChannelSearch={false}
            />
          </Chat>
        </div>
      </CardContent>
      <style jsx global>{`
        .conversation-list .str-chat-channel-list {
          background: transparent;
        }
        .conversation-list .str-chat__channel-list-messenger {
          background: transparent;
        }
        .conversation-list .str-chat__channel-list-messenger__main {
          padding: 0;
        }
        .conversation-list .str-chat__loading-channels {
          background: transparent;
        }
        .dark .conversation-list .str-chat {
          --str-chat__background-color: transparent;
        }
      `}</style>
    </Card>
  );
}
