import { redirect } from "next/navigation";

export default function ChannelMembersPage() {
  redirect("/app?create=channel");
}
