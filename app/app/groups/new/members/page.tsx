import { redirect } from "next/navigation";

export default function GroupMembersPage() {
  redirect("/app?create=group");
}
