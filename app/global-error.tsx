"use client";

import PageLoadError from "@/components/PageLoadError";

export default function GlobalError(props: Parameters<typeof PageLoadError>[0]) {
  return <html lang="en"><body style={{ margin: 0 }}><PageLoadError {...props} /></body></html>;
}
