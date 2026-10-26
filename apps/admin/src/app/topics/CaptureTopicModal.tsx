"use client";

import { useState } from "react";
import { SubmitButton } from "../components/SubmitButton";
import { buttonClass } from "../components/ui";

const inputClass =
  "h-10 rounded-lg border border-line bg-canvas px-3 text-sm text-white outline-none focus:border-zinc-500";
const labelClass = "grid gap-1.5 text-xs font-semibold text-zinc-400";

type CaptureTopicModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  defaultFocusAreaId: string;
  focusAreas: Array<{ id: string; name: string }>;
  statuses: string[];
};

export function CaptureTopicModal({
  action,
  defaultFocusAreaId,
  focusAreas,
  statuses,
}: CaptureTopicModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={buttonClass("primary")}
        onClick={() => setOpen(true)}
        type="button"
      >
        Capture idea
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <section className="w-full max-w-2xl rounded-xl border border-line-strong bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Capture an idea</h2>
              <button
                aria-label="Close"
                className={buttonClass("ghost", "sm")}
                onClick={() => setOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <form action={action} className="mt-5 grid gap-4">
              <label className={labelClass}>
                Title
                <input className={inputClass} name="title" required />
              </label>
              <label className={labelClass}>
                Notes
                <textarea
                  className="min-h-28 rounded-lg border border-line bg-canvas px-3 py-3 text-sm text-white outline-none focus:border-zinc-500"
                  name="description"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["noveltyScore", "Novelty"],
                  ["audienceFit", "Audience"],
                  ["difficulty", "Difficulty"],
                ].map(([name, label]) => (
                  <label className={labelClass} key={name}>
                    {label}
                    <input
                      className={inputClass}
                      max={10}
                      min={1}
                      name={name}
                      type="number"
                    />
                  </label>
                ))}
              </div>
              <label className={labelClass}>
                Focus area
                <select className={inputClass} name="focusAreaId" defaultValue={defaultFocusAreaId}>
                  <option value="">None</option>
                  {focusAreas.map((focusArea) => (
                    <option key={focusArea.id} value={focusArea.id}>
                      {focusArea.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Status
                <select className={inputClass} name="status" defaultValue="backlog">
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  className={buttonClass("ghost")}
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <SubmitButton pendingLabel="Adding...">Add idea</SubmitButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
