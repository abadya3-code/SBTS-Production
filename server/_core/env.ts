const readBoolean = (value: string | undefined, fallback = false) => {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const readString = (value: string | undefined, fallback = "") =>
  value?.trim() || fallback;

export const ENV = {
  appId: readString(process.env.VITE_APP_ID, "sbts-standalone"),
  cookieSecret: readString(process.env.JWT_SECRET),
  databaseUrl: readString(process.env.DATABASE_URL),
  oAuthServerUrl: readString(process.env.OAUTH_SERVER_URL),
  oAuthEnabled: readBoolean(process.env.ENABLE_OAUTH, false),
  ownerOpenId: readString(process.env.OWNER_OPEN_ID),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: readString(process.env.BUILT_IN_FORGE_API_URL),
  forgeApiKey: readString(process.env.BUILT_IN_FORGE_API_KEY),
};
