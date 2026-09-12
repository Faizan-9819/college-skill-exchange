import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ExchangeRequest from "@/model/ExchangeRequest";

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

    return NextResponse.json(populated || exchangeRequest, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to create exchange request", error },
      { status: 500 },
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

    return NextResponse.json(requests);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch requests", error },
      { status: 500 },
    );
  }
}
