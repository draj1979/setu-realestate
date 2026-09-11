import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  console.log("Meta deauthorization request received");

  return Response.json({
    success: true,
  });
}
