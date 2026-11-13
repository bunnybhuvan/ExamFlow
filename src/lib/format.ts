import { format, parseISO } from "date-fns";
export const fmtDate = (iso: string) => {
  try {
    return format(parseISO(iso), "EEE d MMM");
  } catch {
    return iso;
  }
};
export const fmtTime = (iso: string) => {
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return iso;
  }
};
export const fmtDateTime = (iso: string) => {
  try {
    return format(parseISO(iso), "d MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
};
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const titleCase = (s: string) =>
  s.replace(/[_.-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());