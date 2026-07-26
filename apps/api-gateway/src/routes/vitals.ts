/**
 * RuView Vitals API Routes
 * 
 * GET /api/vitals - Get all vital signs from all nodes
 * GET /api/vitals/:nodeId - Get vital signs from a specific node
 */

import { Router } from "express";
import type { RuViewMQTTClient } from "@lderly/ruview-integration";

export function createVitalsRouter(ruviewClient: RuViewMQTTClient | null) {
  const router = Router();

  // Get all vital signs
  router.get("/", (_request, response) => {
    if (!ruviewClient) {
      return response.status(503).json({ error: "RuView not connected" });
    }

    const updates = ruviewClient.getAllSensorUpdates();
    const vitals = Array.from(updates.values()).map((update) => ({
      nodeId: update.nodeId,
      vitalSigns: update.vitalSigns,
      timestamp: update.timestamp
    }));

    response.json({
      count: vitals.length,
      data: vitals
    });
  });

  // Get vital signs for a specific node
  router.get("/:nodeId", (_request, response) => {
    if (!ruviewClient) {
      return response.status(503).json({ error: "RuView not connected" });
    }

    const { nodeId } = _request.params;
    const update = ruviewClient.getSensorUpdate(nodeId);

    if (!update) {
      return response.status(404).json({ error: "Node not found" });
    }

    response.json({
      nodeId: update.nodeId,
      vitalSigns: update.vitalSigns,
      timestamp: update.timestamp
    });
  });

  return router;
}
