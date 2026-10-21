import { redirect } from "next/navigation";

export default function NewChannelPage() {
  redirect("/app?create=channel");
}
