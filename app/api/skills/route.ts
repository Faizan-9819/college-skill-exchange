import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Skill from "@/model/Skill";

// CREATE skill
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    console.log("Received skill data:", body);

    // Validate required fields
    if (!body.name || !body.user) {
      return NextResponse.json(
        { message: "Skill name and user ID are required" },
        { status: 400 },
      );
    }

    const skill = await Skill.create({
      name: body.name,
      user: body.user,
    });

    console.log("Skill created successfully:", skill);

    return NextResponse.json(skill, { status: 201 });
  } catch (error: any) {
    console.error("Error creating skill:", error);
    return NextResponse.json(
      {
        message: "Failed to create skill",
        error: error.message || String(error),
      },
      { status: 500 },
    );
  }
}

// READ all skills
export async function GET() {
  try {
    await connectDB();

    const skills = await Skill.find().populate(
      "user",
      "name email department year",
    );

    return NextResponse.json(skills);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch skills", error },
      { status: 500 },
    );
  }
}
