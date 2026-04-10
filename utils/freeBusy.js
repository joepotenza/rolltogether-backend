/*
  freeBusy.js

  This class is a wrapper for all the freeBusy logic in order to keep it out of the main users controller
  and hopefully organize it a bit better

  Simple call "freeBusy = new FreeBusy()" with the necessary arguments, and then "freebusy.process()"
  to return the result of all the scheduling magic.
*/

const { OAuth2Client } = require("google-auth-library");
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
const BadRequestError = require("../errors/BadRequestError");

class FreeBusy {
  constructor({
    ownerId,
    allUsers,
    usersToGetTokens,
    disconnectedUsers,
    startDate,
    endDate,
    minUsers,
    minDuration,
    prefStartHour,
    prefEndHour,
  }) {
    this._ownerId = ownerId.toString();
    this._allUsers = allUsers; // array of ALL users, before any searching and filtering
    this._usersToGetTokens = usersToGetTokens; // array of users to match with google
    this._disconnectedUsers = disconnectedUsers; // array of users requested who for some reason don't have a token or are revoked
    this._validUsers = []; // array of valid users who made it through all the calls to Google
    this._tokens = {}; // Access token cache
    this._startDate = startDate;
    this._endDate = endDate;
    this._minUsers = minUsers;
    this._minDuration = minDuration;
    this._prefStartHour = prefStartHour;
    this._prefEndHour = prefEndHour;
  }

  // gets an OAuth2Client instance (this way we can have multiple)
  getOAuth2Client() {
    return new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      "postmessage" // Specific value required for GIS popup flow
    );
  }

  // analyzeGroupAvailability: Returns "slices" of time with how many users are available
  analyzeGroupAvailability(
    windowStart,
    windowEnd,
    allBusyIntervals,
    totalUsers
  ) {
    const points = [];
    const start = new Date(windowStart).getTime();
    const end = new Date(windowEnd).getTime();

    // 1. Collect Points
    allBusyIntervals.forEach((busy) => {
      const s = new Date(busy.start).getTime();
      const e = new Date(busy.end).getTime();
      if (s < end && e > start) {
        points.push({ time: Math.max(s, start), type: 1, user: busy.username });
        points.push({ time: Math.min(e, end), type: -1, user: busy.username });
      }
    });
    points.push({ time: start, type: 0 }, { time: end, type: 0 });

    // 2. Sort: Time ASC, then Type DESC (Starts [1] first)
    points.sort((a, b) =>
      a.time !== b.time ? a.time - b.time : b.type - a.type
    );

    // 3. Group by timestamp to handle simultaneous changes (like the 4/13 04:00:00 tie)
    const timeMap = new Map();
    points.forEach((p) => {
      if (!timeMap.has(p.time)) timeMap.set(p.time, []);
      timeMap.get(p.time).push(p);
    });

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const slices = [];
    const busyUsers = new Map();
    const allUsernames = this._allUsers;
    const allValidUsernames = this._validUsers;

    // Identify the Owner's username for the Master Filter
    const ownerToken = this._tokens.find(
      (t) => t._id.toString() === this._ownerId
    );
    const ownerUsername = ownerToken ? ownerToken.username : null;

    for (let i = 0; i < sortedTimes.length - 1; i++) {
      const currentTime = sortedTimes[i];

      const nextTime = sortedTimes[i + 1];

      // Update the busy-user counts for every change happening at this exact millisecond
      timeMap.get(currentTime).forEach((p) => {
        if (p.type === 1 && p.user) {
          busyUsers.set(p.user, (busyUsers.get(p.user) || 0) + 1);
        }
        if (p.type === -1 && p.user) {
          const count = (busyUsers.get(p.user) || 1) - 1;
          if (count > 0) {
            busyUsers.set(p.user, count);
          } else {
            busyUsers.delete(p.user);
          }
        }
      });

      // If the GM is in the busy set, we don't even calculate the slice.
      // We just move to the next timestamp.
      if (ownerUsername && busyUsers.has(ownerUsername)) {
        continue;
      }

      if (nextTime > currentTime) {
        const availableUserList = allValidUsernames.filter(
          (name) => !busyUsers.has(name)
        );
        const unavailableUserList = allUsernames.filter(
          (name) => busyUsers.has(name) || !allValidUsernames.includes(name)
        );

        slices.push({
          start: new Date(currentTime).toISOString(),
          end: new Date(nextTime).toISOString(),
          availablePlayers: availableUserList.length,
          availablePlayerList: [...availableUserList],
          unavailablePlayerList: [...unavailableUserList],
          totalUsers: totalUsers,
          duration: (nextTime - currentTime) / 60000,
        });
      }
    }

    return slices;
  }

  // refineSlices: Filters slices based on a specific daily time window (e.g., 7pm-11pm)
  refineSlices(slices, dailyStartHour, dailyEndHour) {
    const refined = [];
    const crossesMidnight = dailyEndHour < dailyStartHour;

    slices.forEach((slice) => {
      const sliceStart = new Date(slice.start);
      const sliceEnd = new Date(slice.end);

      const startDateOnly = new Date(sliceStart);
      startDateOnly.setUTCHours(0, 0, 0, 0);

      const endDateOnly = new Date(sliceEnd);
      endDateOnly.setUTCHours(0, 0, 0, 0);

      for (
        let date = new Date(startDateOnly);
        date.getTime() <= endDateOnly.getTime();
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        if (crossesMidnight) {
          const winB_Start = new Date(date);
          winB_Start.setUTCHours(0, 0, 0, 0);

          const winB_End = new Date(date);
          winB_End.setUTCHours(dailyEndHour, 0, 0, 0);

          const clipB_S = new Date(Math.max(sliceStart, winB_Start));
          const clipB_E = new Date(Math.min(sliceEnd, winB_End));

          if (clipB_E > clipB_S) {
            refined.push({
              ...slice,
              start: clipB_S.toISOString(),
              end: clipB_E.toISOString(),
              duration: (clipB_E - clipB_S) / 60000,
            });
          }
        }

        const winA_Start = new Date(date);
        winA_Start.setUTCHours(dailyStartHour, 0, 0, 0);

        const winA_End = new Date(date);
        if (crossesMidnight) {
          winA_End.setUTCHours(24, 0, 0, 0);
        } else {
          winA_End.setUTCHours(dailyEndHour, 0, 0, 0);
        }

        const clipA_S = new Date(Math.max(sliceStart, winA_Start));
        const clipA_E = new Date(Math.min(sliceEnd, winA_End));

        if (clipA_E > clipA_S) {
          refined.push({
            ...slice,
            start: clipA_S.toISOString(),
            end: clipA_E.toISOString(),
            duration: (clipA_E - clipA_S) / 60000,
          });
        }
      }
    });
    refined.sort((a, b) => new Date(a.start) - new Date(b.start));
    return refined;
  }

  // groupSlicesIntoBlocks: combine slices that match up into larger blocks of time
  groupSlicesIntoBlocks(slices) {
    if (slices.length === 0) return [];

    const blocks = [];
    let currentBlock = { ...slices[0] };

    for (let i = 1; i < slices.length; i++) {
      const nextSlice = slices[i];

      // If the next slice is perfectly adjacent AND has the same player count
      if (
        nextSlice.start === currentBlock.end &&
        JSON.stringify(nextSlice.availablePlayerList) ===
          JSON.stringify(currentBlock.availablePlayerList)
      ) {
        // Just extend the end time of the current block
        currentBlock.end = nextSlice.end;
        currentBlock.duration =
          (new Date(currentBlock.end) - new Date(currentBlock.start)) / 60000;
      } else {
        // Otherwise, save the finished block and start a new one
        blocks.push(currentBlock);
        currentBlock = { ...nextSlice };
      }
    }

    currentBlock.duration =
      (new Date(currentBlock.end) - new Date(currentBlock.start)) / 60000;
    blocks.push(currentBlock);
    return blocks;
  }

  // Fetch all user access tokens
  async getUserTokens() {
    // Loop through the userIds, get an access token for each. (did not do this in above loop to avoid making unnecessary calls)
    const result = { error: null, tokens: [] };
    const oAuth2Client = this.getOAuth2Client();

    for (let u = 0; u < this._usersToGetTokens.length; u++) {
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
        } else if (err.message.includes("invalid_grant")) {
          // log as disconnected
          this._disconnectedUsers.push(user.username);
        } else {
          // some other error occurred, get out of here and process the error

          result.error = err;
          return result;
        }
      }
    }
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
      if (this._disconnectedUsers.length > this._minUsers) {
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
    const result = { error: null, busyIntervals: [] };

    for (let i = 0; i < calendarList.length; i++) {
      const user = calendarList[i].user;
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
          this._validUsers.push(user.username);

          let thisUserCombined = [];

          let hasErrors = [];

          Object.values(data.calendars).forEach((cal) => {
            if (cal.errors) {
              //Google returned some error, log as disconnected
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
          }

          result.busyIntervals = [...result.busyIntervals, ...thisUserCombined];
        }
      }
    }
    if (this._disconnectedUsers.length > this._minUsers) {
      result.error = new BadRequestError(
        "Could not get enough user calendar data from Google to satisfy the minimum user count"
      );
    }
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

      // ANALYZE AVAILABILITY
      const totalUsers = this._validUsers.length;
      const allSlices = this.analyzeGroupAvailability(
        this._startDate,
        this._endDate,
        allBusyIntervals.busyIntervals,
        totalUsers
      );

      // Filter slices where the required minimum number of users are available
      const filteredSlices = allSlices.filter((slice) => {
        return slice.availablePlayers >= this._minUsers;
      });

      let refinedSlices;
      // Refine to match preferred start/end time window and duration (if set to -1 then just check for duration)
      if (this._prefStartHour !== -1 && this._prefEndHour !== -1) {
        // GM has a preference - run the "Cookie Cutter"
        refinedSlices = this.refineSlices(
          filteredSlices,
          this._prefStartHour,
          this._prefEndHour
        );
      } else {
        // No time-of-day preference - just filter by duration
        refinedSlices = filteredSlices.filter((slice) => {
          const duration =
            (new Date(slice.end) - new Date(slice.start)) / 60000;

          return duration >= this._minDuration;
        });
      }

      // Sort refinedSlices by start time before stitching
      refinedSlices.sort((a, b) => new Date(a.start) - new Date(b.start));

      // Stitch them together so "7-8pm" and "8-9pm" become "7-9pm"
      let stitchedBlocks = this.groupSlicesIntoBlocks(refinedSlices);

      // final filter for duration and sorting by available players first (for "best available matches")
      const blocks = stitchedBlocks
        .filter((slice) => {
          return slice.duration >= this._minDuration;
        })
        .sort((a, b) => {
          // Primary Sort: availablePlayers (Descending: 4, 3, 2...)
          if (b.availablePlayers !== a.availablePlayers) {
            return b.availablePlayers - a.availablePlayers;
          }

          // Secondary Sort: Start Date (Ascending: Monday, Tuesday...)
          return new Date(a.start) - new Date(b.start);
        });

      return {
        blocks,
        validUsers: this._validUsers,
        disconnectedUsers: this._disconnectedUsers,
      };
    } catch (err) {
      result.error = err;
      return result;
    }
  }
}

module.exports = FreeBusy;
