import { db } from "@setu/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await db.$queryRaw<
      Array<{ database: string; user: string }>
    >`SELECT current_database() AS database, current_user AS user`;

    return NextResponse.json({
      ok: true,
      database: result[0]?.database,
      user: result[0]?.user,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Database connection failed",
      },
      { status: 500 },
    );
  }
}
