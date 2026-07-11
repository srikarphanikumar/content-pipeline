import { NextResponse } from "next/server";
import { db } from "@content-pipeline/db";
import { generateNextBacklogTopics } from "../../../topics/actions";

export const dynamic = "force-dynamic";

const topicTarget = 20;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (process.env.NODE_ENV === "production") {
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET is required in production." },
        { status: 500 },
      );
    }

    if (authorization !== `Bearer ${cronSecret}`) {
      return unauthorized();
    }
  }

  const [activeTopicCount, queuePostCount, draftReadyCount] = await Promise.all([
    db.topic.count({
      where: {
        status: {
          not: "done",
        },
      },
    }),
    db.post.count({
      where: {
        status: {
          in: ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"],
        },
      },
    }),
    db.post.count({
      where: {
        status: {
          in: ["DRAFT_READY", "READY_TO_PUBLISH"],
        },
      },
    }),
  ]);
  let generatedTopics = false;

  if (activeTopicCount < topicTarget) {
    await generateNextBacklogTopics();
    generatedTopics = true;
  }

  const activeTopicCountAfter = generatedTopics
    ? await db.topic.count({
        where: {
          status: {
            not: "done",
          },
        },
      })
    : activeTopicCount;

  return NextResponse.json({
    ok: true,
    generatedTopics,
    topicTarget,
    activeTopicCountBefore: activeTopicCount,
    activeTopicCountAfter,
    queuePostCount,
    draftReadyCount,
  });
}
