#!/usr/bin/env node
/**
 * Updates the O-1 Visa Itinerary Google Doc with the final version.
 * Uses the Google Docs API (batchUpdate) to clear and rewrite content.
 * Doc ID: 1Hhn0X1xXInLGw8g6Lb3A6OyzqhToR6QGhnOvr8lPXoQ
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const { getAuthClient, isAuthenticated } = require("../src/google/auth");

const DOC_ID = "1Hhn0X1xXInLGw8g6Lb3A6OyzqhToR6QGhnOvr8lPXoQ";

// Plain text content with markers for formatting
const sections = [
  { text: "Itinerary of Proposed Activities\n", style: "HEADING_1", center: true },
  { text: "O-1 Petition for Austin [LAST NAME]\n", style: "HEADING_2", center: true },
  { text: "Adsora — Performance Marketing & Advertising Technology\n\n", style: "SUBTITLE", center: true },

  // YEAR 1
  { text: "Year 1: Establishing U.S. Operations and Scaling the Agency (2026)\n", style: "HEADING_1" },
  { text: "Working location — 6926 Tranquil Point Court, Las Vegas, Nevada 89179\n\n", italic: true },

  { text: "Month 1–3: Strategic Planning and Market Positioning\n", style: "HEADING_2" },
  { text: "• Conduct in-depth analysis of the U.S. performance marketing landscape, identifying high-value verticals including home services, mass torts, health and wellness, and insurance\n" },
  { text: "• Develop a comprehensive growth plan with market entry strategies for new verticals, client acquisition targets, and revenue milestones\n" },
  { text: "• Establish core technology infrastructure: ad management systems, conversion tracking and attribution platforms, and CRM workflows for lead delivery\n" },
  { text: "• Map the U.S. small business landscape to identify underserved markets where local service providers — roofers, contractors, plumbers, solar installers — lack the advertising expertise to reach homeowners in need of their services\n\n" },

  { text: "Month 4–6: Client Acquisition and Team Building\n", style: "HEADING_2" },
  { text: "• Launch outbound business development campaigns targeting affiliate networks and direct advertisers across home services and legal verticals\n" },
  { text: "• Recruit and hire U.S.-based media buyers, ad creative specialists, and campaign operations support staff, creating skilled digital marketing jobs in the Las Vegas metropolitan area\n" },
  { text: "• Build and optimize lead generation funnels on Facebook Ads, scaling initial campaigns to profitability benchmarks across cost-per-lead and return on ad spend targets\n" },
  { text: "• Begin generating qualified leads for U.S. home service businesses, directly enabling local contractors and tradespeople to grow their customer base and hire additional workers\n\n" },

  { text: "Month 7–9: Scaling Operations and Partnership Development\n", style: "HEADING_2" },
  { text: "• Scale Facebook Ads operations across multiple ad accounts and verticals, managing a portfolio of 60+ advertising accounts\n" },
  { text: "• Negotiate and secure distribution partnerships with U.S.-based affiliate networks for lead monetization, contributing to the growth of the domestic digital advertising ecosystem\n" },
  { text: "• Develop proprietary ad creative testing frameworks and performance analysis methodologies to maximize campaign return on investment\n" },
  { text: "• Launch email newsletter operations to build owned audience assets and diversify revenue streams, educating American consumers on financial products, home improvement options, and available services\n\n" },

  { text: "Month 10–12: Operational Optimization and Financial Infrastructure\n", style: "HEADING_2" },
  { text: "• Implement automated performance reporting systems including weekly performance summaries, real-time spend monitoring, and campaign health alerts\n" },
  { text: "• Optimize unit economics across all verticals by refining cost-per-lead targets, creative rotation strategies, and audience segmentation\n" },
  { text: "• Establish financial reporting, budgeting, and forecasting systems\n" },
  { text: "• Conduct Year 1 performance review — measure economic impact including total leads delivered to U.S. businesses, jobs created, and advertising spend contributed to the U.S. digital economy — and develop Year 2 strategic plan\n\n" },

  // YEAR 2
  { text: "Year 2: Market Expansion and Platform Development (2027)\n", style: "HEADING_1" },
  { text: "Working location — 6926 Tranquil Point Court, Las Vegas, Nevada 89179\n\n", italic: true },

  { text: "Month 1–3: Vertical Expansion and Internal Tool Development\n", style: "HEADING_2" },
  { text: "• Expand into new lead generation verticals based on Year 1 performance data, including clinical trials, solar and home improvement, and pet insurance\n" },
  { text: "• Enter the pay-per-call advertising market, launching inbound call campaigns across high-value verticals such as insurance, legal services, home warranties, and debt relief — connecting American consumers directly with service providers by phone, reducing friction and accelerating economic transactions\n" },
  { text: "• Begin development of an internal AI-powered operations platform designed to streamline campaign management, performance analysis, and cross-platform advertising workflows\n" },
  { text: "• Hire U.S.-based software engineers to build core platform infrastructure and integrate with major advertising APIs, creating high-skilled technology jobs domestically\n\n" },

  { text: "Month 4–6: Platform Development and Performance-Based Growth Model\n", style: "HEADING_2" },
  { text: "• Develop AI-assisted tools for ad research, creative development, compliance review, and campaign launching — all operating under human oversight and approval\n" },
  { text: "• Build integrations with Facebook Ads, Google services, and business communication platforms for unified campaign control\n" },
  { text: "• Design a performance-based growth model where U.S. businesses receive qualified leads and customer conversions on a pay-per-lead or pay-per-conversion basis — eliminating the need for clients to hire marketing staff, manage ad budgets, or take on financial risk, and giving small and mid-size businesses access to predictable, measurable customer acquisition at a fixed cost per result\n" },
  { text: "• Combine AI-driven insights with experienced human media buyers to deliver measurable growth for American businesses across multiple industries\n\n" },

  { text: "Month 7–9: Performance Model Pilot and Market Validation\n", style: "HEADING_2" },
  { text: "• Pilot the performance-based model with select U.S. small business clients — Adsora assumes all advertising risk and cost, delivering qualified leads and conversions to clients who pay only for results received, enabling predictable revenue growth without upfront marketing investment\n" },
  { text: "• Gather performance data comparing AI-assisted campaigns to traditional management, refining the platform based on real outcomes\n" },
  { text: "• Scale pay-per-call operations, generating thousands of qualified inbound calls per month that connect American consumers with local service providers — creating a measurable economic multiplier as each converted call results in jobs performed, materials purchased, and revenue circulated through local economies\n" },
  { text: "• Explore partnerships with complementary U.S.-based marketing and advertising technology companies\n" },
  { text: "• Continue scaling agency revenue to fund ongoing platform development through organic cash flow\n\n" },

  { text: "Month 10–12: Service Refinement and Go-to-Market Planning\n", style: "HEADING_2" },
  { text: "• Refine the performance-based offering based on pilot results, optimizing the balance between AI automation and human expertise\n" },
  { text: "• Conduct market research on demand for performance-based customer acquisition among U.S. small and mid-size businesses — a segment representing over 30 million companies, the majority of which cannot afford traditional advertising agencies or in-house marketing teams\n" },
  { text: "• Develop go-to-market strategy and per-lead pricing tiers by vertical, designed so that businesses of any size can acquire customers with zero upfront cost and fully predictable unit economics\n" },
  { text: "• Expand the U.S. team with additional hires in operations, customer success, and engineering\n" },
  { text: "• Review Year 2 financials, assess product-market fit, and set Year 3 growth targets\n\n" },

  // YEAR 3
  { text: "Year 3: Scaling the Platform and Building Toward Semi-Automation (2028)\n", style: "HEADING_1" },
  { text: "Working location — 6926 Tranquil Point Court, Las Vegas, Nevada 89179\n\n", italic: true },

  { text: "Month 1–3: Performance-Based Service Launch and Customer Acquisition\n", style: "HEADING_2" },
  { text: "• Launch the performance-based customer acquisition service to external U.S. clients — businesses receive qualified leads and conversions at a fixed per-result cost with no retainers, no ad spend commitments, and no need to hire marketing personnel, enabling even the smallest American companies to grow predictably\n" },
  { text: "• Onboard initial customers sourced from existing agency relationships and affiliate network partnerships, prioritizing U.S. small businesses in underserved verticals\n" },
  { text: "• Recruit product, engineering, and customer success talent in the United States to support service delivery and platform growth, with the goal of building a team of 15–25 full-time U.S. employees by end of Year 3\n" },
  { text: "• Reinvest agency profits to fund platform development and team expansion, maintaining a fully bootstrapped, self-funded operation that contributes tax revenue without relying on external capital\n\n" },

  { text: "Month 4–6: Organic Growth and Platform Expansion\n", style: "HEADING_2" },
  { text: "• Expand platform capabilities including automated landing page generation, intelligent creative testing, and multi-channel campaign orchestration\n" },
  { text: "• Scale customer acquisition through industry thought leadership, conference participation, and strategic referral partnerships\n" },
  { text: "• Grow the performance-based client base using revenue generated from agency operations, ensuring sustainable expansion without external capital\n" },
  { text: "• Develop case studies documenting the measurable business growth delivered to U.S. clients — number of leads delivered, customer acquisition cost, revenue generated per lead, and downstream jobs created as businesses scale to meet new demand driven by Adsora's lead generation\n\n" },

  { text: "Month 7–9: Semi-Automation Research and Development\n", style: "HEADING_2" },
  { text: "• Invest in research and development of semi-automated advertising capabilities — building toward a future where routine campaign optimizations execute automatically while strategic decisions remain with human operators\n" },
  { text: "• Expand the U.S.-based engineering team to develop advanced features including predictive budget allocation, automated creative performance scoring, and intelligent audience discovery — keeping AI advertising innovation domestic and contributing to America's leadership in applied artificial intelligence\n" },
  { text: "• Establish a presence at major advertising and marketing technology conferences including Affiliate Summit and related industry events\n\n" },

  { text: "Month 10–12: Continuous Improvement and Long-Term Vision\n", style: "HEADING_2" },
  { text: "• Implement continuous improvement processes driven by customer feedback and platform performance data\n" },
  { text: "• Conduct a comprehensive strategic review of the company's trajectory from agency to technology-enabled performance marketing platform\n" },
  { text: "• Set the long-term product roadmap for progressively expanding the platform's semi-automated capabilities, always maintaining human oversight as a core principle\n" },
  { text: "• Continue reinvesting profits to scale operations, with the goal of building a self-sustaining advertising technology company entirely through organic growth — creating U.S. jobs, empowering American small businesses to grow through risk-free performance-based customer acquisition, and contributing to the domestic digital economy\n" },
];

async function main() {
  if (!isAuthenticated()) {
    console.error("Not authenticated with Google. Start the server and visit /auth/google first.");
    process.exit(1);
  }

  const docs = google.docs({ version: "v1", auth: getAuthClient() });

  // Step 1: Get current document to find content length
  console.log("Reading current document...");
  const doc = await docs.documents.get({ documentId: DOC_ID });
  const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex;

  const requests = [];

  // Step 2: Delete all existing content (leave index 1, the minimum)
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: { startIndex: 1, endIndex: endIndex - 1 },
      },
    });
  }

  // Step 3: Insert all new text (in reverse order since we insert at index 1)
  let insertIndex = 1;
  const formatRequests = [];

  // First, build the full text and insert it
  const fullText = sections.map(s => s.text).join("");
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  // Step 4: Apply formatting
  let currentIndex = 1;
  for (const section of sections) {
    const startIdx = currentIndex;
    const endIdx = currentIndex + section.text.length;

    if (section.style) {
      const styleMap = {
        "HEADING_1": "HEADING_1",
        "HEADING_2": "HEADING_2",
        "SUBTITLE": "SUBTITLE",
      };
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: startIdx, endIndex: startIdx + section.text.indexOf("\n") + 1 },
          paragraphStyle: { namedStyleType: styleMap[section.style] || "NORMAL_TEXT" },
          fields: "namedStyleType",
        },
      });
    }

    if (section.center) {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: startIdx, endIndex: startIdx + section.text.indexOf("\n") + 1 },
          paragraphStyle: { alignment: "CENTER" },
          fields: "alignment",
        },
      });
    }

    if (section.italic) {
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: startIdx, endIndex: endIdx },
          textStyle: { italic: true },
          fields: "italic",
        },
      });
    }

    currentIndex = endIdx;
  }

  requests.push(...formatRequests);

  // Execute
  console.log("Updating document...");
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: { requests },
  });

  console.log("Document updated successfully!");
  console.log(`View it: https://docs.google.com/document/d/${DOC_ID}/edit`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
