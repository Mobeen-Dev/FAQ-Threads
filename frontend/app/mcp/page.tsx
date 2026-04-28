import { notFound } from "next/navigation";
import McpIntegrationClient from "./McpIntegrationClient";
import { isMcpIntegrationEnabled } from "@/config/featureFlags";

export default function McpPage() {
  if (!isMcpIntegrationEnabled()) {
    notFound();
  }

  return <McpIntegrationClient />;
}
