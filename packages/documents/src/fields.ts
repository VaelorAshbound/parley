// The field kinds a document is filled with. Each lives in src/fields/.
import {
  date,
  duration,
  longText,
  money,
  number,
  percent,
  select,
  text,
  url,
} from "./fields/basic.ts"
import { choice } from "./fields/choice.ts"
import { jurisdiction } from "./fields/jurisdiction.ts"
import { party } from "./fields/party.ts"

export { EU_MEMBER_STATES, type Duration, type Money } from "./fields/basic.ts"
export type { ChoiceDraft, ChoiceValue } from "./fields/choice.ts"
export type {
  AnyField,
  Field,
  FieldKind,
  NullableParts,
  ObjectField,
} from "./fields/core.ts"
export type { StateCode } from "./fields/jurisdiction.ts"

export const field = {
  text,
  longText,
  date,
  duration,
  money,
  percent,
  number,
  select,
  url,
  choice,
  jurisdiction,
  party,
}
