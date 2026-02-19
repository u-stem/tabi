import { app } from "@sugara/api";
import { handle } from "hono/vercel";

export const preferredRegion = "hnd1";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
