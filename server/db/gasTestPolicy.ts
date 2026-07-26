import type { WorkflowPolicySettingsRow } from "../../drizzle/schema";

type GasReadingValue = string | number | null | undefined;

export type GasTestReadingSnapshot = {
  oxygenPercent: GasReadingValue;
  lelPercent: GasReadingValue;
  h2sPpm: GasReadingValue;
  coPpm: GasReadingValue;
};

export type GasTestAcceptance = {
  acceptable: boolean;
  reasons: string[];
};

function toFiniteNumber(value: GasReadingValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * Evaluates atmospheric readings against plant-configured acceptance limits.
 * No safety limit is hard-coded in the runtime. Production deployment must
 * configure and approve the site limits in Workflow & Safety settings.
 */
export function evaluateGasTestAcceptance(
  reading: GasTestReadingSnapshot,
  policy: WorkflowPolicySettingsRow,
): GasTestAcceptance {
  const reasons: string[] = [];
  if (policy.gasTestLimitsConfigured !== 1) {
    return {
      acceptable: false,
      reasons: ["Plant gas-test acceptance limits are not configured in Workflow & Safety settings."],
    };
  }

  const oxygen = toFiniteNumber(reading.oxygenPercent);
  const lel = toFiniteNumber(reading.lelPercent);
  const h2s = toFiniteNumber(reading.h2sPpm);
  const co = toFiniteNumber(reading.coPpm);
  const oxygenMin = toFiniteNumber(policy.gasTestOxygenMinPercent);
  const oxygenMax = toFiniteNumber(policy.gasTestOxygenMaxPercent);
  const maxLel = toFiniteNumber(policy.gasTestMaxLelPercent);
  const maxH2s = toFiniteNumber(policy.gasTestMaxH2sPpm);
  const maxCo = toFiniteNumber(policy.gasTestMaxCoPpm);

  if (oxygenMin === null || oxygenMax === null || maxLel === null) {
    reasons.push("Oxygen minimum, oxygen maximum, and maximum LEL limits must be configured.");
  } else if (oxygenMin >= oxygenMax) {
    reasons.push("Configured oxygen minimum must be lower than the oxygen maximum.");
  }

  if (oxygen === null) reasons.push("Oxygen reading is required.");
  else {
    if (oxygenMin !== null && oxygen < oxygenMin) reasons.push(`Oxygen reading ${oxygen}% is below the configured minimum ${oxygenMin}%.`);
    if (oxygenMax !== null && oxygen > oxygenMax) reasons.push(`Oxygen reading ${oxygen}% is above the configured maximum ${oxygenMax}%.`);
  }

  if (lel === null) reasons.push("LEL reading is required.");
  else if (maxLel !== null && lel > maxLel) reasons.push(`LEL reading ${lel}% exceeds the configured maximum ${maxLel}%.`);

  if (maxH2s !== null) {
    if (h2s === null) reasons.push("H₂S reading is required by the configured site limit.");
    else if (h2s > maxH2s) reasons.push(`H₂S reading ${h2s} ppm exceeds the configured maximum ${maxH2s} ppm.`);
  }

  if (maxCo !== null) {
    if (co === null) reasons.push("CO reading is required by the configured site limit.");
    else if (co > maxCo) reasons.push(`CO reading ${co} ppm exceeds the configured maximum ${maxCo} ppm.`);
  }

  return { acceptable: reasons.length === 0, reasons };
}
