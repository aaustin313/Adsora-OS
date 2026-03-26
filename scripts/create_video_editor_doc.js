/**
 * Creates the "Video Editor Master Document" Google Doc via Drive API
 * by uploading HTML that gets converted to a formatted Google Doc.
 * This bypasses the need for the Docs API to be enabled.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const FOLDER_ID = "1-f9KFu8u46WEu38vh2VOAeLsGcDFzEFE";

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback"
  );
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  client.setCredentials(tokens);
  return client;
}

const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; color: #222; line-height: 1.6; }
  h1 { font-size: 24pt; color: #1a1a1a; border-bottom: 3px solid #333; padding-bottom: 8px; }
  h2 { font-size: 16pt; color: #2c3e50; margin-top: 30px; border-bottom: 2px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 13pt; color: #34495e; margin-top: 20px; }
  .subtitle { font-size: 13pt; color: #555; font-style: italic; }
  .updated { font-weight: bold; color: #666; }
  ul { margin: 8px 0; }
  li { margin: 4px 0; }
  .divider { color: #999; margin: 20px 0; }
  .do-header { color: #228B22; }
  .dont-header { color: #CC0000; }
  .checklist li { list-style-type: square; }
  blockquote { border-left: 4px solid #2c3e50; padding-left: 12px; color: #555; font-style: italic; margin: 16px 0; }
</style>
</head>
<body>

<h1>VIDEO EDITOR MASTER DOCUMENT</h1>
<p class="subtitle">Adsora &mdash; Performance Marketing Creative Team</p>
<p class="updated">Last Updated: March 23, 2026</p>

<h2>TABLE OF CONTENTS</h2>
<ol>
<li>Mission &amp; Philosophy</li>
<li>Creative Standards &amp; Specifications</li>
<li>Video Types &amp; When to Use Them</li>
<li>Tools &amp; Access</li>
<li>AI Video Ad Guidelines</li>
<li>UGC-Style Ad Guidelines</li>
<li>Compliance &amp; Legal Requirements</li>
<li>Copywriting for Video Editors</li>
<li>Naming Conventions &amp; File Organization</li>
<li>Delivery &amp; Upload Process</li>
<li>Research Process</li>
<li>Script Frameworks &amp; Templates</li>
<li>Hooks Library</li>
<li>Dos and Don&rsquo;ts Quick Reference</li>
<li>Resources &amp; Links</li>
</ol>

<hr>

<h2>1. MISSION &amp; PHILOSOPHY</h2>

<p>Our ads should never look like ads. The best-performing creatives feel organic, authentic, and native to the platform. We are a direct-response performance marketing agency &mdash; every creative must drive action.</p>

<p><strong>Key principles:</strong></p>
<ul>
<li>Non-ad-looking ads outperform polished commercial-style ads</li>
<li>UGC-style and customer story formats are our bread and butter</li>
<li>Direct response, aggressive tone &mdash; always lead with a compelling offer</li>
<li>Every ad must be unique enough that Meta won&rsquo;t flag it as duplicate</li>
<li>Study winning ads in the accounts to understand WHY they work</li>
<li>Ship volume &mdash; we test 15-30 ads per day across accounts</li>
</ul>

<hr>

<h2>2. CREATIVE STANDARDS &amp; SPECIFICATIONS</h2>

<h3>Video Specs:</h3>
<ul>
<li>All text must be readable and centered</li>
<li><strong>BOTH 9:16 (vertical) AND 1:1 (square) versions are REQUIRED for every video</strong>
  <ul>
    <li>9:16 = Stories, Reels, vertical placements</li>
    <li>1:1 = Feed placements</li>
    <li>Only skip dual versions if the 9:16 naturally crops well to 1:1</li>
    <li>Carousels only need 1:1</li>
  </ul>
</li>
<li>Film vertically in 9:16 aspect ratio</li>
<li>Main content must be centered (not in corners)</li>
<li>Add 1-3 extra seconds at beginning and end of each clip (editing handles)</li>
</ul>

<h3>Quality Rules:</h3>
<ul>
<li>Non-ad-looking ads (UGC style) &mdash; iPhone quality is fine and preferred</li>
<li>Obvious/polished ads &mdash; must be high production quality</li>
<li>AVOID stock footage &mdash; use AI-generated videos instead (Sora 2, Kling, Veo3)</li>
<li>No filters or color grading on UGC raw content submissions</li>
</ul>

<h3>People in Videos:</h3>
<ul>
<li>Default: White people (unless specified otherwise for the vertical)</li>
<li>American accent</li>
<li>Aspirational/authority figures: young blondes, middle-aged deep voice men</li>
<li>&ldquo;Paid promotion&rdquo; disclosure text required for UGC &mdash; small black font, shown for 2-3 seconds at end</li>
</ul>

<h3>Before/After Ads:</h3>
<ul>
<li>Use contrasting colors to clearly distinguish before vs. after states</li>
</ul>

<h3>Sound &amp; Music:</h3>
<ul>
<li>Only use music for feelings-based products (lifestyle, beauty, etc.)</li>
<li>Background music HURTS effectiveness for high-consideration products (home services, legal, etc.)</li>
<li>If music is needed, use suno.com to generate it</li>
<li>Use sumo.ai for mood-matched background music per section in VSLs</li>
</ul>

<hr>

<h2>3. VIDEO TYPES &amp; WHEN TO USE THEM</h2>

<h3>UGC-Style Ads:</h3>
<ul>
<li>Looks like someone filmed it on their phone naturally</li>
<li>No B-roll</li>
<li>No fancy editing or transitions</li>
<li>Captions: NO captions (if disguised as organic video story)</li>
<li>Best for: customer stories, testimonials, &ldquo;I just discovered this&rdquo; angles</li>
</ul>

<h3>Company/Offer Ads:</h3>
<ul>
<li>Direct advertising from the company</li>
<li>Captions: YES, you can add your own</li>
<li>Can be more polished</li>
<li>Best for: direct offers, promotions, seasonal pushes</li>
</ul>

<h3>AI-Generated Video Ads (Sora 2, Kling, Veo3):</h3>
<ul>
<li>One-cut, one-scene &mdash; NO text overlay</li>
<li>Must NOT look like an ad (no phone screens, no visual overlays, no graphics)</li>
<li>Natural, raw feeling</li>
<li>Best for: visual hooks, attention-grabbing openers</li>
</ul>

<h3>Talking Head Ads:</h3>
<ul>
<li>HeyGen performs best for AI talking heads</li>
<li>Use CapCut to fix AI voice quality</li>
<li>Person speaks directly to camera, natural setting</li>
<li>Best for: expert/authority positioning, product explanations</li>
</ul>

<h3>VSL (Video Sales Letters):</h3>
<ul>
<li>Longer format (2-10 minutes)</li>
<li>See Section 12 for script frameworks</li>
<li>Best for: high-ticket offers, complex products</li>
</ul>

<hr>

<h2>4. TOOLS &amp; ACCESS</h2>

<p>All tools are accessible via adsoraaccess@gmail.com &mdash; passwords stored in Bitwarden.</p>

<h3>AI Video Generation:</h3>
<ul>
<li>Sora 2 &mdash; AI videos (free app store download)</li>
<li>Kling AI &mdash; AI videos (<a href="https://app.klingai.com/global/">app.klingai.com/global/</a>)</li>
<li>Veo3 AI ULTRA &mdash; AI videos (not yet accessible)</li>
<li>HeyGen (Unlimited Creator plan) &mdash; AI talking head videos, digital avatars</li>
<li>Grok Imagine &mdash; AI videos (<a href="https://grok.com/imagine">grok.com/imagine</a>)</li>
<li>Higgsfield &mdash; AI video creator studio</li>
</ul>

<h3>AI Voice &amp; Audio:</h3>
<ul>
<li>ElevenLabs (Creator plan) &mdash; AI voiceover generation</li>
<li>CapCut &mdash; Video editor with AI voice fix feature</li>
</ul>

<h3>Image &amp; Design:</h3>
<ul>
<li>Midjourney &mdash; AI image generation for ad creatives</li>
<li>Canva &mdash; Design templates and image ads
  <ul>
    <li>150 Facebook ad templates: <a href="https://bit.ly/150ads">https://bit.ly/150ads</a></li>
    <li>Newsletter image ad templates available</li>
    <li>Low-ticket digital product blank template</li>
  </ul>
</li>
</ul>

<h3>Animation:</h3>
<ul>
<li>LivePortrait (HuggingFace) &mdash; Unlimited face animation
  <ul>
    <li><a href="https://huggingface.co/spaces/KwaiVGI/LivePortrait">https://huggingface.co/spaces/KwaiVGI/LivePortrait</a></li>
    <li>Save the account profile picture first</li>
  </ul>
</li>
</ul>

<h3>AI Script &amp; Content:</h3>
<ul>
<li>ChatGPT Plus &mdash; Script writing, ideation (adsoraaccess@gmail.com)</li>
<li>Caption AI &mdash; AI creator for prompt-to-video generation
  <ul>
    <li>Click create &rarr; select AI creator &rarr; prompt to video &rarr; pick creator &rarr; write script &rarr; auto-generates</li>
  </ul>
</li>
</ul>

<h3>Research:</h3>
<ul>
<li>Ad Library Helper &mdash; Chrome extension for Meta Ad Library research + download</li>
<li>Adplexity &mdash; Competitive ad spying tool (Bitwarden)</li>
<li>Meta Ad Library &mdash; <a href="https://www.facebook.com/ads/library/">https://www.facebook.com/ads/library/</a></li>
<li>TikTok Ad Library &mdash; competitor research</li>
</ul>

<h3>Other:</h3>
<ul>
<li>Sorry Watermark &mdash; Bulk remove Sora 2 watermarks (ask Bruno Avolio for invite)</li>
<li>suno.com &mdash; AI music generation</li>
<li>sumo.ai &mdash; Mood-matched background music</li>
<li>Visla.us &mdash; Auto-generated b-roll from audio upload</li>
</ul>

<hr>

<h2>5. AI VIDEO AD GUIDELINES</h2>

<h3>Sora 2 Prompting Rules:</h3>
<ul>
<li>Tell the AI in the prompt: NO text overlay</li>
<li>Tell the AI: nothing that makes it look like an ad</li>
<li>No visual overlays, no phone screens, no graphics</li>
<li>Best results come from one-cut, one-scene prompts</li>
<li>Keep it natural and cinematic</li>
</ul>

<h3>Kling AI Settings:</h3>
<ul>
<li>Default aspect ratio: 9:16 (vertical)</li>
<li>Duration: 5 seconds (for hooks &le;10s) or 10 seconds (for longer clips)</li>
<li>Model: kling-v2</li>
<li>Mode: standard</li>
</ul>

<h3>Prompt Templates by Ad Type:</h3>
<ul>
<li><strong>UGC/Talking Head:</strong> &ldquo;Person looking directly at camera, speaking passionately... Natural lighting, phone-camera style, authentic feel. Vertical video format, casual setting.&rdquo;</li>
<li><strong>Text Overlay:</strong> &ldquo;Clean, bold text appearing on screen with dynamic motion graphics. Dark background with bright text reveals. Vertical social media format.&rdquo;</li>
<li><strong>Slideshow:</strong> &ldquo;Series of compelling images transitioning smoothly. Ken Burns effect. Clean transitions. Vertical format.&rdquo;</li>
<li><strong>Voiceover/B-roll:</strong> &ldquo;Cinematic b-roll footage... Wide and close-up shots, smooth camera movements. Professional look with natural color grading. Vertical format.&rdquo;</li>
</ul>

<h3>AI Compliance:</h3>
<ul>
<li>First 3 seconds of AI-generated video ads MUST include disclosure: &ldquo;AI-generated&rdquo;</li>
<li>First 3 seconds of influencer/paid actor ads MUST include: &ldquo;Paid actor&rdquo;</li>
</ul>

<h3>HeyGen VSL Workflow:</h3>
<ol>
<li>Record 2 minutes of yourself &rarr; upload to HeyGen + ElevenLabs</li>
<li>Upload VSL script to ElevenLabs &rarr; refine line by line</li>
<li>Upload audio to Visla.us &rarr; auto-generated b-roll</li>
<li>Export HeyGen digital avatar with the audio</li>
<li>Composite in editor: b-roll as primary focus, avatar in corner</li>
<li>Bonus: Use sumo.ai for mood-matched background music per section</li>
</ol>

<hr>

<h2>6. UGC-STYLE AD GUIDELINES</h2>

<h3>Shooting Requirements:</h3>
<ul>
<li>Film vertically &mdash; 9:16 aspect ratio</li>
<li>Main content centered (not in corners)</li>
<li>Add 1-3 extra seconds at beginning and end of each clip</li>
<li>Turn off ACs, fans, and loud devices before recording</li>
<li>NO filters or color grading on submitted raw content</li>
<li>Avoid clothes with logos</li>
<li>Clean, aesthetic background</li>
<li>Well-lit environment</li>
<li>Deliver ALL raw files + finished creative via Google Drive or WeTransfer</li>
</ul>

<h3>Editing Rules:</h3>
<ul>
<li>NO B-roll in UGC-style ads</li>
<li>NO captions if the ad is disguised as an organic video/story</li>
<li>Keep it looking like a natural, raw phone recording</li>
<li>Don&rsquo;t over-edit &mdash; the imperfection is the point</li>
</ul>

<hr>

<h2>7. COMPLIANCE &amp; LEGAL REQUIREMENTS</h2>

<h3>Facebook Ad Policy Non-Negotiables:</h3>
<ul>
<li>NO fake &ldquo;FREE&rdquo; claims</li>
<li>NO outcome promises or guarantees</li>
<li>NO fake urgency or scarcity</li>
<li>NO celebrity use without permission</li>
<li>NO absolutes: &ldquo;guaranteed&rdquo;, &ldquo;approved&rdquo;, &ldquo;100%&rdquo;, &ldquo;always&rdquo;, &ldquo;never&rdquo;</li>
<li>NO misleading before/after images without proper context</li>
<li>NO discrimination in targeting (housing, employment, credit)</li>
<li>Special Ad Categories required for housing-related lead gen</li>
</ul>

<h3>Video Ad Disclosures (First 3 Seconds):</h3>
<ul>
<li>&ldquo;Paid actor&rdquo; &mdash; for influencer/paid actor ads</li>
<li>&ldquo;AI-generated&rdquo; &mdash; for AI-generated video ads</li>
<li>&ldquo;Paid promotion&rdquo; &mdash; small black font, 2-3 seconds at end for UGC</li>
</ul>

<h3>Scarcity &amp; Urgency:</h3>
<ul>
<li>ALLOWED but must use hedging language: &ldquo;may&rdquo;, &ldquo;can&rdquo;, &ldquo;up to&rdquo;, &ldquo;as low as&rdquo;</li>
<li>Never promise specific outcomes</li>
</ul>

<h3>Vertical-Specific Compliance:</h3>

<p><strong>DEBT RELIEF (TurboDebt) &mdash; BANNED TERMS:</strong></p>
<ul>
<li>&ldquo;government&rdquo;, &ldquo;free program&rdquo;, &ldquo;debt forgiveness&rdquo;, &ldquo;guaranteed&rdquo;, &ldquo;emergency&rdquo;, &ldquo;new&rdquo;</li>
<li>No dollar amounts or percentage savings claims</li>
<li>No promises of specific outcomes</li>
</ul>

<p><strong>MASS TORT:</strong></p>
<ul>
<li>Legal disclaimers may be required</li>
<li>Follow attorney advertising rules</li>
</ul>

<p><strong>HOME SERVICES:</strong></p>
<ul>
<li>Cannot say &ldquo;government program&rdquo; or &ldquo;free&rdquo; replacements</li>
<li>Can use creative pricing/offers but people must know they&rsquo;re paying for the service</li>
<li>Hedging language required: &ldquo;may qualify&rdquo;, &ldquo;see if you qualify&rdquo;</li>
</ul>

<h3>Landing Page Requirements:</h3>
<ul>
<li>Must have disclaimer</li>
<li>Minimum 12px font size</li>
<li>Privacy policy link</li>
<li>Terms of service link</li>
<li>DMCA notice</li>
<li>&ldquo;Do Not Sell My Information&rdquo; link</li>
</ul>

<h3>General Legal:</h3>
<ul>
<li>TCPA compliance for lead forms (consent language required)</li>
<li>CAN-SPAM compliance for email newsletters</li>
<li>FTC guidelines for advertising disclosures</li>
<li>Honor opt-out requests immediately</li>
</ul>

<hr>

<h2>8. COPYWRITING FOR VIDEO EDITORS</h2>

<blockquote>Austin&rsquo;s mandate: &ldquo;We need to focus a little more on copywriting. Study ads in the accounts and try to understand why they work.&rdquo;</blockquote>

<p><strong>Video editors must understand copywriting because:</strong></p>
<ul>
<li>You&rsquo;re the last line of creative before the ad goes live</li>
<li>Script selection and hook execution directly impact performance</li>
<li>UGC hooks need to be shorter &mdash; one-liners &mdash; because creators charge by word/time</li>
</ul>

<h3>Copywriting Study Resources (Google Drive):</h3>
<ul>
<li>Folder 1: <a href="https://drive.google.com/drive/folders/1J10VgPzqNm65J_G0bFuaTKZgtEmez03J">https://drive.google.com/drive/folders/1J10VgPzqNm65J_G0bFuaTKZgtEmez03J</a></li>
<li>Folder 2: <a href="https://drive.google.com/drive/folders/1EVIbiz2cj4eEHk3UbvU2wqYVIujFMl6Y">https://drive.google.com/drive/folders/1EVIbiz2cj4eEHk3UbvU2wqYVIujFMl6Y</a></li>
<li>Folder 3: <a href="https://drive.google.com/drive/folders/1Hm2oREx1hhRI0q0lR6TQ3xJMreeGTi7r">https://drive.google.com/drive/folders/1Hm2oREx1hhRI0q0lR6TQ3xJMreeGTi7r</a></li>
</ul>

<p><strong>Key copywriting principles for video:</strong></p>
<ul>
<li>Hook is EVERYTHING &mdash; first 1-3 seconds determine if the ad works</li>
<li>Direct response copy: clear offer, clear CTA, clear benefit</li>
<li>Speak to ONE person, not a crowd</li>
<li>Use the language your audience uses (not marketing speak)</li>
<li>Agitate the problem before presenting the solution</li>
</ul>

<hr>

<h2>9. NAMING CONVENTIONS &amp; FILE ORGANIZATION</h2>

<h3>Creative Naming:</h3>
<ul>
<li>Videos: Video62_9x16, Video62_1x1</li>
<li>Images: Image97_1x1</li>
<li>Carousel folders: &ldquo;carousel 1 set 1&rdquo;</li>
<li>Track the last used creative ID in the &ldquo;Last Creative ID&rdquo; doc in Drive</li>
</ul>

<h3>Folder Structure:</h3>
<ul>
<li>ClientName/Creatives/ProductName/Creative type</li>
<li>All creatives organized by date + vertical in ~/Documents/launched/</li>
</ul>

<h3>Google Drive Delivery:</h3>
<p>Organize deliverables in folders with:</p>
<ul>
<li>Research &amp; insights</li>
<li>Scripts</li>
<li>Edited video (final exports)</li>
<li>Creative decision notes</li>
<li>Assets used</li>
</ul>

<h3>Campaign Naming:</h3>
<ul>
<li>Campaigns may be named per video editor for attribution tracking in ClickFlare</li>
<li>Example: Campaigns with &ldquo;Powerk&rdquo; in the name = POWERK&rsquo;s creatives</li>
</ul>

<hr>

<h2>10. DELIVERY &amp; UPLOAD PROCESS</h2>

<h3>Video Upload to Facebook:</h3>
<ul>
<li>Format: MP4</li>
<li>Processing time: ~2 minutes for files &lt;50MB, ~4 minutes for files &ge;50MB</li>
<li>Videos are pulled from Google Drive folders organized by vertical</li>
</ul>

<h3>Delivery Checklist:</h3>
<ul class="checklist">
<li>Both 9:16 AND 1:1 versions exported</li>
<li>Correct naming convention (Video##_9x16, Video##_1x1)</li>
<li>Uploaded to correct Google Drive folder (by vertical/client)</li>
<li>Last Creative ID doc updated</li>
<li>Compliance disclosures included (if applicable)</li>
<li>No stock footage used</li>
<li>Raw UGC files delivered alongside finished creative</li>
</ul>

<hr>

<h2>11. RESEARCH PROCESS</h2>

<p><strong>Before creating ANY ad, editors must:</strong></p>

<p><strong>1. Research competitors in Meta Ad Library</strong></p>
<ul>
<li>Search by advertiser name, keywords, or vertical</li>
<li>Use Ad Library Helper Chrome extension to download reference ads</li>
<li>Also check TikTok Ad Library</li>
<li>Use Adplexity for deeper competitive intelligence</li>
</ul>

<p><strong>2. Study winning ads in current accounts</strong></p>
<ul>
<li>Look at what&rsquo;s spending the most (highest 7-day spend = best performer)</li>
<li>Understand WHY the winning ads work (hook, angle, offer, visual style)</li>
</ul>

<p><strong>3. Make your ads DIFFERENT</strong></p>
<ul>
<li>&ldquo;Please make ads very different from the examples so Meta doesn&rsquo;t flag us&rdquo;</li>
<li>Same strategy/angle is fine, but execution must be unique</li>
<li>&ldquo;The most important detail is that it needs to be something unique/better than what you can see in the ad library&rdquo;</li>
</ul>

<hr>

<h2>12. SCRIPT FRAMEWORKS &amp; TEMPLATES</h2>

<h3>Short-Form Ad Script (15-45 seconds):</h3>
<ul>
<li><strong>Hook (0-3s):</strong> Pattern interrupt, claim, audience callout, or problem agitation</li>
<li><strong>Story/Problem (3-15s):</strong> Agitate the pain point</li>
<li><strong>Solution (15-30s):</strong> Present the offer</li>
<li><strong>CTA (30-45s):</strong> Clear call to action</li>
</ul>

<h3>YouTube/Long-Form Ad Script (&lt;3 minutes):</h3>
<ul>
<li><strong>Hook (0:00-0:20):</strong> Up to 20 seconds, use one of 5 hook types</li>
<li><strong>Story (0:20-2:00):</strong> Problem &rarr; Discovery &rarr; Solution</li>
<li><strong>Close (2:00-3:00):</strong> Offer + CTA</li>
</ul>

<h3>VSL Framework (2-10 minutes):</h3>
<ol>
<li><strong>Opening</strong> &mdash; Pattern interrupt, big claim</li>
<li><strong>Introduction</strong> &mdash; Who you are, credibility</li>
<li><strong>Problem</strong> &mdash; Deep dive into the pain</li>
<li><strong>Opportunity</strong> &mdash; What&rsquo;s now possible</li>
<li><strong>Case Study</strong> &mdash; Proof/social proof</li>
<li><strong>Offer</strong> &mdash; What they get, pricing, bonuses</li>
<li><strong>CTA</strong> &mdash; Clear next step</li>
</ol>

<h3>4-Video Launch Sequence (for campaigns):</h3>
<ul>
<li><strong>Video 1:</strong> Hook + Problem Identification</li>
<li><strong>Video 2:</strong> Story + Social Proof</li>
<li><strong>Video 3:</strong> Solution + Offer Details</li>
<li><strong>Video 4:</strong> Urgency + Final CTA</li>
</ul>

<h3>Script Output Format (for pipeline):</h3>
<ul>
<li><strong>Type:</strong> ugc / voiceover / text_overlay / slideshow / talking_head</li>
<li><strong>Hook:</strong> The opening line</li>
<li><strong>Angle:</strong> The strategic approach</li>
<li><strong>Headline:</strong> The ad headline</li>
<li><strong>Primary Text:</strong> The ad copy</li>
<li><strong>Full Script:</strong> Complete script with visual directions</li>
<li><strong>Estimated Length:</strong> 15-45 seconds (short form)</li>
<li><strong>Target Emotion:</strong> The feeling you&rsquo;re aiming for</li>
</ul>

<hr>

<h2>13. HOOKS LIBRARY</h2>

<p><strong>6 Types of Video Hooks:</strong></p>

<p><strong>1. PATTERN INTERRUPT</strong></p>
<ul>
<li>Do something unexpected in the first second</li>
<li>Physical action, unusual visual, surprising statement</li>
<li>Example: Dropping phone, slamming door, extreme close-up</li>
</ul>

<p><strong>2. BOLD CLAIM</strong></p>
<ul>
<li>Lead with a provocative or surprising statement</li>
<li>Must be defensible (no compliance violations)</li>
<li>Example: &ldquo;Nobody is talking about this...&rdquo;</li>
</ul>

<p><strong>3. AUDIENCE CALLOUT</strong></p>
<ul>
<li>Directly address the target audience</li>
<li>Example: &ldquo;Homeowners in [state]...&rdquo; or &ldquo;If you were born before 1965...&rdquo;</li>
</ul>

<p><strong>4. DISQUALIFY</strong></p>
<ul>
<li>Tell people NOT to watch/click (reverse psychology)</li>
<li>Example: &ldquo;Don&rsquo;t watch this if you already have cheap insurance&rdquo;</li>
</ul>

<p><strong>5. ACT OUT THE PROBLEM</strong></p>
<ul>
<li>Visually demonstrate the pain point</li>
<li>Example: Showing a leaky roof, struggling with debt paperwork</li>
</ul>

<p><strong>6. NEWS/CURRENT EVENT</strong></p>
<ul>
<li>Tie into something timely</li>
<li>Example: &ldquo;New 2026 program just announced...&rdquo;</li>
</ul>

<p><strong>Hook Categories:</strong></p>
<ul>
<li><strong>Problem-focused:</strong> Lead with the pain</li>
<li><strong>Product-focused:</strong> Lead with the solution</li>
<li><strong>Benefit-focused:</strong> Lead with the outcome</li>
</ul>

<p><strong>Remember: UGC hooks need to be SHORT &mdash; one-liners. Creators charge by word/time.</strong></p>

<hr>

<h2>14. DOS AND DON&rsquo;TS QUICK REFERENCE</h2>

<h3 class="do-header">DO:</h3>
<ul>
<li>Create both 9:16 AND 1:1 versions of every video</li>
<li>Make ads look organic and native to the platform</li>
<li>Use AI tools (Sora 2, Kling, HeyGen) instead of stock footage</li>
<li>Research competitors in Ad Library before creating</li>
<li>Make your ads significantly different from reference ads</li>
<li>Study winning ads in accounts to understand WHY they work</li>
<li>Study copywriting resources &mdash; understand hooks, angles, CTAs</li>
<li>Use HeyGen for talking head ads</li>
<li>Use CapCut to fix AI voice quality</li>
<li>Add &ldquo;Paid promotion&rdquo; disclosure to UGC ads</li>
<li>Add &ldquo;AI-generated&rdquo; disclosure in first 3 seconds of AI ads</li>
<li>Add &ldquo;Paid actor&rdquo; disclosure in first 3 seconds of paid actor ads</li>
<li>Use hedging language for urgency/scarcity (&ldquo;may&rdquo;, &ldquo;up to&rdquo;, &ldquo;as low as&rdquo;)</li>
<li>Follow naming conventions (Video##_9x16, Video##_1x1)</li>
<li>Update the Last Creative ID doc</li>
<li>Deliver raw files alongside finished creatives</li>
<li>Keep hooks SHORT &mdash; especially for UGC (one-liners)</li>
<li>Use suno.com for music generation when needed</li>
<li>Center all text in videos</li>
<li>Add 1-3 extra seconds at beginning/end of clips</li>
</ul>

<h3 class="dont-header">DON&rsquo;T:</h3>
<ul>
<li>Don&rsquo;t add text overlays to AI-generated video ads</li>
<li>Don&rsquo;t make AI videos look like ads (no phone screens, no visual overlays)</li>
<li>Don&rsquo;t add B-roll to UGC-style ads</li>
<li>Don&rsquo;t add captions to organic-style story ads</li>
<li>Don&rsquo;t use stock footage &mdash; use AI-generated video instead</li>
<li>Don&rsquo;t use background music for high-consideration products (home services, legal)</li>
<li>Don&rsquo;t leave AI voices unfixed</li>
<li>Don&rsquo;t say &ldquo;government program&rdquo; or &ldquo;free&rdquo; for home services</li>
<li>Don&rsquo;t use banned terms for debt relief (see compliance section)</li>
<li>Don&rsquo;t promise specific outcomes or guarantees</li>
<li>Don&rsquo;t use &ldquo;guaranteed&rdquo;, &ldquo;approved&rdquo;, &ldquo;100%&rdquo;, &ldquo;always&rdquo;, &ldquo;never&rdquo;</li>
<li>Don&rsquo;t use fake urgency or scarcity</li>
<li>Don&rsquo;t use celebrity images without permission</li>
<li>Don&rsquo;t apply filters/color grading to UGC raw content</li>
<li>Don&rsquo;t wear clothes with logos in UGC shoots</li>
<li>Don&rsquo;t skip the research phase &mdash; always check Ad Library first</li>
<li>Don&rsquo;t submit creatives without both aspect ratio versions</li>
<li>Don&rsquo;t copy competitor ads exactly &mdash; Meta will flag you</li>
</ul>

<hr>

<h2>15. RESOURCES &amp; LINKS</h2>

<h3>Google Drive &mdash; Video Editor Folder:</h3>
<p><a href="https://drive.google.com/drive/folders/1-f9KFu8u46WEu38vh2VOAeLsGcDFzEFE">https://drive.google.com/drive/folders/1-f9KFu8u46WEu38vh2VOAeLsGcDFzEFE</a></p>

<h3>Copywriting Study Folders:</h3>
<ul>
<li><a href="https://drive.google.com/drive/folders/1J10VgPzqNm65J_G0bFuaTKZgtEmez03J">https://drive.google.com/drive/folders/1J10VgPzqNm65J_G0bFuaTKZgtEmez03J</a></li>
<li><a href="https://drive.google.com/drive/folders/1EVIbiz2cj4eEHk3UbvU2wqYVIujFMl6Y">https://drive.google.com/drive/folders/1EVIbiz2cj4eEHk3UbvU2wqYVIujFMl6Y</a></li>
<li><a href="https://drive.google.com/drive/folders/1Hm2oREx1hhRI0q0lR6TQ3xJMreeGTi7r">https://drive.google.com/drive/folders/1Hm2oREx1hhRI0q0lR6TQ3xJMreeGTi7r</a></li>
</ul>

<h3>Tools:</h3>
<ul>
<li>Meta Ad Library: <a href="https://www.facebook.com/ads/library/">https://www.facebook.com/ads/library/</a></li>
<li>Kling AI: <a href="https://app.klingai.com/global/">https://app.klingai.com/global/</a></li>
<li>Grok Imagine: <a href="https://grok.com/imagine">https://grok.com/imagine</a></li>
<li>LivePortrait: <a href="https://huggingface.co/spaces/KwaiVGI/LivePortrait">https://huggingface.co/spaces/KwaiVGI/LivePortrait</a></li>
<li>150 FB Ad Templates: <a href="https://bit.ly/150ads">https://bit.ly/150ads</a></li>
<li>Suno (Music): <a href="https://suno.com">https://suno.com</a></li>
<li>Midjourney Tutorial: <a href="https://youtu.be/dcrhhIKNaRQ">https://youtu.be/dcrhhIKNaRQ</a></li>
</ul>

<h3>Contact:</h3>
<ul>
<li>Slack Channel: #adsora-all-teams-general</li>
<li>Team Email: team@adsora.com</li>
<li>Tool Access Email: adsoraaccess@gmail.com (passwords in Bitwarden)</li>
</ul>

<hr>

<p><em>This is a living document. Updated as processes evolve and new tools are added.</em></p>
<p><em>For questions, reach out in #adsora-all-teams-general on Slack.</em></p>

</body>
</html>`;

async function main() {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  console.log("Creating Google Doc via Drive API (HTML upload with conversion)...");

  // Create a readable stream from the HTML content
  const stream = new Readable();
  stream.push(htmlContent);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: "Video Editor Master Document",
      mimeType: "application/vnd.google-apps.document",
      parents: [FOLDER_ID],
    },
    media: {
      mimeType: "text/html",
      body: stream,
    },
    fields: "id, webViewLink",
  });

  const docId = res.data.id;
  const docUrl = res.data.webViewLink || `https://docs.google.com/document/d/${docId}/edit`;

  console.log(`\nDocument created successfully!`);
  console.log(`Document ID: ${docId}`);
  console.log(`URL: ${docUrl}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  if (err.response) {
    console.error("Details:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
