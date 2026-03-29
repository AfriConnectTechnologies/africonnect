"use client";

import { useEffect, useState } from "react";
import { Channel as StreamChannel } from "stream-chat";
import {
  Chat,
  Channel,
  Window,
  MessageList,
  MessageInput,
  Thread,
  useChannelStateContext,
} from "stream-chat-react";
import { useChatContext } from "./ChatProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import "stream-chat-react/dist/css/v2/index.css";

interface ChatWindowProps {
  channelId: string;
  channelType?: string;
  showBackButton?: boolean;
  backUrl?: string;
  onBack?: () => void;
}

interface ChannelHeaderProps {
  onDelete?: () => void;
  isDeleting?: boolean;
}

function CustomChannelHeader({ onDelete, isDeleting }: ChannelHeaderProps) {
  const { channel, members } = useChannelStateContext();
  const channelData = channel?.data as Record<string, unknown> | undefined;
  
  const productName = channelData?.productName as string | undefined;
  const businessName = channelData?.businessName as string | undefined;

  // Get current user ID
  const currentUserId = channel?.getClient()?.userID;
  
  // Get all members excluding current user
  const membersList = Object.values(members || {});
  const otherMembers = membersList.filter((m) => m.user?.id !== currentUserId);
  
  // Get display name - show other member's name, fallback to any member
  const getDisplayTitle = () => {
    if (otherMembers.length === 0) {
      // Fallback: show first member's name (even if it's current user)
      if (membersList.length > 0) {
        return membersList[0].user?.name || membersList[0].user?.id || "Conversation";
      }
      return "Conversation";
    }
    if (otherMembers.length === 1) {
      return otherMembers[0].user?.name || otherMembers[0].user?.id || "Unknown";
    }
    // Multiple other members
    const names = otherMembers.map((m) => m.user?.name || "Unknown");
    return names.slice(0, 2).join(" & ") + (names.length > 2 ? ` +${names.length - 2}` : "");
  };
  
  // Get member for avatar - prefer other member, fallback to any member
  const displayMember = otherMembers[0] || membersList[0];
  const avatarUrl = displayMember?.user?.image;
  const displayMemberName = displayMember?.user?.name || displayMember?.user?.id || "?";
  const avatarInitial = displayMemberName.charAt(0).toUpperCase();
  
  return (
    <div className="p-4 border-b bg-card">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={getDisplayTitle()}
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-base font-semibold text-primary">
              {avatarInitial}
            </span>
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">
            {getDisplayTitle()}
          </h3>
          {productName && (
            <p className="text-sm text-muted-foreground">
              Re: {productName}
            </p>
          )}
          {businessName && !productName && (
            <p className="text-sm text-muted-foreground">
              {businessName}
            </p>
          )}
          {membersList.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {membersList.length} participants in this conversation
            </p>
          )}
        </div>
        {onDelete && (
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Conversation</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this conversation? This will permanently remove all messages and cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({
  channelId,
  channelType = "messaging",
  showBackButton = false,
  backUrl = "/messages",
  onBack,
}: ChatWindowProps) {
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { client, isConnected, isConnecting, error } = useChatContext();
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const deleteChannelReports = useMutation(api.chat.deleteChannelReports);

  // Handle channel deletion
  const handleDeleteChannel = async () => {
    if (!channelId) return;
    
    setIsDeleting(true);
    try {
      // 1. Clear channel state immediately to prevent "channel after disconnect" error
      setChannel(null);
      
      // 2. Delete from Stream Chat via server API
      const response = await fetch(
        `/api/chat/channel/delete?channelId=${encodeURIComponent(channelId)}&channelType=${encodeURIComponent(channelType)}`,
        { method: "DELETE" }
      );
      
      if (!response.ok) {
        throw new Error("Failed to delete channel from Stream");
      }
      
      // 3. Delete related reports from Convex
      try {
        await deleteChannelReports({ channelId });
      } catch {
        // Ignore errors if no reports exist
      }
      
      toast.success("Conversation deleted successfully");
      
      // 4. Navigate back to messages
      if (onBack) {
        onBack();
      } else {
        router.push("/messages");
      }
    } catch (err) {
      console.error("Failed to delete channel:", err);
      toast.error("Failed to delete conversation");
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!client || !isConnected || !channelId) {
      return;
    }

    let currentChannel: StreamChannel | null = null;
    let isMounted = true;

    const loadChannel = async () => {
      setIsLoading(true);
      setChannelError(null);

      try {
        const existingChannel = client.channel(channelType, channelId);
        await existingChannel.watch();
        
        // Ensure current user is a member of the channel via server API
        const currentUserId = client.userID;
        if (currentUserId) {
          const currentMembers = Object.keys(existingChannel.state.members || {});
          if (!currentMembers.includes(currentUserId)) {
            try {
              // Use server API to add member (requires server-side permissions)
              await fetch("/api/chat/channel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  channelId,
                  channelType,
                  members: [currentUserId],
                }),
              });
              // Re-watch to get updated member list
              await existingChannel.watch();
            } catch (memberErr) {
              console.warn("Could not add user to channel:", memberErr);
            }
          }
        }
        
        if (isMounted) {
          currentChannel = existingChannel;
          setChannel(existingChannel);
          
          // Mark channel as read when opened
          try {
            await existingChannel.markRead();
          } catch {
            // Ignore errors - channel might already be read
          }
        }
      } catch (err) {
        console.error("Failed to load channel:", err);
        if (isMounted) {
          setChannelError("Failed to load conversation");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadChannel();

    return () => {
      isMounted = false;
      // Only stop watching if client is still connected
      if (currentChannel && client.user) {
        currentChannel.stopWatching().catch(() => {
          // Silently ignore errors when client is already disconnected
        });
      }
    };
  }, [client, isConnected, channelId, channelType]);

  if (isConnecting || isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">{tChat("loadingConversations")}</p>
        </CardContent>
      </Card>
    );
  }

  if (error || channelError) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <p className="mt-4 text-muted-foreground">{error || channelError}</p>
          {showBackButton && (
            <Link href={backUrl}>
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tCommon("back")} {tChat("messages")}
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!client || !channel) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">{tChat("selectConversation")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col chat-container">
      {showBackButton && (
        <div className="p-2 border-b bg-card">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tCommon("back")}
            </Button>
          ) : (
            <Link href={backUrl}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tCommon("back")}
              </Button>
            </Link>
          )}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <Chat client={client} theme="str-chat__theme-light">
          <Channel channel={channel}>
            <Window>
              <CustomChannelHeader onDelete={handleDeleteChannel} isDeleting={isDeleting} />
              <MessageList />
              <MessageInput focus />
            </Window>
            <Thread />
          </Channel>
        </Chat>
      </div>
      <style jsx global>{`
        .chat-container .str-chat {
          height: 100%;
        }
        .chat-container .str-chat__container {
          height: 100%;
        }
        .chat-container .str-chat__main-panel {
          height: 100%;
        }
        .chat-container .str-chat__message-list {
          background: var(--background);
        }
        .chat-container .str-chat__message-input {
          background: var(--card);
          border-top: 1px solid var(--border);
        }
        .chat-container .str-chat__input-flat {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .chat-container .str-chat__input-flat:focus-within {
          border-color: var(--ring);
        }
        .chat-container .str-chat__message-simple {
          padding: 0.5rem 1rem;
        }
        .chat-container .str-chat__message-simple--me .str-chat__message-bubble {
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .chat-container .str-chat__message-simple:not(.str-chat__message-simple--me) .str-chat__message-bubble {
          background: var(--muted);
          color: var(--foreground);
        }
        .dark .chat-container .str-chat {
          --str-chat__primary-color: var(--primary);
          --str-chat__background-color: var(--background);
          --str-chat__secondary-background-color: var(--card);
          --str-chat__primary-surface-color: var(--card);
          --str-chat__secondary-surface-color: var(--muted);
          --str-chat__text-color: var(--foreground);
          --str-chat__text-low-emphasis-color: var(--muted-foreground);
          --str-chat__border-color: var(--border);
        }
      `}</style>
    </div>
  );
}
