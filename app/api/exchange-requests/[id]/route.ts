import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ExchangeRequest from "@/model/ExchangeRequest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

// GET one request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;

    const exchangeRequest = await ExchangeRequest.findById(id)
      .populate("sender", "name email department year")
      .populate("receiver", "name email department year")
      .populate("skill", "name");

    if (!exchangeRequest) {
      return NextResponse.json(
        { message: "Exchange request not found" },
        { status: 404, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(exchangeRequest, { headers: noCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch request", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}

// UPDATE request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const exchangeRequest = await ExchangeRequest.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })
      .populate("sender", "name email department year")
      .populate("receiver", "name email department year")
      .populate("skill", "name");

    if (!exchangeRequest) {
      return NextResponse.json(
        { message: "Exchange request not found" },
        { status: 404, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(exchangeRequest, { headers: noCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to update request", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}

// DELETE request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;

    const exchangeRequest = await ExchangeRequest.findByIdAndDelete(id);

    if (!exchangeRequest) {
      return NextResponse.json(
        { message: "Exchange request not found" },
        { status: 404, headers: noCacheHeaders },
      );
    }

    return NextResponse.json(
      {
        message: "Exchange request deleted successfully",
      },
      { headers: noCacheHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to delete request", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}
