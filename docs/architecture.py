# Draws docs/architecture.svg and docs/architecture-dark.svg (brand.md
# colors). GitHub shows a README's SVG as an image, so it can't follow the
# page's theme: the README picks one of the two with <picture>.
#
#   python3 docs/architecture.py

from pathlib import Path

THEMES = {
    "architecture.svg": dict(
        ground="#F6F4EE", frame="#EDEAE2", box="#FFFFFF", rule="#D5CFC2",
        ink="#1B1A17", ink2="#57544C", line="#6A665D", blue="#2743C4",
    ),
    "architecture-dark.svg": dict(
        ground="#141412", frame="#1C1B18", box="#1F1E1B", rule="#3D3B35",
        ink="#EDEAE3", ink2="#B8B3A9", line="#9C978C", blue="#9DAEFF",
    ),
}

FONT = "'Instrument Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"


def box(x, y, w, h, title, lines=(), fill="box", stroke="rule"):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{{{fill}}}" stroke="{{{stroke}}}"/>']
    out.append(f'<text x="{x + 16}" y="{y + 26}" class="t">{title}</text>')
    # "# Group" is a heading in ink; "  item" is indented under it.
    for i, line in enumerate(lines):
        indent, cls = (14, "s") if line.startswith("  ") else (0, "s")
        if line.startswith("# "):
            line, cls = line[2:], "g"
        out.append(f'<text x="{x + 16 + indent}" y="{y + 50 + i * 20}" class="{cls}">{line.strip()}</text>')
    return out


def arrow(d, label=None, at=None, color="line", dashed=False, anchor="middle"):
    dash = ' stroke-dasharray="5 4"' if dashed else ""
    marker = "blue" if color == "blue" else "grey"
    out = [f'<path d="{d}" fill="none" stroke="{{{color}}}" stroke-width="1.6"{dash} marker-end="url(#{marker})"/>']
    if label:
        x, y = at
        out.append(f'<text x="{x}" y="{y}" class="l" text-anchor="{anchor}" fill="{{{color}}}">{label}</text>')
    return out


def drawing():
    p = []
    # The Worker
    p += [f'<rect x="300" y="20" width="520" height="590" rx="16" fill="{{frame}}" stroke="{{rule}}"/>',
          '<text x="324" y="50" class="h">Cloudflare Worker</text>',
          '<text x="324" y="70" class="s">one deploy, one set of bindings</text>']
    p += box(320, 250, 150, 92, "server.ts", ["fetch()", "routes by path"])
    p += box(560, 60, 240, 340, "Hono  /api/*", [
        "# Better Auth",
        "  guests, email, Google,",
        "  GitHub, two-factor",
        "# oRPC procedures",
        "  chat (streamed)",
        "  drafts, export, share",
        "  per-user rate limits",
        "# Document engine",
        "  checks every AI write",
        "  renders PDF and DOCX",
        "# Polar webhook",
        "  sets the Pro plan",
    ])
    p += box(560, 420, 240, 82, "TanStack Start SSR", ["loaders call oRPC", "in-process, no HTTP"])
    p += box(560, 522, 240, 70, "scheduled()", ["daily 03:17 UTC"])
    p += ['<text x="324" y="560" class="s">Bindings: Hyperdrive,</text>',
          '<text x="324" y="579" class="s">Browser Run, Rate Limiting</text>']

    # The browser
    p += box(30, 201, 200, 186, "Browser", [
        "# React 19",
        "  chat",
        "  live document",
        "# Document engine",
        "  same render model",
        "  as the PDF",
    ])

    # Outside services
    services = [
        ("OpenRouter", "gpt-6-luna"),
        ("Browser Run", "prints the PDF"),
        ("Resend", "verify, reset email"),
        ("Polar sandbox", "Pro, $5 a month"),
        ("Turnstile", "bot check"),
    ]
    for i, (name, sub) in enumerate(services):
        p += box(900, 60 + i * 72, 270, 58, name, [], )
        p.append(f'<text x="1154" y="{60 + i * 72 + 26}" class="s" text-anchor="end">{sub}</text>')
    p += box(900, 440, 270, 110, "Neon Postgres 18", [
        "users, drafts, chats,",
        "AI usage, exports",
        "scales to zero",
    ])

    # Arrows. Blue: one chat turn.
    p += arrow("M230 296 H316", "HTTPS", (273, 288), "blue")
    p += arrow("M470 280 H515 V230 H556", "/api/*", (508, 252), "blue", anchor="end")
    p += arrow("M470 312 H515 V461 H556", "pages", (508, 395), anchor="end")
    p += arrow("M680 420 V404", None)
    p += ['<text x="690" y="414" class="l" fill="{line}">calls</text>']
    p += arrow("M800 89 H896", "stream + tools", (848, 81), "blue")
    p += arrow("M800 161 H896", "print HTML", (848, 153))
    p += arrow("M800 233 H896", "send", (848, 225))
    p += arrow("M800 299 H896", "checkout", (848, 291))
    p += arrow("M900 319 H804", "webhook", (848, 333), dashed=True)
    p += arrow("M800 377 H896", "siteverify", (848, 369))
    p += arrow("M800 390 H850 V478 H896", "SQL", (858, 470), "blue", anchor="start")
    p += arrow("M800 557 H850 V522 H896", "purge", (858, 545), anchor="start")
    p += arrow("M316 326 H230", "SSE stream", (273, 343), "blue")

    # Legend
    p += ['<path d="M30 560 H70" stroke="{blue}" stroke-width="1.6"/>',
          '<text x="80" y="564" class="s">one chat turn</text>',
          '<path d="M30 586 H70" stroke="{line}" stroke-width="1.6" stroke-dasharray="5 4"/>',
          '<text x="80" y="590" class="s">calls in</text>']
    return "\n  ".join(p)


def svg(c):
    marker = lambda name, color: (
        f'<marker id="{name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0 L10 5 L0 10 z" fill="{color}"/></marker>'
    )
    body = drawing().format(**c)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="Parley runs as one Cloudflare Worker. The browser talks to it over HTTPS; server.ts sends /api to Hono and pages to TanStack Start, which calls the same oRPC procedures in-process. Hono streams chat from OpenRouter, writes to Neon Postgres through Hyperdrive, prints PDFs with Browser Run, sends email with Resend, and takes Polar webhooks. A daily cron purges idle guests.">
  <defs>{marker("grey", c["line"])}{marker("blue", c["blue"])}</defs>
  <style>
    text {{ font-family: {FONT}; fill: {c["ink2"]}; }}
    .h {{ font-size: 17px; font-weight: 600; fill: {c["ink"]}; }}
    .t {{ font-size: 15px; font-weight: 600; fill: {c["ink"]}; }}
    .s {{ font-size: 13px; white-space: pre; }}
    .g {{ font-size: 13px; font-weight: 600; fill: {c["ink"]}; }}
    .l {{ font-size: 12px; font-weight: 500; }}
  </style>
  <rect width="1200" height="630" fill="{c["ground"]}"/>
  {body}
</svg>
'''


for name, colors in THEMES.items():
    (Path(__file__).parent / name).write_text(svg(colors))
