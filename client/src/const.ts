export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Standalone auth: login path for the email/password login page.
 * Kept as a function for backward compatibility with any existing callers.
 */
export const getLoginUrl = () => "/login";

/** The login page path */
export const LOGIN_PATH = "/login";
