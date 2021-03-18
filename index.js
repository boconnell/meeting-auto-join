const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const open = require("open");
var addMinutes = require("date-fns/addMinutes");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

const LAUNCHED_EVENTS_PATH = "launched_events.json";

console.log(`${new Date()}: running meeting auto-join`);
// Load client secrets from a local file.
fs.readFile("credentials.json", (err, content) => {
  if (err) return console.log("Error loading client secret file:", err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), launchZoom);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Opens any meetings for events about to happen
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function launchZoom(auth) {
  const calendar = google.calendar({ version: "v3", auth });
  calendar.events.list(
    {
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      singleEvents: true,
      maxResults: 10,
      maxAttendees: 1,
      orderBy: "startTime",
    },
    async (err, res) => {
      if (err) return console.error("The API returned an error: " + err);
      const events = res.data.items;
      fs.readFile(LAUNCHED_EVENTS_PATH, async (err, launchedEventsRaw) => {
        let launchedEvents = [];
        if (err) {
          console.error(err);
        } else {
          launchedEvents = JSON.parse(launchedEventsRaw);
        }
        for (let event of events) {
          const start = new Date(event.start.dateTime || event.start.date);
          const attending = Boolean(
            event.attendees?.find(
              (attendee) =>
                attendee.self && attendee.responseStatus === "accepted"
            )
          );
          const aboutToStart = addMinutes(new Date(), 1000) >= start;
          const notLaunched = !launchedEvents.includes(event.id);
          const link = getLink(event);
          console.log(
            [
              start,
              event.summary,
              attending,
              Boolean(link),
              aboutToStart,
              notLaunched,
            ].join(",")
          );
          if (attending && aboutToStart && notLaunched && link) {
            const newLaunchedEvents = launchedEvents.concat([event.id]);
            fs.writeFile(
              LAUNCHED_EVENTS_PATH,
              JSON.stringify(newLaunchedEvents),
              (err) => {
                if (err) return console.error(err);
                console.log(`added ${event.id}`);
              }
            );
            await open(link);
            break;
          }
        }
      });
    }
  );
}

function getLink(event) {
  const re = /https:\/\/asana\.zoom\.us\/[^\s]*/;
  const entryPoint = event.conferenceData?.entryPoints?.find(
    (entryPoint) =>
      entryPoint.entryPointType === "video" && re.test(entryPoint.uri)
  );
  if (entryPoint) {
    return entryPoint.uri;
  }
  const matches = event.description?.match(re);
  if (matches?.length) {
    return matches[0];
  }
  return undefined;
}
