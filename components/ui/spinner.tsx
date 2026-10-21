import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  return <LoaderCircle className={cn("h-5 w-5 animate-spin text-zinc-500", className)} aria-hidden="true" />;
}
