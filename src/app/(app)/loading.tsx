export default function AppLoading() {
  return (
    <div
      className="animate-pulse space-y-6 motion-reduce:animate-none"
      aria-label="Loading workspace"
    >
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-surface-strong" />
        <div className="h-10 w-80 max-w-full rounded-xl bg-surface-strong" />
        <div className="h-4 w-136 max-w-full rounded bg-surface-strong" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="panel h-32 bg-surface-strong/60" />
        ))}
      </div>
      <div className="panel h-96 bg-surface-strong/60" />
    </div>
  );
}
