// The document engine's public API. The parser (src/parse) is build-time only
// and not exported; the app reads the typed trees in generated/. The outputs
// are separate entry points, "@workspace/documents/docx" and "/print", so
// importing the engine doesn't load the `docx` library.
export { applyFieldChanges } from "./changes.ts"
export { DISCLAIMER } from "./disclaimer.ts"
export type {
  AppliedChange,
  ChangeIssue,
  ChangeRequest,
  ChangeResult,
  RejectedChange,
} from "./changes.ts"
export { coverage, defineDocument, initialValues } from "./define.ts"
export { definitionOf, definitions, isDocumentId } from "./definitions/index.ts"
export type { DocumentId } from "./definitions/index.ts"
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
export { render } from "./render.ts"
export type {
  Part,
  RenderedClause,
  RenderedDocument,
  RenderedInline,
  RenderedLine,
  RenderedSignatures,
  RenderedValue,
} from "./render.ts"
