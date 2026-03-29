"use client";

import { useParams } from "next/navigation";
import { ChatProvider } from "@/components/chat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useTranslations } from "next-intl";

export default function ChatPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const t = useTranslations("chat");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("conversation")}</h1>
      </div>
      <ChatProvider>
        <div className="h-[calc(100vh-14rem)]">
          <ChatWindow
            channelId={channelId}
            showBackButton
            backUrl="/messages"
          />
        </div>
      </ChatProvider>
    </div>
  );
}
