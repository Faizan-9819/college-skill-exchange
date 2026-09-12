import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/model/User";

// CREATE + READ
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const name = body.name ? String(body.name).trim() : "";
    const email = body.email ? String(body.email).trim().toLowerCase() : "";
    const password = body.password ? String(body.password).trim() : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Please provide full name, email, and password." },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: "An account with this email already exists. Please log in." },
        { status: 400 }
      );
    }

    const user = await User.create({
      name,
      email,
      password,
      year: Number(body.year) || 1,
      department: body.department || "",
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err?.code === 11000) {
      return NextResponse.json(
        { message: "An account with this email already exists. Please log in." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to create user", error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await connectDB();

    const users = await User.find();

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch users", error },
      { status: 500 },
    );
  }
}
