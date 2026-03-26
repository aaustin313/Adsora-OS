// One-time script: move A/B test event to Tuesday March 10 at 2:00 PM
require("dotenv").config();
const { findEventByTitle, updateEvent } = require("../src/google/calendar");

async function main() {
  console.log("🔍 Searching for A/B test event...");
  const events = await findEventByTitle("A/B test");

  if (events.length === 0) {
    console.log("❌ No event found matching 'A/B test'");
    return;
  }

  console.log(`Found ${events.length} event(s):`);
  events.forEach((e) => console.log(`  - [${e.id}] ${e.summary} @ ${e.start}`));

  // Pick the first match
  const event = events[0];
  console.log(`\n📅 Moving: "${event.summary}"`);
  console.log(`   From: ${event.start}`);

  // Calculate duration from original event
  const origStart = new Date(event.start);
  const origEnd = new Date(event.end);
  const durationMs = origEnd - origStart;

  // New time: Tuesday March 10, 2026 at 2:00 PM (Las Vegas = PT = UTC-8 in March)
  const newStart = new Date("2026-03-10T14:00:00-08:00");
  const newEnd = new Date(newStart.getTime() + durationMs);

  console.log(`   To:   ${newStart.toISOString()}`);

  const updated = await updateEvent(event.id, {
    start: { dateTime: newStart.toISOString(), timeZone: "America/Los_Angeles" },
    end: { dateTime: newEnd.toISOString(), timeZone: "America/Los_Angeles" },
  });

  console.log(`\n✅ Done! Event moved to: ${updated.start}`);
}

main().catch(console.error);
