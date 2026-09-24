import type {
  Part,
  RenderedClause,
  RenderedDocument,
  RenderedLine,
  RenderedSection,
} from "@workspace/documents"
import { cn } from "@workspace/ui/lib/utils"
import { useId, type ReactNode } from "react"

import { Inline } from "./inline"
import { spoken, Value } from "./value"

// The live document (spec §1): the render model as a page. Every value can be
// clicked to edit its field; the editor opens in place of the row it edits
// (brand.md → "Editing"). The same model feeds the PDF and DOCX, so what you
// see is what prints.

type Props = {
  document: RenderedDocument
  /** The field being edited, maybe with a part: "party1.email". */
  editing?: string | undefined
  onEdit: (path: string) => void
  /** The editor for a field, shown where that field's row is. */
  renderEditor: (key: string) => ReactNode
}

const keyOf = (path: string) => path.split(".")[0] ?? path

export function DocumentView({
  document,
  editing,
  onEdit,
  renderEditor,
}: Props) {
  const { coverPage, standardTerms } = document
  const editingKey = editing === undefined ? undefined : keyOf(editing)
  const signed = new Set(coverPage.signatures.parties.map((each) => each.field))

  return (
    <article className="typeset typeset-contract">
      <header>
        {coverPage.eyebrow && (
          <p className="text-label text-muted-foreground uppercase">
            {coverPage.eyebrow}
          </p>
        )}
        <h2 className="text-[1.8em] leading-tight font-medium tracking-[-0.012em]">
          {coverPage.title}
        </h2>
        {coverPage.subtitle && (
          <p className="font-sans text-label text-ink-2 uppercase">
            {coverPage.subtitle}
          </p>
        )}
      </header>
      {coverPage.intro.map((paragraph, index) => (
        <p key={index}>
          <Inline nodes={paragraph} onEdit={onEdit} />
        </p>
      ))}
      {coverPage.sections.map((section, index) =>
        section.part ? (
          <PartHeading key={index} section={section} />
        ) : (
          <Section
            key={index}
            section={section}
            onEdit={onEdit}
            editor={
              editingKey !== undefined && fieldsOf(section).has(editingKey)
                ? renderEditor(editingKey)
                : undefined
            }
          />
        )
      )}
      {coverPage.closing.map((paragraph, index) => (
        <p key={index}>
          <Inline nodes={paragraph} onEdit={onEdit} />
        </p>
      ))}
      <Signatures document={document} onEdit={onEdit} />
      {editingKey !== undefined && signed.has(editingKey) && (
        <section className="mt-4">
          <h3 className="font-sans text-[0.8em] font-semibold">
            {partyLabel(document, editingKey)}
          </h3>
          <div className="not-typeset mt-2">{renderEditor(editingKey)}</div>
        </section>
      )}
      {coverPage.footer.map((paragraph, index) => (
        <p key={index} className="font-sans text-[0.8em] text-ink-2">
          <Inline nodes={paragraph} onEdit={onEdit} />
        </p>
      ))}
      <hr className="my-10 border-rule-sheet" />
      <h2 className="text-[1.5em] font-medium">{standardTerms.title}</h2>
      {standardTerms.children.map((block, index) => {
        if (block.type === "paragraph")
          return (
            <p key={index} className="font-sans text-[0.8em] text-ink-2">
              <Inline nodes={block.content} onEdit={onEdit} />
            </p>
          )
        if (block.type === "clause")
          return <Clause key={index} clause={block} onEdit={onEdit} />
        return (
          <section key={index}>
            <h3>
              <span className="tabular-nums">{block.id}.</span> {block.heading}
            </h3>
            {block.children.map((clause) => (
              <Clause key={clause.id} clause={clause} onEdit={onEdit} />
            ))}
          </section>
        )
      })}
    </article>
  )
}

function partyLabel(document: RenderedDocument, key: string) {
  return document.coverPage.signatures.parties.find(
    (party) => party.field === key
  )?.label
}

/** The fields a section shows: its own, or those of its lines. */
function fieldsOf(section: RenderedSection) {
  if (section.field !== undefined) return new Set([section.field])
  return new Set(
    section.lines.flatMap((line) =>
      line.parts.flatMap((part) =>
        part.type === "value" ? [keyOf(part.field)] : []
      )
    )
  )
}

function PartHeading({ section }: { section: RenderedSection }) {
  return (
    <>
      <h3 className="text-[1.15em]">{section.heading}</h3>
      {section.hint && (
        <p className="font-sans text-[0.8em] text-ink-3">{section.hint}</p>
      )}
    </>
  )
}

function Section({
  section,
  onEdit,
  editor,
}: {
  section: RenderedSection
  onEdit: (path: string) => void
  editor: ReactNode
}) {
  const { field } = section
  const body = (
    <>
      {section.lines.map((line, index) => (
        <Line key={index} line={line} />
      ))}
      {section.table && (
        <span
          className="mt-1 grid gap-x-4 gap-y-1 font-sans text-[0.86em]"
          style={{
            gridTemplateColumns: `repeat(${section.table.columns.length}, minmax(0, 1fr))`,
          }}
        >
          {section.table.columns.map((column) => (
            <span key={column} className="font-semibold text-ink-2">
              {column}
            </span>
          ))}
          {section.table.rows.flatMap((row, rowIndex) =>
            row.map((cell, cellIndex) => (
              <Value key={`${rowIndex}-${cellIndex}`} value={cell} />
            ))
          )}
        </span>
      )}
    </>
  )

  return (
    <section className="border-t border-rule-sheet pt-3">
      <h3 className="mt-0! font-sans text-[0.8em] font-semibold tracking-normal">
        {section.heading}
      </h3>
      {section.hint && (
        <p className="mt-0! font-sans text-[0.8em] text-ink-3">
          {section.hint}
        </p>
      )}
      {editor ? (
        <div className="not-typeset mt-2">{editor}</div>
      ) : field === undefined ? (
        // Lines from several fields: each line edits its own.
        section.lines.map((line, index) => (
          <EditButton
            key={index}
            field={firstValue(line.parts)}
            label={line.parts
              .flatMap((part) => (part.type === "value" ? [spoken(part)] : []))
              .join("; ")}
            onEdit={(path) => onEdit(path ?? firstValue(line.parts) ?? "")}
          >
            <Line line={line} />
          </EditButton>
        ))
      ) : (
        <EditButton
          field={field}
          label={section.heading}
          onEdit={(path) => onEdit(path ?? field)}
        >
          {body}
        </EditButton>
      )}
    </section>
  )
}

function firstValue(parts: Part[]) {
  return parts.find((part) => part.type === "value")?.field
}

/**
 * A row you can click to edit. The value under the pointer names the part to
 * focus ("governingLaw.courtLocation"); a click elsewhere edits the field.
 */
function EditButton({
  label,
  field,
  onEdit,
  children,
}: {
  label: string
  /** The field it edits, where focus returns when its editor closes. */
  field: string | undefined
  onEdit: (path: string | undefined) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <button
      type="button"
      data-edit={field}
      aria-label={`Edit ${label}`}
      aria-describedby={id}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null
        const part = target?.closest<HTMLElement>("[data-field]")?.dataset.field
        onEdit(part)
      }}
      className="hover:bg-hover -mx-2 mt-1 block w-[calc(100%+1rem)] cursor-text rounded-md px-2 py-1 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span id={id}>{children}</span>
    </button>
  )
}

function Line({ line }: { line: RenderedLine }) {
  return (
    <span
      data-unchosen={line.checked === false ? "" : undefined}
      className={cn(
        "flex items-baseline gap-2",
        line.checked === false && "opacity-42"
      )}
    >
      {line.checked !== undefined && <Box checked={line.checked} />}
      <span className="min-w-0">
        {line.label && (
          <span className="font-sans text-[0.86em] text-ink-2">
            {line.label}:{" "}
          </span>
        )}
        {line.parts.map((part, index) =>
          part.type === "text" ? part.text : <Value key={index} value={part} />
        )}
      </span>
    </span>
  )
}

/** The checkbox of a choice line, drawn like the PDF's. */
function Box({ checked }: { checked: boolean }) {
  return (
    <svg
      // Drawn inline like the PDF's boxes, so it takes the theme's colors;
      // an <img> can't.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={checked ? "Selected" : "Not selected"}
      viewBox="0 0 12 12"
      className="size-3 shrink-0 translate-y-px"
    >
      {checked ? (
        <>
          <rect width="12" height="12" rx="2" className="fill-blue-ink" />
          <path
            d="M3 6.2 5.1 8.3 9 3.9"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-sheet"
          />
        </>
      ) : (
        <rect
          x="0.75"
          y="0.75"
          width="10.5"
          height="10.5"
          rx="2"
          fill="none"
          strokeWidth="1.2"
          className="stroke-empty-border"
        />
      )}
    </svg>
  )
}

function Signatures({
  document,
  onEdit,
}: {
  document: RenderedDocument
  onEdit: (path: string) => void
}) {
  const { parties, rows } = document.coverPage.signatures
  if (parties.length === 0) return null
  return (
    <table className="w-full font-sans text-[0.86em]">
      <thead>
        <tr>
          <td>
            <span className="sr-only">Signature row</span>
          </td>
          {parties.map((party) => (
            <th key={party.field} scope="col">
              {party.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className="font-semibold">
              {row.label}
            </th>
            {row.cells.map((cell, index) => (
              <td key={parties[index]?.field ?? index} className="h-9">
                {cell && (
                  <button
                    type="button"
                    data-edit={cell.field}
                    aria-label={`Edit ${spoken(cell)}`}
                    onClick={() => onEdit(cell.field)}
                    className="hover:bg-hover -mx-1 cursor-text rounded-sm px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Value value={cell} />
                  </button>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Clause({
  clause,
  onEdit,
}: {
  clause: RenderedClause
  onEdit: (path: string) => void
}) {
  return (
    <>
      <p>
        <span className="font-semibold tabular-nums">{clause.number}</span>{" "}
        {clause.heading && <strong>{clause.heading} </strong>}
        <Inline nodes={clause.content} onEdit={onEdit} />
      </p>
      {clause.children.length > 0 && (
        <div className="ml-5">
          {clause.children.map((child) => (
            <Clause key={child.id} clause={child} onEdit={onEdit} />
          ))}
        </div>
      )}
    </>
  )
}
