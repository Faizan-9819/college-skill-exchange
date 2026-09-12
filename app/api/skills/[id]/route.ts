import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Skill from "@/model/Skill";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

// GET one skill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;

    const skill = await Skill.findById(id).populate(
      "user",
      "name email department year",
    );

    if (!skill) {
      return NextResponse.json(
        { message: "Skill not found" },
        { status: 404, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(skill, { headers: noCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch skill", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}

// UPDATE skill
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const skill = await Skill.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).populate("user", "name email department year");

    if (!skill) {
      return NextResponse.json(
        { message: "Skill not found" },
        { status: 404, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(skill, { headers: noCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to update skill", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}

// DELETE skill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;

    const skill = await Skill.findByIdAndDelete(id);

    if (!skill) {
      return NextResponse.json(
        { message: "Skill not found" },
        { status: 404, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      {
        message: "Skill deleted successfully",
      },
      { headers: noCacheHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to delete skill", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}
