import catalog from "../../generated/catalog.ts"
import template from "../../generated/baa.ts"
import { defineDocument } from "../define.ts"
import { field, type Duration } from "../fields.ts"
import { link, paragraph } from "./prose.ts"

// Mirrors Common Paper's official BAA 1.0 cover page. Notes and judgment
// calls: work/PAR-1/cover-pages/baa.md.

const STANDARD_TERMS =
  "https://commonpaper.com/standards/business-associate-agreement/1.0"
const COVER_PAGE =
  "https://commonpaper.com/standards/business-associate-agreement/1.0/cover-page-docx"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

/**
 * The longest Breach Notification Period in each unit. The official page says
 * "cannot be more than 60 calendar days" (45 CFR §164.410(b)). 38 US business
 * days never run past 60 calendar days, even over the year-end holidays. The
 * field offers only hours, business days and calendar days; the table covers
 * every unit because the duration's type does not narrow with `units`.
 */
const MAX_BREACH_NOTICE: Record<Duration["unit"], number> = {
  minutes: 86_400,
  hours: 1440,
  days: 60,
  businessDays: 38,
  calendarDays: 60,
  weeks: 8,
  months: 1,
  quarters: 0,
  years: 0,
}

export const baa = defineDocument({
  id: "baa",
  version: 1,
  name: catalog.baa.name,
  template,
  fields: {
    agreement: field.text({
      label: "Agreement",
      help: "The main contract this BAA is part of.",
    }),
    // Two pickers, as on the official page. Each option holds the whole line,
    // since a choice's row can't take a template.
    // "Provider is a [ subcontractor | Business Associate ]": a pick in a
    // blank, so a select inside the official sentence.
    providerRole: field.select({
      label: "Provider's role",
      help: "Provider's role under HIPAA.",
      options: {
        subcontractor: "subcontractor",
        businessAssociate: "Business Associate",
      },
    }),
    companyRole: field.select({
      label: "Company's role",
      help: "Company's role under HIPAA.",
      options: {
        businessAssociate: "Business Associate",
        coveredEntity: "Covered Entity",
      },
    }),
    breachNotificationPeriod: field.duration({
      label: "Breach notification period",
      help: "How fast Provider must report a breach. 60 calendar days at most.",
      units: ["hours", "businessDays", "calendarDays"],
    }),
    designatedRecordSet: field.choice({
      label: "Designated record set",
      help: "Does Provider keep PHI records patients can ask to see or fix?",
      options: {
        maintains: {
          label: "Provider maintains PHI in a Designated Record Set.",
        },
        doesNotMaintain: {
          label: "Provider does not maintain PHI in a Designated Record Set.",
        },
      },
    }),

    // --- Limitations ---
    // Common Paper deletes a row to allow the activity as the Standard Terms
    // do; an explicit "no limitation" keeps that answer on the page.
    subcontracting: field.choice({
      label: "Subcontracting",
      help: "Whether Provider may share PHI with its own vendors.",
      options: {
        noLimitation: {
          label:
            "No limitation. Section 1.7 of the BAA Standard Terms applies.",
        },
        never: { label: "Provider will not subcontract." },
        unless: {
          label: "Provider will not subcontract unless: {value}",
          with: field.choices({
            label: "Subcontracting conditions",
            help: "When Provider may subcontract: after notice, or with permission.",
            options: {
              notice: {
                label:
                  "notice has been provided to Company as specified here: {value}",
                with: field.longText({
                  label: "Notice",
                  help: "How and when Provider tells Company first.",
                }),
              },
              permission: {
                label:
                  "with Company’s explicit permission as specified here: {value}",
                with: field.longText({
                  label: "Permission",
                  help: "How Company gives its permission.",
                }),
              },
            },
          }),
        },
      },
    }),
    offshoring: field.choice({
      label: "Offshoring",
      help: "Whether Provider may use or send PHI outside the United States.",
      options: {
        noLimitation: {
          label:
            "No limitation. Section 3.1 of the BAA Standard Terms applies.",
        },
        never: {
          label: "Offshoring of PHI and/or Services is not permitted.",
        },
        unless: {
          label:
            "Offshoring of PHI and/or Services not permitted unless {value}",
          with: field.longText({
            label: "Offshoring terms",
            help: "The specific offshoring rights or restrictions.",
          }),
        },
      },
    }),
    deidentification: field.choice({
      label: "De-identification",
      help: "Whether Provider may strip identifiers from PHI.",
      options: {
        noLimitation: {
          label:
            "No limitation. Section 3.2 of the BAA Standard Terms applies.",
        },
        never: { label: "Provider will not de-identify PHI." },
        unless: {
          label: "Provider will not de-identify PHI unless: {value}",
          with: field.choices({
            label: "De-identification conditions",
            help: "When Provider may de-identify: for a purpose, or with requirements.",
            options: {
              purpose: {
                label: "doing so for the specific purpose of {value}",
                with: field.text({
                  label: "Purpose",
                  help: "Such as “generating data analytics for academic research”.",
                }),
              },
              requirements: {
                label:
                  "the following additional requirements for de-identifying PHI have been implemented: {value}",
                with: field.longText({
                  label: "Requirements",
                  help: "The extra steps Provider takes before de-identifying PHI.",
                }),
              },
            },
          }),
        },
      },
    }),
    aggregation: field.choice({
      label: "Aggregation",
      help: "Whether Provider may combine PHI for its own purposes.",
      options: {
        noLimitation: {
          label:
            "No limitation. Section 3.3 of the BAA Standard Terms applies.",
        },
        never: { label: "Provider will not aggregate PHI." },
        unless: {
          label: "Provider will not aggregate PHI unless {value}",
          with: field.longText({
            label: "Aggregation terms",
            help: "The specific aggregation restrictions.",
          }),
        },
      },
    }),

    effectiveDate: field.choice({
      label: "BAA effective date",
      help: "The day the BAA starts.",
      options: {
        lastSignature: { label: "Date of last signature on this Cover Page" },
        custom: {
          label: "{value}",
          with: field.date({
            label: "Custom effective date",
            help: "The day the BAA starts, if not the last signature.",
          }),
        },
      },
      default: { option: "lastSignature" },
    }),
    modifications: field.longText({
      label: "Other changes",
      help: "List any changes to the BAA Standard Terms.",
      optional: true,
    }),
    provider: field.party({
      label: "Provider",
      help: "The vendor that handles PHI for Company.",
    }),
    company: field.party({
      label: "Company",
      help: "The covered entity, or business associate, sharing PHI with Provider.",
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Company: "company.company",
    Agreement: "agreement",
    Limitations: [
      "subcontracting",
      "offshoring",
      "deidentification",
      "aggregation",
    ],
    "Breach Notification Period": "breachNotificationPeriod",
    "BAA Effective Date": "effectiveDate",
  },
  coverPage: {
    source: "parley",
    title: "Business Associate Agreement",
    subtitle: "USING THIS BAA",
    intro: [
      paragraph(
        "This BAA has 2 parts: (1) the Key Terms on this Cover Page and (2) the Common Paper BAA Standard Terms Version 1.0 posted at ",
        link(STANDARD_TERMS, STANDARD_TERMS),
        ", which is incorporated by reference. Any modifications to the BAA Standard Terms should be made on the Cover Page. If there is any inconsistency between the parts of the BAA, the Cover Page will control over the BAA Standard Terms. Capitalized words have the meanings or descriptions given in the Cover Page or Standard Terms."
      ),
    ],
    sections: [
      { heading: "Key Terms", part: true },
      {
        heading: "Agreement",
        field: "agreement",
        template: "This BAA is incorporated into the {value}",
      },
      {
        heading: "Relationship",
        lines: [
          { field: "providerRole", template: "Provider is a {value}" },
          { field: "companyRole", template: "Company is a {value}" },
        ],
      },
      {
        heading: "Breach Notification Period",
        hint: "This time period cannot be more than 60 calendar days.",
        field: "breachNotificationPeriod",
        template: "{value} from discovery",
      },
      { heading: "Designated Record Set", field: "designatedRecordSet" },
      {
        heading: "Limitations",
        hint: "The Standard Terms permit all four activities (Sections 1.7 and 3).",
        lines: [
          { label: "Subcontracting", field: "subcontracting" },
          { label: "Offshoring", field: "offshoring" },
          { label: "De-identification", field: "deidentification" },
          { label: "Aggregation", field: "aggregation" },
        ],
      },
      {
        heading: "BAA Effective Date",
        hint: "The date the BAA starts",
        field: "effectiveDate",
      },
      { heading: "Changes to BAA Standard Terms", part: true },
      {
        heading: "Other Changes to BAA Standard Terms",
        hint: "Additional modifications or customizations",
        field: "modifications",
      },
    ],
    closing: [
      paragraph(
        "Provider and Company have not changed the BAA Standard Terms except for the details on the Cover Page above. By signing this Cover Page, each party agrees to enter into this BAA as of the BAA Effective Date."
      ),
    ],
    // The official rows match the default ones (Signature, Print Name, Title,
    // Company, Notice Address, Date); its header names each company.
    signatures: ["provider", "company"],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link("Business Associate Agreement cover page", COVER_PAGE),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper Business Associate Agreement Standard Terms (Version 1.0) free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
    ],
  },
  rules: (values, issue, phase) => {
    const company = (name?: string) => name?.trim().toLowerCase()
    const first = company(values.provider?.company)
    if (first !== undefined && first === company(values.company?.company))
      issue("company", "The two parties must be different companies.")

    const period = values.breachNotificationPeriod
    if (period && period.amount > MAX_BREACH_NOTICE[period.unit])
      issue(
        "breachNotificationPeriod",
        "At most 60 calendar days (38 business days or 1,440 hours)."
      )

    // HIPAA: a subcontractor works for a Business Associate. Checked only on
    // a complete document, so a draft can change the two roles one at a time.
    if (
      phase === "complete" &&
      values.providerRole === "subcontractor" &&
      values.companyRole === "coveredEntity"
    )
      issue(
        "companyRole",
        "A subcontractor works for a Business Associate, so Company is one."
      )
  },
})
