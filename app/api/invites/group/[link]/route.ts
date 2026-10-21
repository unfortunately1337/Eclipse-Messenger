import { NextRequest } from "next/server";
import { communityInvites } from "@/lib/server/community-invites";
import { handleOptions } from "@/lib/server/http";
type Params = { params: Promise<{ link: string }> };
async function handle(req: NextRequest, { params }: Params) { return communityInvites(req, "group", (await params).link); }
export { handle as GET, handle as POST, handle as DELETE };
export function OPTIONS(req: NextRequest) { return handleOptions(req); }
