import { addDays, todayIso } from "./date.js";

export type DemoMember = { id: number; name: string };
export type DemoLog = { id: number; member_id: number; meeting_date: string; hours: number };

const members: DemoMember[] = [
  { id: 1, name: "Rishi" },
  { id: 2, name: "Claire" },
  { id: 3, name: "Howell" },
  { id: 4, name: "Cyrus" },
  { id: 5, name: "Lino" },
  { id: 6, name: "Shaan" },
  { id: 7, name: "Tristan" },
  { id: 8, name: "Lylia" },
];

const logs: DemoLog[] = [];
let nextLogId = 1;

function seedDemoLogs(): void {
  if (logs.length > 0) return;
  const today = todayIso();
  [0, 1, 2, 4].forEach((offset, index) => {
    logs.push({ id: nextLogId++, member_id: 1, meeting_date: addDays(today, -offset), hours: [2.5, 3, 1.5, 2][index] });
  });
  logs.push({ id: nextLogId++, member_id: 2, meeting_date: addDays(today, -1), hours: 2 });
}

export function getDemoMembers(): DemoMember[] {
  seedDemoLogs();
  return [...members];
}

export function addDemoMember(name: string): DemoMember {
  seedDemoLogs();
  const existing = members.find((member) => member.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const member = { id: Math.max(...members.map((item) => item.id), 0) + 1, name };
  members.push(member);
  return member;
}

export function upsertDemoLog(memberId: number, meetingDate: string, hours: number): DemoLog {
  seedDemoLogs();
  const existing = logs.find((log) => log.member_id === memberId && log.meeting_date === meetingDate);
  if (existing) {
    existing.hours = hours;
    return existing;
  }
  const log = { id: nextLogId++, member_id: memberId, meeting_date: meetingDate, hours };
  logs.push(log);
  return log;
}

export function getDemoLogs(memberId: number): DemoLog[] {
  seedDemoLogs();
  return logs.filter((log) => log.member_id === memberId).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
}
