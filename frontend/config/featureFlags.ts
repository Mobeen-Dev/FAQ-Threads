export const MCP_INTEGRATION_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MCP_INTEGRATION !== "false";

export function isMcpIntegrationEnabled() {
  return MCP_INTEGRATION_ENABLED;
}
