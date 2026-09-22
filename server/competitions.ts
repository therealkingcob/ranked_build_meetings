import { addDays } from "./date.js";

export type Competition = {
  name: string;
  startDate: string;
  endDate: string;
};

// Dates are published by San Diego FTC at the source below. Keep the prior
// regional here so the "since last comp" window works before the first meet
// of a new season has happened.
export const SDFTC_COMPETITION_SOURCE_URL = "https://www.sdftc.org/2026-27season.html";

export const SDFTC_COMPETITIONS: Competition[] = [
  { name: "Meet #1", startDate: "2025-11-22", endDate: "2025-11-23" },
  { name: "Meet #2", startDate: "2025-12-20", endDate: "2025-12-21" },
  { name: "Meet #3", startDate: "2026-01-10", endDate: "2026-01-11" },
  { name: "League Tournament", startDate: "2026-02-07", endDate: "2026-02-08" },
  { name: "San Diego Regional", startDate: "2026-03-07", endDate: "2026-03-07" },
  { name: "Meet #1", startDate: "2026-11-21", endDate: "2026-11-22" },
  { name: "Meet #2", startDate: "2026-12-12", endDate: "2026-12-13" },
  { name: "Meet #3", startDate: "2027-01-23", endDate: "2027-01-24" },
  { name: "League Tournament", startDate: "2027-02-20", endDate: "2027-02-21" },
  { name: "San Diego Regional", startDate: "2027-03-07", endDate: "2027-03-07" },
];

export function getCompetitionContext(requestedDate: string): {
  last: Competition | null;
  next: Competition | null;
  sinceStartDate: string | null;
} {
  const completed = SDFTC_COMPETITIONS
    .filter((competition) => competition.endDate <= requestedDate)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const upcoming = SDFTC_COMPETITIONS
    .filter((competition) => competition.startDate > requestedDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const last = completed[0] ?? null;

  return {
    last,
    next: upcoming[0] ?? null,
    sinceStartDate: last ? addDays(last.endDate, 1) : null,
  };
}
