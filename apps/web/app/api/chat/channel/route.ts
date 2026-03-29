import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { StreamChat } from "stream-chat";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

export async function POST(request: Request) {
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

    const body = await request.json();
    const { channelId, channelType = "messaging", members, data, memberNames } = body;

    if (!channelId) {
      return NextResponse.json(
        { error: "Channel ID is required" },
        { status: 400 }
      );
    }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "Members array is required" },
        { status: 400 }
      );
    }

    // Initialize Stream Chat server client
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Get current user's stream ID
    const currentUserStreamId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Ensure current user is in members list
    const allMembers = [...new Set([currentUserStreamId, ...members])];

    // IMPORTANT: Upsert all member users to Stream Chat before creating channel
    // This ensures users exist before being added to the channel
    const usersToUpsert = allMembers.map((memberId, index) => ({
      id: memberId,
      name: memberNames?.[index] || memberId, // Use provided name or fallback to ID
    }));

    try {
      await serverClient.upsertUsers(usersToUpsert);
    } catch (err) {
      console.warn("Could not upsert some users:", err);
      // Continue anyway - existing users will work
    }

    // Create or get the channel with server-side permissions
    const channel = serverClient.channel(channelType, channelId, {
      members: allMembers,
      created_by_id: currentUserStreamId,
      ...data,
    });

    // Create the channel (this upserts - creates if doesn't exist, updates if does)
    await channel.create();

    // If channel already exists, ensure all members are added
    try {
      await channel.addMembers(allMembers);
    } catch (err) {
      console.warn("Could not add some members:", err);
    }

    return NextResponse.json({
      success: true,
      channelId: channel.id,
      members: allMembers,
    });
  } catch (error) {
    console.error("Error creating/updating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
