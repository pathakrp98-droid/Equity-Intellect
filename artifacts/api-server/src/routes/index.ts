import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import portfolioRouter from "./portfolio";
import researchRouter from "./research";
import alertsRouter from "./alerts";
import copilotRouter from "./copilot";
import settingsRouter from "./settings";
import guardrailsRouter from "./guardrails";
import intelligenceRouter from "./intelligence";
import journalRouter from "./journal";
import liveDataRouter from "./liveData";
import integrationRouter from "./integration";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/portfolio", portfolioRouter);
router.use("/research", researchRouter);
router.use("/alerts", alertsRouter);
router.use("/copilot", copilotRouter);
router.use("/settings", settingsRouter);
router.use("/guardrails", guardrailsRouter);
router.use("/intelligence", intelligenceRouter);
router.use("/journal", journalRouter);
router.use("/live-data", liveDataRouter);
router.use("/integration", integrationRouter);

export default router;
