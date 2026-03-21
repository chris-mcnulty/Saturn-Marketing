import { db, servicePlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface FeatureDefinition {
  key: string;
  label: string;
  description: string;
  category: "content" | "management" | "platform";
}

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  { key: "postGeneration", label: "AI Post Generation", description: "Generate social media posts with AI", category: "content" },
  { key: "campaignManagement", label: "Campaign Management", description: "Create and manage marketing campaigns", category: "management" },
  { key: "brandAssets", label: "Brand Assets", description: "Upload and manage brand assets for AI context", category: "content" },
  { key: "socialMonitoring", label: "Social Monitoring", description: "Monitor social media accounts and performance", category: "management" },
  { key: "ssoIntegration", label: "SSO Integration", description: "Microsoft Entra ID SSO login", category: "platform" },
  { key: "customBranding", label: "Custom Branding", description: "Custom logos and brand colors for the platform", category: "platform" },
];

export const FEATURE_CATEGORIES = [
  { key: "content", label: "Content Creation" },
  { key: "management", label: "Campaign Management" },
  { key: "platform", label: "Platform" },
] as const;

export type FeatureKey = string;

export interface PlanFeatures {
  competitorLimit: number;
  analysisLimit: number;
  adminUserLimit: number;
  readWriteUserLimit: number;
  readOnlyUserLimit: number;
  [key: string]: boolean | number;
}

const DEFAULT_PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  free: {
    postGeneration: true,
    campaignManagement: false,
    brandAssets: false,
    socialMonitoring: false,
    ssoIntegration: false,
    customBranding: false,
  },
  trial: {
    postGeneration: true,
    campaignManagement: true,
    brandAssets: true,
    socialMonitoring: false,
    ssoIntegration: false,
    customBranding: false,
  },
  pro: {
    postGeneration: true,
    campaignManagement: true,
    brandAssets: true,
    socialMonitoring: true,
    ssoIntegration: true,
    customBranding: false,
  },
  enterprise: {
    postGeneration: true,
    campaignManagement: true,
    brandAssets: true,
    socialMonitoring: true,
    ssoIntegration: true,
    customBranding: true,
  },
};

const DEFAULT_PLAN_LIMITS: Record<string, { competitorLimit: number; analysisLimit: number; adminUserLimit: number; readWriteUserLimit: number; readOnlyUserLimit: number }> = {
  free: { competitorLimit: 1, analysisLimit: 1, adminUserLimit: 1, readWriteUserLimit: 0, readOnlyUserLimit: 0 },
  trial: { competitorLimit: 3, analysisLimit: 5, adminUserLimit: 1, readWriteUserLimit: 2, readOnlyUserLimit: 5 },
  pro: { competitorLimit: 10, analysisLimit: -1, adminUserLimit: 3, readWriteUserLimit: 10, readOnlyUserLimit: 20 },
  enterprise: { competitorLimit: -1, analysisLimit: -1, adminUserLimit: -1, readWriteUserLimit: -1, readOnlyUserLimit: -1 },
};

let planCache: Map<string, { features: Record<string, boolean>; limits: typeof DEFAULT_PLAN_LIMITS.free }> | null = null;
let planCacheTime = 0;
const CACHE_TTL = 60_000;

async function loadPlansFromDb() {
  if (planCache && Date.now() - planCacheTime < CACHE_TTL) {
    return planCache;
  }
  try {
    const dbPlans = await db.select().from(servicePlansTable);
    const map = new Map<string, { features: Record<string, boolean>; limits: typeof DEFAULT_PLAN_LIMITS.free }>();
    for (const plan of dbPlans) {
      if (!plan.isActive) continue;
      const dbFeatures = (plan.features && typeof plan.features === "object" && !Array.isArray(plan.features))
        ? plan.features as Record<string, boolean>
        : {};
      const fallbackFeatures = DEFAULT_PLAN_FEATURES[plan.name] || DEFAULT_PLAN_FEATURES.free;
      const mergedFeatures: Record<string, boolean> = { ...fallbackFeatures, ...dbFeatures };
      map.set(plan.name, {
        features: mergedFeatures,
        limits: {
          competitorLimit: plan.competitorLimit,
          analysisLimit: plan.analysisLimit,
          adminUserLimit: plan.adminUserLimit,
          readWriteUserLimit: plan.readWriteUserLimit,
          readOnlyUserLimit: plan.readOnlyUserLimit,
        },
      });
    }
    planCache = map;
    planCacheTime = Date.now();
    return map;
  } catch {
    return new Map<string, { features: Record<string, boolean>; limits: typeof DEFAULT_PLAN_LIMITS.free }>();
  }
}

export function invalidatePlanCache() {
  planCache = null;
  planCacheTime = 0;
}

export async function getPlanFeaturesAsync(planName: string): Promise<PlanFeatures> {
  const plans = await loadPlansFromDb();
  const dbPlan = plans.get(planName);
  if (dbPlan) {
    return { ...dbPlan.limits, ...dbPlan.features };
  }
  const fallbackLimits = DEFAULT_PLAN_LIMITS[planName] || DEFAULT_PLAN_LIMITS.free;
  const fallbackFeatures = DEFAULT_PLAN_FEATURES[planName] || DEFAULT_PLAN_FEATURES.free;
  return { ...fallbackLimits, ...fallbackFeatures };
}

export function getPlanFeatures(planName: string): PlanFeatures {
  const fallbackLimits = DEFAULT_PLAN_LIMITS[planName] || DEFAULT_PLAN_LIMITS.free;
  const fallbackFeatures = DEFAULT_PLAN_FEATURES[planName] || DEFAULT_PLAN_FEATURES.free;
  return { ...fallbackLimits, ...fallbackFeatures };
}

export async function isFeatureEnabledAsync(plan: string, feature: FeatureKey): Promise<boolean> {
  const features = await getPlanFeaturesAsync(plan);
  return features[feature] === true;
}

export function getRequiredPlan(feature: FeatureKey): string {
  const trialFeatures = DEFAULT_PLAN_FEATURES.trial;
  if (trialFeatures[feature]) return "Trial";
  const proFeatures = DEFAULT_PLAN_FEATURES.pro;
  if (proFeatures[feature]) return "Pro";
  return "Enterprise";
}

export interface PlanGateResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  requiredPlan?: string;
  currentUsage?: number;
  limit?: number;
}

export async function checkFeatureAccessAsync(plan: string, feature: FeatureKey): Promise<PlanGateResult> {
  const enabled = await isFeatureEnabledAsync(plan, feature);
  if (enabled) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `This feature requires a ${getRequiredPlan(feature)} plan or higher`,
    upgradeRequired: true,
    requiredPlan: getRequiredPlan(feature),
  };
}
