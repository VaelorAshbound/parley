import catalog from "../../generated/catalog.ts"
import template from "../../generated/ai-addendum.ts"
import { defineDocument } from "../define.ts"
import { field } from "../fields.ts"
import { link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official AI Addendum cover page. Notes, sources and
// every deviation: work/PAR-1/cover-pages/ai-addendum.md.

const OFFICIAL_PAGE = "https://commonpaper.com/standards/ai-addendum/"
const STANDARD_TERMS = "https://commonpaper.com/standards/ai-addendum/1.0/"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

const claimText = (label: string) =>
  field.longText({
    label,
    help: "The rest of the sentence, starting with “that”.",
  })

export const aiAddendum = defineDocument({
  id: "ai-addendum",
  version: 1,
  name: catalog["ai-addendum"].name,
  template,
  fields: {
    agreement: field.text({
      label: "Description of Agreement",
      help: "The signed CSA or software license this addendum changes.",
    }),
    trainingData: field.choices({
      label: "Training data",
      help: "Which customer data the provider may train models on.",
      exclusive: ["none"],
      allowOther: true,
      options: {
        none: { label: "None" },
        usageData: { label: "Usage Data" },
        feedback: { label: "Feedback" },
        input: { label: "Input" },
        output: { label: "Output" },
        userPrompts: {
          label: "User prompts, excluding other components of Input",
        },
        customerContent: { label: "Customer Content" },
      },
    }),
    // One pick, not checkboxes as on the official page: "solely for
    // Customer's benefit" narrows the other option, so both make no sense.
    trainingPurposes: field.choice({
      label: "Training purposes",
      help: "What the trained models may be used for.",
      options: {
        none: { label: "None" },
        customerOnly: {
          label:
            "Train the Model(s) in the AI Services solely for Customer’s benefit",
        },
        general: { label: "Train the Model(s) in the AI Services" },
      },
    }),
    trainingRestrictions: field.choices({
      label: "Training restrictions",
      help: "What must happen to the data before training.",
      exclusive: ["none"],
      allowOther: true,
      options: {
        none: { label: "None" },
        aggregated: { label: "Training Data must be aggregated" },
        deidentified: { label: "Training Data must be de-identified" },
        deidentifyEfforts: {
          label:
            "Provider will use commercially reasonable efforts consistent with industry standard technology to de-identify Training Data",
        },
      },
    }),
    improvementRestrictions: field.choices({
      label: "Improvement restrictions",
      help: "Limits on using customer data to improve the product.",
      exclusive: ["none"],
      allowOther: true,
      options: {
        none: { label: "None" },
        noIdentify: { label: "Neither Input nor Output may identify Customer" },
        customerOnly: {
          label:
            "Improvements based on Customer’s Input, Output, or Training Data will be solely for Customer’s benefit",
        },
      },
    }),
    coveredClaims: field.choices({
      label: "Covered claims",
      help: "AI claims each side defends the other against.",
      exclusive: ["none"],
      options: {
        none: { label: "None" },
        provider: {
          label:
            "Provider Covered Claims include any action, proceeding, or claim that the Output—when generated and used by Customer according to the terms of the Agreement and the AI Addendum—violates, misappropriates, or otherwise infringes upon the intellectual property or other proprietary rights of another person or entity. Without limiting the indemnity exclusions in the Agreement, Provider’s obligations as an Indemnifying Party will not apply to Provider Covered Claims that result from: (a) use of Output in combination with data, software, hardware, equipment, technology, or other products or services not provided by Provider; (b) Input; (c) Customer’s use of the AI Services in breach of the Agreement or the AI Addendum; (d) modifications to the Output that were not made by Provider; (e) Output that Customer knew or should have known might violate, misappropriate, or otherwise infringe upon another’s intellectual property or other proprietary rights; or (f) a claim that use of Output infringes another’s trademark or related rights.",
        },
        providerCustom: {
          label:
            "Provider Covered Claims include any action, proceeding, or claim {value}",
          with: claimText("Provider covered claims"),
        },
        customer: {
          label:
            "Customer Covered Claims include any action, proceeding, or claim that (1) the Input—when used by Provider according to the terms of the Agreement and the AI Addendum—violates, misappropriates, or otherwise infringes upon the intellectual property or other proprietary rights of another person or entity; or (2) results from Customer’s use of the AI Services in violation of the applicable restrictions in the Agreement or the AI Addendum.",
        },
        customerCustom: {
          label:
            "Customer Covered Claims include any action, proceeding, or claim {value}",
          with: claimText("Customer covered claims"),
        },
      },
    }),
    acceptableUsePolicy: field.choice({
      label: "AI acceptable use policy",
      help: "Rules for how users may use the AI features.",
      options: {
        none: { label: "None" },
        policy: {
          label:
            "Use of the AI Services is subject to the Acceptable Use Policy {value}",
          with: field.text({
            label: "Where to find it",
            help: "Like “available at https://…” or “attached to this Cover Page”.",
          }),
        },
      },
    }),
    provider: field.party({
      label: "Provider",
      help: "The company providing the AI Services.",
    }),
    customer: field.party({
      label: "Customer",
      help: "The company using the AI Services.",
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Customer: "customer.company",
    "Training Data": "trainingData",
    "Training Purposes": "trainingPurposes",
    "Training Restrictions": "trainingRestrictions",
    "Improvement Restrictions": "improvementRestrictions",
  },
  coverPage: {
    source: "parley",
    title: "AI Addendum",
    intro: [
      paragraph(
        "This Cover Page incorporates the Common Paper AI Addendum Standard Terms Version 1.0 available at ",
        link(STANDARD_TERMS, STANDARD_TERMS),
        " with the Variables set forth below (collectively, the “AI Addendum”). A copy of the AI Addendum Standard Terms is attached for convenience only."
      ),
      paragraph(
        "This AI Addendum amends and is incorporated into the “Agreement” described below. Undefined capitalized words have the meanings or descriptions given in the Agreement. If there is any inconsistency between this AI Addendum and the Agreement, the AI Addendum will control for the provision of AI Services. If there is any inconsistency between this Cover Page and the AI Addendum Standard Terms, this Cover Page will control."
      ),
    ],
    sections: [
      {
        heading: "Agreement",
        hint: "The signed agreement this AI Addendum amends",
        field: "agreement",
      },
      {
        heading: "Training Data",
        hint: "Provider may Train the Model(s) using the following Training Data:",
        field: "trainingData",
      },
      {
        heading: "Training Purposes",
        hint: "Permitted Model Training. Provider may use Training Data for the following purpose:",
        field: "trainingPurposes",
      },
      {
        heading: "Training Restrictions",
        hint: "Restrictions on Model Training",
        field: "trainingRestrictions",
      },
      {
        heading: "Improvement Restrictions",
        hint: "For improvements to the AI System (but not any Models)",
        field: "improvementRestrictions",
      },
      {
        heading: "Covered Claims",
        hint: "Claims covered by indemnity obligations",
        field: "coveredClaims",
      },
      { heading: "AI Acceptable Use Policy", field: "acceptableUsePolicy" },
    ],
    closing: [
      paragraph(
        "By signing this Cover Page, each party agrees to enter into this AI Addendum."
      ),
    ],
    signatures: ["provider", "customer"],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link("AI Addendum cover page", OFFICIAL_PAGE),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper AI Addendum Standard Terms (Version 1.0) free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
    ],
  },
  rules: (values, issue, phase) => {
    const company = (name?: string) => name?.trim().toLowerCase()
    const provider = company(values.provider?.company)
    if (
      provider !== undefined &&
      provider === company(values.customer?.company)
    )
      issue(
        "customer",
        "The provider and the customer must be different companies."
      )

    const claims = new Set(
      values.coveredClaims?.selected.map((pick) => pick.option)
    )
    if (claims.has("provider") && claims.has("providerCustom"))
      issue("coveredClaims", "Pick one version of the Provider Covered Claims.")
    if (claims.has("customer") && claims.has("customerCustom"))
      issue("coveredClaims", "Pick one version of the Customer Covered Claims.")

    // 1.3 allows training only when the page names both the data and the
    // purpose, so a finished page with one of them reads like a grant it isn't.
    const { trainingData: data, trainingPurposes: purpose } = values
    if (phase !== "complete" || !data || !purpose) return
    const hasData =
      data.other !== undefined ||
      data.selected.some((pick) => pick.option !== "none")
    const hasPurpose = purpose.option !== "none"
    if (hasData && !hasPurpose)
      issue(
        "trainingPurposes",
        "Training data is picked, so pick a training purpose, or set Training data to None."
      )
    if (hasPurpose && !hasData)
      issue(
        "trainingData",
        "A training purpose is picked, so pick the training data, or set Training purposes to None."
      )
  },
})
