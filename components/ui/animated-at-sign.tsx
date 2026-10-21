"use client";

import UseAnimations from "react-useanimations";
import atSign from "react-useanimations/lib/atSign";

export default function AnimatedAtSign() {
  return <UseAnimations animation={atSign} size={88} autoplay loop={false} strokeColor="currentColor" aria-hidden />;
}
