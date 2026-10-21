import InviteContent from "./InviteContent";
import { getInvitePreview, type InvitePreview } from "@/lib/server/invite-preview";
import { HttpError } from "@/lib/server/http";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preview: InvitePreview | null = null;
  let error: string | null = null;
  try {
    preview = await getInvitePreview(token);
  } catch (reason) {
    error = reason instanceof HttpError ? reason.message : "Не удалось открыть приглашение";
  }
  return <InviteContent key={token} token={token} initialPreview={preview} initialError={error} />;
}
