import { redirect } from "next/navigation";

export default function NewGroupPage() {
  redirect("/app?create=group");
}
