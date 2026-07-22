import { Router, type Request, type Response } from "express";

import { integrationService } from "../services/integration/integrationService";

const router = Router();

router.get("/health", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const result = await integrationService.getHealth(req.user.id);
  res.json(result);
});

export default router;
