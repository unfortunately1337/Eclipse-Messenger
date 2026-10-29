import type { CallRecord } from "./calls";
import { deliverCallOnce } from "./call-delivery";
import { publishBeamsCallToUser } from "./beams";

export async function deliverCallNotification(call: CallRecord) {
  if (call.kind !== "direct") return true;
  const recipientId = call.invitedIds.find(id => id !== call.callerId);
  if (!recipientId) return true;
  const state = call.status === "ringing" ? "ringing" : call.endReason === "missed" ? "missed" : "closed";
  if (state === "ringing" && Date.now() >= call.createdAt + 45000) return true;
  return deliverCallOnce(`calls:push:v1:${call.id}:${state}`, async () => {
    // Push contains no names, aliases or chat links. The authenticated worker
    // endpoint resolves them only for the intended signed-in recipient.
    await publishBeamsCallToUser(recipientId, { callId: call.id, state, expiresAt: call.createdAt + 45000 });
  });
}
