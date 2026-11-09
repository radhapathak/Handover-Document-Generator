import { config } from "@/lib/config";
import { serviceNowStore } from "@/lib/servicenow/client";
import { memoryStore } from "@/lib/demo/memory-store";
import { IntegrationError, type TableStore } from "@/lib/store/types";

/**
 * Picks the storage backend from configuration — never silently:
 *  - SERVICENOW_INSTANCE_URL set → ServiceNow (errors surface to the user)
 *  - DEMO_MODE=true              → labelled in-memory demo data
 *  - neither                     → error explaining what to configure
 */
export function getStore(): TableStore {
  switch (config.dataMode) {
    case "servicenow":
      return serviceNowStore;
    case "demo":
      return memoryStore;
    default:
      throw new IntegrationError(
        "No data source configured. Set the SERVICENOW_* variables (see SERVICE_NOW_SETUP.md) or DEMO_MODE=true for demo data.",
        503
      );
  }
}
