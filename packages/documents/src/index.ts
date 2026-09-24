// The document engine's public API. The parser (src/parse) is build-time only
// and not exported; the app reads the typed trees in generated/.
export { applyFieldChanges } from "./changes.ts"
export type {
  AppliedChange,
  ChangeRequest,
  ChangeResult,
  RejectedChange,
} from "./changes.ts"
export { coverage, defineDocument, initialValues } from "./define.ts"
export type {
  CoverPageLayout,
  CoverSection,
  DocumentDefinition,
  DraftValues,
  FieldChange,
  FieldPath,
  Fields,
  Values,
} from "./define.ts"
export { field } from "./fields.ts"
export type {
  AnyField,
  Duration,
  Field,
  FieldKind,
  Money,
  StateCode,
} from "./fields.ts"
export { toDocx } from "./output/docx.ts"
export type { DocxOptions } from "./output/docx.ts"
export { toPrintHtml } from "./output/html.ts"
export type { PrintOptions } from "./output/html.ts"
export { render } from "./render.ts"
export type {
  Part,
  RenderedClause,
  RenderedDocument,
  RenderedInline,
  RenderedLine,
  RenderedSignature,
  RenderedValue,
} from "./render.ts"
