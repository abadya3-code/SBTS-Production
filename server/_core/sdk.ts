import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

export type VerifiedSession = SessionPayload & { issuedAt: number };

class SessionService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (secret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters.");
    }
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name?.trim() || "SBTS User",
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(payload.openId)
      .setIssuer(ENV.appId)
      .setAudience(ENV.appId)
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<VerifiedSession | null> {
    if (!cookieValue) return null;

    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
        issuer: ENV.appId,
        audience: ENV.appId,
      });
      const { openId, appId, name, iat } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId)) return null;
      if (!isNonEmptyString(appId) || appId !== ENV.appId) return null;
      if (typeof iat !== "number" || !Number.isFinite(iat)) return null;

      return {
        openId,
        appId,
        name: isNonEmptyString(name) ? name : "SBTS User",
        issuedAt: iat,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const session = await this.verifySession(cookies.get(COOKIE_NAME));
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");
    if (user.userStatus !== "active") throw ForbiddenError("User account is not active");

    // A password change invalidates every token issued in an earlier second.
    if (
      user.passwordChangedAt
      && session.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw ForbiddenError("Session was issued before the password changed");
    }

    return user;
  }
}

export const sdk = new SessionService();
