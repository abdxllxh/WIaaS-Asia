from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
SOURCE_RENDER = ROOT / "tmp" / "pdfs" / "wiaas_source" / "page-01.png"
BUILD_DIR = ROOT / "tmp" / "pdfs" / "wiaas_corrected_build"
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PDF = OUTPUT_DIR / "WIaaS_Asia_Alibaba_Pitch_Corrected_v2.pdf"
MAP_CROP = BUILD_DIR / "asia_map_crop.png"
WIAAS_WORKFLOW = ROOT / "n8n" / "exports" / "WIAAS-Asia.json"
CRISIS_WORKFLOW = ROOT / "n8n" / "exports" / "WIaaS-CrisisLens-Asia.json"

W, H = 1152.0, 648.0

PAPER = HexColor("#F5F1EA")
INK = HexColor("#122128")
MUTED = HexColor("#6E6B65")
LINE = HexColor("#AAA391")
SOFT = HexColor("#E9DFC9")
SOFT_2 = HexColor("#EFE7D7")
DARK = HexColor("#081116")
DARK_BOX = HexColor("#121C21")
TEAL = HexColor("#11889A")
RUST = HexColor("#B65334")
GOLD = HexColor("#BF861F")
GREEN = HexColor("#36885D")
BLUE = HexColor("#2D7896")
RED = HexColor("#B93C2F")
PURPLE = HexColor("#7657B5")
WHITE = HexColor("#F8F6F1")


def register_fonts() -> None:
    fonts = {
        "DeckSans": Path(r"C:\Windows\Fonts\arial.ttf"),
        "DeckSansBold": Path(r"C:\Windows\Fonts\arialbd.ttf"),
        "DeckSerif": Path(r"C:\Windows\Fonts\georgia.ttf"),
        "DeckSerifBold": Path(r"C:\Windows\Fonts\georgiab.ttf"),
        "DeckMono": Path(r"C:\Windows\Fonts\consola.ttf"),
    }
    for name, path in fonts.items():
        if not path.exists():
            raise FileNotFoundError(f"Required font is missing: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path)))


def y_from_top(top: float, height: float = 0) -> float:
    return H - top - height


def paragraph(
    c: canvas.Canvas,
    value: str,
    x: float,
    top: float,
    width: float,
    height: float,
    *,
    font: str = "DeckSans",
    size: float = 11,
    leading: float | None = None,
    color=INK,
    align: int = TA_LEFT,
    bold: bool = False,
    allow_shrink: bool = True,
) -> float:
    actual_font = "DeckSansBold" if bold and font == "DeckSans" else font
    if bold and font == "DeckSerif":
        actual_font = "DeckSerifBold"
    current_size = size
    min_size = max(6.5, size - 3.0)
    while True:
        style = ParagraphStyle(
            name="deck",
            fontName=actual_font,
            fontSize=current_size,
            leading=(leading or size * 1.24) * (current_size / size),
            textColor=color,
            alignment=align,
            spaceAfter=0,
            spaceBefore=0,
            splitLongWords=True,
        )
        p = Paragraph(value, style)
        _, ph = p.wrap(width, height)
        if ph <= height + 0.1 or not allow_shrink or current_size <= min_size:
            if ph > height + 0.1:
                raise ValueError(f"Text overflow ({ph:.1f}>{height:.1f}): {value[:80]}")
            p.drawOn(c, x, y_from_top(top, ph))
            return ph
        current_size -= 0.4


def line(c: canvas.Canvas, x1: float, top1: float, x2: float, top2: float, color=LINE, width: float = 1) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, H - top1, x2, H - top2)


def rect(c: canvas.Canvas, x: float, top: float, width: float, height: float, fill, stroke=LINE, sw: float = 0.8, radius: float = 0) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(sw)
    y = y_from_top(top, height)
    if radius:
        c.roundRect(x, y, width, height, radius, fill=1, stroke=1)
    else:
        c.rect(x, y, width, height, fill=1, stroke=1)


def arrow(c: canvas.Canvas, x1: float, top1: float, x2: float, top2: float, color=TEAL, width: float = 1.1) -> None:
    line(c, x1, top1, x2, top2, color, width)
    import math

    angle = math.atan2(-(top2 - top1), x2 - x1)
    length = 6
    wing = 3.4
    tx, ty = x2, H - top2
    bx = tx - length * math.cos(angle)
    by = ty - length * math.sin(angle)
    p1 = (bx + wing * math.sin(angle), by - wing * math.cos(angle))
    p2 = (bx - wing * math.sin(angle), by + wing * math.cos(angle))
    c.setFillColor(color)
    c.setStrokeColor(color)
    path = c.beginPath()
    path.moveTo(tx, ty)
    path.lineTo(*p1)
    path.lineTo(*p2)
    path.close()
    c.drawPath(path, fill=1, stroke=0)


def frame(c: canvas.Canvas, page: int, plate: str) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(INK)
    c.setLineWidth(0.8)
    c.rect(28, 28, W - 56, H - 56, fill=0, stroke=1)
    # Atlas corner marks
    for x, sx in ((28, -1), (W - 28, 1)):
        line(c, x - 5 * sx, 28, x + 5 * sx, 28, INK, 0.8)
        line(c, x, 23, x, 33, INK, 0.8)
        line(c, x - 5 * sx, H - 28, x + 5 * sx, H - 28, INK, 0.8)
        line(c, x, H - 33, x, H - 23, INK, 0.8)
    paragraph(c, "WIaaS ASIA FIELD ATLAS", 46, 37, 330, 12, font="DeckMono", size=6.4, color=MUTED)
    paragraph(c, f"PLATE {page:02d} - {plate.upper()}", 790, 37, 315, 12, font="DeckMono", size=6.4, color=MUTED, align=TA_RIGHT)
    paragraph(c, "DEVELOPED WITH QODER + N8N ORCHESTRATION", 46, 610, 420, 10, font="DeckMono", size=5.8, color=MUTED)
    paragraph(c, f"{page:02d} / 12", 1032, 610, 72, 10, font="DeckMono", size=5.8, color=MUTED, align=TA_RIGHT)


def title_block(c: canvas.Canvas, kicker: str, title: str, subtitle: str) -> None:
    line(c, 52, 83, 87, 83, RUST, 2.0)
    paragraph(c, kicker.upper(), 100, 78, 400, 14, font="DeckMono", size=6.9, color=RUST)
    size = 30 if len(title) < 54 else 27
    paragraph(c, title, 52, 98, 1048, 42, font="DeckSerif", size=size, leading=size * 1.04, color=INK, bold=True)
    paragraph(c, subtitle, 52, 143, 1048, 34, font="DeckSans", size=11.1, leading=13.8, color=INK)


def card(
    c: canvas.Canvas,
    x: float,
    top: float,
    width: float,
    height: float,
    label: str,
    heading: str,
    body: str,
    accent=TEAL,
    *,
    dark: bool = False,
    body_size: float = 10.2,
) -> None:
    fill = DARK_BOX if dark else SOFT
    stroke = accent if dark else LINE
    rect(c, x, top, width, height, fill, stroke, 0.9, 4 if dark else 0)
    label_color = accent
    head_color = WHITE if dark else INK
    body_color = HexColor("#BFC7C9") if dark else MUTED
    paragraph(c, label.upper(), x + 18, top + 16, width - 36, 13, font="DeckMono", size=6.5, color=label_color)
    line(c, x + 18, top + 38, x + 70, top + 38, accent, 1.5)
    paragraph(c, heading, x + 18, top + 49, width - 36, 27, font="DeckSerif", size=14.2, leading=16.2, color=head_color, bold=True)
    paragraph(c, body, x + 18, top + 83, width - 36, height - 96, font="DeckSans", size=body_size, leading=body_size * 1.27, color=body_color)


def mini_box(c: canvas.Canvas, x: float, top: float, width: float, height: float, heading: str, body: str, accent=TEAL, *, dark: bool = False) -> None:
    rect(c, x, top, width, height, DARK_BOX if dark else SOFT_2, accent, 0.9, 5)
    paragraph(c, heading, x + 12, top + 10, width - 24, 18, font="DeckSans", size=9.5, leading=11, color=WHITE if dark else INK, bold=True)
    paragraph(c, body, x + 12, top + 31, width - 24, height - 38, font="DeckSans", size=7.7 if dark else 8.4, leading=9.7 if dark else 10.2, color=HexColor("#BFC7C9") if dark else MUTED)


def agent_card(
    c: canvas.Canvas,
    x: float,
    top: float,
    width: float,
    height: float,
    label: str,
    heading: str,
    intro: str,
    points: Sequence[str],
    accent,
) -> None:
    rect(c, x, top, width, height, SOFT, LINE, 0.8)
    paragraph(c, label.upper(), x + 18, top + 15, width - 36, 12, font="DeckMono", size=6.4, color=accent)
    line(c, x + 18, top + 37, x + 72, top + 37, accent, 1.5)
    paragraph(c, heading, x + 18, top + 49, width - 36, 27, font="DeckSerif", size=14.5, leading=16.5, color=INK, bold=True)
    paragraph(c, intro, x + 18, top + 82, width - 36, 32, font="DeckSans", size=8.8, leading=10.8, color=MUTED)
    point_top = top + 124
    for index, point in enumerate(points, start=1):
        row_top = point_top + (index - 1) * 32
        c.setFillColor(accent)
        c.circle(x + 28, y_from_top(row_top + 8), 7, fill=1, stroke=0)
        paragraph(c, str(index), x + 22, row_top + 3, 12, 11, font="DeckSans", size=6.5, color=WHITE, bold=True, align=TA_CENTER)
        paragraph(c, point, x + 44, row_top, width - 62, 28, font="DeckSans", size=8.4, leading=10.3, color=INK)


def workflow_stage(
    c: canvas.Canvas,
    x: float,
    top: float,
    width: float,
    height: float,
    index: int,
    title: str,
    summary: str,
    nodes: Sequence[str],
    accent,
) -> None:
    rect(c, x, top, width, height, DARK_BOX, accent, 0.9, 6)
    c.setFillColor(accent)
    c.rect(x, y_from_top(top, 4), width, 4, fill=1, stroke=0)
    paragraph(c, f"{index:02d}", x + 13, top + 14, 24, 13, font="DeckMono", size=6.6, color=accent)
    paragraph(c, f"{len(nodes)} NODES", x + width - 72, top + 14, 58, 13, font="DeckMono", size=6.2, color=accent, align=TA_RIGHT)
    paragraph(c, title, x + 13, top + 34, width - 26, 22, font="DeckSans", size=10.4, leading=12, color=WHITE, bold=True)
    paragraph(c, summary, x + 13, top + 62, width - 26, 34, font="DeckSans", size=7.4, leading=9, color=HexColor("#BFC7C9"))
    line(c, x + 13, top + 101, x + width - 13, top + 101, HexColor("#334148"), 0.6)
    clean_nodes = [" ".join(name.split()) for name in nodes]
    paragraph(c, "<br/>".join(clean_nodes), x + 13, top + 111, width - 26, height - 123, font="DeckMono", size=6.45, leading=8.05, color=HexColor("#D6DCDE"))


def validate_node_groups(path: Path, groups: Sequence[Sequence[str]]) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    actual = [node["name"] for node in data["nodes"]]
    grouped = [name for group in groups for name in group]
    if len(grouped) != len(set(grouped)):
        raise ValueError(f"Duplicate workflow node in grouped diagram: {path.name}")
    missing = sorted(set(actual) - set(grouped))
    extra = sorted(set(grouped) - set(actual))
    if missing or extra or len(grouped) != len(actual):
        raise ValueError(f"Workflow grouping mismatch for {path.name}. Missing={missing}, extra={extra}")
    return len(actual)


def footer_note(c: canvas.Canvas, x: float, top: float, width: float, height: float, label: str, body: str, accent=RUST) -> None:
    rect(c, x, top, width, height, SOFT, LINE, 0.8)
    paragraph(c, label.upper(), x + 22, top + 16, width - 44, 12, font="DeckMono", size=6.5, color=accent)
    paragraph(c, body, x + 22, top + 36, width - 44, height - 46, font="DeckSans", size=10.3, leading=12.5, color=INK, bold=True)


def dark_panel(c: canvas.Canvas, x: float, top: float, width: float, height: float) -> None:
    rect(c, x, top, width, height, DARK, HexColor("#26353C"), 0.9, 9)
    c.setStrokeColor(HexColor("#162329"))
    c.setLineWidth(0.35)
    for gx in range(int(x + 28), int(x + width - 10), 32):
        c.line(gx, y_from_top(top + height - 18), gx, y_from_top(top + 18))
    for gy in range(int(top + 30), int(top + height - 10), 32):
        c.line(x + 16, H - gy, x + width - 16, H - gy)


def build_map_crop() -> None:
    if not SOURCE_RENDER.exists():
        raise FileNotFoundError(f"Rendered source page is missing: {SOURCE_RENDER}")
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE_RENDER) as image:
        # The original cover contains the supplied Asia border illustration on the right.
        crop = image.crop((1190, 180, 2240, 1135))
        crop.save(MAP_CROP, optimize=True)


def slide_01(c: canvas.Canvas) -> None:
    frame(c, 1, "field briefing")
    line(c, 52, 88, 87, 88, RUST, 2.0)
    paragraph(c, "ALIBABA CLOUD HACKATHON SUBMISSION", 100, 83, 420, 14, font="DeckMono", size=6.8, color=RUST)
    paragraph(c, "WIaaS Asia", 58, 126, 510, 72, font="DeckSerif", size=51, leading=53, color=INK, bold=True)
    paragraph(c, "Weather Intelligence as a Service", 60, 205, 520, 40, font="DeckSerif", size=24, leading=27, color=RUST)
    paragraph(
        c,
        "A decision layer for Asia that converts weather evidence into practical guidance for farms, utilities, logistics teams, outdoor workers, and emergency coordinators.",
        60,
        260,
        505,
        68,
        font="DeckSans",
        size=12.5,
        leading=16,
        color=INK,
    )
    line(c, 60, 350, 565, 350, LINE, 0.8)
    paragraph(
        c,
        "Developed with Qoder. Orchestrated with n8n. FastAPI calculates deterministic weather, grid, water, and resource metrics before any language model interprets them.",
        60,
        372,
        505,
        68,
        font="DeckSans",
        size=11.4,
        leading=14.2,
        color=INK,
        bold=True,
    )
    paragraph(c, "Made by Muhammad Abdullah", 60, 525, 320, 20, font="DeckSans", size=11.2, color=INK, bold=True)
    paragraph(c, "LinkedIn: mohammad-abdullah-25ba1721b", 60, 555, 360, 14, font="DeckSans", size=8.5, color=MUTED)
    paragraph(c, "GitHub: abdxllxh/WIAAS---Asia", 60, 573, 360, 14, font="DeckSans", size=8.5, color=MUTED)
    paragraph(c, "ASIA OPERATING SCOPE", 610, 78, 470, 14, font="DeckMono", size=6.8, color=TEAL, align=TA_CENTER)
    c.drawImage(ImageReader(str(MAP_CROP)), 600, y_from_top(103, 445), width=505, height=445, preserveAspectRatio=True, anchor="c", mask="auto")


def slide_02(c: canvas.Canvas) -> None:
    frame(c, 2, "problem definition")
    title_block(c, "diagnostics", "The operational gap", "Forecast data exists. Teams still spend critical time translating it into a decision.")
    card(c, 62, 205, 326, 180, "01 / observation", "Forecasts stop before the decision", "Weather products report conditions and probabilities. Operators still decide when to irrigate, slow outdoor work, protect grid capacity, or reroute deliveries.", TEAL)
    card(c, 413, 205, 326, 180, "02 / coordination", "Teams interpret separate views", "Farms, utilities, logistics teams, and crisis desks often work from different dashboards. The result can be slower and inconsistent action.", RUST)
    card(c, 764, 205, 326, 180, "03 / locality", "Local context changes the risk", "Coastal humidity, desert heat, monsoon runoff, typhoon exposure, and mountain hydrology require decisions at city and district level.", GOLD)
    footer_note(c, 76, 430, 1000, 104, "Why WIaaS exists", "WIaaS keeps the selected location attached to a shared physics-based state. It then routes only the decision path needed for the operator's question.", RUST)


def slide_03(c: canvas.Canvas) -> None:
    frame(c, 3, "response architecture")
    title_block(c, "backend first design", "Deterministic state before model reasoning", "FastAPI calculates measurable conditions. The workflows interpret that state and communicate the action.")
    xs = [52, 324, 596, 868]
    items = [
        ("01 DATA INGEST", "Open-Meteo telemetry, the region registry, map selection, radar metadata, and the user's question."),
        ("02 PHYSICS ENGINE", "VPD, heat index, wet bulb, grid demand change, evaporation stress, and the resource ledger."),
        ("03 DECISION ROUTING", "Rules choose a direct metric, an operational report, or a CrisisLens threat assessment."),
        ("04 FIELD ACTION", "A structured brief explains what matters for the selected role and location."),
    ]
    accents = [TEAL, RUST, GOLD, GREEN]
    for i, ((head, body), x, accent) in enumerate(zip(items, xs, accents)):
        mini_box(c, x, 225, 232, 142, head, body, accent)
        if i < 3:
            arrow(c, x + 234, 296, xs[i + 1] - 8, 296, accent, 1.2)
    footer_note(c, 84, 426, 984, 105, "System boundary", "Core physics remains deterministic. Language models interpret a bounded state vector, while missing evidence stays explicit in the response.", RUST)


def slide_04(c: canvas.Canvas) -> None:
    frame(c, 4, "two agent system")
    title_block(c, "shared weather state", "Two agents, one shared weather state", "The Weather Agent handles daily decisions. CrisisLens handles threat intelligence and emergency guidance.")
    agent_card(
        c,
        60,
        200,
        460,
        256,
        "Agent 01 / weather operations",
        "WIaaS Weather Agent",
        "Turns live weather and backend calculations into routine operating guidance.",
        [
            "Weather state: Open-Meteo telemetry, VPD, wet bulb, heat index, and resource metrics.",
            "Decisions: irrigation, worker heat safety, grid capacity, and logistics continuity.",
            "Output: direct metrics, concise answers, or a structured cross-sector report.",
        ],
        TEAL,
    )
    agent_card(
        c,
        632,
        200,
        460,
        256,
        "Agent 02 / crisis intelligence",
        "CrisisLens Agent",
        "Combines hazard evidence with the same selected location and calculated weather state.",
        [
            "Evidence: Open-Meteo, GDACS, GDELT, and optional NASA FIRMS fire detections.",
            "Assessment: hazard severity, confidence, affected area, and stakeholder exposure.",
            "Safety: separates observations from inference and labels unavailable sources.",
        ],
        RUST,
    )
    line(c, 520, 328, 528, 328, TEAL, 1.2)
    line(c, 624, 328, 632, 328, RUST, 1.2)
    rect(c, 528, 272, 96, 112, DARK, GOLD, 1.0, 9)
    c.setFillColor(TEAL)
    c.rect(528, y_from_top(272, 5), 48, 5, fill=1, stroke=0)
    c.setFillColor(RUST)
    c.rect(576, y_from_top(272, 5), 48, 5, fill=1, stroke=0)
    paragraph(c, "ONE SHARED", 538, 292, 76, 16, font="DeckMono", size=6.5, color=GOLD, align=TA_CENTER)
    paragraph(c, "WEATHER", 536, 315, 80, 19, font="DeckSerif", size=11.4, color=WHITE, bold=True, align=TA_CENTER)
    paragraph(c, "STATE", 536, 337, 80, 19, font="DeckSerif", size=11.4, color=WHITE, bold=True, align=TA_CENTER)
    paragraph(c, "location<br/>telemetry<br/>calculated metrics", 540, 361, 72, 32, font="DeckSans", size=6.2, leading=7.7, color=HexColor("#C5CCCE"), align=TA_CENTER)
    footer_note(c, 110, 492, 932, 78, "Shared inputs", "Region, coordinates, timezone, climate context, live telemetry, calculated physics, resource ledger, and recent session context.", GOLD)


def slide_05(c: canvas.Canvas) -> None:
    frame(c, 5, "WIaaS workflow branches")
    title_block(c, "operational intelligence", "Branches inside the WIaaS Weather Agent", "These internal workflow functions share one calculated state. Users still interact with one Weather Agent.")
    left = [
        ("Research brief", "Explains baselines, evidence, and limitations", TEAL),
        ("Agriculture guidance", "Irrigation timing, crop stress, and disease pressure", GREEN),
        ("Grid outlook", "Capacity headroom, cooling load, and blackout risk", GOLD),
    ]
    right = [
        ("Logistics continuity", "Route disruption and fuel overhead", HexColor("#D27824")),
        ("Conversation response", "Short English or Urdu answers with session context", BLUE),
        ("Safe fallback", "States limits when evidence is unavailable", RED),
    ]
    tops = [214, 311, 408]
    for (head, body, accent), top in zip(left, tops):
        mini_box(c, 82, top, 292, 68, head, body, accent)
        arrow(c, 374, top + 34, 438, 327, accent)
    for (head, body, accent), top in zip(right, tops):
        mini_box(c, 778, top, 292, 68, head, body, accent)
        arrow(c, 714, 327, 778, top + 34, accent)
    rect(c, 438, 272, 276, 110, DARK, TEAL, 1.1, 10)
    paragraph(c, "Shared calculated state", 458, 296, 236, 28, font="DeckSerif", size=16.2, color=WHITE, bold=True, align=TA_CENTER)
    paragraph(c, "FastAPI completes the physics before workflow reasoning", 468, 334, 216, 32, font="DeckSans", size=8.8, leading=11.2, color=WHITE, align=TA_CENTER)
    footer_note(c, 160, 514, 832, 64, "Design rule", "Role specific guidance can change. The evidence base and selected location remain consistent.", TEAL)


def slide_06(c: canvas.Canvas) -> None:
    frame(c, 6, "crisis intelligence")
    title_block(c, "CrisisLens agent", "Evidence to a safe threat response", "CrisisLens gathers local signals, records uncertainty, and returns guidance for the stakeholder who needs it.")
    sources = [
        ("Open-Meteo", "Weather and apparent heat", TEAL),
        ("GDACS", "Global disaster alerts", RUST),
        ("GDELT", "Regional news context", GOLD),
        ("NASA FIRMS", "Optional fire feed. API key required", HexColor("#D27824")),
    ]
    outputs = [
        ("Citizens and workers", "Exposure timing and protection steps", BLUE),
        ("Farmers", "Crop, livestock, and irrigation response", GREEN),
        ("Emergency teams", "Public warning and response priorities", RED),
        ("Grid and logistics", "Capacity, route, and continuity guidance", GOLD),
    ]
    tops = [202, 288, 374, 460]
    input_bus_x = 416
    output_bus_x = 736
    line(c, input_bus_x, 233, input_bus_x, 491, HexColor("#9AA3A5"), 0.8)
    line(c, output_bus_x, 233, output_bus_x, 491, HexColor("#9AA3A5"), 0.8)
    for (head, body, accent), top in zip(sources, tops):
        line(c, 352, top + 31, input_bus_x, top + 31, accent, 1.0)
    arrow(c, input_bus_x, 346, 464, 346, TEAL, 1.2)
    arrow(c, 688, 346, output_bus_x, 346, RUST, 1.2)
    for (head, body, accent), top in zip(outputs, tops):
        arrow(c, output_bus_x, top + 31, 800, top + 31, accent, 1.0)
    for (head, body, accent), top in zip(sources, tops):
        mini_box(c, 52, top, 300, 62, head, body, accent)
    for (head, body, accent), top in zip(outputs, tops):
        mini_box(c, 800, top, 300, 62, head, body, accent)
    rect(c, 464, 260, 224, 172, DARK, RUST, 1.1, 10)
    c.setFillColor(RUST)
    c.rect(464, y_from_top(260, 5), 224, 5, fill=1, stroke=0)
    paragraph(c, "CRISISLENS", 486, 282, 180, 14, font="DeckMono", size=6.7, color=RUST, align=TA_CENTER)
    paragraph(c, "Threat assessment", 480, 305, 192, 26, font="DeckSerif", size=14.8, color=WHITE, bold=True, align=TA_CENTER)
    line(c, 488, 342, 664, 342, HexColor("#38464C"), 0.6)
    paragraph(c, "01  Normalize evidence", 492, 354, 168, 16, font="DeckSans", size=8.2, color=WHITE, bold=True)
    paragraph(c, "02  Score severity and confidence", 492, 378, 168, 16, font="DeckSans", size=8.2, color=WHITE, bold=True)
    paragraph(c, "03  Bound the recommended action", 492, 402, 168, 16, font="DeckSans", size=8.2, color=WHITE, bold=True)
    footer_note(c, 386, 514, 380, 62, "Safety rule", "Observations and inference stay separate. Missing sources remain visible.", RUST)


def slide_07(c: canvas.Canvas) -> None:
    frame(c, 7, "WIaaS workflow system")
    title_block(c, "audited workflow map", "WIaaS Weather Agent workflow", "Every node in the 58-node export is represented below, grouped by its actual execution role.")
    groups = [
        [
            "Manual Trigger", "Webhook Trigger", "Regex Router", "Route Switch", "Crisis Agent", "FW Crisis Model",
            "Crisis Response", "Math Calc", "Sentiment Agent", "FW Sentiment Model", "Sentiment Response",
            "To WIaaS Pipeline", "FAQ To Pipeline", "Fallback Classifier", "FW Fallback Model", "Fallback To Pipeline",
        ],
        [
            "Intent Router2", "Fetch Regions Registry", "Match Region", "If", "Region Found?", "HTTP Request",
            "Check HTTP Success", "Prepare State Vector", "Set Fallback State Vector", "Region Missing?",
            "Ask For Region", "Region Not Found Response", "Which Regions?",
        ],
        [
            "Fast Answer?", "Fast Answer Formatter", "Risk Only?", "Risk Answer", "FAQ Channel?", "Respond FAQ",
            "FAQs", "Fetch Regions For List", "Format Region List", "Conversation Agent", "FW Chat Model",
            "Conversation Memory", "Chat Sanitizer",
        ],
        [
            "Research Agent", "FW Research Model", "Save Research Output", "Agri  Agent", "FW Sector Model",
            "Save Agri Output", "Grid Agent", "Save Grid Output", "Logistic Agent", "FW Logistics Model",
            "Save Logistics Output", "Compile For Report", "Sanitizer", "Analysis Channel?", "Respond Analysis", "Chat",
        ],
    ]
    count = validate_node_groups(WIAAS_WORKFLOW, groups)
    dark_panel(c, 52, 188, 1048, 392)
    specs = [
        ("Entry and command routes", "Receives requests and handles direct utility, crisis, sentiment, FAQ, and fallback routes.", RUST),
        ("Region and state", "Resolves the selected place, calls backend analytics, and prepares the shared state vector.", GREEN),
        ("Fast and conversation paths", "Handles direct metrics, region lists, FAQs, risk-only replies, and contextual conversation.", BLUE),
        ("Specialists and delivery", "Runs the operational chain, compiles the report, sanitizes output, and returns chat or analysis.", GOLD),
    ]
    xs = [70, 326, 582, 838]
    for i, ((title, summary, accent), nodes, x) in enumerate(zip(specs, groups, xs), start=1):
        workflow_stage(c, x, 211, 232, 310, i, title, summary, nodes, accent)
        if i < 4:
            arrow(c, x + 235, 252, xs[i] - 5, 252, accent, 0.9)
    paragraph(c, f"{count} OF {count} NODES AUDITED. MODEL AND SAVE NODES STAY WITH THE STEP THAT OWNS THEM.", 82, 545, 986, 14, font="DeckMono", size=6.3, color=HexColor("#A8B1B4"))


def slide_08(c: canvas.Canvas) -> None:
    frame(c, 8, "CrisisLens workflow system")
    title_block(c, "audited workflow map", "CrisisLens emergency workflow", "Every node in the 47-node export is represented below, including cache, skip, and persistence paths.")
    groups = [
        [
            "CrisisLens Webhook", "Load Data Table Memory", "Parse User Request", "Needs Conversational Decision?",
            "Conversational Decision Agent", "Apply Conversation Decision", "Route Cached Severity",
            "Build Cached Severity Response", "Route Cached Evidence", "Build Cached Evidence Response",
            "Route Cached Action", "Cached Action Agent", "Build Cached Action Response",
        ],
        [
            "Route Needs Geocode", "Geocode Region", "Prepare API Context", "Route Prepared Direct Response",
            "Route Weather API", "Route FIRMS API", "Route GDACS API", "Route GDELT API", "Skip Weather Data",
            "Skip FIRMS Data", "Skip GDACS Data", "Skip GDELT Data",
        ],
        [
            "Open-Meteo Weather API", "Tag Weather Data", "NASA FIRMS Fire API - ADD KEY", "Tag FIRMS Data",
            "GDACS Disaster Feed", "Tag GDACS Data", "GDELT Regional News API", "Tag News Data",
            "Merge API Results", "Normalize API Data", "Should Run OSINT?", "OSINT Correlation Agent",
            "Should Run Action?", "Action Recommendation Agent", "firework",
        ],
        [
            "Route Direct Response", "Build Frontend Response", "Save Conversation State", "Persist Data Table Memory",
            "Route Chat or Webhook Response", "Return to Chat", "Return to Frontend",
        ],
    ]
    count = validate_node_groups(CRISIS_WORKFLOW, groups)
    dark_panel(c, 52, 188, 1048, 392)
    specs = [
        ("Session and cached paths", "Loads memory, interprets follow-ups, and reuses recent severity, evidence, or action state.", HexColor("#7E8D94")),
        ("Location and dispatch", "Resolves coordinates and routes each configured source or explicit skip path.", GREEN),
        ("Evidence and reasoning", "Collects source data, normalizes it, then runs correlation and action reasoning when required.", RUST),
        ("Response and persistence", "Builds the frontend payload, stores session state, and returns through chat or webhook.", GOLD),
    ]
    xs = [70, 326, 582, 838]
    for i, ((title, summary, accent), nodes, x) in enumerate(zip(specs, groups, xs), start=1):
        workflow_stage(c, x, 211, 232, 310, i, title, summary, nodes, accent)
        if i < 4:
            arrow(c, x + 235, 252, xs[i] - 5, 252, accent, 0.9)
    paragraph(c, f"{count} OF {count} NODES AUDITED. NASA FIRMS REMAINS OPTIONAL UNTIL ITS API KEY IS CONFIGURED.", 82, 545, 986, 14, font="DeckMono", size=6.3, color=HexColor("#A8B1B4"))


def slide_09(c: canvas.Canvas) -> None:
    frame(c, 9, "model use and traceability")
    title_block(c, "controlled orchestration", "Routing controls model use", "The workflow reduces and labels the evidence before any specialist reasoning begins.")
    card(c, 70, 200, 320, 174, "Uncontrolled pattern", "One large weather prompt", "Raw data, full chat history, and every instruction enter one model call. The source of each conclusion becomes harder to trace.", RUST)
    card(c, 416, 200, 320, 174, "WIaaS approach", "Routed intelligence", "Deterministic routing, API normalization, compact state vectors, and cached follow ups narrow the task before reasoning.", TEAL)
    card(c, 762, 200, 320, 174, "Engineering benefit", "Smaller context and clearer paths", "Each branch receives fewer irrelevant fields. Structured responses make frontend handling and debugging more direct.", GREEN)
    features = [
        ("01", "Direct routes", "No model call for a simple metric"),
        ("02", "Compact state", "Only required evidence fields"),
        ("03", "Relevant branch", "Specialists run only when needed"),
        ("04", "Cached follow up", "Recent severity and evidence reuse"),
        ("05", "Strict JSON", "Stable fields for UI rendering"),
        ("06", "Evidence fallback", "Missing data stays explicit"),
    ]
    positions = [(78, 420), (410, 420), (742, 420), (78, 500), (410, 500), (742, 500)]
    for (num, head, body), (x, top) in zip(features, positions):
        rect(c, x, top, 310, 62, SOFT_2, LINE, 0.6)
        paragraph(c, num, x + 14, top + 18, 32, 14, font="DeckMono", size=6.7, color=RUST)
        paragraph(c, head, x + 48, top + 11, 238, 18, font="DeckSans", size=9.6, color=INK, bold=True)
        paragraph(c, body, x + 48, top + 31, 244, 22, font="DeckSans", size=7.9, leading=9.5, color=MUTED)


def slide_10(c: canvas.Canvas) -> None:
    frame(c, 10, "backend infrastructure")
    title_block(c, "FastAPI core", "FastAPI owns the measurable state", "The backend resolves locations, normalizes weather, calculates physics, and builds the values used by both agents.")
    left = [
        ("FastAPI routes", "Analytics, dynamic region registration, grid outlooks, client location, static frontend delivery, and text-to-speech.", RUST),
        ("Physics engine", "VPD, heat index, wet bulb, and stress indicators are calculated before model reasoning.", GOLD),
        ("Grid fallback", "The UI can receive a structured grid outlook even when the AI workflow is unavailable.", BLUE),
    ]
    right = [
        ("Weather pipeline", "Open-Meteo signals are cached and normalized into one schema for temperature, humidity, wind, and rain.", TEAL),
        ("Resource ledger", "Weather stress becomes explicit quantities for water loss, irrigation efficiency, grid demand, fuel overhead, and capacity.", GREEN),
        ("Bilingual speech", "English and Urdu input and neural playback reduce dependence on a dense technical dashboard.", HexColor("#69757A")),
    ]
    tops = [194, 296, 398]
    for (head, body, accent), top in zip(left, tops):
        mini_box(c, 66, top, 500, 84, head, body, accent)
    for (head, body, accent), top in zip(right, tops):
        mini_box(c, 586, top, 500, 84, head, body, accent)
    footer_note(c, 112, 510, 928, 68, "Backend contract", "Available evidence is explained. Partial evidence stays labeled. Direct metric requests use deterministic routes.", RUST)


def slide_11(c: canvas.Canvas) -> None:
    frame(c, 11, "human impact")
    title_block(c, "operating roles", "One shared state supports five roles", "Each role receives a different decision while the location, telemetry, and calculations remain consistent.")
    card(c, 64, 200, 330, 154, "01 / farmers", "Protect crop decisions", "Time irrigation, monitor crop stress, reduce evaporation loss, and respond to changing disease pressure.", GREEN)
    card(c, 411, 200, 330, 154, "02 / workers", "Reduce exposure risk", "Use clear guidance for heat intensity, hydration, work windows, and unsafe conditions.", RUST)
    card(c, 758, 200, 330, 154, "03 / business", "Protect continuity", "Track route disruption, fuel overhead, rainfall, and storm exposure from the same location context.", GOLD)
    card(c, 222, 390, 330, 154, "04 / crisis teams", "Coordinate response", "Separate evidence from inference, record confidence, and issue guidance that stays within the data.", RED)
    card(c, 600, 390, 330, 154, "05 / grid teams", "Anticipate demand", "Watch cooling load, transformer stress, demand change, and capacity headroom before service pressure increases.", BLUE)


def slide_12(c: canvas.Canvas) -> None:
    frame(c, 12, "impact and production path")
    title_block(c, "final field note", "Current demo and production path", "The core loop works today. Production deployment needs stronger observability, provider controls, and managed secrets.")
    paragraph(c, "WIaaS DECISION TYPES", 80, 206, 420, 14, font="DeckMono", size=6.7, color=TEAL, align=TA_CENTER)
    roles = [
        ("Agriculture", 80, 246, GREEN),
        ("Workforce", 382, 246, HexColor("#D0643A")),
        ("Business", 404, 362, PURPLE),
        ("Emergency", 348, 478, RED),
        ("Grid", 82, 478, BLUE),
    ]
    core_x, core_top, core_w, core_h = 228, 318, 154, 98
    core_center_x, core_center_top = core_x + core_w / 2, core_top + core_h / 2
    # Connections sit behind every label and the center node.
    for _, x, top, accent in roles:
        arrow(c, core_center_x, core_center_top, x + 64, top + 15, accent, 0.9)
    for label, x, top, accent in roles:
        rect(c, x, top, 128, 30, accent, accent, 0.5, 15)
        paragraph(c, label, x + 8, top + 8, 112, 14, font="DeckSans", size=8.2, color=WHITE, bold=True, align=TA_CENTER)
    rect(c, core_x, core_top, core_w, core_h, DARK, TEAL, 1.1, 10)
    c.setFillColor(TEAL)
    c.rect(core_x, y_from_top(core_top, 5), core_w, 5, fill=1, stroke=0)
    paragraph(c, "WIaaS", core_x + 18, core_top + 24, core_w - 36, 24, font="DeckSerif", size=17, color=WHITE, bold=True, align=TA_CENTER)
    paragraph(c, "WEATHER DECISION CORE", core_x + 14, core_top + 57, core_w - 28, 14, font="DeckMono", size=6.2, color=TEAL, align=TA_CENTER)
    paragraph(c, "one shared state", core_x + 18, core_top + 76, core_w - 36, 13, font="DeckSans", size=7.3, color=HexColor("#C5CCCE"), align=TA_CENTER)
    footer_note(c, 580, 196, 508, 98, "Current build", "FastAPI physics, a MapLibre Asia map, a 58-node WIaaS workflow, a 47-node CrisisLens workflow, bilingual chat, and neural speech.", RUST)
    footer_note(c, 580, 318, 508, 98, "Before production", "Add managed secrets, source health checks, traceable timestamps, token and latency measurement, and calibrated regional validation.", TEAL)
    footer_note(c, 580, 440, 508, 82, "Outcome", "One regional interface that connects weather evidence to a defensible next action.", GOLD)
    paragraph(c, "Weather evidence connected to a defensible next step", 580, 548, 508, 28, font="DeckSerif", size=18.2, leading=20, color=INK, bold=True)


SLIDES = [slide_01, slide_02, slide_03, slide_04, slide_05, slide_06, slide_07, slide_08, slide_09, slide_10, slide_11, slide_12]


def build() -> None:
    register_fonts()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    build_map_crop()
    c = canvas.Canvas(str(OUTPUT_PDF), pagesize=(W, H), pageCompression=1)
    c.setTitle("WIaaS Asia - Corrected Alibaba Hackathon Pitch Deck")
    c.setAuthor("Muhammad Abdullah")
    c.setSubject("Weather Intelligence as a Service for Asia")
    for draw_slide in SLIDES:
        draw_slide(c)
        c.showPage()
    c.save()
    print(OUTPUT_PDF)


if __name__ == "__main__":
    build()
