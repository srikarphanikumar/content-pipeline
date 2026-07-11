import { NextResponse } from "next/server";
import { generateBacklogTopics } from "@/app/topics/actions";

export async function POST() {
  try {
    const result = await generateBacklogTopics();

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
