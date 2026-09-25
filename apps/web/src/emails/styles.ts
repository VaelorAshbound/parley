import type { CSSProperties } from "react"

// Parley's brand for email (work/PAR-1/brand.md), as inline styles: mail
// apps drop <style> tags and most CSS, and the React Email Tailwind
// component would put a CSS compiler in the Worker. Pixel sizes, no rem.

const ink = "#1b1a17"
const muted = "#6a665d"
const serif = 'Newsreader, Georgia, "Times New Roman", serif'
const sans =
  '"Instrument Sans", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export const emailStyles = {
  body: { backgroundColor: "#f6f4ee", color: ink, fontFamily: sans },
  container: { maxWidth: "520px", margin: "0 auto", padding: "32px 20px" },
  wordmark: {
    fontFamily: serif,
    fontSize: "22px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
    margin: "0 0 20px",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e3ded3",
    borderRadius: "12px",
    padding: "28px",
  },
  heading: {
    fontFamily: serif,
    fontSize: "26px",
    fontWeight: 500,
    lineHeight: "32px",
    margin: "0 0 12px",
  },
  text: { fontSize: "16px", lineHeight: "24px", margin: "0 0 24px" },
  button: {
    backgroundColor: ink,
    borderRadius: "8px",
    boxSizing: "border-box",
    color: "#faf8f3",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 20px",
    textDecoration: "none",
  },
  small: {
    color: muted,
    fontSize: "13px",
    lineHeight: "20px",
    margin: "24px 0 4px",
  },
  link: {
    color: "#2743c4",
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
    wordBreak: "break-all",
  },
  rule: {
    borderColor: "#e3ded3",
    borderStyle: "solid",
    borderWidth: "1px 0 0",
    margin: "28px 0 16px",
  },
  footer: { color: muted, fontSize: "12px", lineHeight: "18px", margin: 0 },
} satisfies Record<string, CSSProperties>
