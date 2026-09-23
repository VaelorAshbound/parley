#!/usr/bin/env python3
"""Expand src/*.src.html into project/*.dc.html for the Parley design canvas.

Placeholders: %%CSS%% %%FONTS%% %%SERIF%% %%SANS%% %%I:name:size[:stroke]%%
%%MARK:size%% %%MARKD:size%% %%GH:size%% %%GG:size%% %%CR:#fg:#bg%%
Drafting is also rendered as DraftingDark by mapping every light token to its dark twin.
"""
import re, pathlib

ROOT = pathlib.Path(__file__).parent
SRC, OUT = ROOT / "src", ROOT / "project"

SERIF = "'Newsreader','Iowan Old Style','Palatino Linotype',Georgia,serif"
SANS = "'Instrument Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif"
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700'
         '&amp;family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&amp;display=swap">')

# light token -> dark token (every light hex is used for exactly one role)
DARK = {
    "#F6F4EE": "#141412",  # paper (app ground)
    "#EDEAE2": "#0E0E0C",  # paper deep (document backdrop)
    "#F0EDE6": "#181715",  # sidebar
    "#FFFFFF": "#1F1E1B",  # surface
    "#FFFDF9": "#1C1B18",  # sheet
    "#ECE8DF": "#2A2925",  # your bubble
    "#E9E5DB": "#2B2A26",  # hover
    "#E6E2D8": "#302E2A",  # active item
    "#E3DED3": "#2E2C28",  # rule
    "#ECE7DC": "#292724",  # sheet rule
    "#D5CFC2": "#3D3B35",  # rule strong
    "#1B1A17": "#EDEAE3",  # ink
    "#2E2C28": "#D9D5CC",  # ink hover
    "#57544C": "#B8B3A9",  # ink 2
    "#6A665D": "#9C978C",  # ink 3
    "#A29D92": "#6A665E",  # ink 4 (decorative only)
    "#FAF8F3": "#151412",  # on ink
    "#2743C4": "#9DAEFF",  # blue ink
    "#1F37A6": "#B7C4FF",  # blue ink hover
    "#EEF1FC": "#1D2340",  # blue tint
    "#F3F5FD": "#191E34",  # asking tint
    "#F5F7FE": "#1B2038",  # option hover
    "#9AA9E6": "#4A5A9E",  # blue border
    "#E1E6FA": "#26305A",  # avatar
    "#FFE58A": "#4B3F14",  # highlighter
    "#FFF1BC": "#342C10",  # highlighter settled
    "#FDFDFF": "#10142A",  # on blue
    "#F2EFE8": "#252420",  # empty field
    "#CFC8B9": "#4A4740",  # empty field border
}

ICONS = {
    "panel": '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path>',
    "search": '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
    "new": '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path>',
    "link": '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path><path d="M12 15V3"></path>',
    "expand": '<path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="m21 3-7 7"></path><path d="m3 21 7-7"></path>',
    "x": '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    "chevdown": '<path d="m6 9 6 6 6-6"></path>',
    "chevleft": '<path d="m15 18-6-6 6-6"></path>',
    "chevupdown": '<path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path>',
    "arrowup": '<path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path>',
    "arrowright": '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
    "undo": '<path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path>',
    "redo": '<path d="m15 14 5-5-5-5"></path><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"></path>',
    "pen": '<path d="M12 20h9"></path><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"></path>',
    "file": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path>',
    "moon": '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>',
    "check": '<path d="M20 6 9 17l-5-5"></path>',
    "menu": '<path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path>',
    "more": '<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>',
    "lock": '<rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
    "eye": '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle>',
    "replay": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path>',
}

MARK_PATHS = ('<path d="M12.6 3V13H8.6L5 15.8L5.6 12.05A5 5 0 0 1 8.5 3Z" fill="{bowl}"></path>'
              '<path d="M13.4 3H20V21H17.9V5.1H15.5V21H13.4Z" fill="{stem}"></path>')

GITHUB = ('<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"></path></svg>')
GOOGLE = ('<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true">'
          '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path>'
          '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path>'
          '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path>'
          '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>')

CSS = r"""
body{margin:0;background:#F6F4EE;color:#1B1A17;font-family:%%SANS%%;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:#2743C4;text-decoration:none}
a:hover{color:#1F37A6}
button,input,textarea{font:inherit;color:inherit}
textarea::placeholder,input::placeholder{color:#6A665D;opacity:1}
:focus-visible{outline:2px solid #2743C4;outline-offset:2px}
.pl-press{transition:transform 140ms cubic-bezier(0.23,1,0.32,1),background-color 160ms ease,border-color 160ms ease,color 160ms ease,box-shadow 160ms ease}
.pl-press:active{transform:scale(0.97)}
.pl-composer{transition:border-color 160ms ease,box-shadow 200ms ease}
.pl-composer:focus-within{border-color:#9AA9E6 !important;box-shadow:0 0 0 4px #EEF1FC,0 12px 32px -16px rgba(27,26,23,0.18) !important}
@media (hover:hover) and (pointer:fine){
.pl-hover:hover{background-color:#E9E5DB !important;color:#1B1A17 !important}
.pl-opt-idle:hover{border-color:#9AA9E6 !important;background-color:#F5F7FE !important}
.pl-chip:hover{border-color:#D5CFC2 !important;background-color:#FFFFFF !important;color:#1B1A17 !important}
.pl-ink-btn:hover{background-color:#2E2C28 !important}
.pl-outline:hover{border-color:#D5CFC2 !important;background-color:#F6F4EE !important}
.pl-link:hover{color:#1B1A17 !important}
.pl-row:hover{background-color:#F6F4EE !important}
}
@property --pl-hl{syntax:'<color>';inherits:false;initial-value:#FFE58A}
.pl-v{border-radius:3px;padding:1px 3px;margin:0 -3px;-webkit-box-decoration-break:clone;box-decoration-break:clone;background-repeat:no-repeat;background-image:linear-gradient(var(--pl-hl),var(--pl-hl));background-size:100% 100%;transition:--pl-hl 700ms ease}
.pl-soft{--pl-hl:#FFF1BC}
.pl-plain{--pl-hl:rgba(255,241,188,0)}
.pl-hot{--pl-hl:#FFE58A}
.pl-fresh-a{animation:pl-sweep-a 640ms cubic-bezier(0.23,1,0.32,1) both,pl-settle-a 1600ms ease 1600ms both}
.pl-fresh-b{animation:pl-sweep-b 640ms cubic-bezier(0.23,1,0.32,1) both,pl-settle-b 1600ms ease 1600ms both}
.pl-ink-a{animation:pl-ink-a 520ms cubic-bezier(0.23,1,0.32,1) 60ms both}
.pl-ink-b{animation:pl-ink-b 520ms cubic-bezier(0.23,1,0.32,1) 60ms both}
@keyframes pl-sweep-a{from{background-size:0% 100%;--pl-hl:#FFE58A}to{background-size:100% 100%;--pl-hl:#FFE58A}}
@keyframes pl-sweep-b{from{background-size:0% 100%;--pl-hl:#FFE58A}to{background-size:100% 100%;--pl-hl:#FFE58A}}
@keyframes pl-settle-a{from{--pl-hl:#FFE58A}to{--pl-hl:#FFF1BC}}
@keyframes pl-settle-b{from{--pl-hl:#FFE58A}to{--pl-hl:#FFF1BC}}
@keyframes pl-ink-a{from{opacity:0;filter:blur(3px)}to{opacity:1;filter:blur(0)}}
@keyframes pl-ink-b{from{opacity:0;filter:blur(3px)}to{opacity:1;filter:blur(0)}}
.pl-bar-a{animation:pl-bar-a 480ms cubic-bezier(0.23,1,0.32,1) both}
.pl-bar-b{animation:pl-bar-b 480ms cubic-bezier(0.23,1,0.32,1) both}
@keyframes pl-bar-a{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes pl-bar-b{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.pl-pop-a{animation:pl-pop-a 260ms cubic-bezier(0.23,1,0.32,1) both}
.pl-pop-b{animation:pl-pop-b 260ms cubic-bezier(0.23,1,0.32,1) both}
@keyframes pl-pop-a{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pl-pop-b{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
.pl-enter{animation:pl-enter 340ms cubic-bezier(0.23,1,0.32,1) both}
@keyframes pl-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.pl-step-a{animation:pl-step-a 240ms cubic-bezier(0.23,1,0.32,1) both}
.pl-step-b{animation:pl-step-b 240ms cubic-bezier(0.23,1,0.32,1) both}
@keyframes pl-step-a{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
@keyframes pl-step-b{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
.pl-fade-a{animation:pl-fade-a 280ms ease both}
.pl-fade-b{animation:pl-fade-b 280ms ease both}
@keyframes pl-fade-a{from{opacity:0}to{opacity:1}}
@keyframes pl-fade-b{from{opacity:0}to{opacity:1}}
.pl-progress{transition:width 360ms cubic-bezier(0.23,1,0.32,1)}
.pl-shimmer{color:transparent;background-image:linear-gradient(90deg,#6A665D 0%,#6A665D 35%,#1B1A17 50%,#6A665D 65%,#6A665D 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;animation:pl-shimmer 1.5s linear infinite}
@keyframes pl-shimmer{from{background-position:110% 0}to{background-position:-110% 0}}
.pl-marker{background-image:linear-gradient(transparent 62%,#FFE58A 62%,#FFE58A 92%,transparent 92%);background-repeat:no-repeat;background-size:100% 100%;animation:pl-marker 900ms cubic-bezier(0.77,0,0.175,1) 700ms both}
@keyframes pl-marker{from{background-size:0% 100%}to{background-size:100% 100%}}
.pl-rise{animation:pl-rise 800ms cubic-bezier(0.23,1,0.32,1) 150ms both}
@keyframes pl-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.pl-fan-l{animation:pl-fan-l 1000ms cubic-bezier(0.23,1,0.32,1) 350ms both}
.pl-fan-r{animation:pl-fan-r 1000ms cubic-bezier(0.23,1,0.32,1) 450ms both}
@keyframes pl-fan-l{from{opacity:0;transform:rotate(6deg) translateY(18px)}to{opacity:1;transform:none}}
@keyframes pl-fan-r{from{opacity:0;transform:rotate(-4deg) translateY(18px)}to{opacity:1;transform:none}}
.pl-float-1{animation:pl-float 600ms cubic-bezier(0.23,1,0.32,1) 900ms both}
.pl-float-2{animation:pl-float 600ms cubic-bezier(0.23,1,0.32,1) 2300ms both}
@keyframes pl-float{from{opacity:0;transform:translateY(8px) scale(0.97)}to{opacity:1;transform:none}}
.pl-hero-fresh{animation:pl-sweep-a 700ms cubic-bezier(0.23,1,0.32,1) 1500ms both,pl-settle-a 1600ms ease 3600ms both}
.pl-hero-ink{animation:pl-ink-a 600ms cubic-bezier(0.23,1,0.32,1) 1500ms both}
.pl-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){
.pl-fresh-a,.pl-fresh-b,.pl-hero-fresh{animation:pl-settle-a 1600ms ease 800ms both}
.pl-ink-a,.pl-ink-b,.pl-bar-a,.pl-bar-b,.pl-pop-a,.pl-pop-b,.pl-enter,.pl-step-a,.pl-step-b,.pl-hero-ink,.pl-rise,.pl-fan-l,.pl-fan-r,.pl-float-1,.pl-float-2{animation:pl-fade-a 220ms ease both}
.pl-marker{animation:none}
.pl-shimmer{animation:none;color:#6A665D;background:none}
.pl-press:active{transform:none}
}
"""


def contrast(fg, bg):
    def lum(h):
        h = h.lstrip("#")
        c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    a, b = sorted((lum(fg), lum(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


def icon(m):
    name, size, sw = m.group(1), m.group(2), m.group(3) or "1.75"
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


def mark(size, bowl, stem):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true">{MARK_PATHS.format(bowl=bowl, stem=stem)}</svg>'


def expand(text):
    text = text.replace("%%CSS%%", CSS.strip())
    text = text.replace("%%FONTS%%", FONTS).replace("%%SERIF%%", SERIF).replace("%%SANS%%", SANS)
    text = re.sub(r"%%I:([a-z]+):(\d+)(?::([\d.]+))?%%", icon, text)
    text = re.sub(r"%%MARK:(\d+)%%", lambda m: mark(m.group(1), "#2743C4", "#1B1A17"), text)
    text = re.sub(r"%%MARKD:(\d+)%%", lambda m: mark(m.group(1), "#9DAEFF", "#EDEAE3"), text)
    text = re.sub(r"%%GH:(\d+)%%", lambda m: GITHUB.format(s=m.group(1)), text)
    text = re.sub(r"%%GG:(\d+)%%", lambda m: GOOGLE.format(s=m.group(1)), text)
    text = re.sub(r"%%CR:(#[0-9A-Fa-f]{6}):(#[0-9A-Fa-f]{6})%%",
                  lambda m: f"{contrast(m.group(1), m.group(2)):.1f}:1", text)
    left = re.findall(r"%%[^%]+%%", text)
    assert not left, f"unexpanded placeholders: {left}"
    return text


def to_dark(text):
    pattern = re.compile("|".join(re.escape(k) for k in DARK), re.IGNORECASE)
    text = pattern.sub(lambda m: DARK[m.group(0).upper()], text)
    return re.sub(r"rgba\(27,26,23,([0-9.]+)\)",
                  lambda m: f"rgba(0,0,0,{min(0.6, float(m.group(1)) * 3):.2f})", text)


def main():
    OUT.mkdir(exist_ok=True)
    built = []
    for src in sorted(SRC.glob("*.src.html")):
        name = src.name.replace(".src.html", ".dc.html")
        html = expand(src.read_text())
        (OUT / name).write_text(html)
        built.append(name)
        if name == "Drafting.dc.html":
            dark = to_dark(html).replace("<title>Drafting</title>", "<title>Drafting, dark</title>")
            (OUT / "DraftingDark.dc.html").write_text(dark)
            built.append("DraftingDark.dc.html")
    print("built:", ", ".join(built))
    # the contrast pairs the brand page promises
    pairs = [("#1B1A17", "#F6F4EE"), ("#57544C", "#F6F4EE"), ("#6A665D", "#F6F4EE"), ("#6A665D", "#EDEAE2"),
             ("#6A665D", "#F0EDE6"), ("#2743C4", "#FFFDF9"), ("#2743C4", "#FFE58A"), ("#2743C4", "#FFF1BC"),
             ("#6A665D", "#F2EFE8"), ("#FAF8F3", "#1B1A17"), ("#FDFDFF", "#2743C4")]
    for fg, bg in pairs:
        print(f"light {fg} on {bg}: {contrast(fg, bg):.2f}")
    for fg, bg in pairs:
        print(f"dark  {DARK[fg]} on {DARK[bg]}: {contrast(DARK[fg], DARK[bg]):.2f}")


if __name__ == "__main__":
    main()
