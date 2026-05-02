import type { DependencyReviewInput } from "../store/memoryStore.js";

interface NpmRegistryPackage {
  name: string;
  "dist-tags"?: {
    latest?: string;
  };
  time?: Record<string, string>;
  versions?: Record<
    string,
    {
      license?: string;
      dependencies?: Record<string, string>;
      repository?: unknown;
      deprecated?: string;
    }
  >;
}

export interface ReviewOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
}

export async function reviewNpmPackage(
  packageName: string,
  useCase: string,
  options: ReviewOptions = {}
): Promise<DependencyReviewInput> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

  try {
    const response = await fetchImpl(registryUrl, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return fallbackReview(packageName, useCase, `npm registry returned ${response.status}`);
    }

    const metadata = (await response.json()) as NpmRegistryPackage;
    const latestVersion = metadata["dist-tags"]?.latest;
    const latest = latestVersion ? metadata.versions?.[latestVersion] : undefined;
    const publishedAt = latestVersion ? metadata.time?.[latestVersion] : undefined;
    const dependencyCount = latest?.dependencies ? Object.keys(latest.dependencies).length : 0;
    const risks = collectRisks({
      license: latest?.license,
      publishedAt,
      dependencyCount,
      deprecated: latest?.deprecated,
      now
    });
    const maintenanceStatus = maintenanceStatusFor(publishedAt, now);
    const recommendation = recommendationFor(risks, maintenanceStatus, latest?.license);

    return {
      packageName: metadata.name || packageName,
      useCase,
      license: latest?.license,
      maintenance: {
        latestVersion,
        publishedAt,
        dependencyCount,
        status: maintenanceStatus
      },
      risks,
      alternatives: [],
      recommendation,
      rationale: rationaleFor(recommendation, risks, maintenanceStatus),
      evidence: [
        {
          url: registryUrl,
          note: "npm registry metadata"
        }
      ]
    };
  } catch (error) {
    return fallbackReview(packageName, useCase, `registry lookup failed: ${String(error)}`);
  }
}

function collectRisks(input: {
  license: string | undefined;
  publishedAt: string | undefined;
  dependencyCount: number;
  deprecated: string | undefined;
  now: Date;
}): string[] {
  const risks: string[] = [];

  if (!input.license) {
    risks.push("license is missing from the latest package metadata");
  }

  if (input.deprecated) {
    risks.push(`package is deprecated: ${input.deprecated}`);
  }

  const ageDays = ageInDays(input.publishedAt, input.now);

  if (ageDays === undefined) {
    risks.push("latest publish date is unknown");
  } else if (ageDays > 730) {
    risks.push(`latest release is over two years old (${Math.round(ageDays)} days)`);
  } else if (ageDays > 365) {
    risks.push(`latest release is over one year old (${Math.round(ageDays)} days)`);
  }

  if (input.dependencyCount > 50) {
    risks.push(`large dependency surface (${input.dependencyCount} direct dependencies)`);
  }

  return risks;
}

function maintenanceStatusFor(publishedAt: string | undefined, now: Date): "active" | "stale" | "inactive" | "unknown" {
  const ageDays = ageInDays(publishedAt, now);

  if (ageDays === undefined) {
    return "unknown";
  }

  if (ageDays <= 365) {
    return "active";
  }

  if (ageDays <= 730) {
    return "stale";
  }

  return "inactive";
}

function recommendationFor(
  risks: string[],
  status: "active" | "stale" | "inactive" | "unknown",
  license: string | undefined
): "use" | "avoid" | "spike" {
  if (risks.some((risk) => risk.includes("deprecated")) || status === "inactive") {
    return "avoid";
  }

  if (!license || status === "stale" || status === "unknown" || risks.length > 0) {
    return "spike";
  }

  return "use";
}

function rationaleFor(
  recommendation: "use" | "avoid" | "spike",
  risks: string[],
  status: "active" | "stale" | "inactive" | "unknown"
): string {
  if (recommendation === "use") {
    return "npm metadata indicates a licensed, recently maintained package with no obvious MVP-blocking risk.";
  }

  if (recommendation === "avoid") {
    return `Avoid by default because maintenance status is ${status}${risks.length > 0 ? ` and risks were found: ${risks.join("; ")}` : ""}.`;
  }

  return `Run a focused spike before adopting because maintenance status is ${status}${risks.length > 0 ? ` and risks were found: ${risks.join("; ")}` : ""}.`;
}

function fallbackReview(packageName: string, useCase: string, reason: string): DependencyReviewInput {
  return {
    packageName,
    useCase,
    maintenance: {
      status: "unknown"
    },
    risks: [reason],
    alternatives: [],
    recommendation: "spike",
    rationale: "Registry metadata could not be confirmed, so this dependency should not be adopted blindly.",
    evidence: [
      {
        url: `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        note: "npm registry metadata lookup attempted"
      }
    ]
  };
}

function ageInDays(value: string | undefined, now: Date): number | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return (now.getTime() - timestamp) / 86_400_000;
}
