// Lookups over the platform registry (./providerIds). Each returns the platform's own setting, or
// the default when the platform does not set one, so a platform with no billing terms behaves as
// ChargeMOD does today. App code only: the test runner loads providerIds.ts and billingCycle.ts
// directly, so this file (which imports them at runtime) is not loaded there.
import { DEFAULT_CYCLE, type CycleRule } from "@/lib/billingCycle";
import { PROVIDERS } from "@/lib/cms/providerIds";

const DEFAULT_PAYMENT_DAYS = 3;

function infoFor(id: string | null | undefined) {
  return PROVIDERS.find((p) => p.id === id);
}

// The billing cycle of a platform; half-month when it does not set one.
export function cycleRuleFor(id: string | null | undefined): CycleRule {
  return infoFor(id)?.cycle ?? DEFAULT_CYCLE;
}

// What a platform charges Triarc per kWh of customer energy; zero when it charges nothing.
export function commissionPerKwh(id: string | null | undefined): number {
  return infoFor(id)?.commissionPerKwh ?? 0;
}

// Days after a cycle closes that a platform settles. Three days for every platform by default.
export function paymentDaysFor(id: string | null | undefined): number {
  return infoFor(id)?.paymentDays ?? DEFAULT_PAYMENT_DAYS;
}
