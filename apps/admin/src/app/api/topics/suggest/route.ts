import { NextResponse } from "next/server";
import { generateBacklogTopics } from "@/app/topics/actions";

export async function POST(request: Request) {
  try {
    let count = 100;

    try {
      const body = (await request.json()) as { count?: unknown };

      if (typeof body.count === "number") {
        count = body.count;
      }
    } catch {
      // Empty request body is fine. The default batch size is used.
    }

    const result = await generateBacklogTopics(count);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Topic suggestion API failed.", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown topic suggestion error.",
        ok: false,
      },
      {
        status: 500,
      },
    );
  }
}
