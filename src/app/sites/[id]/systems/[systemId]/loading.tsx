export default function PowerSystemLoading() {
  return (
    <main className="min-h-screen bg-[#f4f7fa] p-4 sm:p-6" role="status" aria-label="Opening power system">
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <div className="h-12 rounded-2xl border border-line bg-white" />
        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="hidden h-[34rem] rounded-2xl border border-line bg-white lg:block" />
          <div className="space-y-4">
            <div className="h-28 rounded-2xl border border-line bg-white" />
            <div className="h-80 rounded-2xl border border-line bg-white" />
            <p className="text-center text-xs font-bold text-muted">Opening your power system…</p>
          </div>
        </div>
      </div>
    </main>
  );
}
