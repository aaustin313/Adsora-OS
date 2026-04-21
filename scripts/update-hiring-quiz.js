require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const FORM_ID = "13KxkcAJM4AcapGNUv1DF-HXBRiuDESQYSIA3ZwpQZXE";

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

// ─── ALL QUESTIONS FOR THE UPDATED FORM ───
const questions = [
  // === Section 1: Basic Info (kept from original) ===
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
  choiceQ("Are you available during EST business hours (9am–6pm ET) on weekdays?", [
    "Yes, fully available",
    "Mostly — occasional conflicts",
    "No",
  ]),
  choiceQ("Are you comfortable hopping in on weekends when something urgent comes up?", [
    "Yes, no problem",
    "Occasionally, with advance notice",
    "No, weekends are off-limits",
  ]),

  // === Section 2: Compensation & Logistics (kept from original) ===
  sectionHeader("Compensation & Logistics"),
  textQ("What is your desired monthly compensation including bonuses (USD)?"),
  choiceQ("Would you be open to performing a test task before being hired?", [
    "Yes",
    "No",
  ]),

  // === Section 6: Strengths (from book — Pre-interview Questions) ===
  sectionHeader("Strengths", "The following questions help us understand who you are as a professional. Be honest and specific — generic answers won't stand out."),
  textQ("List some adjectives or phrases that sum you up, that get to your essence.", true, true),
  textQ("When you look at your professional self in the mirror, what do you see?", true, true),
  textQ("What motivates you? What are you trying to accomplish at this point in your career?", true, true),
  textQ("What do you consider to be your biggest career accomplishment(s) so far?", true, true),
  textQ("What are your biggest professional strengths?", true, true),
  textQ("What's been the high point of your career so far?", true, true),
  textQ("What parts of your jobs have you liked the most?", true, true),
  textQ("What's your favorite professional activity?", true, true),
  textQ("Name five reasons for your professional success.", true, true),
  textQ("What do your subordinates think are your strengths?", true, true),
  textQ("Who was your favorite boss and why?", true, true),
  textQ("What positive things might your bosses and colleagues say about you?", true, true),
  textQ("What's the most significant praise you've received in a performance appraisal in the last five years?", true, true),

  // === Section 7: Areas for Improvement (from book) ===
  sectionHeader("Areas for Improvement"),
  textQ("What are some of your biggest professional weaknesses or areas for improvement?", true, true),
  textQ("What's been the low point of your career so far?", true, true),
  textQ("What have been some of the biggest mistakes you've made, and what did you learn from them?", true, true),
  textQ("What's the most significant criticism you've received in a performance appraisal in the last five years?", true, true),
  textQ("Who was your least favorite boss and why?", true, true),
  textQ("What negative things might your bosses and colleagues say about you?", true, true),
  textQ("What do your subordinates think are your weaknesses?", true, true),
  textQ("What have been the biggest frustrations or failures in your career?", true, true),
  textQ("If you could change one thing about yourself, what would it be?", true, true),

  // === Section 8: Miscellaneous (from book) ===
  sectionHeader("Miscellaneous"),
  textQ("Describe your character.", true, true),
  textQ("What quality do you admire most in people?", true, true),
  textQ("What parts of your jobs have you enjoyed the least?", true, true),
  textQ("What was the toughest decision you've ever had to make in business? How did you handle it? What did you learn from it?", true, true),
  textQ("What was your favorite job and why?", true, true),
  textQ("What was your least favorite job and why?", true, true),
  textQ("What defect should a professional never allow themself to have?", true, true),
  textQ("How do you manage your personal/professional balance?", true, true),
  textQ("Who in the business world do you admire and why?", true, true),
  textQ("Explain the reason for your separation from each one of your jobs.", true, true),
  textQ("In an ideal world, describe your perfect job.", true, true),
  textQ("Name three of your biases.", true, true),
  textQ("What are your working habits (a typical day and week)? How many hours do you usually work? How much do you travel for work?", true, true),
  textQ("What do you think it takes to be successful in the job you're applying for?", true, true),

  // === Section 9: Fit & Interest (from book) ===
  sectionHeader("Fit & Interest"),
  choiceQ("On a scale of 1-10, how well do you think your skill set matches what's required to succeed in this job?", [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  ]),
  textQ("What would it take to make your skill set match a 10?", true, true),
  choiceQ("On a scale of 1-10, subject to acceptable compensation, how much do you want this job?", [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  ]),
  textQ("What would it take to make your desire for this job a 10?", true, true),
  textQ("What are the top three reasons why you're interested in this position?", true, true),
  choiceQ("Would you accept this job if it were offered to you?", [
    "Yes",
    "No",
    "It depends — I'd need to know more",
  ]),
  textQ("What more do you need to know in order to decide if this role is right for you?", true, true),
  textQ("What questions or comments do you have for us?", true, true),
  textQ("Why should we hire you?", true, true),
];

async function updateForm(auth) {
  const forms = google.forms({ version: "v1", auth });

  // Step 1: Get the current form to find all item IDs
  console.log("Reading existing form...");
  const existing = await forms.forms.get({ formId: FORM_ID });
  const items = existing.data.items || [];
  console.log(`Found ${items.length} existing items to remove.`);

  // Step 2: Delete all existing items (in reverse order to avoid index shifting)
  if (items.length > 0) {
    const deleteRequests = items.map((item, i) => ({
      deleteItem: { location: { index: 0 } },
    }));

    console.log("Deleting existing items...");
    await forms.forms.batchUpdate({
      formId: FORM_ID,
      requestBody: { requests: deleteRequests },
    });
    console.log("Existing items deleted.");
  }

  // Step 3: Update form title and description
  const updateInfoRequests = [
    {
      updateFormInfo: {
        info: {
          title: "Adsora — Media Buyer Pre-Interview Application",
          description: `We're a performance marketing agency managing significant Meta ad spend across lead gen verticals. We need sharp, reliable media buyers to join the team.

This application screens for cultural fit, self-awareness, hunger, and capability. Be honest and specific — generic answers won't cut it.`,
        },
        updateMask: "title,description",
      },
    },
  ];

  console.log("Updating form info...");
  await forms.forms.batchUpdate({
    formId: FORM_ID,
    requestBody: { requests: updateInfoRequests },
  });

  // Step 4: Add all new questions
  const createRequests = [];
  for (let i = 0; i < questions.length; i++) {
    const q = JSON.parse(JSON.stringify(questions[i]));
    q.createItem.location.index = i;
    createRequests.push(q);
  }

  // Google Forms API has a limit on batch size, so chunk with delays
  const CHUNK_SIZE = 20;
  for (let i = 0; i < createRequests.length; i += CHUNK_SIZE) {
    const chunk = createRequests.slice(i, i + CHUNK_SIZE);
    console.log(`Adding items ${i + 1} to ${Math.min(i + CHUNK_SIZE, createRequests.length)} of ${createRequests.length}...`);
    let retries = 3;
    while (retries > 0) {
      try {
        await forms.forms.batchUpdate({
          formId: FORM_ID,
          requestBody: { requests: chunk },
        });
        break;
      } catch (err) {
        if (err.code === 429 && retries > 1) {
          console.log("Rate limited, waiting 30s...");
          await new Promise(r => setTimeout(r, 30000));
          retries--;
        } else {
          throw err;
        }
      }
    }
    // Small delay between chunks to avoid rate limits
    if (i + CHUNK_SIZE < createRequests.length) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n✅ Form updated successfully with ${questions.length} items!`);
  console.log(`\n📝 Edit:      https://docs.google.com/forms/d/${FORM_ID}/edit`);
  console.log(`📋 Share:     https://docs.google.com/forms/d/${FORM_ID}/viewform`);
  console.log(`\nRemoved: Experience & Tools section (7 questions) + 2 media-specific scenarios`);
  console.log(`Kept: Basic Info, Work Style, Standards, Hunger & Drive, Compensation`);
  console.log(`Added: 45 pre-interview questions (Strengths, Areas for Improvement, Miscellaneous, Fit & Interest)`);
}

async function main() {
  try {
    const auth = await getAuthClient();
    await updateForm(auth);
  } catch (err) {
    if (err.message?.includes("insufficient") || err.code === 403) {
      console.error("\n❌ Token missing permissions. Re-authenticate:");
      console.error("   1. Delete token.json");
      console.error("   2. Restart server & visit http://localhost:3000/auth/google");
      console.error("   3. Re-run this script");
    } else {
      console.error("Error:", err.message || err);
      if (err.errors) console.error("Details:", JSON.stringify(err.errors, null, 2));
      if (err.response?.data) console.error("Response:", JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
