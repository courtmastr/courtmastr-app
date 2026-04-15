"use strict";
// Pure functions for daily check-in reset logic.
// No Firebase imports — these are unit-tested directly via Vitest.
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateKey = formatDateKey;
exports.getTodayKey = getTodayKey;
exports.getTodayWindowUTC = getTodayWindowUTC;
exports.computeResetTargets = computeResetTargets;
/**
 * Returns a YYYY-MM-DD date string for the given date in the given IANA timezone.
 * Uses the 'en-CA' locale which formats as YYYY-MM-DD natively.
 */
function formatDateKey(date, timezone) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
}
/**
 * Returns today's YYYY-MM-DD key in the given timezone.
 */
function getTodayKey(timezone = 'America/Chicago') {
    return formatDateKey(new Date(), timezone);
}
/**
 * Returns UTC Date objects for the start and end of the local calendar day
 * that contains `now` in the given timezone.
 *
 * Strategy: compute how many milliseconds into the local day `now` is (ignoring
 * sub-second precision), then subtract to reach local midnight.
 *
 * Known limitation: on DST transition days the computed window start can be off by
 * ±1 hour if `now` falls after a midnight-adjacent transition. For the scheduled
 * use case (function runs at 06:00 UTC ≈ 00:00–01:00 Chicago) this never occurs
 * because the function runs well before any US DST transition window.
 */
function getTodayWindowUTC(now, timezone) {
    var _a, _b, _c, _d, _e, _f;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    }).formatToParts(now);
    const localHour = parseInt((_b = (_a = parts.find((p) => p.type === 'hour')) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '0', 10);
    const localMinute = parseInt((_d = (_c = parts.find((p) => p.type === 'minute')) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : '0', 10);
    const localSecond = parseInt((_f = (_e = parts.find((p) => p.type === 'second')) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : '0', 10);
    const msIntoLocalDay = (localHour * 3600 + localMinute * 60 + localSecond) * 1000;
    // Truncate sub-second component to land precisely on the second boundary.
    const windowStart = new Date(Math.floor((now.getTime() - msIntoLocalDay) / 1000) * 1000);
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
    return { windowStart, windowEnd };
}
/**
 * Given a set of matches and registration statuses, returns the IDs of
 * registrations that should have their check-in status reset.
 *
 * A registration is reset when:
 *  - It has at least one match with plannedStartAt within [windowStart, windowEnd)
 *  - Its current status is 'checked_in' or 'no_show'
 */
function computeResetTargets(params) {
    const { matches, registrationStatuses, windowStart, windowEnd } = params;
    const idsWithMatchesInWindow = new Set();
    for (const match of matches) {
        const t = match.plannedStartAt;
        if (!t)
            continue;
        if (t >= windowStart && t < windowEnd) {
            if (match.participant1Id)
                idsWithMatchesInWindow.add(match.participant1Id);
            if (match.participant2Id)
                idsWithMatchesInWindow.add(match.participant2Id);
        }
    }
    return [...idsWithMatchesInWindow].filter((id) => {
        const status = registrationStatuses.get(id);
        return status === 'checked_in' || status === 'no_show';
    });
}
//# sourceMappingURL=dailyCheckIn.js.map