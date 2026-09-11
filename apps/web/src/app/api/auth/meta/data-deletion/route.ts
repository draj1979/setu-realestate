import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  console.log("Meta data deletion request received");

  return Response.json({
    url: "https://app.gosetu.co/",
    confirmation_code: "SETU-DELETION-PENDING",
  });
}
