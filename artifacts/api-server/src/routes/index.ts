import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import portfolioRouter from "./portfolio";
import researchRouter from "./research";
import marketRouter from "./market";
import alertsRouter from "./alerts";
import copilotRouter from "./copilot";
import settingsRouter from "./settings";
import guardrailsRouter from "./guardrails";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/dashboard", dashboardRouter);
router.use("/portfolio", portfolioRouter);
router.use("/research", researchRouter);
router.use("/market", marketRouter);
router.use("/alerts", alertsRouter);
router.use("/copilot", copilotRouter);
router.use("/settings", settingsRouter);
router.use("/guardrails", guardrailsRouter);

export default router;
