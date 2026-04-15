/*
  freeBusy.js

  This class is a wrapper for all the freeBusy logic in order to keep it out of the main users controller
  and hopefully organize it a bit better

  Simple call "freeBusy = new FreeBusy()" with the necessary arguments, and then "freebusy.process()"
  to return the result of all the scheduling magic.

  NOTE: REVERTED TO A MORE BASIC VERSION UNTIL ALL BUGS ARE GONE
*/

const { OAuth2Client } = require("google-auth-library");

const BadRequestError = require("../errors/BadRequestError");

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

// gets an OAuth2Client instance (this way we can have multiple)
const getOAuth2Client = () =>
  new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    "postmessage" // Specific value required for GIS popup flow
  );

class FreeBusy {
  constructor({
    ownerId,
    allUsers,
    usersToGetTokens,
    disconnectedUsers,
    startDate,
    endDate,
  }) {
    this._ownerId = ownerId.toString();
    this._allUsers = allUsers; // array of ALL users, before any searching and filtering
    this._usersToGetTokens = usersToGetTokens; // array of users to match with google
    this._disconnectedUsers = disconnectedUsers; // array of users requested who for some reason don't have a token or are revoked
    this._validUsers = []; // array of valid users who made it through all the calls to Google
    this._tokens = {}; // Access token cache
    this._startDate = startDate;
    this._endDate = endDate;
  }

  // Fetch all user access tokens
  async getUserTokens() {
    const result = { error: null, tokens: [] };
    const oAuth2Client = getOAuth2Client();

    /* eslint-disable no-await-in-loop */
    for (let u = 0; u < this._usersToGetTokens.length; u += 1) {
      const user = this._usersToGetTokens[u];
      const isOwner = user._id.toString() === this._ownerId;
      try {
        oAuth2Client.setCredentials({
          refresh_token: user.googleRefreshToken,
        });
        const { token } = await oAuth2Client.getAccessToken();

        if (!token) {
          // bad token, log as disconnected

          if (isOwner) {
            // CRITICAL FAILURE: The GM is not available
            result.error = new BadRequestError(
              "Your Google Calendar is disconnected. Cannot search for availability. Please reconnect your account and try again."
            );
            return result;
          }
          this._disconnectedUsers.push(user.username);
        } else {
          // token is good
          result.tokens.push({ ...user, token });
        }
      } catch (err) {
        // 'invalid_grant' is the specific error Google sends when the refresh token is revoked/expired
        if (isOwner) {
          // CRITICAL FAILURE: The GM is not available
          result.error = new BadRequestError(
            "Your Google Calendar is disconnected. Cannot search for availability. Please reconnect your account and try again."
          );
          return result;
        }
        if (err.message.includes("invalid_grant")) {
          // log as disconnected
          this._disconnectedUsers.push(user.username);
        } else {
          // some other error occurred, get out of here and process the error

          result.error = err;
          return result;
        }
      }
    }
    /* eslint-enable no-await-in-loop */

    if (!result.tokens.length) {
      result.error = new BadRequestError(
        "Could not verify any users with Google"
      );
    } else if (result.tokens.length < this._minUsers) {
      result.error = new BadRequestError(
        "Could not verify enough users with Google to satisfy the minimum user count"
      );
    }
    return result;
  }

  // get an individual user calendar list
  async getUserCalendarList(user) {
    const result = { error: null, user, calendarList: [] };
    try {
      // Get the user's list of calendars
      const googleResponseCalendarList = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const calendarList = await googleResponseCalendarList.json();

      if (typeof calendarList.items === "undefined") {
        // Can't get a full list of their calendars. It IS possible they didn't authorize this one feature. Don't panic :D
        // Simply add their main, public calendar to the list and move on.

        result.calendarList.push({ id: user.googleEmail });
      } else {
        // There's a list of calendars, now filter by
        // Primary OR Selected OR accessRole is Owner or Writer (Important for things like shared Work calendars)
        result.calendarList = calendarList.items
          .filter(
            (cal) =>
              cal.primary ||
              (cal.selected && cal.accessRole !== "reader" && !cal.hidden)
          )
          .map((cal) => ({ id: cal.id }));
      }
    } catch (err) {
      this._disconnectedUsers.push(user);
      result.error = err;
    }
    return result;
  }

  // Get all user calendar lists
  async getAllUserCalendarLists() {
    const result = { error: null, calendars: [] };
    try {
      result.calendars = await Promise.all(
        this._tokens.map((user) => this.getUserCalendarList(user))
      );
      if (result.calendars.length < 2) {
        result.error = new BadRequestError(
          "Could not get enough user calendars from Google to satisfy the minimum user count"
        );
      }
    } catch (err) {
      result.error = err;
    }
    return result;
  }

  // Get all busy intervals for users with tokens
  async getBusyIntervals(calendarList) {
    const result = { error: null, busyIntervals: {}, total: 0 };

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < calendarList.length; i += 1) {
      const { user } = calendarList[i];
      const thisUsersCalendarList = calendarList[i].calendarList;
      const userError = calendarList[i].error;
      if (!userError) {
        const googleResponse = await fetch(
          "https://www.googleapis.com/calendar/v3/freeBusy",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${user.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              timeMin: this._startDate,
              timeMax: this._endDate,
              items: thisUsersCalendarList,
            }),
          }
        );
        const data = await googleResponse.json();

        if (!data.calendars) {
          this._disconnectedUsers.push(user.username);
        } else {
          let thisUserCombined = [];

          const hasErrors = [];

          Object.values(data.calendars).forEach((cal) => {
            if (cal.errors) {
              // Google returned some error, log as disconnected
              hasErrors.push(cal.errors);
            } else if (cal.busy && cal.busy.length > 0) {
              // ALL SET, log as valid, and add all busy slots to the allBusyIntervals array (including the username of the busy person)
              const busyWithNames = cal.busy.map((slot) => ({
                ...slot,
                username: user.username,
              }));
              thisUserCombined = [...thisUserCombined, ...busyWithNames];
            }
          });

          if (hasErrors.length > 0) {
            this._disconnectedUsers.push(user.username);
          } else {
            this._validUsers.push(user.username);
          }

          result.busyIntervals[user.username] = thisUserCombined;
          result.total += thisUserCombined.length;
        }
      }
    }
    /* eslint-enable no-await-in-loop */

    if (this._validUsers.length < 2) {
      result.error = new BadRequestError(
        "Could not get enough user calendar data from Google to satisfy the minimum user count"
      );
    }
    return result;
  }

  /*
    buildBlocks: Build a grid of 30-minute intervals from start to finish for each user and mark as free/busy
    Output should look like this:
    [
      {
        start: [date],
        end:   [date+30],
        users:{
          username: "busy",
          username2: "free"
          ...
        }
      }
    ]
  */
  buildBlocks(allBusyIntervals) {
    const result = [];
    // console.log("Building blocks for ", allBusyIntervals);
    const theEnd = new Date(this._endDate);
    const windowStart = new Date(this._startDate);
    const windowEnd = new Date(this._startDate);
    windowEnd.setMinutes(windowEnd.getMinutes() + 30);
    while (windowEnd <= theEnd) {
      // console.log("Window: ", windowStart, " - ", windowEnd);

      const thisWindow = {
        start: new Date(windowStart),
        end: new Date(windowEnd),
        users: {},
      };

      Object.entries(allBusyIntervals).forEach(([username, intervals]) => {
        // console.log(`-Checking ${username}`);
        thisWindow.users[username] = "free";

        if (
          intervals.some(
            (interval) =>
              windowStart >= new Date(interval.start) &&
              windowEnd <= new Date(interval.end)
          )
        ) {
          // console.log(`---busy!`);
          thisWindow.users[username] = "busy";
        }
      });

      result.push(thisWindow);
      windowStart.setMinutes(windowStart.getMinutes() + 30);
      windowEnd.setMinutes(windowEnd.getMinutes() + 30);
    }

    // console.log(result);
    return result;
  }

  // process: Begin making the magic!
  async process() {
    const result = {};
    try {
      const tokenResult = await this.getUserTokens();
      if (tokenResult.error) {
        result.error = tokenResult.error;
        return result;
      }
      this._tokens = tokenResult.tokens;

      const calendarList = await this.getAllUserCalendarLists();

      if (calendarList.error) {
        result.error = calendarList.error;
        return result;
      }

      const allBusyIntervals = await this.getBusyIntervals(
        calendarList.calendars
      );

      if (allBusyIntervals.error) {
        result.error = allBusyIntervals.error;
        return result;
      }

      if (!allBusyIntervals.total) {
        /*
         Nobody is busy at all for the selected window. Don't bother doing anything.
        */
        // console.log("Nobody is busy ", allBusyIntervals);
        return {
          validUsers: this._validUsers,
          disconnectedUsers: this._disconnectedUsers,
          nobodyBusy: true,
        };
      }

      // Build a grid of 30-minute intervals from start to finish for each user and mark as free/busy
      const blocks = this.buildBlocks(allBusyIntervals.busyIntervals);

      return {
        blocks,
        validUsers: this._validUsers,
        disconnectedUsers: this._disconnectedUsers,
        nobodyBusy: false,
      };
    } catch (err) {
      result.error = err;
      return result;
    }
  }
}

module.exports = FreeBusy;
