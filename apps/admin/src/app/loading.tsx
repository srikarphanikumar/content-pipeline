export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] text-[#f7f2ea]">
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#141414] px-5 py-4 text-sm font-semibold text-zinc-300">
        <span className="size-5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
        Loading pipeline...
      </div>
    </main>
  );
}
