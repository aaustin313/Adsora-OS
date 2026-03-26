#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { createGoogleDocFromHtml } = require("../src/google/drive");

const html = `
<h1 style="text-align:center;">Media Buyer Test Task</h1>
<p style="text-align:center; color:#555;">Windows Replacement Landing Page Setup</p>

<hr>

<p style="background:#f0f5ff; border-left:4px solid #2563eb; padding:12px 16px;">
  <strong>Overview:</strong> Build a landing page in GoHighLevel for a <strong>windows replacement</strong> offer.
  The page needs to look clean, convert well, and have the correct tracking and links in place.
  Use the reference pages and resources below to guide your work.
</p>

<p style="background:#fef3c7; border:1px solid #f59e0b; padding:12px 16px;">
  <strong>IMPORTANT:</strong> You must <strong>screen record yourself</strong> completing this entire task from start to finish.
  Submit the recording along with your finished page. This lets us see your workflow, speed, and how you solve problems.
  Any screen recording tool works (Loom, OBS, QuickTime, etc.).
</p>

<h2>1. Reference Pages</h2>
<p>Use these live landing pages as inspiration for layout, design, and feel:</p>
<ul>
  <li><a href="https://www.yourwarrantysavings.com/v2">yourwarrantysavings.com/v2</a></li>
  <li><a href="https://homerequestoffers.casa">homerequestoffers.casa</a></li>
  <li><a href="https://clearwindowsavings.com/slp2">clearwindowsavings.com/slp2</a></li>
  <li><a href="https://trustedlocalpros.org/2025-local-pros/">trustedlocalpros.org/2025-local-pros</a></li>
</ul>

<h2>2. Conversion Resources</h2>
<p>Use these documents to help make your page convert better:</p>
<ul>
  <li><a href="https://docs.google.com/document/d/1N1ZA-sJ4Y8_2i7rl7_cfQZWeJkIzeel_/edit">Landing Page Optimization Guide</a></li>
  <li><a href="https://docs.google.com/document/d/19Jm1fpx_Fm9t-W8eLy3BLbaSGqEPX4sDlKfDLrI4AOE/edit?tab=t.qfqyb7q9pwr3">Conversion Best Practices</a></li>
</ul>

<h2>3. Requirements</h2>

<h3>A. Build & Style the Page</h3>
<ul>
  <li>The page should promote <strong>windows replacement services</strong></li>
  <li>Make it look clean, professional, and mobile-friendly</li>
  <li>Use the reference pages above for design inspiration</li>
  <li>Use the conversion resources in Section 2 to optimize the page for conversions</li>
</ul>

<h3>B. Set the Offer Link</h3>
<p>All buttons and links on the page that lead to the offer <strong>must</strong> point to:</p>
<p style="background:#f3f4f6; padding:10px 14px; font-family:monospace; border:1px solid #d1d5db;">
  https://click.americanprograms.org/cf/click/1
</p>

<h3>C. Add Tracking Code to the Page Header</h3>
<p>Add the following script to the <strong>page header</strong> (Settings → Tracking Code → Header):</p>
<p style="background:#f3f4f6; padding:10px 14px; font-family:monospace; font-size:10px; border:1px solid #d1d5db; word-break:break-all;">
&lt;script&gt;!function(){"use strict";var n="lp_ref",t="cpid",e="lpurl",c="https://click.americanprograms.org",r="(?&lt;domain&gt;http(?:s?)://[^/]*)".concat("/cf/click"),a="(?:(?:/(?&lt;cta&gt;[1-9][0-9]*)/?)|(?:/))?",i="^".concat(r).concat(a).concat("(?:$|(\\\\?.*))"),o='javascript:window.clickflare.l="(?&lt;original_link&gt;'.concat(r).concat(a,'("|(\\\\?[^"]*"))).*'),s=function(){return new RegExp(i,"")},u=function(){return new RegExp(o,"")};function l(n){var t=function(n){return n.replace(s(),(function(n){for(var t=[],e=1;e&lt;arguments.length;e++)t[e-1]=arguments[e];var r=t[t.length-1].domain;return n.replace(r,c)}))}(n);return'javascript:window.clickflare.l="'.concat(t,'"; void 0;')}function d(n,t){if(t&amp;&amp;n&amp;&amp;t.apply(document,[n]),/loaded|interactive|complete/.test(document.readyState))for(var e=0,c=document.links.length;e&lt;c;e++)if(s().test(document.links[e].href)){var r=document.links[e];window.clickflare.links_replaced.has(r)||(r.href=l(r.href),window.clickflare.links_replaced.add(r))}}var f,h,m,p;!function(r,a){var i=document.onreadystatechange;window.clickflare||(window.clickflare={listeners:{},customParams:{},links_replaced:new Set,addEventListener:function(n,t){var e=this.listeners[n]||[];e.includes(t)||e.push(t),this.listeners[n]=e},dispatchEvent:function(n,t){t&amp;&amp;(this.customParams[n]=t),(this.listeners[n]||[]).forEach((function(n){return n(t)}))},push:function(n,t){t&amp;&amp;(this.customParams[n]=t),(this.listeners[n]||[]).forEach((function(n){return n(t)}))}},document.onreadystatechange=function(n){return d(n,i)},d(null,i),setTimeout((function(){!function(r,a){var i,o=function(r,a){var i=new URL("".concat(c).concat(r)),o="{",s=o+o;a.startsWith(s)||i.searchParams.set(t,a);return i.searchParams.append(n,document.referrer),i.searchParams.append(e,location.href),i.searchParams.append("lpt",document.title),i.searchParams.append("t",(new Date).getTime().toString()),i.toString()}(r,a),s=document.createElement("script"),l=document.scripts[0];s.async=1,s.src=o,s.onerror=function(){!function(){for(var n=function(n,t){var e=document.links[n];u().test(decodeURI(e.href))&amp;&amp;setTimeout((function(){e&amp;&amp;e.setAttribute("href",function(n){var t=n.match(u());if(t){var e=(t.groups||{}).original_link;return e?e.slice(0,-1):n}return n}(decodeURI(e.href)))}))},t=0,e=document.links.length;t&lt;e;t++)n(t)}()},null===(i=l.parentNode)||void 0===i||i.insertBefore(s,l)}(r,a)})))}("".concat("/cf/tags","/").concat(new URL(window.location.href).searchParams.get("cftmid")||"{{__CONTAINER_ID__}}"),(m=new URL(window.location.href).searchParams.get(t),f=new RegExp("(^| )".concat("cf_cpid","=([^;]+)")),p=(h=document.cookie.match(f))&amp;&amp;h.pop()||null,m||p||"{{__CAMPAIGN_ID__}}"))}();&lt;/script&gt;
</p>

<h2>4. Deliverable</h2>
<p style="background:#eff6ff; border:2px solid #2563eb; padding:16px; text-align:center; font-weight:bold;">
  Once complete, share the live page URL and your screen recording for review.
</p>

<h3>Checklist Before Submitting</h3>
<ul>
  <li>☐ Page looks clean, professional, and mobile-friendly</li>
  <li>☐ All offer links/buttons point to the correct URL</li>
  <li>☐ Tracking code is added to the page header</li>
  <li>☐ Page is published and the live URL is shared</li>
  <li>☐ Screen recording of the full task is included</li>
</ul>
`;

async function main() {
  try {
    const doc = await createGoogleDocFromHtml("Media Buyer Test Task — Windows Replacement", html);
    console.log("Google Doc created!");
    console.log("Name:", doc.name);
    console.log("Link:", doc.webViewLink);
    console.log("ID:", doc.id);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
