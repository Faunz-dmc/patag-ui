import type { Report } from './types';
export const reportDates = (reports: Pick<Report,'createdAt'>[]) => [...new Set(reports.map(r=>r.createdAt.slice(0,10)))].sort();
export function resolutionDays(report: Pick<Report,'createdAt'|'history'|'resolvedAt'>) {
  const resolved = report.history.find(h=>h.action==='resolve' && h.to==='Resolved');
  const at=report.resolvedAt || resolved?.at;
  return at ? Math.max(0,(Date.parse(at)-Date.parse(report.createdAt))/86400000) : 0;
}
