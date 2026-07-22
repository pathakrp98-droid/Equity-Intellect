import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import {
  isOriginAllowed,
  resolveAllowedOrigins,
  securityHeaders,
} from "./middlewares/securityHeaders";
import router from "./routes";

const app: Express = express();
const environment = process.env.NODE_ENV ?? "development";
const allowedOrigins = resolveAllowedOrigins(
  process.env.CORS_ALLOWED_ORIGINS,
  process.env.REPLIT_DEV_DOMAIN,
  process.env.REPLIT_DOMAINS,
);

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use((req, res, next) => {
  if (req.id) res.setHeader("X-Request-Id", String(req.id));
  next();
});
app.use(securityHeaders);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins, environment)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS policy"));
    },
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "8mb", strict: true }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use(authMiddleware);

app.use("/api", router);

app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;
  const message =
    status < 500 && error instanceof Error
      ? error.message
      : "Unexpected server error";

  req.log?.error({ error }, "request failed");
  if (!res.headersSent) {
    res.status(status).json({
      error: message,
      requestId: req.id ? String(req.id) : undefined,
    });
  }
});

export default app;
