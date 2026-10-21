import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Eclipse",
};

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/app");
  }

  redirect("/login");
}
