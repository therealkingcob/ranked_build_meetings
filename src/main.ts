type Member = {
  id: number;
  name: string;
};

type DailyEntry = {
  date: string;
  label: string;
  hours: number;
  isToday: boolean;
};

type WeeklyEntry = {
  startDate: string;
  endDate: string;
  label: string;
  hours: number;
  isCurrent: boolean;
};

type LeaderboardEntry = {
  id: number;
  name: string;
  visits: number;
  hours: number;
};

type Competition = {
  name: string;
  startDate: string;
  endDate: string;
};

type LeaderboardPeriod = {
  startDate: string | null;
  endDate: string;
  leaders: LeaderboardEntry[];
};

type Dashboard = {
  member: Member;
  today: { date: string; hours: number };
  week: { startDate: string; endDate: string; hours: number };
  streaks: { current: number; best: number };
  daily: DailyEntry[];
  weekly: WeeklyEntry[];
  recent: Array<{ id: number; meetingDate: string; hours: number }>;
  leaderboards: {
    week: LeaderboardPeriod;
    sinceLastCompetition: LeaderboardPeriod;
  };
  competition: {
    sourceUrl: string;
    last: Competition | null;
    next: Competition | null;
  };
  dataSource: "neon" | "demo";
};

type MembersResponse = {
  members: Member[];
  dataSource: "neon" | "demo";
};

const state: {
  members: Member[];
  selectedMemberId: number | null;
  selectedDate: string;
  dashboard: Dashboard | null;
} = {
  members: [],
  selectedMemberId: null,
  selectedDate: localIsoDate(),
  dashboard: null,
};

const memberSelect = getElement<HTMLSelectElement>("memberSelect");
const entryDate = getElement<HTMLInputElement>("entryDate");
const hoursInput = getElement<HTMLInputElement>("hoursInput");
const logForm = getElement<HTMLFormElement>("logForm");
const addMemberForm = getElement<HTMLFormElement>("addMemberForm");
const newMemberName = getElement<HTMLInputElement>("newMemberName");
const logStatus = getElement<HTMLParagraphElement>("logStatus");
const errorBanner = getElement<HTMLDivElement>("errorBanner");
const modeBanner = getElement<HTMLDivElement>("modeBanner");
const dashboardColumn = getElement<HTMLElement>("dashboard-title").closest(".dashboard-column") as HTMLElement;

entryDate.value = state.selectedDate;
entryDate.max = state.selectedDate;

memberSelect.addEventListener("change", () => {
  const value = Number(memberSelect.value);
  state.selectedMemberId = Number.isInteger(value) && value > 0 ? value : null;
  clearMessage(errorBanner);
  void loadDashboard();
});

entryDate.addEventListener("change", () => {
  state.selectedDate = entryDate.value || localIsoDate();
  void loadDashboard();
});

document.querySelectorAll<HTMLButtonElement>(".quick-hour").forEach((button) => {
  button.addEventListener("click", () => {
    hoursInput.value = button.dataset.hours ?? "";
    hoursInput.focus();
  });
});

logForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedMemberId) {
    setMessage(logStatus, "Choose a teammate first.", true);
    return;
  }

  const hours = Number(hoursInput.value);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    setMessage(logStatus, "Enter between 0.25 and 24 hours.", true);
    return;
  }

  setMessage(logStatus, "Saving session…");
  try {
    await request("/api/logs", {
      method: "POST",
      body: JSON.stringify({
        memberId: state.selectedMemberId,
        meetingDate: entryDate.value,
        hours,
      }),
    });
    hoursInput.value = "";
    setMessage(logStatus, `Saved ${formatHours(hours)} for ${formatDate(entryDate.value)}.`);
    await loadDashboard();
  } catch (error) {
    setMessage(logStatus, getErrorMessage(error), true);
  }
});

addMemberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = newMemberName.value.trim();
  if (!name) return;

  const button = addMemberForm.querySelector<HTMLButtonElement>("button");
  if (button) button.disabled = true;
  try {
    const result = await request<{ member: Member }>("/api/members", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    newMemberName.value = "";
    await loadMembers(result.member.id);
    setMessage(logStatus, `${result.member.name} is on the roster.`);
  } catch (error) {
    setMessage(logStatus, getErrorMessage(error), true);
  } finally {
    if (button) button.disabled = false;
  }
});

void loadMembers();

async function loadMembers(preferredId?: number): Promise<void> {
  try {
    const response = await request<MembersResponse>("/api/members");
    state.members = response.members;
    const currentId = preferredId ?? state.selectedMemberId;
    state.selectedMemberId = state.members.some((member) => member.id === currentId)
      ? currentId ?? null
      : state.members[0]?.id ?? null;
    renderMemberOptions();
    renderRoster();
    updateMode(response.dataSource);
    clearMessage(errorBanner);
    await loadDashboard();
  } catch (error) {
    showError(getErrorMessage(error));
    renderMemberOptions();
    renderRoster();
  }
}

async function loadDashboard(): Promise<void> {
  if (!state.selectedMemberId) {
    renderEmptyDashboard();
    return;
  }

  dashboardColumn.setAttribute("aria-busy", "true");
  try {
    const params = new URLSearchParams({
      memberId: String(state.selectedMemberId),
      date: state.selectedDate,
    });
    const dashboard = await request<Dashboard>(`/api/dashboard?${params.toString()}`);
    state.dashboard = dashboard;
    renderDashboard(dashboard);
    updateMode(dashboard.dataSource);
    clearMessage(errorBanner);
  } catch (error) {
    showError(getErrorMessage(error));
  } finally {
    dashboardColumn.setAttribute("aria-busy", "false");
  }
}

function renderMemberOptions(): void {
  if (!state.members.length) {
    memberSelect.innerHTML = '<option value="">No teammates yet</option>';
    memberSelect.disabled = true;
    return;
  }

  memberSelect.disabled = false;
  memberSelect.innerHTML = state.members
    .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`)
    .join("");
  memberSelect.value = state.selectedMemberId ? String(state.selectedMemberId) : "";
}

function renderRoster(): void {
  const roster = getElement<HTMLUListElement>("rosterList");
  if (!state.members.length) {
    roster.innerHTML = '<li class="empty-state">Add the first teammate above.</li>';
    return;
  }

  roster.innerHTML = state.members
    .map((member) => {
      const initial = escapeHtml(member.name.charAt(0).toUpperCase());
      return `<li class="roster-item"><span class="roster-initial">${initial}</span><span>${escapeHtml(member.name)}</span></li>`;
    })
    .join("");
}

function renderDashboard(dashboard: Dashboard): void {
  getElement<HTMLElement>("dashboardMemberName").textContent = dashboard.member.name + "’s";
  getElement<HTMLElement>("weekLabel").textContent = `${formatShortDate(dashboard.week.startDate)} – ${formatShortDate(dashboard.week.endDate)}`;
  getElement<HTMLElement>("todayHours").textContent = formatHours(dashboard.today.hours);
  getElement<HTMLElement>("weekHours").textContent = formatHours(dashboard.week.hours);
  getElement<HTMLElement>("currentStreak").textContent = `${dashboard.streaks.current}`;
  getElement<HTMLElement>("bestStreak").textContent = `${dashboard.streaks.best}`;
  getElement<HTMLElement>("todayCaption").textContent = dashboard.today.hours > 0 ? "Logged today" : "Nothing logged yet";
  getElement<HTMLElement>("weekCaption").textContent = `Since ${formatShortDate(dashboard.week.startDate)}`;

  renderLeaderboards(dashboard);
  renderDailyChart(dashboard.daily);
  renderWeeklyChart(dashboard.weekly);
  renderRecent(dashboard.recent);
}

function renderLeaderboards(dashboard: Dashboard): void {
  renderLeaderboardPeriod("week", dashboard.leaderboards.week);
  renderLeaderboardPeriod("sinceComp", dashboard.leaderboards.sinceLastCompetition);

  const sourceLink = getElement<HTMLAnchorElement>("competitionSource");
  sourceLink.href = dashboard.competition.sourceUrl;

  const note = getElement<HTMLElement>("competitionNote");
  if (dashboard.competition.last) {
    note.textContent = `Since ${formatCompetitionRange(dashboard.competition.last.startDate, dashboard.competition.last.endDate)} ${dashboard.competition.last.name.toLowerCase()} (competition day not counted).`;
  } else {
    note.textContent = "No completed San Diego FTC competition is on the calendar before this date.";
  }

  const nextCompetition = dashboard.competition.next;
  const nextLabel = getElement<HTMLElement>("nextCompetition");
  nextLabel.textContent = nextCompetition
    ? `Next: ${nextCompetition.name} · ${formatCompetitionRange(nextCompetition.startDate, nextCompetition.endDate)}`
    : "No upcoming competition on the published calendar";
}

function renderLeaderboardPeriod(prefix: "week" | "sinceComp", period: LeaderboardPeriod): void {
  const names = getElement<HTMLElement>(`${prefix}LeaderNames`);
  const stats = getElement<HTMLElement>(`${prefix}LeaderStats`);
  const periodLabel = getElement<HTMLElement>(`${prefix}LeaderPeriod`);

  periodLabel.textContent = period.startDate
    ? formatDateRange(period.startDate, period.endDate)
    : "All logged time";

  if (!period.leaders.length) {
    names.textContent = "No sessions yet";
    stats.textContent = "Log a build session to start the race.";
    return;
  }

  names.textContent = period.leaders.map((leader) => leader.name).join(" · ");
  const visits = period.leaders[0].visits;
  const visitLabel = `${visits} ${visits === 1 ? "visit" : "visits"}${period.leaders.length > 1 ? " each" : ""}`;
  const hoursLabel = period.leaders.map((leader) => `${formatHours(leader.hours)} ${leader.name}`).join(" · ");
  stats.textContent = `${visitLabel} · ${hoursLabel}`;
}

function renderDailyChart(entries: DailyEntry[]): void {
  const chart = getElement<HTMLDivElement>("dailyChart");
  const maxHours = Math.max(1, ...entries.map((entry) => entry.hours));
  chart.innerHTML = entries
    .map((entry) => {
      const height = entry.hours > 0 ? Math.max(8, (entry.hours / maxHours) * 100) : 5;
      const classes = ["day-column", entry.isToday ? "today" : "", entry.hours > 0 ? "has-hours" : ""].filter(Boolean).join(" ");
      return `<div class="${classes}" title="${escapeHtml(formatDate(entry.date))}: ${formatHours(entry.hours)}">
        <div class="bar-track"><div class="day-bar" style="height: ${height}%"></div></div>
        <span class="day-total">${entry.hours > 0 ? escapeHtml(formatHours(entry.hours)) : "—"}</span>
        <span class="day-label">${escapeHtml(entry.label)}</span>
      </div>`;
    })
    .join("");
}

function renderWeeklyChart(entries: WeeklyEntry[]): void {
  const chart = getElement<HTMLDivElement>("weeklyChart");
  const maxHours = Math.max(1, ...entries.map((entry) => entry.hours));
  chart.innerHTML = entries
    .map((entry) => {
      const width = entry.hours > 0 ? Math.max(2, (entry.hours / maxHours) * 100) : 0;
      const classes = `week-row${entry.isCurrent ? " current" : ""}`;
      return `<div class="${classes}" title="${escapeHtml(formatDateRange(entry.startDate, entry.endDate))}">
        <span class="week-row-label">${escapeHtml(entry.label)}</span>
        <span class="week-track"><span class="week-bar" style="width: ${width}%"></span></span>
        <span class="week-row-total">${escapeHtml(formatHours(entry.hours))}</span>
      </div>`;
    })
    .join("");
}

function renderRecent(entries: Dashboard["recent"]): void {
  const list = getElement<HTMLDivElement>("recentList");
  if (!entries.length) {
    list.innerHTML = '<p class="empty-state">No sessions yet. Log the first hour above.</p>';
    return;
  }

  list.innerHTML = entries
    .map(
      (entry) => `<div class="recent-row">
        <div class="recent-date">${escapeHtml(formatDate(entry.meetingDate))}<small>Build meeting</small></div>
        <div class="recent-hours">${escapeHtml(formatHours(entry.hours))}</div>
      </div>`,
    )
    .join("");
}

function renderEmptyDashboard(): void {
  getElement<HTMLElement>("dashboardMemberName").textContent = "Your";
  getElement<HTMLElement>("weekLabel").textContent = "Choose a teammate";
  ["todayHours", "weekHours", "currentStreak", "bestStreak"].forEach((id) => {
    getElement<HTMLElement>(id).textContent = "—";
  });
  getElement<HTMLElement>("todayCaption").textContent = "Add a teammate to begin";
  getElement<HTMLElement>("weekCaption").textContent = "—";
  getElement<HTMLElement>("weekLeaderNames").textContent = "Choose a teammate";
  getElement<HTMLElement>("weekLeaderStats").textContent = "—";
  getElement<HTMLElement>("weekLeaderPeriod").textContent = "—";
  getElement<HTMLElement>("sinceCompLeaderNames").textContent = "Choose a teammate";
  getElement<HTMLElement>("sinceCompLeaderStats").textContent = "—";
  getElement<HTMLElement>("sinceCompLeaderPeriod").textContent = "—";
  getElement<HTMLElement>("competitionNote").textContent = "—";
  getElement<HTMLElement>("nextCompetition").textContent = "—";
  getElement<HTMLElement>("dailyChart").innerHTML = '<p class="empty-state">Add a teammate to see daily time.</p>';
  getElement<HTMLElement>("weeklyChart").innerHTML = '<p class="empty-state">Add a teammate to see weekly time.</p>';
  getElement<HTMLElement>("recentList").innerHTML = '<p class="empty-state">Your saved sessions will show here.</p>';
}

function updateMode(source: "neon" | "demo"): void {
  const pill = getElement<HTMLElement>("modePill");
  const isDemo = source === "demo";
  pill.textContent = isDemo ? "Demo data" : "Neon connected";
  pill.classList.toggle("demo", isDemo);
  modeBanner.hidden = !isDemo;
  if (isDemo) {
    modeBanner.textContent = "Demo mode is active. Add DATABASE_URL in Vercel and run schema.sql in Neon to save real team data.";
  }
}

function showError(message: string): void {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearMessage(element: HTMLElement): void {
  element.textContent = "";
  element.hidden = true;
}

function setMessage(element: HTMLElement, message: string, isError = false): void {
  element.textContent = message;
  element.style.color = isError ? "#b5483c" : "";
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error ?? "Something went wrong. Try again.");
  }
  return payload;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function localIsoDate(): string {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, "")}h`;
}

function formatDate(iso: string): string {
  const date = dateFromIso(iso);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatShortDate(iso: string): string {
  const date = dateFromIso(iso);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatDateRange(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function formatCompetitionRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[character] ?? character;
  });
}
