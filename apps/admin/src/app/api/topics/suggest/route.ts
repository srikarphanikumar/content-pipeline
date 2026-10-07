import { NextResponse } from "next/server";
import { generateBacklogTopics } from "@/app/topics/pipeline";
import { getAdminUser } from "@/lib/auth/require-admin";

async function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }

  return Boolean(await getAdminUser());
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized", ok: false }, { status: 401 });
  }

  try {
    let count = 20;

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
