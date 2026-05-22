"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import {
  clearAdminGameModeCookie,
  getOrCreateAdminShadowTasker,
  getReviewerById,
  getTaskerById,
  setOwnAdminGameModeCookie,
  setReviewerImpersonationCookie,
  setTaskerImpersonationCookie,
} from "@/lib/admin-game-mode";
import { getMyUserRow } from "@/lib/data";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function enterOwnAdminGameMode() {
  const user = await requireRole("admin");
  const admin = await getMyUserRow(user.sub);

  if (!admin) {
    throw new Error("Admin user row was not found.");
  }

  await getOrCreateAdminShadowTasker(admin);
  await setOwnAdminGameModeCookie();
  redirect("/");
}

export async function enterTaskerImpersonationMode(formData: FormData) {
  await requireRole("admin");
  const taskerId = formString(formData, "taskerId");
  const tasker = taskerId ? await getTaskerById(taskerId) : null;

  if (!tasker) {
    throw new Error("Choose a valid tasker to impersonate.");
  }

  await setTaskerImpersonationCookie(tasker.id);
  redirect("/");
}

export async function enterReviewerImpersonationMode(formData: FormData) {
  await requireRole("admin");
  const reviewerId = formString(formData, "reviewerId");
  const reviewer = reviewerId ? await getReviewerById(reviewerId) : null;

  if (!reviewer) {
    throw new Error("Choose a valid reviewer to impersonate.");
  }

  await setReviewerImpersonationCookie(reviewer.id);
  redirect("/review/queue");
}

export async function exitAdminGameMode() {
  await requireRole("admin");
  await clearAdminGameModeCookie();
  redirect("/admin");
}
