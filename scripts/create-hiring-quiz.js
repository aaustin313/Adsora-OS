require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");

async function getAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback"
  );
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    client.setCredentials(tokens);
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    }
    return client;
  }
  console.error("No token found. Run the server and authenticate first.");
  process.exit(1);
}

const QUIZ_TITLE = "Adsora — Marketing Tech Assistant Application";
const QUIZ_DESCRIPTION = `We're a pay-per-lead marketing agency managing ~$500k/month in Meta ad spend across lead gen verticals. We need a sharp, reliable marketing tech assistant to keep the machine running smoothly.

This application screens for cultural fit, hunger, and capability. Be honest — there are no trick questions, but generic answers won't cut it.`;

// Helper functions
function textQ(title, required = true, paragraph = false) {
  return {
    createItem: {
      item: {
        title,
        questionItem: {
          question: { required, textQuestion: { paragraph } },
        },
      },
      location: { index: 0 },
    },
  };
}

function choiceQ(title, options, required = true) {
  return {
    createItem: {
      item: {
        title,
        questionItem: {
          question: {
            required,
            choiceQuestion: {
              type: "RADIO",
              options: options.map((o) => ({ value: o })),
            },
          },
        },
      },
      location: { index: 0 },
    },
  };
}

function checkboxQ(title, options, required = true) {
  return {
    createItem: {
      item: {
        title,
        questionItem: {
          question: {
            required,
            choiceQuestion: {
              type: "CHECKBOX",
              options: options.map((o) => ({ value: o })),
            },
          },
        },
      },
      location: { index: 0 },
    },
  };
}

function sectionHeader(title, description = "") {
  return {
    createItem: {
      item: { title, description, textItem: {} },
      location: { index: 0 },
    },
  };
}

// ─── EXACT QUESTIONS FROM AUSTIN ───
const questions = [
  // === Section 1: Basic Info ===
  sectionHeader("Basic Info"),
  textQ("Your Full Name"),
  textQ("Your Email Address"),
  textQ("Your Phone Number"),
  choiceQ("What time zone are you in?", [
    "EST (Eastern)",
    "CST (Central)",
    "MST (Mountain)",
    "PST (Pacific)",
    "Other",
  ]),

  // Q5
  choiceQ("Are you available during EST business hours (9am–6pm ET) on weekdays?", [
    "Yes, fully available",
    "Mostly — occasional conflicts",
    "No",
  ]),

  // Q6
  choiceQ("Are you comfortable hopping in on weekends when something urgent comes up?", [
    "Yes, no problem",
    "Occasionally, with advance notice",
    "No, weekends are off-limits",
  ]),

  // === Section 2: Experience & Tools ===
  sectionHeader("Experience & Tools"),

  // Q7
  checkboxQ("Which of these platforms have you actively worked in? (Select all that apply)", [
    "Facebook Ads Manager",
    "GoHighLevel",
    "ClickFunnels / Unbounce / other LP builders",
    "ClickFlare / Voluum / other trackers",
    "Beehiiv / Mailchimp / other email platforms",
    "QuickBooks / invoicing tools",
    "None of the above",
  ]),

  // Q8
  choiceQ("How would you rate your Facebook Ads Manager experience?", [
    "Expert — I manage campaigns daily and know the platform inside out",
    "Intermediate — I've launched and managed campaigns but not daily",
    "Beginner — I've been inside it but haven't managed campaigns independently",
    "No experience",
  ]),

  // Q9
  textQ("Have you ever built or edited a landing page? If yes, what tool(s)?", true, true),

  // Q10
  choiceQ("How comfortable are you with tracking setup — pixels, UTMs, postbacks, ClickFlare or similar?", [
    "Very comfortable — I set these up regularly",
    "Somewhat comfortable — I've done it but need to reference docs",
    "Not comfortable — but I'm a fast learner",
    "No idea what these are",
  ]),

  // Q11
  choiceQ("Do you have copywriting experience (ad copy, landing pages, email)?", [
    "Yes — I write copy regularly",
    "Some — I've written copy but it's not my main skill",
    "No",
  ]),

  // Q12
  choiceQ("How proficient are you with AI tools (ChatGPT, Claude, Cursor, Claude Code, etc.)?", [
    "I use AI daily in my work — it's core to how I operate",
    "I use AI regularly but not for everything",
    "I've tried them a few times",
    "I don't use AI tools",
  ]),

  // Q13
  choiceQ("Can you write or edit code (HTML, CSS, JavaScript, Python — any)?", [
    "Yes — I code regularly and am comfortable building things",
    "Somewhat — I can edit code and follow along, especially with AI assistance",
    "No — I'm not technical at all",
  ]),

  // === Section 3: Work Style & Cultural Fit ===
  sectionHeader("Work Style & Cultural Fit"),

  // Q14
  choiceQ("You're given a task on a platform you've never used before. What do you do?", [
    "Google it, watch a tutorial, figure it out, and get it done",
    "Ask for detailed instructions before starting",
    "Wait until someone can walk me through it",
  ]),

  // Q15
  choiceQ("A client's invoice is 5 days overdue. What do you do?", [
    "Follow up immediately and keep following up daily until it's resolved",
    "Send one reminder and wait",
    "Flag it to my manager and wait for instructions",
  ]),

  // Q16
  choiceQ("You notice an ad account's spend spiked 3x overnight but no one mentioned it. What do you do?", [
    "Investigate immediately, pause if something looks wrong, and alert the team",
    "Send a Slack message asking if anyone knows about it",
    "Assume someone else is handling it",
  ]),

  // Q17
  choiceQ("You disagree with how your manager wants to structure a campaign. What do you do?", [
    "Speak up directly with my reasoning, but execute their decision if they still want to go that direction",
    "Keep it to myself and do what they say",
    "Push back until they change their mind",
  ]),

  // Q18
  choiceQ("You launched a landing page and a client reports the form isn't working. It's 7pm on a Friday. What do you do?", [
    "Jump in and fix it now — it's live and broken",
    "Log it and fix it Monday morning",
    "Tell the client we'll look into it next week",
  ]),

  // Q19
  choiceQ("Which statement best describes you?", [
    "I ship fast and improve later — done is better than perfect",
    "I take my time to make sure everything is perfect before delivering",
    "I deliver when I feel like it's ready",
  ]),

  // Q20
  choiceQ("You made a mistake that cost the company money. What do you do?", [
    "Own it immediately, explain what happened, fix it, and put a process in place so it doesn't happen again",
    "Fix it quietly and hope no one notices",
    "Explain why it wasn't really my fault",
  ]),

  // === Section 4: Standards & Environment ===
  sectionHeader("Standards & Environment"),

  // Q21
  choiceQ("You see a coworker doing something that's clearly wrong but it's \"not your department.\" What do you do?", [
    "Say something — the company's results are everyone's business",
    "Mind my own business",
    "Mention it casually if it comes up",
  ]),

  // Q22
  choiceQ("Would you rather be the best performer on a mediocre team or an average performer on an elite team?", [
    "Average on an elite team — iron sharpens iron",
    "Best on a mediocre team — I like standing out",
  ]),

  // Q23
  choiceQ("How often do you complain about work to friends or family?", [
    "Rarely — I'd rather fix the problem or leave",
    "Sometimes — everyone vents",
    "Often — work is stressful",
  ]),

  // === Section 5: Hunger & Drive ===
  sectionHeader("Hunger & Drive"),

  // Q24
  textQ("What are you currently learning right now — on your own time, unpaid?", true, true),

  // Q25
  textQ("Why do you actually want THIS job and not just ANY job?", true, true),

  // Q26
  textQ("Have you ever built something on your own — a side project, a business, a campaign, a website, anything — without being asked or paid to do it?", true, true),

  // Q27
  choiceQ("If this role required you to work 50-60 hour weeks for the first 90 days to get fully ramped, would you do it?", [
    "Absolutely — that's what it takes to earn my spot",
    "Probably, depending on the weeks",
    "No — that's not sustainable",
  ]),

  // Q28
  choiceQ("Rate your urgency level at work on a scale of 1-10, where 10 means you treat every task like it's due in an hour.", [
    "8-10",
    "5-7",
    "1-4",
  ]),

  // === Section 6: Compensation & Logistics ===
  sectionHeader("Compensation & Logistics"),

  // Q29
  choiceQ("Would you rather work more and make more money, or prefer a work-life balance?", [
    "Work more, make more",
    "Balance is important to me",
  ]),

  // Q30
  choiceQ("Do you prefer a lower base with higher performance bonuses, or a higher base with a smaller bonus?", [
    "Lower base + higher bonus — I bet on myself",
    "Higher base + smaller bonus — I prefer stability",
  ]),

  // Q31
  textQ("What is your desired monthly compensation including bonuses (USD)?"),

  // Q32
  choiceQ("Would you be open to performing a test task before being hired?", [
    "Yes",
    "No",
  ]),
];

// ─── DQ RULES (column header → DQ answer) ───
// These map to the Google Sheet columns for auto-flagging
const DQ_RULES = {
  "Are you available during EST business hours (9am–6pm ET) on weekdays?": ["No"],
  "Are you comfortable hopping in on weekends when something urgent comes up?": ["No, weekends are off-limits"],
  "Which of these platforms have you actively worked in? (Select all that apply)": ["None of the above"],
  "How would you rate your Facebook Ads Manager experience?": ["No experience"],
  "How comfortable are you with tracking setup — pixels, UTMs, postbacks, ClickFlare or similar?": ["No idea what these are"],
  "How proficient are you with AI tools (ChatGPT, Claude, Cursor, Claude Code, etc.)?": ["I don't use AI tools"],
  "Can you write or edit code (HTML, CSS, JavaScript, Python — any)?": ["No — I'm not technical at all"],
  "You're given a task on a platform you've never used before. What do you do?": ["Wait until someone can walk me through it"],
  "A client's invoice is 5 days overdue. What do you do?": ["Flag it to my manager and wait for instructions"],
  "You notice an ad account's spend spiked 3x overnight but no one mentioned it. What do you do?": ["Assume someone else is handling it"],
  "You launched a landing page and a client reports the form isn't working. It's 7pm on a Friday. What do you do?": ["Tell the client we'll look into it next week"],
  "You made a mistake that cost the company money. What do you do?": ["Explain why it wasn't really my fault"],
  "How often do you complain about work to friends or family?": ["Often — work is stressful"],
  "If this role required you to work 50-60 hour weeks for the first 90 days to get fully ramped, would you do it?": ["No — that's not sustainable"],
  "Rate your urgency level at work on a scale of 1-10, where 10 means you treat every task like it's due in an hour.": ["1-4"],
  "Would you be open to performing a test task before being hired?": ["No"],
};

async function createForm(auth) {
  const forms = google.forms({ version: "v1", auth });

  // Step 1: Create the form
  console.log("Creating form...");
  const createRes = await forms.forms.create({
    requestBody: {
      info: { title: QUIZ_TITLE, documentTitle: QUIZ_TITLE },
    },
  });

  const formId = createRes.data.formId;
  console.log(`Form created: ${formId}`);

  // Step 2: Add description + all questions
  const requests = [
    {
      updateFormInfo: {
        info: { description: QUIZ_DESCRIPTION },
        updateMask: "description",
      },
    },
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = JSON.parse(JSON.stringify(questions[i]));
    q.createItem.location.index = i;
    requests.push(q);
  }

  console.log(`Adding ${questions.length} items...`);
  await forms.forms.batchUpdate({
    formId,
    requestBody: { requests },
  });

  console.log("\n✅ Form created successfully!");
  console.log(`\n📝 Edit:      https://docs.google.com/forms/d/${formId}/edit`);
  console.log(`📋 Share:     https://docs.google.com/forms/d/${formId}/viewform`);
  console.log(`📊 Responses: https://docs.google.com/forms/d/${formId}/responses`);

  return formId;
}

async function createDQSheet(auth, formId) {
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  console.log("\n📊 Creating DQ scoring spreadsheet...");

  // Create the spreadsheet
  const sheetRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Adsora — Hiring Quiz DQ Tracker" },
      sheets: [
        {
          properties: { title: "DQ Rules", index: 0 },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Question" } },
                    { userEnteredValue: { stringValue: "DQ Answer(s)" } },
                  ],
                },
                ...Object.entries(DQ_RULES).map(([q, answers]) => ({
                  values: [
                    { userEnteredValue: { stringValue: q } },
                    { userEnteredValue: { stringValue: answers.join(" | ") } },
                  ],
                })),
              ],
            },
          ],
        },
        {
          properties: { title: "Instructions", index: 1 },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue: "HOW TO USE THIS WITH YOUR GOOGLE FORM",
                      },
                    },
                  ],
                },
                { values: [{ userEnteredValue: { stringValue: "" } }] },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue:
                          "1. Open the Google Form → Responses tab → Click the green Sheets icon → 'Create a new spreadsheet'",
                      },
                    },
                  ],
                },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue:
                          "2. In that new response sheet, add a column at the end called 'DQ STATUS'",
                      },
                    },
                  ],
                },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue:
                          "3. Paste this formula in the DQ STATUS column for row 2 (adjust column letters to match your sheet):",
                      },
                    },
                  ],
                },
                { values: [{ userEnteredValue: { stringValue: "" } }] },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue: "FORMULA (paste in the DQ STATUS cell for row 2, then drag down):",
                      },
                    },
                  ],
                },
                { values: [{ userEnteredValue: { stringValue: "" } }] },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue: `=IF(OR(F2="No",G2="No, weekends are off-limits",H2="None of the above",I2="No experience",K2="No idea what these are",M2="I don't use AI tools",N2="No — I'm not technical at all",O2="Wait until someone can walk me through it",P2="Flag it to my manager and wait for instructions",Q2="Assume someone else is handling it",S2="Tell the client we'll look into it next week",U2="Explain why it wasn't really my fault",X2="Often — work is stressful",AB2="No — that's not sustainable",AC2="1-4",AG2="No"),"❌ DISQUALIFIED","✅ PASSED")`,
                      },
                    },
                  ],
                },
                { values: [{ userEnteredValue: { stringValue: "" } }] },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue:
                          "⚠️  IMPORTANT: The column letters (F2, G2, etc.) above are ESTIMATES. After linking the form to a sheet,",
                      },
                    },
                  ],
                },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue:
                          "verify each column letter matches the correct question. The DQ Rules tab has the full list of DQ answers.",
                      },
                    },
                  ],
                },
                { values: [{ userEnteredValue: { stringValue: "" } }] },
                {
                  values: [
                    {
                      userEnteredValue: {
                        stringValue: `Form link: https://docs.google.com/forms/d/${formId}/edit`,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  const sheetId = sheetRes.data.spreadsheetId;
  console.log(`✅ DQ Tracker: https://docs.google.com/spreadsheets/d/${sheetId}`);
  return sheetId;
}

async function main() {
  try {
    const auth = await getAuthClient();
    const formId = await createForm(auth);
    await createDQSheet(auth, formId);
    console.log("\n🎯 DONE! Next steps:");
    console.log("   1. Open the form edit link and review the questions");
    console.log("   2. In the form's Responses tab, click the Sheets icon to link responses");
    console.log("   3. In that response sheet, add the DQ formula from the Instructions tab");
    console.log("   4. Share the form viewform link with candidates");
  } catch (err) {
    if (err.message?.includes("insufficient") || err.code === 403) {
      console.error("\n❌ Token missing permissions. Re-authenticate:");
      console.error("   1. Delete token.json");
      console.error("   2. Restart server & visit http://localhost:3000/auth/google");
      console.error("   3. Re-run this script");
    } else {
      console.error("Error:", err.message || err);
      if (err.errors) console.error("Details:", JSON.stringify(err.errors, null, 2));
    }
    process.exit(1);
  }
}

main();
