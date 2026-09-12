import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { message: "userId is required" },
        { status: 400 },
      );
    }

    // Learning preferences feature has been removed
    // Return empty matches array
    return NextResponse.json({
      matches: [],
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to find matches", error },
      { status: 500 },
    );
  }
}
