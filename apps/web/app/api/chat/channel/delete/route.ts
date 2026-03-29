import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { StreamChat } from "stream-chat";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!apiKey || !apiSecret) {
      console.error("Stream Chat API key or secret not configured");
      return NextResponse.json(
        { error: "Chat service not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const channelType = searchParams.get("channelType") || "messaging";

    if (!channelId) {
      return NextResponse.json(
        { error: "Channel ID is required" },
        { status: 400 }
      );
    }

    // Initialize Stream Chat server client
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Get the channel
    const channel = serverClient.channel(channelType, channelId);

    // Delete the channel - this permanently removes it from Stream Chat
    // The 'hard' delete removes all messages and the channel itself
    await channel.delete();

    return NextResponse.json({
      success: true,
      message: "Channel deleted successfully",
      channelId,
    });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: "Failed to delete channel" },
      { status: 500 }
    );
  }
}
