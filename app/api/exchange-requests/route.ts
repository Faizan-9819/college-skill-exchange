import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ExchangeRequest from "@/model/ExchangeRequest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

// CREATE request
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    const exchangeRequest = await ExchangeRequest.create(body);

    const populated = await ExchangeRequest.findById(exchangeRequest._id)
      .populate("sender", "name email department year")
      .populate("receiver", "name email department year")
      .populate("skill", "name");

    return NextResponse.json(populated || exchangeRequest, {
      status: 201,
      headers: noCacheHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to create exchange request", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}

// READ all requests
export async function GET() {
  try {
    await connectDB();

    const requests = await ExchangeRequest.find()
      .populate("sender", "name email department year")
      .populate("receiver", "name email department year")
      .populate("skill", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json(requests, { headers: noCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch requests", error },
      { status: 500, headers: noCacheHeaders },
    );
  }
}
