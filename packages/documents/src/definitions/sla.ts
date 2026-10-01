import catalog from "../../generated/catalog.ts"
import template from "../../generated/sla.ts"
import { defineDocument } from "../define.ts"
import { field } from "../fields.ts"
import { link, paragraph } from "./prose.ts"

// Mirrors the SLA block of Common Paper's CSA Order Form, as a cover page of
// its own. Notes, sources and every deviation: work/PAR-1/cover-pages/sla.md.

const OFFICIAL_PAGE =
  "https://commonpaper.com/standards/service-level-agreement/"
const STANDARD_TERMS =
  "https://commonpaper.com/standards/service-level-agreement/2.0/"
const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

const blank = (label: string, help: string) => field.text({ label, help })

export const sla = defineDocument({
  id: "sla",
  version: 1,
  name: catalog.sla.name,
  template,
  fields: {
    agreement: field.text({
      label: "Description of Agreement",
      help: "The CSA and Order Form this SLA is added to.",
    }),
    // The official page's two "[ ]" boxes. Each target's details are blanks
    // inside it, so they are required once it is picked, and a finished page
    // needs at least one target (with neither, the SLA promises nothing).
    targets: field.choices({
      label: "Targets",
      help: "Uptime, support response time, or both.",
      options: {
        uptime: {
          label:
            "Target Uptime: {target}. Scheduled Downtime means time periods where the Cloud Service is not available to Customer: {downtime}",
          blanks: {
            target: field.percent({
              label: "Target uptime",
              help: "Like 99.9%. 99.999% is strong, 98% is lenient.",
              decimals: 3,
            }),
            downtime: field.choice({
              label: "Scheduled downtime",
              help: "Planned maintenance that doesn't count against uptime.",
              options: {
                none: { label: "None" },
                window: {
                  label:
                    "because Provider is performing routine or scheduled maintenance during the following time windows: {start} to {end} {timeZone} during {days}",
                  blanks: {
                    start: blank(
                      "Start time",
                      "When the maintenance window opens."
                    ),
                    end: blank(
                      "End time",
                      "When the maintenance window closes."
                    ),
                    timeZone: blank("Time zone", "Like Pacific Time."),
                    days: blank(
                      "Days of the week",
                      "Like Saturdays and Sundays."
                    ),
                  },
                },
                notice: {
                  label:
                    "following written notice (including by email, on the Cloud Service, or on Provider’s website) given at least {value} before the period of unavailability.",
                  with: field.duration({
                    label: "Notice",
                    help: "How much notice comes before planned downtime.",
                    units: ["hours", "days"],
                  }),
                },
              },
            }),
          },
        },
        response: {
          label:
            "Target Response Time: {time}. The Response Time Credit will be {credit} of the monthly Cloud Service Fee for each time Provider fails to meet the Target Response Time. Support Channel: {channel}",
          blanks: {
            time: field.duration({
              label: "Target response time",
              help: "30 minutes is strong, 2 days is lenient.",
              units: ["minutes", "hours", "days"],
            }),
            credit: field.percent({
              label: "Response time credit",
              help: "The credit each time a support reply is late.",
            }),
            channel: field.text({
              label: "How customers request support",
              help: "Like an email address or a help desk link.",
            }),
          },
        },
      },
    }),
    // A table can't be a blank, so it is its own row, required once an uptime
    // target is picked (see rules).
    uptimeCredit: field.list({
      label: "Uptime credit",
      help: "The credit for each band of uptime below the target.",
      optional: true,
      max: 10,
      item: {
        // The official column headers, kept as written.
        range: field.text({
          label: "Actual Uptime Percentage",
          help: "A band of uptime, like 99.0% to Target Uptime.",
        }),
        credit: field.percent({
          label: "Percentage of monthly Cloud Service Fee",
          help: "The credit for a month in this band.",
        }),
      },
    }),
    provider: field.party({
      label: "Provider",
      help: "The company providing the Cloud Service.",
    }),
    customer: field.party({
      label: "Customer",
      help: "The company using the Cloud Service.",
    }),
  },
  linkedTerms: {
    Provider: "provider.company",
    Customer: "customer.company",
    // The Subscription Period is the Order Form's; this page doesn't set it.
    "Subscription Period": "agreement",
    "Target Uptime": "targets",
    "Uptime Credit": "uptimeCredit",
    "Scheduled Downtime": "targets",
    "Target Response Time": "targets",
    "Response Time Credit": "targets",
    "Support Channel": "targets",
  },
  coverPage: {
    source: "parley",
    title: "Service Level Agreement",
    intro: [
      paragraph(
        "This Cover Page incorporates the Common Paper Service Level Agreement Standard Terms Version 2.0 available at ",
        link(STANDARD_TERMS, STANDARD_TERMS),
        " with the below Variables. A copy of the SLA Standard Terms is attached for convenience only."
      ),
      paragraph(
        "This SLA is incorporated into the Order Form of the Agreement named below. Capitalized words not defined here have the meanings given in the Agreement. If there is any inconsistency between this Cover Page and the SLA Standard Terms, this Cover Page will control."
      ),
    ],
    sections: [
      {
        heading: "Agreement",
        hint: "The Order Form this SLA is incorporated into",
        field: "agreement",
      },
      { heading: "SLA", hint: "Service Level Agreement", field: "targets" },
      {
        heading: "Uptime Credit",
        hint: "The Uptime Credit will be calculated as outlined in the table below:",
        when: { field: "targets", option: "uptime" },
        field: "uptimeCredit",
      },
    ],
    closing: [
      paragraph(
        "By signing this Cover Page, each party agrees to enter into this SLA."
      ),
    ],
    signatures: ["provider", "customer"],
    footer: [
      paragraph(
        "Cover page adapted by Parley from Common Paper's ",
        link("Service Level Agreement cover page", OFFICIAL_PAGE),
        ", free to use under ",
        link("CC BY 4.0", CC_BY),
        "."
      ),
      paragraph(
        "Common Paper Service Level Agreement Standard Terms (Version 2.0) free to use under ",
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

    // Without the table, an uptime target gives no credit when it is missed.
    const uptime = values.targets?.selected.some(
      (pick) => pick.option === "uptime"
    )
    if (phase === "complete" && uptime && values.uptimeCredit === undefined)
      issue(
        "uptimeCredit",
        "Add the uptime credit for each band below the target."
      )
  },
})
