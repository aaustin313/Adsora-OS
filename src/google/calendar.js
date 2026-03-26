const { google } = require("googleapis");
const { getAuthClient, isAuthenticated } = require("./auth");

function getCalendarClient() {
  if (!isAuthenticated()) {
    throw new Error("Google not connected. Visit /auth/google to connect.");
  }
  return google.calendar({ version: "v3", auth: getAuthClient() });
}

async function listEvents(maxResults = 10) {
  const calendar = getCalendarClient();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items || []).map(formatEvent);
}

async function getUpcomingEvents(hours = 24) {
  const calendar = getCalendarClient();
  const now = new Date();
  const later = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: later.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items || []).map(formatEvent);
}

async function createEvent({ summary, startTime, endTime, description, location }) {
  const calendar = getCalendarClient();
  const event = {
    summary,
    start: { dateTime: startTime, timeZone: "America/New_York" },
    end: { dateTime: endTime, timeZone: "America/New_York" },
  };
  if (description) event.description = description;
  if (location) event.location = location;

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });
  return formatEvent(res.data);
}

async function deleteEvent(eventId) {
  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
  return { deleted: true, eventId };
}

async function updateEvent(eventId, updates) {
  const calendar = getCalendarClient();
  const res = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: updates,
  });
  return formatEvent(res.data);
}

async function findEventByTitle(titleSubstring, maxResults = 20) {
  const calendar = getCalendarClient();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
    q: titleSubstring,
  });
  return (res.data.items || []).map(formatEvent);
}

function formatEvent(event) {
  return {
    id: event.id,
    summary: event.summary || "(no title)",
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    location: event.location || "",
    description: event.description || "",
  };
}

module.exports = { listEvents, getUpcomingEvents, createEvent, deleteEvent, updateEvent, findEventByTitle };
