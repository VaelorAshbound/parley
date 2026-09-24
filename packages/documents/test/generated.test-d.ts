import { expectTypeOf, test } from "vite-plus/test"

import aiAddendum from "../generated/ai-addendum.ts"
import baa from "../generated/baa.ts"
import csa from "../generated/csa.ts"
import designPartnerAgreement from "../generated/design-partner-agreement.ts"
import dpa from "../generated/dpa.ts"
import mutualNdaCoverpage from "../generated/mutual-nda-coverpage.ts"
import mutualNda from "../generated/mutual-nda.ts"
import partnershipAgreement from "../generated/partnership-agreement.ts"
import pilotAgreement from "../generated/pilot-agreement.ts"
import psa from "../generated/psa.ts"
import sla from "../generated/sla.ts"
import softwareLicenseAgreement from "../generated/software-license-agreement.ts"
import type { CoverPage, StandardTerms } from "../src/parse/schema.ts"

// generated/ is git-ignored, so lint never type-checks it. Importing every
// module here makes the type test compile them, so a tree that no longer
// fits the schema's type fails `pnpm test`.
test("every generated template has its schema's type", () => {
  for (const template of [
    aiAddendum,
    baa,
    csa,
    designPartnerAgreement,
    dpa,
    mutualNda,
    partnershipAgreement,
    pilotAgreement,
    psa,
    sla,
    softwareLicenseAgreement,
  ])
    expectTypeOf(template).toEqualTypeOf<StandardTerms>()
  expectTypeOf(mutualNdaCoverpage).toEqualTypeOf<CoverPage>()
})
