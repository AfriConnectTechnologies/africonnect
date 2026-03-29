import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { StreamChat } from "stream-chat";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

export async function GET() {
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

    // Get user details from Clerk
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Initialize Stream Chat server client
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Create or update user in Stream Chat
    const streamUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    
    await serverClient.upsertUser({
      id: streamUserId,
      name: user.firstName 
        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
        : user.emailAddresses[0]?.emailAddress || "User",
      image: user.imageUrl,
    });

    // Generate token for the user
    const token = serverClient.createToken(streamUserId);

    return NextResponse.json({
      token,
      userId: streamUserId,
      apiKey,
    });
  } catch (error) {
    console.error("Error generating Stream Chat token:", error);
    return NextResponse.json(
      { error: "Failed to generate chat token" },
      { status: 500 }
    );
  }
}
