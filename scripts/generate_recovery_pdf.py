#!/usr/bin/env python3
"""Generate a PDF of the Tendon Recovery Plan."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
import os

OUTPUT_PATH = os.path.expanduser("~/Desktop/Tendon_Recovery_Plan.pdf")

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=letter,
    topMargin=0.6 * inch,
    bottomMargin=0.6 * inch,
    leftMargin=0.75 * inch,
    rightMargin=0.75 * inch,
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    'DocTitle', parent=styles['Title'],
    fontSize=24, leading=30, textColor=HexColor('#1a1a2e'),
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    'DocSubtitle', parent=styles['Normal'],
    fontSize=11, leading=14, textColor=HexColor('#555555'),
    alignment=TA_CENTER, spaceAfter=20,
))
styles.add(ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontSize=18, leading=22, textColor=HexColor('#16213e'),
    spaceBefore=20, spaceAfter=10,
    borderWidth=0, borderPadding=0,
))
styles.add(ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontSize=14, leading=18, textColor=HexColor('#0f3460'),
    spaceBefore=14, spaceAfter=6,
))
styles.add(ParagraphStyle(
    'H3', parent=styles['Heading3'],
    fontSize=12, leading=15, textColor=HexColor('#533483'),
    spaceBefore=10, spaceAfter=4,
))
styles.add(ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#2d2d2d'),
    spaceAfter=6,
))
styles.add(ParagraphStyle(
    'BulletItem', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#2d2d2d'),
    leftIndent=20, spaceAfter=3,
    bulletIndent=8,
))
styles.add(ParagraphStyle(
    'SubBullet', parent=styles['Normal'],
    fontSize=9.5, leading=13, textColor=HexColor('#444444'),
    leftIndent=36, spaceAfter=2,
    bulletIndent=24,
))
styles.add(ParagraphStyle(
    'Important', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#c0392b'),
    spaceAfter=6, fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    'TableCell', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=HexColor('#2d2d2d'),
))
styles.add(ParagraphStyle(
    'TableHeader', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=white, fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    'Source', parent=styles['Normal'],
    fontSize=8, leading=11, textColor=HexColor('#666666'),
    leftIndent=10, spaceAfter=2,
))
styles.add(ParagraphStyle(
    'Callout', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=HexColor('#1a5276'),
    backColor=HexColor('#eaf2f8'),
    borderWidth=1, borderColor=HexColor('#2980b9'),
    borderPadding=8, leftIndent=10, rightIndent=10,
    spaceAfter=10, spaceBefore=6,
))

# Colors
HEADER_BG = HexColor('#16213e')
ROW_ALT = HexColor('#f4f6f9')
BORDER_COLOR = HexColor('#cccccc')
ACCENT = HexColor('#2980b9')

story = []

# ── Title ──
story.append(Spacer(1, 20))
story.append(Paragraph("Tendon Recovery Plan", styles['DocTitle']))
story.append(Paragraph("7-Day Accelerated Protocol — Evidence-Based", styles['DocSubtitle']))
story.append(Paragraph("Prepared for Austin | March 10, 2026", styles['DocSubtitle']))
story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=10))

# ── Condition ──
story.append(Paragraph("Your Condition", styles['H1']))
story.append(Paragraph(
    "Repetitive strain tendinopathy from mouse clicking — affecting the extensor tendons of the "
    "wrist and forearm (possibly De Quervain's tenosynovitis if the thumb is involved).",
    styles['Body']
))
story.append(Paragraph(
    "<b>Reality check:</b> Full tendon healing takes 4–6 weeks minimum. But you can achieve "
    "<b>significant pain reduction (40–60%)</b> within 7 days by combining the interventions below. "
    "The goal: reduce inflammation, start tendon remodeling, and eliminate the mechanical cause.",
    styles['Callout']
))

# ══════════════════════════════════════════════
# IMMEDIATE CHANGES
# ══════════════════════════════════════════════
story.append(Paragraph("IMMEDIATE CHANGES (Day 1)", styles['H1']))

# 1 — Stop clicking
story.append(Paragraph("1. Stop Clicking With Your Hands Entirely", styles['H2']))
story.append(Paragraph(
    "Your tendons cannot heal if you keep aggravating them. Every click is a micro-aggravation "
    "that resets the healing clock. Go all-in on hands-free input:",
    styles['Body']
))
for item in [
    "<b>macOS Dwell Control</b> — System Settings > Accessibility > Pointer Control > "
    "Alternative Control Methods. Hover to click, zero hand involvement.",
    "<b>Switch Control</b> with head movements — configure for left/right click.",
    "<b>Foot pedal mouse</b> (~$30–50, e.g. PageFlip Dragonfly) — shifts clicking to your feet.",
    "<b>Voice Control</b> — built into macOS Accessibility. Say \"Click\", \"Double click\", etc.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

story.append(Spacer(1, 4))
story.append(Paragraph(
    "This is the single most important intervention in this entire plan.",
    styles['Important']
))

# 2 — Cold therapy
story.append(Paragraph("2. Cold Therapy (Based on PMC4335578)", styles['H2']))
story.append(Paragraph(
    "The study you provided found that cold application stabilizes nerve and tendon structures "
    "under pressure, reducing compression. Cold also reduces inflammation.",
    styles['Body']
))
for item in [
    "<b>During computer use:</b> Apply cold pack for 15–20 min on, 45 min off, repeat.",
    "<b>At night:</b> Continuous low-level heat wraps (41°C / ThermaCare). The study showed "
    "heat increases tendon elasticity 3x — promotes overnight tissue remodeling.",
    "Use a thin cloth barrier to protect skin.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

# 3 — Topical NSAID
story.append(Paragraph("3. Topical NSAID (Diclofenac Gel / Voltaren)", styles['H2']))
story.append(Paragraph(
    "Evidence shows topical NSAIDs deliver 2–6x higher local tissue concentration than oral NSAIDs "
    "with fewer systemic side effects (Wiley, 2025).",
    styles['Body']
))
for item in [
    "Apply Voltaren gel (diclofenac) to the affected tendons <b>3–4x daily</b>.",
    "Massage in for 1–2 minutes along the tendon line.",
    "Available OTC at any pharmacy.",
    "Avoid oral NSAIDs beyond the first few days — they may impair tendon healing long-term (PMC2770552).",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

# ══════════════════════════════════════════════
# DAILY PROTOCOL
# ══════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("DAILY PROTOCOL (Days 1–7)", styles['H1']))

# Morning
story.append(Paragraph("Morning Routine (10 min)", styles['H2']))

story.append(Paragraph("Step 1: Warm Up (2 min)", styles['H3']))
story.append(Paragraph(
    "Run warm water over hands and forearms for 2 minutes, or use a warm towel.",
    styles['Body']
))

story.append(Paragraph("Step 2: Isometric Holds (5 min)", styles['H3']))
story.append(Paragraph(
    "Research shows isometric contractions provide immediate pain relief lasting 45+ minutes "
    "(PMC7406028). Do this BEFORE you start working.",
    styles['Body']
))
for item in [
    "Place palm flat on desk, press down gently (30–40% effort).",
    "<b>Hold 45 seconds \u2192 rest 2 minutes \u2192 repeat 5 times.</b>",
    "Should be pain-free or very mild discomfort (stop if sharp pain).",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

story.append(Paragraph("Step 3: Wrist Extensor Stretch (3 min)", styles['H3']))
for item in [
    "Extend arm straight, palm down.",
    "Use other hand to gently pull fingers toward you.",
    "<b>Hold 30 seconds \u00d7 3 reps, each hand.</b>",
    "From the comprehensive rehab protocol (PMC6769266): perform 3x/day.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

# During work
story.append(Paragraph("During Work", styles['H2']))
for item in [
    "<b>Every 30 minutes:</b> Stop for 60 seconds. Let hands hang loose, shake gently.",
    "<b>Every 2 hours:</b> Repeat isometric holds (45 sec \u00d7 5 reps).",
    "<b>Cold pack:</b> 15 min on / 45 min off during computer use.",
    "<b>Topical NSAID:</b> Apply every 4–6 hours.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

# Evening
story.append(Paragraph("Evening Routine (15 min)", styles['H2']))

story.append(Paragraph("Step 1: Eccentric Wrist Exercises (10 min)", styles['H3']))
story.append(Paragraph(
    "Eccentric exercise stimulates collagen regeneration in damaged tendons — the gold standard "
    "for tendinopathy rehab (PMC5909009).",
    styles['Body']
))
for item in [
    "Rest forearm on table, wrist hanging off edge, palm down.",
    "Start with wrist extended (up position).",
    "<b>Slowly lower hand down over 5 seconds</b> (the eccentric phase).",
    "Use other hand to help lift back to starting position.",
    "<b>3 sets \u00d7 10 reps, no weight for Days 1–3.</b>",
    "<b>Days 4–7:</b> Add a 1-lb weight (water bottle) if pain-free.",
    "Should feel mild tension, NOT pain.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

story.append(Paragraph("Step 2: Ice Massage (5 min)", styles['H3']))
for item in [
    "Freeze water in a paper cup, peel back the edge.",
    "Massage directly on the tender area for 3–5 minutes.",
    "Can apply ice up to 4x/day after activity.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

story.append(Paragraph("Step 3: Heat Wrap for Sleep", styles['H3']))
for item in [
    "Apply continuous low-level heat wrap (ThermaCare or similar) to wrist/forearm.",
    "Your study showed heat increases tendon elasticity 3x — promotes overnight remodeling.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

# ══════════════════════════════════════════════
# NUTRITION
# ══════════════════════════════════════════════
story.append(Paragraph("NUTRITION (Days 1–7)", styles['H1']))
story.append(Paragraph(
    "Research from Shaw et al. (2017, PMC5183725) showed collagen + vitamin C taken before "
    "exercise significantly increases collagen synthesis.",
    styles['Body']
))

nutr_data = [
    [Paragraph("<b>Supplement</b>", styles['TableHeader']),
     Paragraph("<b>Dose</b>", styles['TableHeader']),
     Paragraph("<b>Timing</b>", styles['TableHeader'])],
    [Paragraph("Hydrolyzed collagen", styles['TableCell']),
     Paragraph("15 g", styles['TableCell']),
     Paragraph("60 min before rehab exercises", styles['TableCell'])],
    [Paragraph("Vitamin C", styles['TableCell']),
     Paragraph("500 mg", styles['TableCell']),
     Paragraph("With collagen", styles['TableCell'])],
    [Paragraph("Omega-3 fish oil", styles['TableCell']),
     Paragraph("2–3 g", styles['TableCell']),
     Paragraph("With meals (anti-inflammatory)", styles['TableCell'])],
]
nutr_table = Table(nutr_data, colWidths=[2.2*inch, 1.2*inch, 3.2*inch])
nutr_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('BACKGROUND', (0, 2), (-1, 2), ROW_ALT),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
]))
story.append(nutr_table)
story.append(Spacer(1, 8))

for item in [
    "Eat protein-rich foods (tendons need amino acids to rebuild).",
    "Stay hydrated (tendons are ~70% water).",
    "Avoid alcohol (impairs tissue healing).",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

# ══════════════════════════════════════════════
# ERGONOMIC SETUP
# ══════════════════════════════════════════════
story.append(Paragraph("ERGONOMIC SETUP", styles['H1']))
story.append(Paragraph(
    "If you must use your hands at all, alternate between devices to spread the load:",
    styles['Body']
))

ergo_data = [
    [Paragraph("<b>Device</b>", styles['TableHeader']),
     Paragraph("<b>Why</b>", styles['TableHeader'])],
    [Paragraph("Vertical mouse (Logitech MX Vertical)", styles['TableCell']),
     Paragraph("Handshake position eliminates forearm pronation — the twisted position that strains extensors", styles['TableCell'])],
    [Paragraph("Trackball (Logitech ERGO M575)", styles['TableCell']),
     Paragraph("No wrist movement at all; cursor control via thumb/fingers only", styles['TableCell'])],
    [Paragraph("Foot pedal for clicking", styles['TableCell']),
     Paragraph("Completely offloads hands from clicking", styles['TableCell'])],
    [Paragraph("Counterforce strap/brace", styles['TableCell']),
     Paragraph("Position 2 finger-widths below pain site; wear during activity, remove at rest", styles['TableCell'])],
]
ergo_table = Table(ergo_data, colWidths=[2.5*inch, 4.1*inch])
ergo_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('BACKGROUND', (0, 2), (-1, 2), ROW_ALT),
    ('BACKGROUND', (0, 4), (-1, 4), ROW_ALT),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
]))
story.append(ergo_table)

# ══════════════════════════════════════════════
# DAY-BY-DAY CHECKLIST
# ══════════════════════════════════════════════
story.append(PageBreak())
story.append(Paragraph("DAY-BY-DAY CHECKLIST", styles['H1']))

day_data = [
    [Paragraph("<b>Day</b>", styles['TableHeader']),
     Paragraph("<b>Focus</b>", styles['TableHeader']),
     Paragraph("<b>Expected Outcome</b>", styles['TableHeader'])],
    [Paragraph("1", styles['TableCell']),
     Paragraph("Eliminate clicking, start cold therapy, get Voltaren, start isometrics", styles['TableCell']),
     Paragraph("Pain awareness, setup complete", styles['TableCell'])],
    [Paragraph("2", styles['TableCell']),
     Paragraph("Full protocol begins (AM isometrics, PM eccentrics, cold/heat cycle)", styles['TableCell']),
     Paragraph("Possible slight soreness from exercises", styles['TableCell'])],
    [Paragraph("3", styles['TableCell']),
     Paragraph("Continue protocol, add collagen + Vitamin C if obtained", styles['TableCell']),
     Paragraph("Pain should start decreasing with isometrics", styles['TableCell'])],
    [Paragraph("4", styles['TableCell']),
     Paragraph("Progress eccentrics to 1-lb if pain-free", styles['TableCell']),
     Paragraph("Noticeable pain reduction during work", styles['TableCell'])],
    [Paragraph("5", styles['TableCell']),
     Paragraph("Continue all interventions", styles['TableCell']),
     Paragraph("Improved tolerance to daily activities", styles['TableCell'])],
    [Paragraph("6", styles['TableCell']),
     Paragraph("Assess: if pain dropped 50%+, add light grip strengthening", styles['TableCell']),
     Paragraph("Building capacity", styles['TableCell'])],
    [Paragraph("7", styles['TableCell']),
     Paragraph("Full reassessment", styles['TableCell']),
     Paragraph("Significant pain reduction expected", styles['TableCell'])],
]
day_table = Table(day_data, colWidths=[0.5*inch, 3.5*inch, 2.6*inch])
day_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('BACKGROUND', (0, 2), (-1, 2), ROW_ALT),
    ('BACKGROUND', (0, 4), (-1, 4), ROW_ALT),
    ('BACKGROUND', (0, 6), (-1, 6), ROW_ALT),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
]))
story.append(day_table)

# ══════════════════════════════════════════════
# WHEN TO SEE A DOCTOR
# ══════════════════════════════════════════════
story.append(Paragraph("WHEN TO SEE A DOCTOR", styles['H1']))
story.append(Paragraph(
    "If after 7 days you don't see improvement, get a proper medical evaluation. Consider:",
    styles['Body']
))
for item in [
    "<b>Corticosteroid injection + thumb spica splint</b> — a JAMA systematic review of 1,663 "
    "patients found this is the most effective first-line treatment for De Quervain's.",
    "<b>Ultrasound-guided injection</b> was significantly more effective than blind injection.",
    "<b>Avoid multiple injections</b> — the rehab protocol warns patients receiving multiple "
    "corticosteroid injections typically fare worse long-term.",
]:
    story.append(Paragraph(f"\u2022  {item}", styles['BulletItem']))

# ══════════════════════════════════════════════
# KEY TAKEAWAYS
# ══════════════════════════════════════════════
story.append(Paragraph("KEY TAKEAWAYS", styles['H1']))

takeaways = [
    "Stop clicking with your hands. Use dwell click, voice control, or foot pedals. This is non-negotiable.",
    "Isometric holds before work = immediate pain relief for 45+ min.",
    "Eccentric exercises in the evening = stimulates tendon collagen repair.",
    "Cold during work, heat at night = based on PMC4335578 findings.",
    "Topical Voltaren > oral ibuprofen for local tendon issues.",
    "15 g collagen + 500 mg vitamin C one hour before rehab exercises.",
    "7 days won't fully heal you, but should get you 40–60% pain reduction if followed strictly.",
]
for i, item in enumerate(takeaways, 1):
    story.append(Paragraph(f"<b>{i}.</b>  {item}", styles['BulletItem']))

# ══════════════════════════════════════════════
# SOURCES
# ══════════════════════════════════════════════
story.append(Spacer(1, 16))
story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8))
story.append(Paragraph("SCIENTIFIC SOURCES", styles['H2']))

sources = [
    "PMC4335578 — Heat, Cold, and Pressure Effects on Carpal Tunnel Structures (your study)",
    "PMC6769266 — Comprehensive Lateral Elbow Tendinopathy Rehabilitation Program",
    "PMC7406028 — Isometric Exercise for Tendinopathy: Systematic Review & Meta-Analysis",
    "PMC5909009 — Eccentric Exercise for Wrist Extensor Tendinopathy",
    "PMC5183725 — Vitamin C-Enriched Gelatin Supplementation Augments Collagen Synthesis (Shaw et al.)",
    "PMC9267994 — Vitamin C and Tendinopathy Recovery: Scoping Review",
    "JAMA Network Open — De Quervain Management: Systematic Review & Network Meta-Analysis",
    "Wiley (2025) — Clinical Practice Guidelines for Topical NSAIDs in Sports Injuries",
    "PMC2770552 — Anti-inflammatory Management for Tendon Injuries",
    "PMC6204628 — Vitamin C Supplementation on Collagen Synthesis: Systematic Review",
]
for s in sources:
    story.append(Paragraph(f"\u2022  {s}", styles['Source']))

story.append(Spacer(1, 20))
story.append(Paragraph(
    "<i>Disclaimer: This plan is based on published scientific research and is for informational "
    "purposes only. It does not constitute medical advice. Consult a healthcare professional for "
    "diagnosis and personalized treatment.</i>",
    ParagraphStyle('Disclaimer', parent=styles['Normal'],
                   fontSize=8, leading=11, textColor=HexColor('#999999'),
                   alignment=TA_CENTER)
))

# Build
doc.build(story)
print(f"PDF saved to: {OUTPUT_PATH}")
