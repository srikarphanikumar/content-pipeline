import { SubmitButton } from "../components/SubmitButton";
import { createFocusArea, deleteFocusArea, toggleFocusArea, updateFocusArea } from "./actions";

export type FocusAreaSummary = {
  id: string;
  name: string;
  angle: string | null;
  active: boolean;
  weight: number;
  isPreset: boolean;
  activeTopicCount: number;
};

const inputClass =
  "h-9 rounded-md border border-white/10 bg-black px-3 text-sm text-white outline-none ring-orange-500/20 focus:ring-4";
const labelClass = "grid gap-1 text-xs font-semibold text-zinc-400";
const weights = [
  [1, "Normal"],
  [2, "More"],
  [3, "Most"],
] as const;

const areaErrors: Record<string, string> = {
  duplicate: "A focus area with that name already exists.",
  "name-required": "Focus area name is required.",
};

export function FocusAreasPanel({
  areaError,
  focusAreas,
}: {
  areaError?: string;
  focusAreas: FocusAreaSummary[];
}) {
  return (
    <section className="mb-4 rounded-lg border border-white/10 bg-[#141414] p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-300">
            Focus areas
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
            Active areas drive the daily top-up and are pre-checked when you generate ideas.
            Weight sets how much of a mixed batch each area gets.
          </p>
        </div>
      </div>

      {areaError ? (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-100">
          {areaErrors[areaError] || "Could not save the focus area."}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {focusAreas.map((area) => (
          <details
            className={`group rounded-md border px-2.5 py-1.5 text-xs open:basis-full ${
              area.active
                ? "border-orange-400/40 bg-orange-500/10 text-orange-100"
                : "border-white/10 bg-black/30 text-zinc-500"
            }`}
            key={area.id}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
              <span>{area.name}</span>
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-zinc-300">
                {area.activeTopicCount}
              </span>
              {area.weight > 1 ? (
                <span className="text-[11px] text-orange-300">×{area.weight}</span>
              ) : null}
              {!area.active ? <span className="text-[11px]">off</span> : null}
            </summary>

            <div className="mt-3 grid gap-3 border-t border-white/10 pt-3">
              <form action={updateFocusArea.bind(null, area.id)} className="grid gap-3 md:grid-cols-[1fr_2fr_auto_auto] md:items-end">
                <label className={labelClass}>
                  Name
                  <input className={inputClass} defaultValue={area.name} maxLength={60} name="name" required />
                </label>
                <label className={labelClass}>
                  Angle
                  <input
                    className={inputClass}
                    defaultValue={area.angle || ""}
                    maxLength={400}
                    name="angle"
                    placeholder="How you want this area covered"
                  />
                </label>
                <label className={labelClass}>
                  Weight
                  <select className={inputClass} defaultValue={area.weight} name="weight">
                    {weights.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton
                  className="h-9 rounded-md bg-orange-500 px-3 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-70"
                  pendingLabel="Saving..."
                >
                  Save
                </SubmitButton>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action={toggleFocusArea.bind(null, area.id)}>
                  <SubmitButton
                    className="h-8 rounded-md border border-orange-400 px-3 text-xs font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black disabled:cursor-wait disabled:opacity-70"
                    pendingLabel="Saving..."
                  >
                    {area.active ? "Turn off" : "Turn on"}
                  </SubmitButton>
                </form>
                {area.isPreset ? (
                  <span className="self-center text-xs text-zinc-500">
                    Preset areas can be turned off but not deleted.
                  </span>
                ) : (
                  <form action={deleteFocusArea.bind(null, area.id)}>
                    <SubmitButton
                      className="h-8 rounded-md border border-red-400 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-70"
                      pendingLabel="Deleting..."
                    >
                      Delete
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>

      <form
        action={createFocusArea}
        className="mt-4 grid gap-2 border-t border-white/10 pt-4 md:grid-cols-[1fr_2fr_auto_auto] md:items-end"
      >
        <label className={labelClass}>
          New focus area
          <input className={inputClass} maxLength={60} name="name" placeholder="e.g. Fintech frontend" required />
        </label>
        <label className={labelClass}>
          Angle (optional)
          <input
            className={inputClass}
            maxLength={400}
            name="angle"
            placeholder="e.g. Money formatting, precision bugs, compliance-driven UI"
          />
        </label>
        <label className={labelClass}>
          Weight
          <select className={inputClass} defaultValue={1} name="weight">
            {weights.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton
          className="h-9 rounded-md border border-orange-400 px-3 text-xs font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black disabled:cursor-wait disabled:opacity-70"
          pendingLabel="Adding..."
        >
          Add area
        </SubmitButton>
      </form>
    </section>
  );
}
