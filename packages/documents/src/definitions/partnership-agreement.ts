import catalog from "../../generated/catalog.ts"
import template from "../../generated/partnership-agreement.ts"
import { defineDocument } from "../define.ts"
import { field } from "../fields.ts"
import { link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official Partnership Agreement cover page. The
// template names itself Version 1.0 (13.19), so the page cites 1.0, although
// its text carries the 1.1 fixes (work/PAR-1/cover-pages/partnership-agreement.md).

const STANDARD_TERMS =
  "https://commonpaper.com/standards/partnership-agreement/1.0"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

const TWELVE_MONTHS_OF_FEES =
  "the fees paid or payable under the Agreement in the 12 month period immediately before the claim"

const details = (label: string, help: string) => field.longText({ label, help })

/** One party's Obligations; `self` does them, `other` is the other party. */
const obligations = (
  self: "Company" | "Partner",
  other: "Company" | "Partner"
) =>
  field.choices({
    label: `${self} will`,
    help: `What the ${self} does in this partnership.`,
    options: {
      promoActivities: {
        label: "Engage in the following promotional activities: {value}",
        with: details("Promotional activities", "The promotion to do."),
      },
      promoMaterials: {
        label: "Provide the following promotional materials: {value}",
        with: details("Promotional materials", "The materials to provide."),
      },
      sponsoredBenefits: {
        label: "Provide the following sponsored benefits: {value}",
        with: details("Sponsored benefits", "The benefits to provide."),
      },
      referrals: {
        label: `Make Referrals to ${other}. A “Referral” to ${other} is a third party that meets all the following criteria: {value}`,
        with: details(
          "Referral criteria",
          "What makes a third party a Referral."
        ),
      },
      payment: {
        label: `Pay ${other} the following amount according to the Payment Schedule: {value}`,
        with: details(
          "Payment amount",
          "The amount and currency, like $2,000 per quarter."
        ),
      },
      brandElements: {
        label: `Provide ${self}’s Brand Elements as Licensor`,
      },
      none: { label: "None" },
    },
    exclusive: ["none"],
  })

/** One party's indemnity (the Committee's default wording, or custom). */
const coveredClaim = (self: "Company" | "Partner", other: string) =>
  field.choice({
    label: `${self} covered claims`,
    help: `Claims the ${self} will defend the ${other} against.`,
    options: {
      standard: {
        label: `Any action, suit, proceeding, or claim that arises out of or relates to (a) ${self}’s gross negligence or willful misconduct; or (b) ${self}’s breach or alleged breach of its representations and warranties in Section 7, including the intellectual property representations or warranties.`,
      },
      custom: {
        label:
          "Any action, suit, proceeding, or claim that arises out of or relates to {value}",
        with: details("Covered claims", "The claims this party covers."),
      },
      none: { label: "None" },
    },
  })

const multiple = () =>
  field.number({
    label: "Multiple of fees",
    help: "How many times the fees, like 2 for 2x.",
    min: 0,
    minExclusive: true,
    max: 100,
    decimals: 2,
  })

/**
 * The General and Increased Cap Amount options, in the official wording. The
 * two official rows differ in one word: "or [#] times" and "or [#]x".
 */
const capOptions = (times: " times" | "x") => ({
  multiple: {
    label: `{value} times ${TWELVE_MONTHS_OF_FEES}`,
    with: multiple(),
  },
  fixed: {
    label: "{value}",
    with: field.money({
      label: "Cap amount",
      help: "A fixed amount, like $100,000.",
    }),
  },
  greater: {
    label: `The greater of {amount} or {multiple}${times} ${TWELVE_MONTHS_OF_FEES}`,
    blanks: {
      amount: field.money({
        label: "Minimum cap",
        help: "The lowest the cap can be, like $100,000.",
      }),
      multiple: multiple(),
    },
  },
})

/** Increased and Unlimited Claims share their option keys, not their order. */
const CLAIMS = {
  confidentiality: { label: "Breach of Section 11 (Confidentiality)" },
  indemnity: {
    label:
      "An Indemnifying Party’s indemnification obligations for its Covered Claims",
  },
  confidentialityMisconduct: {
    label:
      "Breach of Section 11 (Confidentiality) resulting from gross negligence or willful misconduct",
  },
  misconduct: {
    label:
      "Claims resulting from a party’s gross negligence or willful misconduct",
  },
  none: { label: "None" },
}

export const partnershipAgreement = defineDocument({
  id: "partnership-agreement",
  version: 1,
  name: catalog["partnership-agreement"].name,
  template,
  fields: {
    companyObligations: obligations("Company", "Partner"),
    partnerObligations: obligations("Partner", "Company"),
    territory: field.choice({
      label: "Territory",
      help: "Where the partnership activities happen.",
      options: {
        worldwide: { label: "Worldwide" },
        areas: {
          label: "{value}",
          with: field.text({
            label: "Geographic areas",
            help: "The specific areas, like the United States and Canada.",
          }),
        },
      },
      default: { option: "worldwide" },
    }),
    paymentProcess: field.choices({
      label: "Payment process",
      help: "Where each party sends invoices for Fees.",
      options: {
        companyBills: {
          label:
            "Company will send invoices or bills for Fees owed by Partner to: {value}",
          with: field.text({
            label: "Partner billing contact",
            help: "The person or email address that gets the Partner's bills.",
          }),
        },
        partnerBills: {
          label:
            "Partner will send invoices or bills for Fees owed by Company to: {value}",
          with: field.text({
            label: "Company billing contact",
            help: "The person or email address that gets the Company's bills.",
          }),
        },
        none: { label: "None" },
      },
      exclusive: ["none"],
    }),
    paymentSchedule: field.choice({
      label: "Payment schedule",
      help: "When the paying party pays, if any Obligation is a payment.",
      options: {
        schedule: {
          label:
            "The party making payment will pay the other party according to the following schedule: {value}",
          with: details(
            "Schedule",
            "Like 30 days from receipt of invoice, or 60 days before the event."
          ),
        },
        none: { label: "None" },
      },
    }),
    endDate: field.choice({
      label: "End date",
      help: "When this Agreement ends. There is no termination for convenience.",
      options: {
        afterEffective: {
          label: "{value} after the Effective Date",
          with: field.duration({
            label: "Length",
            help: "How long after the Effective Date the Agreement ends.",
            units: ["days", "weeks", "months", "years"],
          }),
        },
        custom: {
          label: "{value}",
          with: field.text({
            label: "Custom end date",
            help: "A date, or words like Until terminated by either party.",
          }),
        },
      },
      default: { option: "afterEffective" },
    }),
    effectiveDate: field.choice({
      label: "Effective date",
      help: "The date this Agreement starts.",
      options: {
        lastSignature: { label: "Date of last signature on this Cover Page" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Custom Effective Date",
            help: "The day the Agreement starts.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    governingLaw: field.jurisdiction({
      label: "Governing law & courts",
      help: "Whose laws apply, and where disputes are filed.",
      courts: "anywhere",
    }),
    companyCoveredClaim: coveredClaim("Company", "Partner"),
    partnerCoveredClaim: coveredClaim("Partner", "Company"),
    // Required with no default: an empty cap means no limitation of liability.
    generalCap: field.choice({
      label: "General cap amount",
      help: "The most either party can owe for most claims.",
      options: capOptions(" times"),
    }),
    increasedClaims: field.choices({
      label: "Increased claims",
      help: "Claims with a higher liability cap, the Increased Cap Amount.",
      options: CLAIMS,
      allowOther: true,
      longOther: true,
      exclusive: ["none"],
    }),
    increasedCap: field.choice({
      label: "Increased cap amount",
      help: "The higher liability limit for Increased Claims.",
      options: { ...capOptions("x"), none: { label: "None" } },
    }),
    unlimitedClaims: field.choices({
      label: "Unlimited claims",
      help: "Claims with no liability cap at all.",
      options: {
        indemnity: CLAIMS.indemnity,
        confidentiality: CLAIMS.confidentiality,
        confidentialityMisconduct: CLAIMS.confidentialityMisconduct,
        misconduct: CLAIMS.misconduct,
        none: CLAIMS.none,
      },
      allowOther: true,
      longOther: true,
      exclusive: ["none"],
    }),
    additionalWarranties: field.choices({
      label: "Additional warranties",
      help: "Extra promises beyond those in Section 7.",
      options: {
        byCompany: {
          label: "By Company: {value}",
          with: details("Company warranties", "What the Company promises."),
        },
        byPartner: {
          label: "By Partner: {value}",
          with: details("Partner warranties", "What the Partner promises."),
        },
        none: { label: "None" },
      },
      exclusive: ["none"],
    }),
    dpa: field.text({
      label: "DPA",
      help: "Attach or say where to find the data protection agreement.",
      optional: true,
    }),
    brandGuidelines: field.choices({
      label: "Brand guidelines",
      help: "Where to find each party's rules for using its brand.",
      options: {
        company: {
          label: "Company Brand Guidelines: {value}",
          with: field.text({
            label: "Company guidelines",
            help: "Attach or say where to find them.",
          }),
        },
        partner: {
          label: "Partner Brand Guidelines: {value}",
          with: field.text({
            label: "Partner guidelines",
            help: "Attach or say where to find them.",
          }),
        },
        none: { label: "None" },
      },
      exclusive: ["none"],
    }),
    modifications: field.longText({
      label: "Changes to standard terms",
      help: "List any changes to the Standard Terms.",
      optional: true,
    }),
    company: field.party({
      label: "Company",
      help: "One side of the partnership, often your company.",
    }),
    partner: field.party({
      label: "Partner",
      help: "The other company in the partnership.",
    }),
  },
  linkedTerms: {
    Company: "company.company",
    Partner: "partner.company",
    Obligations: ["companyObligations", "partnerObligations"],
    Territory: "territory",
    "Payment Process": "paymentProcess",
    "Payment Schedule": "paymentSchedule",
    "End Date": "endDate",
    "Effective Date": "effectiveDate",
    "Governing Law": "governingLaw",
    "Chosen Courts": "governingLaw.courtLocation",
    "Company Covered Claim": "companyCoveredClaim",
    "Partner Covered Claim": "partnerCoveredClaim",
    "Partner Covered Claims": "partnerCoveredClaim",
    "General Cap Amount": "generalCap",
    "Increased Claims": "increasedClaims",
    "Increased Cap Amount": "increasedCap",
    "Unlimited Claims": "unlimitedClaims",
    "Additional Warranties": "additionalWarranties",
    DPA: "dpa",
    "Brand Guidelines": "brandGuidelines",
  },
  coverPage: {
    source: "parley",
    title: "Partnership Agreement",
    subtitle: "USING THIS AGREEMENT",
    intro: [
      paragraph(
        "This Agreement has 2 parts: (1) this Cover Page, which includes Business Terms and legal Key Terms, and (2) the Common Paper Partnership Standard Terms Version 1.0 posted at ",
        link(
          "commonpaper.com/standards/partnership-agreement/1.0",
          STANDARD_TERMS
        ),
        ", which is incorporated by reference. If there is any inconsistency between the parts of the Agreement, the Cover Page will control over the Standard Terms. Variables have the meanings or descriptions given on the Cover Page. However, if the Cover Page omits or does not define a Variable, the default meaning will be “none” or “not applicable” and the correlating clause, sentence, or section does not apply to this Agreement. All other capitalized words have the meanings or descriptions given in the Standard Terms."
      ),
    ],
    sections: [
      {
        heading: "Business Terms",
        hint: "The key business terms of this Agreement are as follows:",
        part: true,
      },
      {
        heading: "Obligations",
        hint: "Company will:",
        field: "companyObligations",
      },
      {
        heading: "Obligations",
        hint: "Partner will:",
        field: "partnerObligations",
      },
      { heading: "Territory", field: "territory" },
      { heading: "Payment Process", field: "paymentProcess" },
      { heading: "Payment Schedule", field: "paymentSchedule" },
      {
        heading: "End Date",
        hint: "When this Agreement ends",
        field: "endDate",
      },
      {
        heading: "Key Terms",
        hint: "The key legal terms of this Agreement are as follows:",
        part: true,
      },
      {
        heading: "Effective Date",
        hint: "The date the Agreement starts",
        field: "effectiveDate",
      },
      {
        heading: "Governing Law",
        field: "governingLaw",
        template: "The laws of {value}",
      },
      {
        heading: "Chosen Courts",
        hint: "Jurisdiction or where disputes are filed",
        field: "governingLaw.courtLocation",
        template: "The {value}",
      },
      {
        heading: "Covered Claims",
        hint: "Claims covered by indemnity obligations",
        lines: [
          { label: "Company Covered Claim(s)", field: "companyCoveredClaim" },
          { label: "Partner Covered Claim(s)", field: "partnerCoveredClaim" },
        ],
      },
      {
        heading: "General Cap Amount",
        hint: "Limitation of liability amount for most claims",
        field: "generalCap",
      },
      {
        heading: "Increased Claims",
        hint: "Specific claims covered by the Increased Cap Amount",
        field: "increasedClaims",
      },
      {
        heading: "Increased Cap Amount",
        hint: "Higher limitation of liability amount for Increased Claims, often called a supercap",
        field: "increasedCap",
      },
      {
        heading: "Unlimited Claims",
        hint: "Claims excluded from any liability cap",
        field: "unlimitedClaims",
      },
      { heading: "Additional Warranties", field: "additionalWarranties" },
      { heading: "Attachments and Supplements", part: true },
      { heading: "DPA", hint: "Data Protection Agreement", field: "dpa" },
      { heading: "Brand Guidelines", field: "brandGuidelines" },
      { heading: "Changes to Standard Terms", part: true },
      {
        heading: "Changes to Standard Terms",
        hint: "List specific changes to the Standard Terms",
        field: "modifications",
      },
    ],
    closing: [
      paragraph(
        "Company and Partner have not changed the Standard Terms except for the details in the Cover Page above. By signing this Cover Page, each party agrees to enter the Agreement as of the Effective Date."
      ),
    ],
    signatures: ["company", "partner"],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link(
          "Partnership Agreement cover page",
          "https://commonpaper.com/standards/partnership-agreement/1.0/cover-page-docx"
        ),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper Partnership Standard Terms (Version 1.0) free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
    ],
  },
  rules: (values, issue) => {
    const company = (name?: string) => name?.trim().toLowerCase()
    const first = company(values.company?.company)
    if (first !== undefined && first === company(values.partner?.company))
      issue("partner", "The two parties must be different companies.")

    // Rules run on drafts, so each one waits until every value it reads is
    // there; otherwise it would block filling the page in order.
    const lists = [values.companyObligations, values.partnerObligations]
    const picks = lists.flatMap((list) =>
      (list?.selected ?? []).map((item) => item.option)
    )
    const bothAnswered = lists.every((list) => list !== undefined)
    const pays = picks.includes("payment")

    if (bothAnswered && picks.every((pick) => pick === "none"))
      issue(
        "partnerObligations",
        "Pick at least one Obligation for either party."
      )
    if (pays && values.paymentSchedule?.option === "none")
      issue(
        "paymentSchedule",
        "An Obligation is a payment, so fill in the Payment Schedule."
      )
    // Common Paper: "In general, a $0 liability cap would be unenforceable."
    const noFees =
      "No Obligation is a payment, so a cap tied to fees is $0. Pick a dollar amount."
    if (bothAnswered && !pays && values.generalCap?.option === "multiple")
      issue("generalCap", noFees)
    if (bothAnswered && !pays && values.increasedCap?.option === "multiple")
      issue("increasedCap", noFees)

    const cap = values.increasedCap
    if (cap?.option === "multiple" && cap.value === 1)
      issue("increasedCap", "Use a number other than 1.")
    const claims = values.increasedClaims
    if (claims !== undefined && cap !== undefined) {
      const noClaims = claims.selected.some((item) => item.option === "none")
      if (noClaims && cap.option !== "none")
        issue("increasedCap", "There are no Increased Claims, so pick None.")
      if (!noClaims && cap.option === "none")
        issue("increasedCap", "Pick a cap for the Increased Claims.")
    }
  },
})
