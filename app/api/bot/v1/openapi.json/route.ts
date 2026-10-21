import { BOT_API_OPENAPI } from "@/lib/bot-api-openapi";
export function GET() { return Response.json(BOT_API_OPENAPI, { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } }); }
