import path from "node:path";

import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";

export interface FrontendHostingOptions {
  assetsDirectory: string;
}

function isSafeNavigation(req: Request): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!req.accepts("html")) return false;

  let pathname: string;
  try {
    pathname = decodeURIComponent(req.path);
  } catch {
    return false;
  }

  if (pathname.includes("\\") || pathname.includes("\0")) return false;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase() === "api") return false;
  if (segments.some((segment) => segment.startsWith("."))) return false;
  return path.posix.extname(pathname) === "";
}

function notFound(res: Response): void {
  res.status(404).type("text/plain").send("Not found");
}

export function mountFrontend(
  app: Express,
  { assetsDirectory }: FrontendHostingOptions,
): void {
  app.use(
    express.static(assetsDirectory, {
      dotfiles: "deny",
      fallthrough: true,
      index: false,
      redirect: false,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isSafeNavigation(req)) {
      notFound(res);
      return;
    }

    res.sendFile(
      "index.html",
      { root: assetsDirectory, dotfiles: "deny" },
      (error) => {
        if (!error) return;
        if (res.headersSent) {
          next(error);
          return;
        }
        const status =
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof error.status === "number"
            ? error.status
            : 500;
        if (status === 404) {
          notFound(res);
          return;
        }
        next(error);
      },
    );
  });
}
