import { z } from "../zod.ts"
import { mergeParts, plainText, withMeta, type ObjectField } from "./core.ts"

// --- Jurisdiction ---

const stateCode = z.enum(
  [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ],
  "Pick a US state."
)
export type StateCode = z.infer<typeof stateCode>

const STATES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
} as const satisfies Record<StateCode, string>

const courtLocation = plainText(100)
const region = plainText(100)

type JurisdictionConfig = { label: string; help: string; optional?: boolean }

// The courts sit in the governing-law place by construction, so the spec's
// "court must match the governing-law state" rule can't be broken.
const courts = (location: string | undefined, place: string | undefined) =>
  location && place ? `courts located in ${location}, ${place}` : null

/** For terms that say "the laws of the State of …": a US state only. */
function usJurisdiction(config: JurisdictionConfig) {
  const base = z.strictObject({ state: stateCode, courtLocation })
  type Value = z.infer<typeof base>
  const draftSchema = withMeta(base.exactPartial(), config)
  type Draft = z.infer<typeof draftSchema>
  return {
    kind: "jurisdiction",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: undefined,
    subfields: { state: "State", courtLocation: "Courts" },
    schema: withMeta(base, config),
    draftSchema,
    changeSchema: withMeta(
      z
        .strictObject({
          state: stateCode.nullable(),
          courtLocation: courtLocation.nullable(),
        })
        .exactPartial(),
      config
    ),
    merge: mergeParts,
    format: (value) => (value.state ? STATES[value.state] : null),
    formatPath: (value, part) =>
      part === "state"
        ? value.state
          ? STATES[value.state]
          : null
        : courts(value.courtLocation, value.state),
  } satisfies ObjectField<"jurisdiction", Value, Draft>
}

/**
 * A US state or a province or country ("Ontario, Canada"), as Common Paper's
 * cover pages allow. Picking one kind of place clears the other.
 */
function worldJurisdiction(config: JurisdictionConfig) {
  const base = z.strictObject({
    state: stateCode.exactOptional(),
    region: region.exactOptional(),
    courtLocation,
  })
  type Value = z.infer<typeof base>
  const onePlace = {
    message: "Pick a US state, or a province or country, not both.",
    path: ["state"],
  }
  const draftSchema = withMeta(
    base
      .exactPartial()
      .refine(
        (value) => value.state === undefined || value.region === undefined,
        onePlace
      ),
    config
  )
  type Draft = z.infer<typeof draftSchema>
  const placeOf = (value: Draft) =>
    value.state ? STATES[value.state] : value.region
  return {
    kind: "jurisdiction",
    label: config.label,
    help: config.help,
    optional: config.optional ?? false,
    default: undefined,
    subfields: {
      state: "State",
      region: "Province or country",
      courtLocation: "Courts",
    },
    schema: withMeta(
      base.refine(
        (value) => (value.state === undefined) !== (value.region === undefined),
        onePlace
      ),
      config
    ),
    draftSchema,
    changeSchema: withMeta(
      z
        .strictObject({
          state: stateCode.nullable(),
          region: region.nullable(),
          courtLocation: courtLocation.nullable(),
        })
        .exactPartial(),
      config
    ),
    merge(current, change) {
      if (change === null) return undefined
      const swap =
        change.state != null
          ? { region: null }
          : change.region != null
            ? { state: null }
            : {}
      return mergeParts(current, { ...swap, ...change })
    },
    format: (value) => placeOf(value) ?? null,
    formatPath(value, part) {
      if (part === "state") return value.state ? STATES[value.state] : null
      if (part === "region") return value.region ?? null
      return courts(value.courtLocation, value.state ?? value.region)
    },
  } satisfies ObjectField<"jurisdiction", Value, Draft>
}

export function jurisdiction(
  config: JurisdictionConfig & { usOnly: true }
): ReturnType<typeof usJurisdiction>
export function jurisdiction(
  config: JurisdictionConfig & { usOnly?: false }
): ReturnType<typeof worldJurisdiction>
export function jurisdiction(
  config: JurisdictionConfig & { usOnly?: boolean }
) {
  return config.usOnly ? usJurisdiction(config) : worldJurisdiction(config)
}
