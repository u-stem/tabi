import { app } from "./app";
import { registerWebSocket, websocket } from "./ws/handler";

registerWebSocket(app);

const port = Number(process.env.PORT) || 3001;

console.log(`API server running on http://localhost:${port}`);

export default {
  fetch: app.fetch,
  port,
  websocket,
};
