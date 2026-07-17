import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import portfolioRouter from "./portfolio";
import researchRouter from "./research";
import marketRouter from "./market";
import alertsRouter from "./alerts";
import copilotRouter from "./copilot";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/dashboard", dashboardRouter);
router.use("/portfolio", portfolioRouter);
router.use("/research", researchRouter);
router.use("/market", marketRouter);
router.use("/alerts", alertsRouter);
router.use("/copilot", copilotRouter);
router.use("/settings", settingsRouter);

export default router;
