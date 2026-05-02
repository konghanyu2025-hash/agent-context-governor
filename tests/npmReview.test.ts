import { describe, expect, it } from "vitest";
import { reviewNpmPackage } from "../src/review/npmReview.js";

describe("reviewNpmPackage", () => {
  it("recommends use for a licensed active package with no dependencies", async () => {
    const review = await reviewNpmPackage("example-use", "test package", {
      now: new Date("2026-05-03T00:00:00.000Z"),
      fetchImpl: fakeRegistry({
        name: "example-use",
        "dist-tags": { latest: "1.0.0" },
        time: { "1.0.0": "2026-04-01T00:00:00.000Z" },
        versions: {
          "1.0.0": {
            license: "MIT"
          }
        }
      })
    });

    expect(review.recommendation).toBe("use");
    expect(review.maintenance?.status).toBe("active");
  });

  it("recommends spike for missing license or stale metadata", async () => {
    const review = await reviewNpmPackage("example-spike", "test package", {
      now: new Date("2026-05-03T00:00:00.000Z"),
      fetchImpl: fakeRegistry({
        name: "example-spike",
        "dist-tags": { latest: "1.0.0" },
        time: { "1.0.0": "2025-01-01T00:00:00.000Z" },
        versions: {
          "1.0.0": {}
        }
      })
    });

    expect(review.recommendation).toBe("spike");
    expect(review.risks?.join(" ")).toContain("license");
  });

  it("recommends avoid for deprecated packages", async () => {
    const review = await reviewNpmPackage("example-avoid", "test package", {
      now: new Date("2026-05-03T00:00:00.000Z"),
      fetchImpl: fakeRegistry({
        name: "example-avoid",
        "dist-tags": { latest: "1.0.0" },
        time: { "1.0.0": "2026-04-01T00:00:00.000Z" },
        versions: {
          "1.0.0": {
            license: "MIT",
            deprecated: "Use another package"
          }
        }
      })
    });

    expect(review.recommendation).toBe("avoid");
  });
});

function fakeRegistry(metadata: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(metadata), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
}
