import type messages from "./messages/ja.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
