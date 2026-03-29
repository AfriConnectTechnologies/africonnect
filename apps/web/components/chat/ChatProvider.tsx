"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { StreamChat, Channel as StreamChannel } from "stream-chat";
import { useUser } from "@clerk/nextjs";

interface ChatContextType {
  client: StreamChat | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  unreadCount: number;
  createOrJoinChannel: (
    channelId: string,
    channelType: string,
    members: string[],
    extraData?: Record<string, unknown>
  ) => Promise<StreamChannel | null>;
  disconnect: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType>({
  client: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  unreadCount: 0,
  createOrJoinChannel: async () => null,
  disconnect: async () => {},
});

export function useChatContext() {
  return useContext(ChatContext);
}

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { user, isSignedIn } = useUser();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize Stream Chat client
  useEffect(() => {
    if (!isSignedIn || !user) {
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    if (!apiKey) {
      setError("Chat service not configured");
      return;
    }

    let chatClient: StreamChat | null = null;
    let mounted = true;

    const initChat = async () => {
      setIsConnecting(true);
      setError(null);

      try {
        // Fetch token from API
        const response = await fetch("/api/chat/token");
        if (!response.ok) {
          throw new Error("Failed to get chat token");
        }

        const { token, userId } = await response.json();

        // Initialize client
        chatClient = StreamChat.getInstance(apiKey);

        // Connect user
        await chatClient.connectUser(
          {
            id: userId,
            name: user.fullName || user.primaryEmailAddress?.emailAddress || "User",
            image: user.imageUrl,
          },
          token
        );

        if (mounted) {
          setClient(chatClient);
          setIsConnected(true);

          // Get initial unread count
          const userState = chatClient.user as Record<string, unknown> | undefined;
          const totalUnread = userState?.total_unread_count;
          setUnreadCount(typeof totalUnread === "number" ? totalUnread : 0);
        }
      } catch (err) {
        console.error("Failed to initialize chat:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to connect to chat");
        }
      } finally {
        if (mounted) {
          setIsConnecting(false);
        }
      }
    };

    initChat();

    return () => {
      mounted = false;
      if (chatClient) {
        chatClient.disconnectUser().catch(console.error);
      }
    };
  }, [isSignedIn, user]);

  // Listen for unread count changes
  useEffect(() => {
    if (!client) return;

    const handleNotification = () => {
      const userState = client.user as Record<string, unknown> | undefined;
      const totalUnread = userState?.total_unread_count;
      setUnreadCount(typeof totalUnread === "number" ? totalUnread : 0);
    };

    // Listen to all events that can change unread count
    client.on("notification.message_new", handleNotification);
    client.on("notification.mark_read", handleNotification);
    client.on("message.read", handleNotification);
    client.on("message.new", handleNotification);

    return () => {
      client.off("notification.message_new", handleNotification);
      client.off("notification.mark_read", handleNotification);
      client.off("message.read", handleNotification);
      client.off("message.new", handleNotification);
    };
  }, [client]);

  const createOrJoinChannel = useCallback(
    async (
      channelId: string,
      channelType: string,
      members: string[],
      extraData?: Record<string, unknown>
    ): Promise<StreamChannel | null> => {
      if (!client || !isConnected) {
        console.error("Chat client not connected");
        return null;
      }

      try {
        const channel = client.channel(channelType, channelId, {
          members,
          ...extraData,
        });

        await channel.watch();
        return channel;
      } catch (err) {
        console.error("Failed to create/join channel:", err);
        return null;
      }
    },
    [client, isConnected]
  );

  const disconnect = useCallback(async () => {
    if (client) {
      await client.disconnectUser();
      setClient(null);
      setIsConnected(false);
    }
  }, [client]);

  return (
    <ChatContext.Provider
      value={{
        client,
        isConnected,
        isConnecting,
        error,
        unreadCount,
        createOrJoinChannel,
        disconnect,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
