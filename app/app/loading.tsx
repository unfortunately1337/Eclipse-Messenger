import { cn } from "@/lib/utils";

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-white/[0.08]",
        className,
      )}
    >
      <span className="absolute inset-0 animate-pulse bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))]" />
    </div>
  );
}

export default function AppLoading() {
  return (
    <div className="flex min-h-[100dvh] w-full items-start justify-center px-4 py-6 md:px-6">
      <div className="w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <LoadingBlock className="h-10 w-40 rounded-full" />
          <LoadingBlock className="h-10 w-24 rounded-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-3xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/70 dark:bg-zinc-950/70">
            <LoadingBlock className="h-9 w-full rounded-full" />
            <LoadingBlock className="h-9 w-[80%] rounded-full" />
            <LoadingBlock className="h-9 w-[72%] rounded-full" />
          </div>
          <div className="space-y-4 rounded-3xl border border-zinc-200/70 bg-white/70 p-5 dark:border-zinc-800/70 dark:bg-zinc-950/70">
            <LoadingBlock className="h-12 w-52 rounded-full" />
            <LoadingBlock className="h-11 w-full rounded-2xl" />
            <LoadingBlock className="h-11 w-full rounded-2xl" />
            <LoadingBlock className="h-28 w-full rounded-3xl" />
            <LoadingBlock className="h-11 w-52 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
