import { describe, expect, test } from "vite-plus/test"

import {
  hyperdriveOrigin,
  orphanedHyperdrives,
  previewNames,
  withPreviewDatabase,
} from "../scripts/preview-names.ts"

describe("previewNames", () => {
  test("names the Neon branch and Hyperdrive after the Preview's URL slug", () => {
    expect(previewNames("PAR-1-parley")).toEqual({
      slug: "par-1-parley",
      neonBranch: "preview/par-1-parley",
      hyperdrive: "parley-preview--par-1-parley",
    })
  })

  test("turns every character a URL can't hold into a dash, like e2e.yml", () => {
    expect(previewNames("feature/Share_links.v2").slug).toBe(
      "feature-share-links-v2"
    )
  })

  test("refuses an empty branch name", () => {
    expect(() => previewNames("")).toThrow("git branch")
  })
})

describe("withPreviewDatabase", () => {
  const config = {
    name: "parley",
    hyperdrive: [{ binding: "HYPERDRIVE", id: "production-id" }],
    previews: {
      vars: { STAGE: "preview" },
      hyperdrive: [
        {
          binding: "HYPERDRIVE",
          id: "shared-preview-id",
          localConnectionString: "postgres://localhost/parley",
        },
      ],
    },
  }

  test("points only the Preview's HYPERDRIVE at the branch's config", () => {
    const patched = withPreviewDatabase(config, "branch-id")

    expect(patched.previews.hyperdrive).toEqual([
      {
        binding: "HYPERDRIVE",
        id: "branch-id",
        localConnectionString: "postgres://localhost/parley",
      },
    ])
    expect(patched.hyperdrive).toEqual([
      { binding: "HYPERDRIVE", id: "production-id" },
    ])
  })

  test("leaves the config it was given as it was", () => {
    withPreviewDatabase(config, "branch-id")

    expect(config.previews.hyperdrive[0]?.id).toBe("shared-preview-id")
  })

  test("fails when the Preview has no HYPERDRIVE binding to replace", () => {
    expect(() =>
      withPreviewDatabase({ previews: { hyperdrive: [] } }, "branch-id")
    ).toThrow("previews.hyperdrive")
  })
})

describe("orphanedHyperdrives", () => {
  test("finds the per-branch configs whose Neon branch is gone", () => {
    const configs = [
      { id: "1", name: "parley" },
      { id: "2", name: "parley-preview" },
      { id: "3", name: "parley-preview--par-1-parley" },
      { id: "4", name: "parley-preview--old-branch" },
      { id: "5", name: "priced-e2e" },
    ]

    expect(
      orphanedHyperdrives(configs, [
        "production",
        "preview",
        "preview/par-1-parley",
      ])
    ).toEqual([{ id: "4", name: "parley-preview--old-branch" }])
  })
})

describe("hyperdriveOrigin", () => {
  test("splits a Neon URL into Hyperdrive's origin fields", () => {
    expect(
      hyperdriveOrigin(
        "postgresql://neondb_owner:p%40ss@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require"
      )
    ).toEqual({
      scheme: "postgresql",
      host: "ep-x.eu-central-1.aws.neon.tech",
      port: 5432,
      database: "neondb",
      user: "neondb_owner",
      password: "p@ss",
    })
  })
})
