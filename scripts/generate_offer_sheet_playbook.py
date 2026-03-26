#!/usr/bin/env python3
"""
Generate the Offer Sheet Newsletter Growth Playbook PDF
The Offer Sheet = STR (Short-Term Rental) real estate investment newsletter
250K+ subscribers, daily property listings, Pro tier, on Beehiiv
Client of Adsora
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import os

# Colors
DARK = HexColor("#1a1a2e")
ACCENT = HexColor("#e94560")
BLUE = HexColor("#0f3460")
LIGHT_BG = HexColor("#f5f5f5")
WHITE = HexColor("#ffffff")
GRAY = HexColor("#666666")
LIGHT_GRAY = HexColor("#e0e0e0")
GREEN = HexColor("#2d6a4f")
TEAL = HexColor("#1a7a6d")

output_path = os.path.expanduser("~/Downloads/Offer_Sheet_Growth_Playbook.pdf")

doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    topMargin=0.75*inch,
    bottomMargin=0.75*inch,
    leftMargin=0.85*inch,
    rightMargin=0.85*inch,
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(name='CoverTitle', fontName='Helvetica-Bold', fontSize=28, leading=34, textColor=DARK, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name='CoverSubtitle', fontName='Helvetica', fontSize=14, leading=20, textColor=GRAY, alignment=TA_CENTER, spaceAfter=6))
styles.add(ParagraphStyle(name='SectionTitle', fontName='Helvetica-Bold', fontSize=20, leading=26, textColor=DARK, spaceBefore=20, spaceAfter=12))
styles.add(ParagraphStyle(name='SubSection', fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=BLUE, spaceBefore=14, spaceAfter=8))
styles.add(ParagraphStyle(name='SubSubSection', fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=ACCENT, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='Body', fontName='Helvetica', fontSize=10.5, leading=15, textColor=DARK, alignment=TA_JUSTIFY, spaceAfter=6))
styles.add(ParagraphStyle(name='BodyBold', fontName='Helvetica-Bold', fontSize=10.5, leading=15, textColor=DARK, spaceAfter=6))
styles.add(ParagraphStyle(name='BulletPt', fontName='Helvetica', fontSize=10.5, leading=15, textColor=DARK, leftIndent=20, spaceAfter=3, bulletIndent=8))
styles.add(ParagraphStyle(name='Callout', fontName='Helvetica-Oblique', fontSize=11, leading=16, textColor=BLUE, leftIndent=15, rightIndent=15, spaceBefore=8, spaceAfter=8, borderWidth=1, borderColor=BLUE, borderPadding=8, backColor=HexColor("#f0f4ff")))
styles.add(ParagraphStyle(name='ActionItem', fontName='Helvetica-Bold', fontSize=10.5, leading=15, textColor=GREEN, leftIndent=20, spaceAfter=4, bulletIndent=8))
styles.add(ParagraphStyle(name='TableHeader', fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=WHITE, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='TableCell', fontName='Helvetica', fontSize=9.5, leading=13, textColor=DARK))
styles.add(ParagraphStyle(name='SmallNote', fontName='Helvetica-Oblique', fontSize=9, leading=12, textColor=GRAY, spaceAfter=4))
styles.add(ParagraphStyle(name='TOCItem', fontName='Helvetica', fontSize=11, leading=18, textColor=DARK, leftIndent=10))

story = []

def bullet(text):
    story.append(Paragraph(f"<bullet>&bull;</bullet> {text}", styles['BulletPt']))

def action(text):
    story.append(Paragraph(f"<bullet>&rarr;</bullet> {text}", styles['ActionItem']))

def body(text):
    story.append(Paragraph(text, styles['Body']))

def callout(text):
    story.append(Paragraph(text, styles['Callout']))

def heading(text):
    story.append(Paragraph(text, styles['SectionTitle']))

def subheading(text):
    story.append(Paragraph(text, styles['SubSection']))

def subsubheading(text):
    story.append(Paragraph(text, styles['SubSubSection']))

def spacer(h=0.1):
    story.append(Spacer(1, h*inch))

def make_table(data, widths, header_color=BLUE):
    t = Table(data, colWidths=widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_color),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, HexColor("#f5f5f5")]),
        ('GRID', (0,0), (-1,-1), 0.5, LIGHT_GRAY),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t)

def TH(text):
    return Paragraph(f"<b>{text}</b>", styles['TableHeader'])

def TC(text):
    return Paragraph(text, styles['TableCell'])

# ════════════════════════════════════════════════════════
# COVER PAGE
# ════════════════════════════════════════════════════════
spacer(1.5)
story.append(Paragraph("THE OFFER SHEET", styles['CoverTitle']))
story.append(Paragraph("GROWTH PLAYBOOK", styles['CoverTitle']))
spacer(0.3)
story.append(Paragraph("A Complete Operating Manual for Scaling a 250K+ Subscriber", styles['CoverSubtitle']))
story.append(Paragraph("Short-Term Rental Investment Newsletter", styles['CoverSubtitle']))
spacer(0.2)
story.append(Paragraph("Based on Learnings from the New Media Summit  |  March 2026", styles['CoverSubtitle']))
spacer(0.4)

divider = Table([[""]],colWidths=[4*inch])
divider.setStyle(TableStyle([('LINEBELOW', (0,0), (-1,-1), 2, ACCENT)]))
story.append(divider)
spacer(0.3)

story.append(Paragraph("About The Offer Sheet", styles['SmallNote']))
bullet("Daily curated short-term rental (STR) investment opportunities")
bullet("250,000+ subscribers | Built on Beehiiv")
bullet("Free tier (1-2 properties/day) + Pro tier (10+ properties/day, filterable Google Sheet, private community, optimization tools)")
bullet("Audience: Real estate investors focused on Airbnb/STR properties")

spacer(0.2)
story.append(Paragraph("Frameworks synthesized from 11 presentations:", styles['SmallNote']))
presenters = [
    "Matt McGarry (GrowLetter) -- Newsletter Growth Frameworks",
    "Matt Paulson (MarketBeat, $50.7M revenue) -- Advanced List Growth & Monetization",
    "Chenell Basilio (Growth In Reverse) -- Content Strategy from Top Creators",
    "Anik Singal (UgenticAI, 34M+ views/mo) -- AI Content at Scale",
    "1440 Media (900M+ email opens/yr) -- Meta Ads for Newsletters",
    "Alexis Grant (They Got Acquired) -- Building a Sellable Media Business",
    "Sherrell Dorsey (The Plug, exited) -- First-Party Data Monetization",
    "Sam Gaudet (Dan Martell's team) -- Viral YouTube System",
    "Chandler Bolt (selfpublishing.com, $75M+) -- Books as Lead Magnets",
    "All Healthy Newsletter -- Newsletter Design & Engagement Tactics",
    "Haplin / HighLevel -- AI-Powered Sales & Marketing Flywheel",
]
for p in presenters:
    bullet(p)

spacer(0.4)
story.append(Paragraph("Prepared by Adsora  |  March 2026", styles['CoverSubtitle']))
story.append(PageBreak())

# ════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ════════════════════════════════════════════════════════
heading("TABLE OF CONTENTS")
spacer(0.15)

toc = [
    ("1.", "CONTENT STRATEGY -- Making Every Issue Insanely Valuable"),
    ("2.", "THE MAGIC FRAMEWORK -- Organic Subscriber Growth"),
    ("3.", "THE ADAPT ENGINE -- Repurposing Each Issue Into 5-10 Social Posts"),
    ("4.", "AI-POWERED CONTENT -- Scaling Property Research & Writing"),
    ("5.", "EMAIL DELIVERABILITY -- WE-PAC Welcome Email + Deliverability Detox"),
    ("6.", "MONETIZATION -- 10 Revenue Streams Beyond Pro Subscriptions"),
    ("7.", "FIRST-PARTY DATA -- The Data Flywheel for Premium Revenue"),
    ("8.", "META ADS -- 2026 Playbook for Newsletter Subscriber Acquisition"),
    ("9.", "YOUTUBE & VIDEO -- Building a Viral STR Brand"),
    ("10.", "BUILDING FOR EXIT -- Profit, Recurring Revenue & Sellability"),
    ("11.", "NEWSLETTER DESIGN -- Anatomy of a High-Performing Issue"),
    ("12.", "THE GROWTH FLYWHEEL -- Capture, Nurture, Close, Evangelize, Reactivate"),
    ("13.", "SMS & PHONE -- The Untapped Channel"),
    ("14.", "BOOKS AS LEAD MAGNETS -- Authority in the STR Space"),
    ("15.", "30-DAY QUICK-START IMPLEMENTATION PLAN"),
    ("16.", "KEY METRICS DASHBOARD & BENCHMARKS"),
]
for num, desc in toc:
    story.append(Paragraph(f"<b>{num}</b> {desc}", styles['TOCItem']))

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 1: CONTENT STRATEGY
# ════════════════════════════════════════════════════════
heading("PART 1: CONTENT STRATEGY")
subheading("Making Every Issue Insanely Valuable")

body(
    "Chenell Basilio studied 80+ top creators and found one universal truth: the newsletters that grow fastest "
    "create what she calls <b>Insanely Valuable (IV) Content</b> -- the kind readers frantically open, save, and share. "
    "The Offer Sheet already has strong bones (daily curated STR deals), but there's a framework to make "
    "every issue irresistible."
)

subsubheading("The 6 Buckets of IV Content -- Applied to The Offer Sheet")
body("Each issue should hit at least 2 of these 6 buckets. Combining more = exponentially more valuable:")

make_table([
    [TH("Bucket"), TH("What It Means"), TH("Offer Sheet Application")],
    [TC("1. Make Money"), TC("Help readers earn more"), TC("Feature properties with proven revenue data, ROI projections, and cap rates. Show real Airbnb income screenshots when possible. 'This property is generating $8,200/mo on Airbnb.'")],
    [TC("2. Save Money"), TC("Help readers avoid waste"), TC("Flag overpriced listings, markets with declining STR regulations, hidden costs (HOA, renovation needs). 'Skip this one -- the county just passed a 90-day STR cap.'")],
    [TC("3. Save Time"), TC("Help readers be efficient"), TC("The core value prop: curating 10+ deals daily so investors don't have to search. Enhance with pre-calculated metrics, area comps, and direct booking links.")],
    [TC("4. Entertain / Feel"), TC("Evoke emotion"), TC("Feature jaw-dropping properties ('This treehouse Airbnb grosses $180K/yr'), wild deal stories, before/after renovations, reader success stories.")],
    [TC("5. Teach / Feel Smart"), TC("Make readers knowledgeable"), TC("Market trend analysis, STR regulation updates, tax strategy tips, new platform features, seasonal demand patterns by market.")],
    [TC("6. Speed to Market"), TC("Help readers act fast"), TC("'This just hit the market 2 hours ago.' Provide ready-to-use offer templates, financing contacts, property management referrals for each listing.")],
], [1.2*inch, 1.6*inch, 3.4*inch])

spacer()
callout(
    "The Offer Sheet's daily listings already nail Bucket 3 (Save Time) and Bucket 1 (Make Money). "
    "The biggest growth opportunity is layering in Buckets 5 (Teach) and 6 (Speed to Market) -- "
    "adding market intelligence and ready-to-act resources that make the newsletter indispensable, not just informative."
)

subsubheading("The Momentum Framework")
body(
    "Growth = IV Content + Momentum (distribution activities). Without both, you stall. "
    "At 250K subscribers, The Offer Sheet has momentum. The question is: is the content IV enough "
    "that readers share it organically? The signals to track:"
)
bullet("<b>Forwards/Shares:</b> Are readers sending issues to their investor friends? This is the #1 organic growth driver.")
bullet("<b>Replies:</b> Are readers responding with questions about specific properties?")
bullet("<b>Screenshots:</b> Are readers sharing property listings on social media or in investor groups?")
bullet("<b>Saves:</b> Are readers bookmarking the Google Sheet or specific issues?")

subsubheading("ACTION ITEMS")
action("Audit the last 10 issues against the 6 buckets -- identify which buckets are underrepresented")
action("Add a weekly 'Market Intel' section with STR regulation changes, seasonal trends, and rate data (Bucket 5)")
action("Add a 'Speed to Market' box per listing: financing options, PM contacts, estimated rehab cost (Bucket 6)")
action("Add 1 'jaw-drop' property per issue -- the aspirational listing that gets screenshotted and shared (Bucket 4)")
action("Track forward rate and reply rate as primary content quality KPIs in Beehiiv")

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 2: MAGIC FRAMEWORK
# ════════════════════════════════════════════════════════
heading("PART 2: THE MAGIC FRAMEWORK")
subheading("Organic Subscriber Growth from Social Media")

body(
    "Matt McGarry has helped clients add 10M+ email subscribers. His MAGIC formula converts social media "
    "followers into email subscribers. Most newsletters only use 1 of these 5 tactics -- implementing all 5 "
    "could 5-10x organic subscriber growth:"
)

make_table([
    [TH("Letter"), TH("Tactic"), TH("Offer Sheet Implementation")],
    [TC("M"), TC("Magnets (Lead Magnets)"), TC("Create: 'Top 50 STR Markets by ROI 2026' PDF, 'STR Investment Calculator' spreadsheet, 'Airbnb Listing Optimization Checklist', 'First STR Purchase Starter Kit'. Repurpose past issues as gated blog posts on Beehiiv.")],
    [TC("A"), TC("Asks (Pre & Post CTAs)"), TC("24hrs before each issue: 'Tomorrow I'm dropping 3 properties under $300K with 20%+ cap rates. Free subscribers get 1. Subscribe for all 3.' After: share the best listing with CTA to subscribe for the full daily list.")],
    [TC("G"), TC("Giveaways (Comment-to-Get)"), TC("Post on Instagram/LinkedIn/X: 'I just found 10 lakefront STR properties under $400K with proven Airbnb revenue. Comment LAKE to get the full list.' DM them a landing page link to subscribe.")],
    [TC("I"), TC("Inbox (DM Followers)"), TC("Auto-DM new followers: 'Hey [name], thanks for the follow! I send the best STR investment deals daily to 250K+ investors. Want in? [link]' -- they already followed you, just ask.")],
    [TC("C"), TC("Complete Profile"), TC("Bio: 'I find the best Airbnb investment deals so you don't have to. Join 250K+ STR investors: [direct link]' -- NO linktree (kills conversions, <10% CVR vs 50%+ with direct link).")],
], [0.5*inch, 1.5*inch, 4.2*inch])

spacer()
callout(
    "McGarry's key insight: 'Stop begging people to sign up for your newsletter. BRIBE them instead.' "
    "A lead magnet like 'Top 50 STR Markets Ranked by Cap Rate' is 100x more compelling than "
    "'Subscribe to my newsletter about real estate.'"
)

subsubheading("Lead Magnet Deep Dive")
body("Test a new lead magnet every month. The best ones for The Offer Sheet:")
bullet("Provide <b>immediate value</b> -- a downloadable PDF or spreadsheet, not a 10-hour course")
bullet("Take <b>less than 15 minutes</b> to consume")
bullet("Solve a <b>narrow problem</b> -- 'Best STR markets in Florida' not 'Complete guide to STR investing'")
bullet("<b>Repurpose existing content</b> -- past issues bundled by theme work perfectly as lead magnets")

body("<b>Lead magnet ideas ranked by likely conversion:</b>")
bullet("'2026 STR Market Scorecard' -- Top 25 markets ranked by ROI, regulation risk, demand growth")
bullet("'The $500K STR Playbook' -- 10 properties under $500K currently generating $5K+/mo on Airbnb")
bullet("'STR Tax Deduction Checklist' -- every deduction an STR investor can claim (Speed to Market + Save Money)")
bullet("'Airbnb Listing Optimization Template' -- plug-and-play title, description, and photo guidelines")
bullet("'STR Deal Analyzer Spreadsheet' -- input price, estimate revenue, see ROI instantly")

subsubheading("Pop-Up Newsletter Strategy (From Chenell Basilio)")
body(
    "Run a limited-series newsletter (e.g., '10 Days of Hidden Gem STR Markets') as a growth tactic. "
    "Chenell gained 3,714 subscribers in 40 days with 77% open rate. After it ends, the series becomes a "
    "permanent lead magnet. Great for breaking through growth plateaus."
)

subsubheading("OPA -- Other People's Audiences")
body("Cross-promote with complementary newsletters and creators:")
bullet("Real estate investing newsletters (not STR-specific -- you bring the STR angle)")
bullet("Personal finance newsletters (STR as passive income angle)")
bullet("Travel newsletters (the property/experience crossover)")
bullet("Beehiiv Recommendations network -- get recommended by aligned newsletters")
bullet("Guest posts in BiggerPockets, Investopedia, or similar real estate communities")

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 3: ADAPT FRAMEWORK
# ════════════════════════════════════════════════════════
heading("PART 3: THE ADAPT ENGINE")
subheading("Turn Every Newsletter Issue Into 5-10 Social Posts")

body(
    "Matt McGarry's ADAPT framework turns 1 newsletter into 5+ social posts per week. "
    "At 250 issues/year, that's 1,250+ social posts -- all driving subscribers back to The Offer Sheet:"
)

make_table([
    [TH("Method"), TH("What It Is"), TH("Offer Sheet Example")],
    [TC("Amplify"), TC("Expand one section into a full standalone post"), TC("Take your best property listing and write a LinkedIn deep-dive: 'Why this $380K cabin in Gatlinburg is generating $7,200/mo on Airbnb -- and 3 things most investors miss about the Smokies market.'")],
    [TC("Direct"), TC("Summarize the whole issue into one post"), TC("'Today in The Offer Sheet: A lakefront 5BR in Michigan for $500K (4.94 stars), a desert A-frame for $275K, and a treehouse in Asheville. Join 250K investors who get these daily: [link]'")],
    [TC("Ask"), TC("Question, debate, or poll"), TC("'What's your target cap rate for an STR investment? A) 8-12% B) 12-18% C) 18%+ D) I don't know yet' -- drives comments and algorithm visibility")],
    [TC("Pull"), TC("Single stat, quote, or insight"), TC("'This $275K A-frame in Joshua Tree is averaging $4,800/mo on Airbnb. That's a 21% cap rate.' -- shareable graphic with property photo")],
    [TC("Transcribe"), TC("Turn into video script"), TC("60-second Reel/TikTok walking through the top 3 properties of the day with quick commentary on why each is a good deal. Use the newsletter as your script.")],
], [0.9*inch, 1.6*inch, 3.7*inch])

spacer()
subsubheading("The Newsletter Flywheel")
body(
    "This creates compounding growth: <b>Newsletter issue -> Publish as blog post -> Create 5 social posts -> "
    "Drive new subscribers -> More revenue -> Next issue.</b> Each issue adds to your searchable library of blog "
    "content (SEO), each social post is a new entry point for potential subscribers."
)

subsubheading("Weekly Content Calendar")
make_table([
    [TH("Day"), TH("Email"), TH("Social"), TH("Website")],
    [TC("Monday"), TC("Newsletter send"), TC("Post-CTA (share best listing)"), TC("Issue as blog post")],
    [TC("Tuesday"), TC("Newsletter send"), TC("Amplify post (deep-dive on 1 market)"), TC("")],
    [TC("Wednesday"), TC("Newsletter send"), TC("Comment-to-Get giveaway"), TC("")],
    [TC("Thursday"), TC("Newsletter send"), TC("Ask/Poll post"), TC("")],
    [TC("Friday"), TC("Newsletter send"), TC("Pull quote graphic (best deal of week)"), TC("")],
    [TC("Saturday"), TC(""), TC("Reel/TikTok (top 3 properties this week)"), TC("")],
    [TC("Sunday"), TC(""), TC("Pre-CTA for Monday's issue"), TC("")],
], [0.9*inch, 1.3*inch, 2.5*inch, 1.5*inch])

spacer()
callout(
    "Since The Offer Sheet sends daily, there's an enormous amount of content to repurpose. "
    "Even doing 1 social post per day (not 5) from the newsletter creates 365 discovery touchpoints per year."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 4: AI CONTENT
# ════════════════════════════════════════════════════════
heading("PART 4: AI-POWERED CONTENT AT SCALE")
subheading("Scaling Property Research, Analysis & Distribution")

body(
    "Anik Singal generates 34M+ social views per month using AI clones, spending 10-15 minutes per week. "
    "His <b>Double Level Training</b> method is directly applicable to scaling The Offer Sheet's operations:"
)

subsubheading("Level 1: Mind Cloning for The Offer Sheet")
body(
    "Train AI on The Offer Sheet's voice, analysis style, and property evaluation criteria. Feed it:"
)
bullet("The full archive of past issues (writing style, tone, emoji usage, deal commentary)")
bullet("Your property evaluation framework (what makes a 'good' vs 'great' STR deal)")
bullet("Market knowledge (which markets are hot, regulatory risks, seasonal patterns)")
bullet("The Offer Sheet's brand voice (casual, informative, investor-savvy)")

subsubheading("Level 2: Specialized AI Agents")
body("Build dedicated agents for each operational task:")

make_table([
    [TH("Agent"), TH("Function"), TH("How It Helps")],
    [TC("Property Scout Agent"), TC("Scans MLS feeds, Zillow, Realtor.com for STR-worthy listings"), TC("Automates the most time-consuming part: finding properties that meet The Offer Sheet criteria")],
    [TC("Revenue Analyzer Agent"), TC("Pulls AirDNA/Mashvisor/PriceLabs data for each property"), TC("Auto-calculates estimated monthly revenue, cap rate, cash-on-cash return")],
    [TC("Newsletter Writer Agent"), TC("Drafts property descriptions in The Offer Sheet voice"), TC("Turns raw property data into engaging, emoji-rich descriptions. Human adds final 20% (voice, personality).")],
    [TC("Social Content Agent"), TC("Generates ADAPT social posts from each issue"), TC("Auto-creates 5 social posts per issue using the ADAPT framework")],
    [TC("Market Intel Agent"), TC("Monitors STR regulation changes, market trends, rate shifts"), TC("Powers the 'Market Intel' section with real-time data and analysis")],
], [1.3*inch, 1.8*inch, 3.1*inch])

spacer()
subsubheading("The 5-Step Viral Content Framework (for Social)")
body("From Anik's system, adapted for STR content creation:")
bullet("<b>1. Topic Selection:</b> Follow 10-20 STR/real estate creators. Look for outlier posts (10x+ normal engagement). Key: Shares > Likes = viral topic.")
bullet("<b>2. Research:</b> Upload top-performing STR content transcripts to Claude. Analyze patterns: what hooks work, what data points get shared, what emotional triggers drive engagement.")
bullet("<b>3. Content Outline:</b> Hook (jaw-dropping property or stat) -> Context (why this matters) -> Value (the analysis) -> CTA (subscribe/share)")
bullet("<b>4. AI Draft:</b> Use trained clone to generate 80% of the content")
bullet("<b>5. Human Edit:</b> Add the final 20% -- insider knowledge, personal opinion, specific market experience")

callout(
    "Anik's team is just 2 people (1 part-time). With AI handling research, writing, and distribution, "
    "The Offer Sheet could dramatically increase content output without adding headcount."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 5: DELIVERABILITY
# ════════════════════════════════════════════════════════
heading("PART 5: EMAIL DELIVERABILITY & ENGAGEMENT")
subheading("The WE-PAC Welcome Email + Deliverability Detox")

body(
    "At 250K+ subscribers with daily sends, deliverability is everything. Even a 5% improvement in inbox "
    "placement means 12,500 more people see each issue. Matt McGarry's frameworks are critical here:"
)

subsubheading("WE-PAC Welcome Email Framework")
body("The welcome email determines whether all future emails land in Primary or Promotions. It must drive 3 actions: click a link, move to Primary, and reply.")

make_table([
    [TH("Step"), TH("Element"), TH("Offer Sheet Implementation")],
    [TC("W"), TC("Welcome -- Thank them (1-2 sentences)"), TC("'Welcome to The Offer Sheet! You just joined 250,000+ investors who get the best STR deals delivered daily.'")],
    [TC("E"), TC("Expectations -- What, when, how"), TC("'Every morning, you'll get curated short-term rental properties with revenue estimates, market data, and our analysis. Free members get 1-2 deals. Pro members get 10+ daily.'")],
    [TC("P"), TC("Primary inbox -- Ask to move you"), TC("'To make sure you see every deal (including the ones that go fast), drag this email to your Primary tab. Takes 2 seconds -- investors who do this never miss a listing.'")],
    [TC("A"), TC("Ask for reply -- Simple 1-word reply"), TC("'Hit reply and send me a quick YES -- it tells Gmail you want these emails. (Seriously, 1 second and you'll never miss a deal.)'")],
    [TC("C"), TC("Click a link (CTA)"), TC("Link to: (1) your most popular past issue with a jaw-dropping property, (2) the Pro tier info page, (3) your Instagram/social. At least 2 links.")],
], [0.5*inch, 1.8*inch, 3.9*inch])

spacer()
callout(
    "Do NOT use double opt-in unless legally required -- you'll lose 30%+ of subscribers. "
    "Ask for a simple 1-word reply (YES), not an open-ended question. Open-ended questions "
    "require effort and dramatically reduce reply rate."
)

subsubheading("The Deliverability Detox -- 4-Week Protocol")
body(
    "If open rates are declining, inactive subscribers are dragging you down. This protocol from McGarry "
    "guarantees a 20-30% open rate increase in 4 weeks by temporarily narrowing who you send to:"
)

make_table([
    [TH("Week"), TH("Base Sending Segment (BSS) Criteria"), TH("Expected Impact")],
    [TC("Week 1"), TC("Signed up last 10 days OR opened last 30 days OR clicked last 60 days"), TC("Smallest, most engaged segment. Immediate engagement jump.")],
    [TC("Week 2"), TC("Signed up last 14 days OR opened last 45 days OR clicked last 90 days"), TC("Slightly larger. Engagement stays high. Gmail notices.")],
    [TC("Week 3"), TC("Signed up last 21 days OR opened last 60 days OR clicked last 120 days"), TC("Expanding. Sender reputation improving with email providers.")],
    [TC("Week 4"), TC("Signed up last 30 days OR opened last 90 days OR clicked last 180 days"), TC("Full BSS. Deliverability significantly improved across the board.")],
], [0.7*inch, 3*inch, 2.5*inch])

spacer()
body("<b>Ongoing sunsetting (from Matt Paulson, 6M subscribers):</b>")
bullet("For daily sends: Added last 7 days OR opened last 30 days OR clicked last 60 days")
bullet("For weekly digests: Added last 30 days OR opened last 90 days OR clicked last 180 days")
bullet("Adjust thresholds until you average ~45% open rate")
bullet("Anyone outside these segments: run a re-engagement campaign or remove")

callout(
    "Counter-intuitive: sending to FEWER people gets you MORE opens and clicks. "
    "Better deliverability means more emails actually reach inboxes. "
    "Paulson: 'Sunsetting is THE key to deliverability.'"
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 6: MONETIZATION
# ════════════════════════════════════════════════════════
heading("PART 6: MONETIZATION")
subheading("10 Revenue Streams Beyond Pro Subscriptions")

body(
    "The Offer Sheet already has a Pro tier. Matt Paulson (MarketBeat, $50.7M/yr, 6M subs) identified 10 "
    "revenue streams for newsletter businesses. Here's how each applies:"
)

make_table([
    [TH("#"), TH("Revenue Stream"), TH("How It Works for The Offer Sheet"), TH("Priority")],
    [TC("1"), TC("Pro Subscriptions (existing)"), TC("Premium tier with 10+ daily listings, Google Sheet, community, tools. Already in place."), TC("ACTIVE")],
    [TC("2"), TC("Newsletter Sponsorships"), TC("Real estate SaaS (AirDNA, PriceLabs, Hospitable), mortgage lenders, STR management companies, furniture rental companies (Minoan, Fernish). 250K subscribers in a high-value niche = premium CPMs."), TC("HIGH")],
    [TC("3"), TC("Co-Registration Ads"), TC("On the thank-you page after signup, offer subscribers opt-ins to complementary newsletters (BiggerPockets, real estate investing). Get paid per opt-in."), TC("HIGH")],
    [TC("4"), TC("CPA Affiliate Deals"), TC("Recommend tools you'd actually use: AirDNA, PriceLabs, Guesty, Hospitable, Turno. Earn commission per signup. Authentic because readers need these tools."), TC("HIGH")],
    [TC("5"), TC("Info Products"), TC("'STR Deal Analyzer Course', 'First Airbnb Purchase Masterclass', 'STR Tax Strategy Guide'. Sell to the segment that clicks educational content."), TC("MEDIUM")],
    [TC("6"), TC("Leadshare / Data Licensing"), TC("Real estate agents, lenders, and property managers would pay for warm leads who are actively shopping STR properties. (With subscriber consent.)"), TC("MEDIUM")],
    [TC("7"), TC("Display Ads on Blog"), TC("Publish every issue as a blog post. Monetize web traffic with Ezoic/AdSense. SEO brings in organic traffic that monetizes passively."), TC("MEDIUM")],
    [TC("8"), TC("Sell Your Time"), TC("Consulting calls for investors who want personalized deal analysis and market advice. Premium pricing for access to expertise."), TC("LOW")],
    [TC("9"), TC("SMS Channel"), TC("Flash alerts for hot deals via SMS. Higher urgency = higher click rates. SMS subscribers are 10-20x more valuable than email."), TC("HIGH")],
    [TC("10"), TC("Events / Meetups"), TC("STR investor meetups, virtual deal reviews, annual conference. Community events deepen loyalty and unlock sponsorship."), TC("FUTURE")],
], [0.3*inch, 1.1*inch, 3.1*inch, 0.7*inch])

spacer()
subsubheading("Maximizing the Thank-You Page (Paulson's #1 Tip)")
body(
    "The moment of greatest attention is when someone first opts in. Your thank-you page should:"
)
bullet("<b>Collect 4 opt-ins:</b> Email (done), secondary email, SMS/phone, push notifications")
bullet("<b>Run co-registration offers:</b> Complementary newsletters/products")
bullet("<b>Pitch Pro upgrade:</b> 'Get ALL 10 deals, not just 1-2. Upgrade to Pro.'")
bullet("<b>Show a post-signup survey</b> (see Part 13 for phone number collection)")

subsubheading("Triggered Email Campaigns")
body("Don't just blast everyone. Trigger follow-ups based on behavior:")
bullet("Subscriber clicks a lakefront property -> trigger a 'Best Lakefront STR Markets' sequence")
bullet("Subscriber clicks properties under $300K -> trigger 'Affordable STR' segment emails")
bullet("Subscriber visits Pro pricing page but doesn't convert -> trigger a 3-email nurture with Pro benefits + testimonials")
bullet("These triggered emails convert at 3-5x the rate of regular sends")

callout(
    "Paulson: 'Don't be afraid to send more email. The fear of unsubscribes costs you far more in "
    "lost revenue than the unsubscribes themselves.' With proper sunsetting, you can increase "
    "send frequency to your most engaged subscribers without hurting deliverability."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 7: FIRST-PARTY DATA
# ════════════════════════════════════════════════════════
heading("PART 7: FIRST-PARTY DATA")
subheading("The Data Flywheel -- From Newsletter to Intelligence Platform")

body(
    "Sherrell Dorsey built and sold 'The Plug' by escaping the ad-revenue trap. Her Data Flywheel "
    "turned a newsletter into a premium intelligence business. This is the biggest long-term opportunity "
    "for The Offer Sheet:"
)

subsubheading("Why the Ad-Only Model Is a Trap")
bullet("Ad CPMs are volatile -- you're at the mercy of the market")
bullet("Algorithms own your reach; you rent it")
bullet("To double revenue, you have to double traffic -- no leverage")
bullet("Low-margin: most newsletter ad revenue is a grind")

subsubheading("The Data Flywheel: 3 Steps")
make_table([
    [TH("Step"), TH("Action"), TH("Offer Sheet Application")],
    [TC("1. CAPTURE"), TC("Collect structured data from your audience"), TC("Add a 'Survey Question of the Week' to every issue. Poll readers: 'What's your target market?' 'What's your budget?' 'How many STRs do you own?' Tag every click (lakefront, mountain, urban, budget range). Run quarterly investor sentiment surveys.")],
    [TC("2. CONTEXTUALIZE"), TC("Turn raw data into benchmarks and reports"), TC("Aggregate into: 'Q2 2026 STR Investor Sentiment Report' -- where investors are buying, average budgets, most-wanted markets, regulatory concerns. Your click data IS proprietary market intelligence.")],
    [TC("3. CAPITALIZE"), TC("Sell the intelligence"), TC("Sell reports to: STR management companies ($5K-$25K), real estate platforms ($10K-$50K), tourism boards ($5K-$15K). Create a premium membership tier with database access. Offer consulting powered by your proprietary data.")],
], [1*inch, 1.8*inch, 3.4*inch])

spacer()
subsubheading("Stop Counting Clicks, Start Tagging Intent")
body(
    "Every click a subscriber makes is a data point. Tag them: 'Interested in Lakefront' vs. 'Interested in "
    "Mountain' vs. 'Budget Under $300K' vs. 'Portfolio Investor (3+ properties).' Then sell sponsors access to "
    "the <b>segment</b>, not the whole list. A targeted segment of 'investors actively looking at mountain STRs "
    "under $400K' commands 5-10x the CPM of a generic blast."
)

subsubheading("Membership Model (Dorsey's Playbook)")
body("Dorsey added 400 members in month 1 of launching membership. For The Offer Sheet:")
bullet("<b>Pro tier enhancement:</b> Add downloadable market databases, investor benchmarks, quarterly reports")
bullet("<b>Corporate/Team seats:</b> Real estate brokerages and property management firms buy 'seats' for their teams")
bullet("<b>Member calls:</b> Monthly deal review calls where Pro members submit properties for live analysis")

callout(
    "Dorsey went from $2K ads to $100K reports by packaging survey results and first-party research "
    "into white papers and searchable databases. The Offer Sheet has 250K+ subscribers clicking on "
    "properties daily -- that click data alone is worth six figures to the right buyer."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 8: META ADS
# ════════════════════════════════════════════════════════
heading("PART 8: META ADS FOR NEWSLETTERS")
subheading("2026 Subscriber Acquisition Playbook")

body(
    "1440 Media (1.5B+ daily digest emails/year, 60%+ open rate, $1M revenue per employee) shared "
    "the updated playbook for Meta's Andromeda algorithm. Key changes for 2026:"
)

subsubheading("Andromeda Algorithm: What Changed")
bullet("<b>Creative IS the targeting.</b> Creative accounts for 56-70% of auction outcomes. Stop obsessing over audience targeting.")
bullet("<b>Go BROAD.</b> Narrow targeting is dead. Let Meta's AI find the right people based on creative signals.")
bullet("<b>Simplify structure.</b> 1 campaign -> 2-3 testing ad sets (by persona) -> 1 scaling ad set")
bullet("<b>Slow down changes.</b> New creative every 2 weeks, not daily. Let the algorithm learn.")
bullet("<b>Review at campaign level,</b> not individual ad level. Meta optimizes across ads.")

subsubheading("Campaign Structure for The Offer Sheet")
make_table([
    [TH("Level"), TH("Structure"), TH("Details")],
    [TC("Campaign"), TC("1 campaign: 'Offer Sheet Subscriber Growth'"), TC("Conversion objective, optimize for email signups via Beehiiv landing page")],
    [TC("Test Ad Set A"), TC("Persona: First-Time STR Investor"), TC("'Dreaming of Airbnb income? See the deals full-time investors are buying.' 8-10 ads, broad targeting.")],
    [TC("Test Ad Set B"), TC("Persona: Experienced Portfolio Investor"), TC("'Your next STR deal, delivered daily. Join 250K investors.' 8-10 ads, broad targeting.")],
    [TC("Test Ad Set C"), TC("Persona: Real Estate Professional"), TC("'Your clients are asking about STRs. Stay ahead with daily deal flow.' 8-10 ads, broad targeting.")],
    [TC("Scaling Ad Set"), TC("Winners from testing"), TC("Graduate ads that hit CPA targets. Scale budget 20% max per increase. 80% of total budget here.")],
], [1.2*inch, 2*inch, 3*inch])

spacer()
subsubheading("Creative Strategy")
body("Test at the CONCEPT level, not just hooks/copy. For each persona, build:")
bullet("3-4 creative concepts: static image, short UGC video, longer VSL, carousel/GIF")
bullet("3-4 variants per concept: different hooks, overlays, property photos")
bullet("Use actual property listings as ad creative -- 'This $380K cabin generates $7,200/mo. See deals like this daily.'")
bullet("UGC and creator content outperform polished brand creative in 2026")

subsubheading("Budgeting Rules")
bullet("<b>20% Rule:</b> Never increase budget more than 20% at a time")
bullet("<b>Learning Phase:</b> Need 50 optimization events (signups) within 7 days to exit. Budget accordingly.")
bullet("<b>80/20 Split:</b> 80% to proven winners, 20% to testing new creative")
bullet("<b>Don't tinker daily.</b> Let the algorithm learn. Review weekly.")

subsubheading("The Ad Lifecycle")
body("Creative Ideation -> Learning Phase (DON'T TOUCH) -> Data Feedback -> Use, Renew, Recycle")
body("Key questions during feedback: Thumbstop ratio? Click quality (landing page views / outbound clicks)? CPA? What are comments saying? Was the CTA clear enough?")

callout(
    "Paulson (MarketBeat): 'Paid advertising is how you scale a media business to eight figures. "
    "Organic won't get you there. The key to success in paid is understanding your data.' "
    "At 250K subs, The Offer Sheet is at the inflection point where paid growth becomes the primary lever."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 9: YOUTUBE
# ════════════════════════════════════════════════════════
heading("PART 9: YOUTUBE & VIDEO")
subheading("Building a Viral STR Brand on YouTube")

body(
    "Sam Gaudet built Dan Martell from 10K to 2.4M YouTube subscribers (multi-8-figure revenue). "
    "Chenell Basilio showed YouTube drives a 4.5% email conversion rate. "
    "For STR content, the visual medium is especially powerful -- you can SHOW properties."
)

subsubheading("The 4-Part System Applied to STR Content")
make_table([
    [TH("Part"), TH("Elements"), TH("Offer Sheet Application")],
    [TC("1. CLICK"), TC("Topic + Title + Thumbnail"), TC("Topic: Find outlier STR videos (4x+ normal views). Title: Target hopes ('How I Made $120K/yr From a $300K Cabin'), dreams, fears ('The STR Markets That Are About to Get Banned'), blockers ('How to Buy Your First Airbnb With No Experience'). Thumbnail: Property photo + big text + emotion.")],
    [TC("2. CAPTURE"), TC("The Hook (first 30 sec)"), TC("Promise: 'I'm going to show you 5 properties under $400K that are generating $6K+/mo.' Proof: 'We analyze 500+ deals a month for 250K investors.' Urgency: 'These kinds of deals are getting scooped up in days.' Open Loop: preview what's coming.")],
    [TC("3. CONSUME"), TC("Retention (PEIL)"), TC("For each property: Point (name the deal) -> Explain (why it's special) -> Illustrate (show the listing, revenue data, photos) -> Lesson (the takeaway for investors). Repeat for 3-5 properties per video.")],
    [TC("4. CONVERT"), TC("Drive subscribers"), TC("Free resource at 30% mark: 'Download our STR Deal Analyzer -- link in description.' End: 'Subscribe to The Offer Sheet for deals like this every single day.' First link in description = newsletter signup.")],
], [0.8*inch, 1.4*inch, 4*inch])

spacer()
subsubheading("YouTube -> Email Conversion Math")
make_table([
    [TH("Metric"), TH("Conservative"), TH("Optimistic")],
    [TC("Conversion rate (views to email)"), TC("3.1%"), TC("4.6%")],
    [TC("Views needed for 10K new subscribers"), TC("323K"), TC("217K")],
    [TC("Videos needed (at 5,000 avg views)"), TC("65 videos"), TC("43 videos")],
    [TC("Timeline (2 videos/week)"), TC("8 months"), TC("5 months")],
], [2.5*inch, 1.6*inch, 1.6*inch])

spacer()
subsubheading("Video Content Ideas for The Offer Sheet")
bullet("'Top 5 STR Deals This Week' -- weekly recurring series (like the newsletter, but visual)")
bullet("'I Found a $250K Airbnb Making $60K/Year' -- individual property deep dives")
bullet("'Best STR Markets in [State]' -- geographic series (each video = targeted lead magnet)")
bullet("'STR Investor Mistakes That Cost Thousands' -- educational content that builds trust")
bullet("'Property Tour: Is This Airbnb Worth $400K?' -- walkthroughs with analysis")

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 10: EXIT
# ════════════════════════════════════════════════════════
heading("PART 10: BUILDING FOR EXIT")
subheading("Profit, Recurring Revenue & Sellability")

body(
    "Alexis Grant has studied 300+ media business acquisitions at TheyGotAcquired.com. "
    "Her lessons are directly applicable to The Offer Sheet's long-term trajectory:"
)

subsubheading("Lesson 1: Profit Is King -- Not Subscribers")
body(
    "The #1 mistake media founders make: focusing on audience size instead of profit. "
    "Valuations are based on EBITDA/SDE, not subscriber count. A 250K-subscriber newsletter "
    "with $0 profit is nearly unsellable. The same newsletter with $300K+ in recurring profit "
    "could sell for $900K - $1.5M+ (3-5x multiple)."
)

make_table([
    [TH("Scenario"), TH("Subscribers"), TH("Revenue"), TH("Profit"), TH("Likely Valuation")],
    [TC("Newsletter A"), TC("250K"), TC("$400K"), TC("$0 (reinvesting everything)"), TC("Hard to sell. Limited buyers.")],
    [TC("Newsletter B"), TC("250K"), TC("$400K"), TC("$200K (recurring)"), TC("$600K - $1M (3-5x profit)")],
    [TC("Newsletter C"), TC("250K"), TC("$800K"), TC("$400K (recurring + data)"), TC("$1.2M - $2.8M (3-7x)")],
], [0.9*inch, 0.8*inch, 0.8*inch, 1.5*inch, 2.2*inch])

spacer()
body("<b>Key: make revenue RECURRING.</b> Buyers pay significantly more for predictable income:")
bullet("Pro subscriptions = recurring (already in place)")
bullet("Annual sponsorship contracts = recurring")
bullet("Data licensing deals = recurring")
bullet("SaaS-like premium tier with databases = recurring")

subsubheading("Lesson 2: The Founder Trap")
body(
    "If the newsletter can't run without the founder, it's a job, not a sellable asset. "
    "Caitlin Pyle sold Proofread Anywhere for $4.5M after reducing founder dependencies."
)
bullet("Document all processes: property sourcing, writing, distribution, sponsor sales")
bullet("Use AI to systematize content creation (see Part 4) so it's not dependent on one person")
bullet("Build a small team or contractor network that can operate independently")
bullet("Create SOPs for everything: how to evaluate a property, how to write a listing, how to manage sponsors")

subsubheading("Lesson 3: Choose Your M&A Advisor Carefully")
body("When it's time to sell:")
bullet("Work with someone who has sold media/newsletter businesses specifically")
bullet("Check that they work with businesses your size")
bullet("Get referrals from founders who've already sold")

make_table([
    [TH("Deal Size"), TH("Typical Fee"), TH("Cost")],
    [TC("$500K"), TC("15%"), TC("$75K")],
    [TC("$1M"), TC("10%"), TC("$100K")],
    [TC("$5M"), TC("7%"), TC("$350K")],
], [2*inch, 2*inch, 2.2*inch])

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 11: NEWSLETTER DESIGN
# ════════════════════════════════════════════════════════
heading("PART 11: NEWSLETTER DESIGN")
subheading("Anatomy of a High-Performing Issue")

body(
    "The All Healthy newsletter shared their design framework that drives 51%+ open rate and 3%+ CTR. "
    "Here's how to structure each Offer Sheet issue for maximum engagement:"
)

make_table([
    [TH("Section"), TH("Purpose"), TH("Offer Sheet Implementation")],
    [TC("Header"), TC("Brand identity + context"), TC("Date, 'The Offer Sheet' branding, sponsor logo if applicable, 'View in browser' link. Keep it clean and recognizable.")],
    [TC("Intro / Hook"), TC("Establish connection, drive first click"), TC("Set context with something timely: 'Rates just dropped and these markets are heating up...' or 'This treehouse listing broke our newsletter.' Use YOUR voice. Drive the first click within the first 3 lines.")],
    [TC("Featured Listing"), TC("The hero deal"), TC("Your best property of the day. Full breakdown: photos, revenue data, market context, why it's special. This is the one that gets screenshotted and shared.")],
    [TC("Deal Grid"), TC("Core value delivery"), TC("Remaining 5-9 properties (Pro). Run-in headings for skimmability. Bulleted key stats. Clear CTAs to view each listing.")],
    [TC("Market Intel"), TC("Teach / make them smarter"), TC("1-2 paragraphs on a trend: regulation changes, market shifts, seasonal patterns. Positions The Offer Sheet as an intelligence source, not just a listing service.")],
    [TC("Sponsor Section"), TC("Revenue without friction"), TC("Written in your voice. Education over promotion. 'We use [Tool] to analyze every property we feature...' Clearly labeled but visually native.")],
    [TC("Quick Hits"), TC("Fast, click-forward content"), TC("3-5 one-line items: industry news, interesting stats, partner offers. Perfect for cross-promotions and performance sponsors.")],
    [TC("Poll / Interactive"), TC("Engagement + data collection"), TC("'Which market are you most interested in this week?' Click-to-vote. Builds first-party data and segments engaged readers.")],
    [TC("Closer"), TC("End on a high note"), TC("Aspirational property photo or inspiring investor quote. 'Feelings drive return behavior' -- make them WANT to open tomorrow's issue.")],
    [TC("Footer"), TC("Utility + compliance"), TC("Referral program CTA, social links, frequency adjustment option, disclaimers, team humanization ('Curated by the team at The Offer Sheet').")],
], [1*inch, 1.3*inch, 3.9*inch])

spacer()
subsubheading("Design Principles")
bullet("<b>Predictability + Surprise:</b> Same structure every day (habit-forming), but with unique/unexpected properties")
bullet("<b>Skimmability is king:</b> Most readers scan. Bold key numbers, use emojis as visual anchors, keep descriptions tight")
bullet("<b>Test in-email before building products:</b> Use polls/clicks to validate demand before investing in new features")
bullet("<b>Target: 51%+ open rate, 3%+ CTR, 3K+ sponsor clicks per placement</b>")

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 12: GROWTH FLYWHEEL
# ════════════════════════════════════════════════════════
heading("PART 12: THE GROWTH FLYWHEEL")
subheading("Capture, Nurture, Close, Evangelize, Reactivate")

body("The HighLevel framework applied to The Offer Sheet's subscriber lifecycle:")

make_table([
    [TH("Step"), TH("Action"), TH("Offer Sheet Implementation"), TH("Common Mistake")],
    [TC("1. CAPTURE"), TC("Capture leads from all sources"), TC("Landing pages, lead magnets, social, Meta ads, co-marketing with real estate platforms, YouTube. All into Beehiiv."), TC("No lead magnets. Only 1 landing page. No social CTAs.")],
    [TC("2. NURTURE"), TC("Automated follow-up within 5 min"), TC("WE-PAC welcome email -> post-signup survey -> first issue. For non-opens: SMS reminder. For Pro interest: targeted nurture sequence."), TC("No welcome email. No automation. Cold subscriber experience.")],
    [TC("3. CLOSE"), TC("Convert to paid"), TC("Pro tier upsell in welcome sequence. Triggered email when subscriber clicks 3+ deals (high intent). Time-limited Pro offers. Easy Stripe checkout."), TC("Never asking for the upgrade. No triggers based on behavior.")],
    [TC("4. EVANGELIZE"), TC("Turn readers into advocates"), TC("Beehiiv referral program (refer 3 friends, get Pro for free). Ask for testimonials after 30 days. 'Share this deal with an investor friend' CTA in each issue."), TC("No referral program. Never asking readers to share.")],
    [TC("5. REACTIVATE"), TC("Re-engage inactive readers"), TC("'We miss you' email with the 3 best deals from the past week. 'The market is moving -- here's what you missed.' Conversation starters, not just offers."), TC("Chasing only new subscribers. Ignoring the 250K already on the list.")],
], [0.8*inch, 1.1*inch, 2.2*inch, 2.1*inch])

spacer()
callout(
    "The flywheel effect: More subscribers -> More engagement -> Higher sponsor rates -> "
    "More revenue -> More investment in content & growth -> More subscribers. "
    "The key: don't just chase new subscribers. Activate, retain, and monetize the 250K you already have."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 13: SMS
# ════════════════════════════════════════════════════════
heading("PART 13: SMS & PHONE NUMBERS")
subheading("The Untapped Channel")

body(
    "Matt McGarry and Matt Paulson both emphasized SMS as the most underutilized channel in newsletters. "
    "SMS has near 100% open rate vs. 40-50% for email. Paulson says SMS subscribers are "
    "<b>10-20x more valuable</b> than email subscribers."
)

subsubheading("How to Collect Phone Numbers (Without Extra Work)")
body("McGarry gets 17% of subscribers to share their phone number using a post-signup survey:")
bullet("After email signup, show a 6-question survey (multiple choice)")
bullet("Last question (optional): 'Want deal alerts via text? Enter your phone number.'")
bullet("Give a reason: 'The best deals go fast. Get SMS alerts before they hit the newsletter.'")
bullet("Results: 87% survey completion rate, 17% share phone number")

body("At 250K subscribers, even if only new signups see the survey:")
bullet("1,000 new subscribers/week = 170 phone numbers/week = 8,840/year")
bullet("If you retroactively survey existing list: potential for 42,500 phone numbers")

subsubheading("How to Use SMS for The Offer Sheet")
bullet("<b>Flash Deal Alerts:</b> 'Just listed: Lakefront 5BR, $450K, 4.94 stars. See it before it's gone: [link]'")
bullet("<b>Pro Tier Promotions:</b> 'Pro is 30% off this weekend. Get 10+ deals daily: [link]' -- McGarry made $100K+ from SMS promotions")
bullet("<b>Event Invites:</b> Webinars, deal review calls, investor meetups")
bullet("<b>Market Alerts:</b> 'New STR regulation in [market]. Read our analysis: [link]'")

callout(
    "Paulson: 'Don't sleep on SMS. 20% of email opt-ins also sign up for SMS. "
    "However, SMS opt-ins are 10-20x more valuable than email sign-ups.' "
    "It's more expensive and has a higher compliance bar (TCPA), but totally worth it."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 14: BOOKS
# ════════════════════════════════════════════════════════
heading("PART 14: BOOKS AS LEAD MAGNETS")
subheading("Authority in the STR Space")

body(
    "Chandler Bolt ($75M+ revenue at selfpublishing.com) showed how a book is the fastest path to "
    "authority and lead generation. For The Offer Sheet, a book could be a massive growth lever:"
)

subsubheading("Why a Book for The Offer Sheet")
bullet("<b>Authority:</b> 'The team behind the #1 STR investing newsletter with 250K+ subscribers' -- a book cements this")
bullet("<b>Lead generation:</b> Every book buyer becomes a newsletter subscriber (include signup CTA in every chapter)")
bullet("<b>Amazon discovery:</b> People searching 'Airbnb investing' find your book -> subscribe to newsletter")
bullet("<b>Passive income:</b> Ongoing royalties + ongoing subscriber flow")
bullet("<b>Speaking opportunities:</b> Book authors get invited to real estate conferences, podcasts, and events")

subsubheading("Book Ideas")
bullet("'The Offer Sheet: How Smart Investors Find and Profit From Short-Term Rental Properties'")
bullet("'The STR Investor's Playbook: Data-Driven Strategies for Airbnb Wealth'")
bullet("'Deal Flow: How to Never Run Out of Profitable STR Investment Opportunities'")

subsubheading("How to Write It Fast (Bolt's Method)")
bullet("<b>Step 1 -- Mind Map:</b> Topic in center, everything you know about STR investing around it")
bullet("<b>Step 2 -- Outline:</b> 5 sections x 3 chapters = 15 chapters (e.g., Market Selection, Deal Analysis, Financing, Operations, Scaling)")
bullet("<b>Step 3 -- Speak it:</b> Average person speaks 150 words/min. A 30K-word book = 3.5 hours of speaking. Record, transcribe with AI, edit.")
bullet("<b>Timeline:</b> Rough draft in a weekend, published in 4-6 months")

subsubheading("Launch Strategy")
bullet("Build a launch team from Pro subscribers (built-in audience of 250K)")
bullet("Get reviews on Amazon to feed the algorithm")
bullet("Use the book as a lead magnet: give away free copies at events, on social, via ads")

callout(
    "Case study: AJ Osborne sold 25,000+ copies of his self-storage book. "
    "It drives people to his $1,000 course (150+ sales = $150K+). His company now manages "
    "2.5M sq ft of real estate. The book was the top of the funnel."
)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 15: 30-DAY PLAN
# ════════════════════════════════════════════════════════
heading("PART 15: 30-DAY QUICK-START PLAN")
subheading("Prioritized Actions for Immediate Impact")

subsubheading("WEEK 1: Foundation (Days 1-7)")
w1 = [
    "Rewrite the welcome email using the WE-PAC framework (2 hours)",
    "Set up a post-signup survey: role, portfolio size, target markets, budget, experience level, phone number (1 hour)",
    "Add a poll/survey question to the next newsletter issue -- 'What market are you most interested in?' (15 min)",
    "Optimize social bios on all platforms with direct newsletter link, no linktree (15 min each)",
    "Create Base Sending Segment (BSS) Week 1 criteria in Beehiiv (30 min)",
    "Audit last 10 issues against the 6 IV Content buckets -- identify gaps (1 hour)",
]
for i, a in enumerate(w1, 1):
    story.append(Paragraph(f"<bullet>{i}.</bullet> {a}", styles['ActionItem']))

subsubheading("WEEK 2: Content Engine (Days 8-14)")
w2 = [
    "Create first lead magnet from past issues: 'Top 50 STR Markets Ranked by ROI' or similar (2-3 hours, repurpose existing data)",
    "Implement ADAPT framework: generate 5 social posts from your latest newsletter issue (1 hour)",
    "Run first Comment-to-Get giveaway on LinkedIn or Instagram (15 min to set up)",
    "Send newsletter to BSS Week 2 segment (expanding from Week 1)",
    "Begin tagging subscribers by interest based on click behavior (set up in Beehiiv)",
    "Start pre-CTA / post-CTA posting schedule around daily newsletter",
]
for i, a in enumerate(w2, 1):
    story.append(Paragraph(f"<bullet>{i}.</bullet> {a}", styles['ActionItem']))

subsubheading("WEEK 3: Growth & Data (Days 15-21)")
w3 = [
    "Launch second lead magnet (different angle: calculator, checklist, or market report)",
    "Reach out to 5 complementary newsletters for cross-promotion (BiggerPockets community, RE investing newsletters)",
    "Set up co-registration offers on thank-you page",
    "Create a Claude Project with newsletter archive for AI-assisted content generation",
    "Build 3 subscriber personas for Meta ad creative (first-time investor, portfolio investor, RE professional)",
    "Aggregate Week 1-3 survey data into a mini 'Flash Report'",
    "Send newsletter to BSS Week 3 segment",
]
for i, a in enumerate(w3, 1):
    story.append(Paragraph(f"<bullet>{i}.</bullet> {a}", styles['ActionItem']))

subsubheading("WEEK 4: Scale & Monetize (Days 22-30)")
w4 = [
    "Launch Meta ad campaign: 1 campaign, 3 persona-based test ad sets, 1 scaling ad set",
    "Send newsletter to BSS Week 4 segment -- deliverability should be noticeably improved",
    "Set up 2-3 triggered email campaigns based on click behavior (Pro upsell, market-specific sequences)",
    "Begin publishing issues as gated blog posts on Beehiiv for SEO / lead magnet repurposing",
    "Send Flash Report to 5 potential sponsors as a preview of audience intelligence capabilities",
    "Activate Beehiiv referral program ('Refer 3 friends, unlock Pro features')",
    "Document all processes into SOPs for founder independence",
    "Identify and pitch 3 potential sponsors (STR SaaS tools, lenders, PM companies)",
]
for i, a in enumerate(w4, 1):
    story.append(Paragraph(f"<bullet>{i}.</bullet> {a}", styles['ActionItem']))

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PART 16: METRICS
# ════════════════════════════════════════════════════════
heading("PART 16: KEY METRICS & BENCHMARKS")
subheading("What to Track and What Good Looks Like")

make_table([
    [TH("Metric"), TH("Good"), TH("Great"), TH("Elite"), TH("Source")],
    [TC("Open Rate"), TC("35%"), TC("45%"), TC("51%+"), TC("All Healthy, Paulson")],
    [TC("Click-Through Rate"), TC("2%"), TC("3%"), TC("7%+"), TC("1440 Media")],
    [TC("Welcome Email Open Rate"), TC("40%"), TC("50%"), TC("60%+"), TC("McGarry")],
    [TC("Welcome Email CTR"), TC("10%"), TC("15%"), TC("19%+"), TC("McGarry")],
    [TC("Post-Signup Survey Completion"), TC("70%"), TC("80%"), TC("87%+"), TC("McGarry")],
    [TC("Phone # Collection Rate"), TC("10%"), TC("15%"), TC("17%+"), TC("McGarry")],
    [TC("Social Bio -> Signup CVR"), TC("20%"), TC("35%"), TC("50%+"), TC("McGarry (no linktree)")],
    [TC("YouTube -> Email CVR"), TC("2%"), TC("3.1%"), TC("4.6%+"), TC("Basilio")],
    [TC("Sponsor Click Rate"), TC("1,000"), TC("2,000"), TC("3,000+"), TC("All Healthy")],
    [TC("Revenue per Employee"), TC("$200K"), TC("$500K"), TC("$1M+"), TC("1440 Media")],
    [TC("SMS Value vs Email"), TC("5x"), TC("10x"), TC("20x"), TC("Paulson")],
    [TC("Free -> Pro Conversion"), TC("1%"), TC("3%"), TC("5%+"), TC("Industry benchmark")],
], [1.6*inch, 0.6*inch, 0.6*inch, 0.6*inch, 2.3*inch])

spacer(0.2)
subsubheading("Revenue Benchmarks from Summit Speakers")
make_table([
    [TH("Company"), TH("Revenue"), TH("List Size"), TH("Key Takeaway for Offer Sheet")],
    [TC("MarketBeat (Paulson)"), TC("$50.7M/yr"), TC("6M email + 440K SMS"), TC("10 revenue streams. Aggressive sending with sunsetting. Paid growth is the scale lever.")],
    [TC("1440 Media"), TC("$1M/employee"), TC("Millions"), TC("60%+ open, 7% CTR, 100% sponsor booking rate. Creative = targeting in Meta ads.")],
    [TC("The Plug (Dorsey)"), TC("Exited"), TC("Niche"), TC("Data flywheel: $2K ads -> $100K reports. First-party data is the moat.")],
    [TC("Anik Singal"), TC("$150M+ lifetime"), TC("4M+ social"), TC("AI clones: 34M views/mo, 10-15 min/week, 2-person team. Scale without headcount.")],
], [1.3*inch, 1*inch, 1.2*inch, 2.7*inch])

spacer(0.3)
heading("THE BOTTOM LINE")
body(
    "The Offer Sheet is already a strong business at 250K+ subscribers with a Pro tier. The biggest opportunities "
    "identified from these 11 presentations are:"
)
bullet("<b>1. Deliverability (immediate):</b> WE-PAC welcome email + deliverability detox = 20-30% open rate boost in 4 weeks")
bullet("<b>2. First-party data (medium-term):</b> Start capturing investor intent data via surveys and click tagging. This becomes your moat and unlocks premium sponsorships + data products.")
bullet("<b>3. Content repurposing (ongoing):</b> ADAPT framework turns daily issues into 365+ social posts/year, driving organic growth")
bullet("<b>4. SMS (quick win):</b> Post-signup survey captures phone numbers from 17% of new subscribers. SMS is 10-20x more valuable.")
bullet("<b>5. Meta ads (scale):</b> Persona-based creative with broad targeting on Meta's Andromeda algorithm. Paid is how you get to 500K+ and beyond.")
bullet("<b>6. Revenue diversification (strategic):</b> Move beyond Pro subs into sponsorships, affiliate deals, co-reg, data products, and triggered campaigns")

spacer(0.2)
body(
    "Start with the 30-day plan. The Week 1 wins (WE-PAC email, post-signup survey, deliverability detox) "
    "require minimal effort but deliver outsized results. Everything else builds from there."
)

spacer(0.2)
story.append(Paragraph(
    "This playbook was synthesized from 11 presentations at the New Media Summit (March 2026), "
    "representing $200M+ in combined revenue from the presenters. Every framework and tactic "
    "has been battle-tested at scale and adapted specifically for The Offer Sheet.",
    styles['SmallNote']
))
story.append(Paragraph(
    "Prepared by Adsora (adsora.com)  |  March 2026",
    styles['SmallNote']
))

# Build
doc.build(story)
print(f"PDF generated: {output_path}")
