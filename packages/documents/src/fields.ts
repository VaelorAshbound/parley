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
import { choices } from "./fields/choices.ts"
import { group } from "./fields/group.ts"
import { jurisdiction } from "./fields/jurisdiction.ts"
import { list } from "./fields/list.ts"
import { party } from "./fields/party.ts"

export {
  EU_MEMBER_STATES,
  unitWords,
  type Duration,
  type Money,
  type Unit,
} from "./fields/basic.ts"
export type { ChoiceDraft, ChoiceValue } from "./fields/choice.ts"
export type { ChoicesDraft, ChoicesValue } from "./fields/choices.ts"
export type {
  AnyField,
  Field,
  FieldKind,
  NullableParts,
  ObjectField,
} from "./fields/core.ts"
export type { GroupValue } from "./fields/group.ts"
export { US_STATES, type StateCode } from "./fields/jurisdiction.ts"
export type { ListDraft, ListValue } from "./fields/list.ts"

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
  choices,
  list,
  group,
  jurisdiction,
  party,
}
