import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Skill from "@/model/Skill";

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
      "name email year",
    );

    if (!skill) {
      return NextResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(skill);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch skill", error },
      { status: 500 },
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
    });

    if (!skill) {
      return NextResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(skill);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to update skill", error },
      { status: 500 },
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
      return NextResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Skill deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to delete skill", error },
      { status: 500 },
    );
  }
}
