"use client";

import { useState } from "react";
import { SubmitButton } from "../components/SubmitButton";

const inputClass =
  "h-10 rounded-md border border-white/10 bg-black px-3 text-sm text-white outline-none ring-orange-500/20 focus:ring-4";
const labelClass = "grid gap-1.5 text-xs font-semibold text-zinc-400";

type CaptureTopicModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  statuses: string[];
};

export function CaptureTopicModal({ action, statuses }: CaptureTopicModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="h-9 rounded-md bg-orange-500 px-3 text-xs font-semibold text-black transition hover:bg-orange-400"
        onClick={() => setOpen(true)}
        type="button"
      >
        Capture idea
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <section className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#141414] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-400">
                  Add topic
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Capture a new idea
                </h2>
              </div>
              <button
                className="h-8 rounded-md border border-white/10 px-3 text-xs font-semibold text-zinc-300 transition hover:border-orange-400 hover:text-orange-300"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
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
                  className="min-h-28 rounded-md border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none ring-orange-500/20 focus:ring-4"
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
                  className="h-10 rounded-md border border-white/10 px-4 text-sm font-semibold text-zinc-300"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <SubmitButton pendingLabel="Adding...">Add topic</SubmitButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
