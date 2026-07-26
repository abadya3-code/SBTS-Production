import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

function isSecureRequest(req: Request) {
  if (req.secure || req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const values = Array.isArray(forwardedProto)
    ? forwardedProto
    : String(forwardedProto ?? "").split(",");
  return values.some((value) => value.trim().toLowerCase() === "https");
}

/**
 * Same-origin email/password sessions do not need SameSite=None. Lax is more
 * reliable across Railway/custom domains and prevents third-party cookie use.
 */
export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: ENV.isProduction || isSecureRequest(req),
  };
}
