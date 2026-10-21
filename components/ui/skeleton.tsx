import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative isolate overflow-hidden rounded-xl bg-[#101012] dark:bg-[#101012]",
        className,
      )}
      {...props}
    >
      <span className="absolute inset-0 animate-pulse bg-white/[0.025]" />
    </div>
  )
}

export { Skeleton }
