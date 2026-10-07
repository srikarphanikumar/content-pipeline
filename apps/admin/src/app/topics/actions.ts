"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import * as focusAreas from "./focus-areas";
import * as pipeline from "./pipeline";

// Inngest and cron import ./pipeline directly; only UI-facing actions are exposed here.

export async function createTopic(formData: FormData) {
  await requireAdmin();
  return pipeline.createTopic(formData);
}

export async function generateNextBacklogTopicsFromForm(formData: FormData) {
  await requireAdmin();
  return pipeline.generateNextBacklogTopicsFromForm(formData);
}

export async function brainstormTopicsFromForm(formData: FormData) {
  await requireAdmin();
  return pipeline.brainstormTopicsFromForm(formData);
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

export async function selectAllBacklogTopicsFromForm(formData: FormData) {
  await requireAdmin();
  return pipeline.selectAllBacklogTopicsFromForm(formData);
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

export async function createFocusArea(formData: FormData) {
  await requireAdmin();
  return focusAreas.createFocusArea(formData);
}

export async function updateFocusArea(focusAreaId: string, formData: FormData) {
  await requireAdmin();
  return focusAreas.updateFocusArea(focusAreaId, formData);
}

export async function toggleFocusArea(focusAreaId: string) {
  await requireAdmin();
  return focusAreas.toggleFocusArea(focusAreaId);
}

export async function deleteFocusArea(focusAreaId: string) {
  await requireAdmin();
  return focusAreas.deleteFocusArea(focusAreaId);
}
