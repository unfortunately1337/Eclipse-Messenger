"use client";
import { useEffect } from "react";

/** Optional story/typeface choices must not block the first auth/chat paint. */
export default function DeferredFonts() {
  useEffect(() => {
    if (document.querySelector("[data-optional-fonts]")) return;
    const load = () => {
      if (document.querySelector("[data-optional-fonts]")) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.optionalFonts = "true";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Roboto:wght@300;400;500;700;900&family=Outfit:wght@300;400;500;600;700;800&family=Nunito:wght@600;700;800;900&display=swap";
      document.head.appendChild(link);
    };
    const timer = window.setTimeout(load, 2000);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
