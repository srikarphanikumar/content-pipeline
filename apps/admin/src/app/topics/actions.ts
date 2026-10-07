"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import * as pipeline from "./pipeline";

// Inngest and cron import ./pipeline directly; only UI-facing actions are exposed here.

export async function createTopic(formData: FormData) {
  await requireAdmin();
  return pipeline.createTopic(formData);
}

export async function generateNextBacklogTopicsFromForm() {
  await requireAdmin();
  return pipeline.generateNextBacklogTopicsFromForm();
}

export async function updateTopicStatus(topicId: string, formData: FormData) {
  await requireAdmin();
  return pipeline.updateTopicStatus(topicId, formData);
}

export async function updateTopic(topicId: string, formData: FormData) {
  await requireAdmin();
  return pipeline.updateTopic(topicId, formData);
}

export async function deleteTopic(topicId: string) {
  await requireAdmin();
  return pipeline.deleteTopic(topicId);
}

export async function selectAllBacklogTopicsFromForm() {
  await requireAdmin();
  return pipeline.selectAllBacklogTopicsFromForm();
}

export async function clearAllTopicsFromForm() {
  await requireAdmin();
  return pipeline.clearAllTopicsFromForm();
}

export async function createDraftPostFromTopic(topicId: string) {
  await requireAdmin();
  return pipeline.createDraftPostFromTopic(topicId);
}

export async function prepareNextSelectedTopicDraft() {
  await requireAdmin();
  return pipeline.prepareNextSelectedTopicDraft();
}

export async function createDraftsForAllSelectedTopics() {
  await requireAdmin();
  return pipeline.createDraftsForAllSelectedTopics();
}
