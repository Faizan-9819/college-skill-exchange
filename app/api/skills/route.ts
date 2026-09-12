import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Skill from "@/model/Skill";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

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
        { status: 400, headers: noCacheHeaders },
      );
    }

    const skill = await Skill.create({
      name: body.name,
      user: body.user,
    });

    const populatedSkill = await Skill.findById(skill._id).populate(
      "user",
      "name email department year",
    );

    console.log("Skill created successfully:", skill);

    return NextResponse.json(populatedSkill || skill, {
      status: 201,
      headers: noCacheHeaders,
    });
  } catch (error: any) {
    console.error("Error creating skill:", error);
    return NextResponse.json(
      {
        message: "Failed to create skill",
        error: error.message || String(error),
      },
      { status: 500, headers: noCacheHeaders },
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

    return NextResponse.json(skills, { headers: noCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch skills", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}
