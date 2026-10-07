import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@content-pipeline/db";

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function weightValue(formData: FormData) {
  const weight = Number(stringValue(formData, "weight"));
  return Number.isFinite(weight) ? Math.min(Math.max(Math.round(weight), 1), 3) : 1;
}

async function nameTaken(name: string, exceptId?: string) {
  const existing = await db.focusArea.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

function revalidateTopics() {
  revalidatePath("/");
  revalidatePath("/topics");
}

export async function createFocusArea(formData: FormData) {
  const name = stringValue(formData, "name").slice(0, 60);

  if (!name) {
    redirect("/topics?area_error=name-required");
  }

  if (await nameTaken(name)) {
    redirect("/topics?area_error=duplicate");
  }

  await db.focusArea.create({
    data: {
      name,
      angle: stringValue(formData, "angle").slice(0, 400) || null,
      weight: weightValue(formData),
    },
  });

  revalidateTopics();
}

export async function updateFocusArea(focusAreaId: string, formData: FormData) {
  const name = stringValue(formData, "name").slice(0, 60);

  if (!name) {
    redirect("/topics?area_error=name-required");
  }

  if (await nameTaken(name, focusAreaId)) {
    redirect("/topics?area_error=duplicate");
  }

  await db.focusArea.update({
    where: {
      id: focusAreaId,
    },
    data: {
      name,
      angle: stringValue(formData, "angle").slice(0, 400) || null,
      weight: weightValue(formData),
    },
  });

  revalidateTopics();
}

export async function toggleFocusArea(focusAreaId: string) {
  const focusArea = await db.focusArea.findUnique({
    where: {
      id: focusAreaId,
    },
    select: {
      active: true,
    },
  });

  if (!focusArea) {
    return;
  }

  await db.focusArea.update({
    where: {
      id: focusAreaId,
    },
    data: {
      active: !focusArea.active,
    },
  });

  revalidateTopics();
}

// Presets can only be switched off, so the original mix is always recoverable.
export async function deleteFocusArea(focusAreaId: string) {
  await db.focusArea.deleteMany({
    where: {
      id: focusAreaId,
      isPreset: false,
    },
  });

  revalidateTopics();
}
