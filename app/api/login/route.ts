import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/model/User";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const email = body.email ? String(body.email).trim() : "";
    const password = body.password ? String(body.password).trim() : "";

    if (!email || !password) {
      return NextResponse.json(
        { message: "Please enter both email and password." },
        { status: 400 }
      );
    }

    // Match by email or username (case-insensitive)
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${email}$`, "i") } },
        { name: { $regex: new RegExp(`^${email}$`, "i") } },
      ],
    });

    if (!user) {
      return NextResponse.json(
        { message: "Account not found. Please register first." },
        { status: 404 }
      );
    }

    // Match password
    if (user.password && user.password !== password) {
      return NextResponse.json(
        { message: "Incorrect password. Please check and try again." },
        { status: 401 }
      );
    }

    // If user existed without password, update with this password
    if (!user.password && password) {
      user.password = password;
      await user.save();
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to login";
    return NextResponse.json(
      { message: "Login failed", error: msg },
      { status: 500 }
    );
  }
}
