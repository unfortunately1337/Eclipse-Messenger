"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function CommunityDetailsSkeleton({ withMembers = false }: { withMembers?: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 pt-6 space-y-4" aria-hidden="true">
      <Skeleton className="h-[92px] w-[92px] rounded-full" />
      <Skeleton className="h-5 w-36 rounded-md" />
      <Skeleton className="h-4 w-24 rounded-md" />
      <div className="w-full mt-6 space-y-3">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        {withMembers && (
          <>
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </>
        )}
      </div>
    </div>
  );
}
