# Description

- Fetches upcoming events via the GCal API
- Looks for any event that is about to start and that you have marked yourself as attending
- Opens any zoom meeting links it finds in the event
  It's intended to be run periodically (e.g. via cron) and stores a record of which meetings it has already opened so as to not double-open them.

# How to Use

1. Create a GCP Developer Account
2. Create a project
3. Create an Oauth desktop client for that project
4. Export the credentials to a file in this project's directory called `credentials.json`
5. Run `node index.js` in interactive mode to setup access tokens for the account whose calendar events you want to look at
6. Set up a cron job that runs `node /path/to/index.js`
