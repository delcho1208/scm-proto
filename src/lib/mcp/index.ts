import { defineMcp } from "@lovable.dev/mcp-js";

import listProductsTool from "./tools/list-products";
import listRegionsTool from "./tools/list-regions";
import getRegionTool from "./tools/get-region";
import getIntegrationRecordsTool from "./tools/get-integration-records";

export default defineMcp({
  name: "scm",
  title: "scm",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Digital Twin SCM Portal (Korean pharmaceutical supply chain demo). Use `list_products` for tracked drugs and their demand/stock KPIs, `list_regions` and `get_region` for regional inventory and risk status, and `get_integration_records` for ERP/MES/WMS sync records for a region + product pair.",
  tools: [listProductsTool, listRegionsTool, getRegionTool, getIntegrationRecordsTool],
});
