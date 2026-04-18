const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
};

export const API_BASE_URL =
  getEnvVar("NEXT_PUBLIC_API_URL") || "https://reelbazar-backend.vercel.app/api";

export const LANDING_ORIGIN =
  getEnvVar("NEXT_PUBLIC_LANDING_ORIGIN") || "https://rava.one";
