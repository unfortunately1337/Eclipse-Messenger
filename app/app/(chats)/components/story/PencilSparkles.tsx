import { createLucideIcon } from "lucide-react";

// Official Lucide PencilSparkles paths; this icon is newer than our installed package.
// https://github.com/lucide-icons/lucide/blob/main/icons/pencil-sparkles.svg (ISC license)
export const PencilSparkles = createLucideIcon("PencilSparkles", [
  ["path", { d: "M10 3H8", key: "spark-top" }],
  ["path", { d: "m15.007 5.008 3.987 3.986", key: "pencil-edge" }],
  ["path", { d: "M20 15v4", key: "spark-right-v" }],
  ["path", { d: "M21.174 6.813a2.82 2.82 0 0 0-3.986-3.987L3.842 16.175a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z", key: "pencil" }],
  ["path", { d: "M22 17h-4", key: "spark-right-h" }],
  ["path", { d: "M4 5v4", key: "spark-left-v" }],
  ["path", { d: "M6 7H2", key: "spark-left-h" }],
  ["path", { d: "M9 2v2", key: "spark-top-v" }],
]);
