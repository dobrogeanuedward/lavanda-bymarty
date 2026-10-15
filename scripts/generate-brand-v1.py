"""Build LAVANDA's original vector artwork. Standard library only.

All outlines below were drawn for this project. No external font is needed by
the logotype. Run from any directory to regenerate the SVG source assets.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "public" / "brand-v1"
ICON_ROOT = ROOT.parent / "icons"

# Letterforms share a 100-unit cap height. The A counters and uneven strokes
# establish the rhythm; the D is deliberately rounder than the triangular A/V.
GLYPHS = {
    "L": "M0 0H29V4H21V95H51Q59 95 65 78H69L66 100H0V96H8V4H0Z",
    "A": "M0 100V96H7L41 0H47L82 96H90V100H57V96H65L55 69H22L12 96H24V100ZM24 64H53L38.5 23Z",
    "V": "M0 0H34V4H25L50 77L76 4H65V0H92V4H83L48 102H42L8 4H0Z",
    "N": "M0 100V96H9V4H0V0H26L80 75V4H69V0H98V4H89V100H81L18 12V96H30V100Z",
    "D": "M0 0H40C76 0 96 17 96 49C96 81 76 100 40 100H0V96H9V4H0ZM22 5V95H37C66 95 81 80 81 49C81 19 67 5 37 5Z",
}

LETTERS = [("L", 0), ("A", 72), ("V", 159), ("A", 249), ("N", 342), ("D", 446), ("A", 545)]

def mark(color="currentColor", center_color=None):
    center_color = center_color or color
    return f'''<g fill="none" stroke="{color}" stroke-width="5" stroke-linecap="butt">
  <path d="M28 77C22 44 43 13 76 10C109 7 138 31 140 65"/>
  <path d="M124 73C130 106 109 137 76 140C43 143 14 119 12 85"/>
</g><circle cx="76" cy="75" r="7" fill="{center_color}"/>'''

def wordmark(color="currentColor"):
    return "\n".join(f'<path transform="translate({x} 0)" d="{GLYPHS[ch]}" fill="{color}" fill-rule="evenodd"/>' for ch, x in LETTERS)

def svg(width, height, body, label, description):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">{label}</title><desc id="desc">{description}</desc>
{body}
</svg>\n'''

def write(name, body):
    (ROOT / name).write_text(body, encoding="utf-8")

for name, color in [("logo.svg", "#000000"), ("logo-inverse.svg", "#ffffff")]:
    body = f'<g transform="translate(6 9) scale(.88)">{mark(color)}</g>\n<g transform="translate(180 34)">{wordmark(color)}</g>'
    write(name, svg(830, 160, body, "LAVANDA", "Marchio originale: due archi aperti e sfalsati attorno a un punto, accanto al logotipo LAVANDA disegnato a tracciati."))

write("wordmark.svg", svg(650, 120, f'<g transform="translate(7 9)">{wordmark("#000000")}</g>', "LAVANDA", "Logotipo LAVANDA originale, interamente a tracciati."))
write("wordmark-inverse.svg", svg(650, 120, f'<g transform="translate(7 9)">{wordmark("#ffffff")}</g>', "LAVANDA", "Logotipo LAVANDA bianco, interamente a tracciati."))
write("emblem.svg", svg(152, 150, mark("#000000"), "LAVANDA, ritorno al centro", "Segno contemporaneo originale composto da due archi aperti sfalsati e da un punto centrale."))
write("emblem-inverse.svg", svg(152, 150, mark("#ffffff"), "LAVANDA, ritorno al centro", "Versione bianca del segno contemporaneo originale."))
write("emblem-periwinkle.svg", svg(152, 150, mark("#000000", "#8093F1"), "LAVANDA, ritorno al centro", "Segno contemporaneo nero con punto centrale pervinca."))
write("favicon.svg", '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>LAVANDA</title><rect width="64" height="64" rx="32" fill="#8093F1"/><g transform="translate(7.5 8) scale(.32)" fill="none" stroke="#000" stroke-width="8"><path d="M28 77C22 44 43 13 76 10C109 7 138 31 140 65"/><path d="M124 73C130 106 109 137 76 140C43 143 14 119 12 85"/></g><circle cx="32" cy="32" r="3" fill="#000"/></svg>\n''')

ICONS = {
    "ciclo": ("Ciclo", '<path d="M6.2 13.5A9.5 9.5 0 0 1 22.5 7.8M25.8 18.5A9.5 9.5 0 0 1 9.5 24.2"/><path d="M23 3.8v4.4h-4.4M9 28.2v-4.4h4.4"/><circle cx="16" cy="16" r="1.4"/>'),
    "botanica": ("Botanica", '<path d="M16 28V9M16 19C8.2 19 5 14.8 5 8c7.8 0 11 4.2 11 11ZM16 24c7.8 0 11-4.2 11-11-7.8 0-11 4.2-11 11ZM16 12c-4.7-2.5-5.1-6.3 0-10 5.1 3.7 4.7 7.5 0 10Z"/>'),
    "arcani": ("Arcani", '<path d="M9 5h17v23H9zM9 8H6v20M9 11H3v17"/><path d="m17.5 10 4.5 6.5-4.5 6.5-4.5-6.5Z"/><path d="M17.5 13.5v6M15.5 16.5h4"/>'),
    "alchimia": ("Alchimia", '<path d="M12 3h8M14 3v8L6.5 24a3 3 0 0 0 2.6 4.5h13.8a3 3 0 0 0 2.6-4.5L18 11V3M10.5 19h11"/><circle cx="16" cy="23.5" r="1.3"/>'),
    "corrispondenze": ("Corrispondenze", '<path d="M16 7v7M9 17h5M18 17h5M16 20v5M7 14V8h6M25 14V8h-6M7 20v6h6M25 20v6h-6"/><circle cx="16" cy="5" r="2"/><circle cx="7" cy="17" r="2"/><circle cx="25" cy="17" r="2"/><circle cx="16" cy="17" r="2"/><circle cx="16" cy="27" r="2"/>'),
    "lettura": ("Lettura", '<path d="M16 8c-4-3-8-3.5-13-2v20c5-1.5 9-1 13 2 4-3 8-3.5 13-2V6c-5-1.5-9-1-13 2ZM16 8v20M7 11c2.2-.1 3.5.2 5 1M7 15c2.2-.1 3.5.2 5 1M20 12c1.5-.8 2.8-1.1 5-1M20 16c1.5-.8 2.8-1.1 5-1"/>'),
}

symbols = []
for key, (label, paths) in ICONS.items():
    attrs = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'
    content = f'<g {attrs}>{paths}</g>'
    (ICON_ROOT / f"{key}.svg").write_text(svg(32, 32, content, label, f"Icona originale LAVANDA: {label.lower()}."), encoding="utf-8")
    symbols.append(f'<symbol id="{key}" viewBox="0 0 32 32"><title>{label}</title>{content}</symbol>')
(ICON_ROOT / "sprite.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg">\n' + '\n'.join(symbols) + '\n</svg>\n', encoding="utf-8")

print("Generated 9 brand SVGs, 6 icons and 1 icon sprite.")
