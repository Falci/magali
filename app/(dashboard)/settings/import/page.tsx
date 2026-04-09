import { requireSession } from "@/lib/session";
import ImportSettingsClient from "./import-client";

export default async function ImportSettingsPage() {
  await requireSession();

  return <ImportSettingsClient />;
}
