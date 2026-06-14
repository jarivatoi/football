import { RosterEntry, ShiftFilterType } from '../types/roster';

const filterEntriesByShift = (entries: RosterEntry[], filter: ShiftFilterType): RosterEntry[] => {
  if (filter === 'all') {
    return entries;
  }
  return entries.filter(entry => entry.shift_type === filter);
};

const sortEntriesByDate = (entries: RosterEntry[]): RosterEntry[] => {
  return [...entries].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
};

export const formatDisplayDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const getShiftDisplayName = (shiftType: string): string => {
  const shiftMap: Record<string, string> = {
    'Morning Shift (9-4)': 'Morning (9-4)',
    'Evening Shift (4-10)': 'Evening (4-10)',
    'Saturday Regular (12-10)': 'Saturday (12-10)',
    'Night Duty': 'Night Duty (N)',
    'Sunday/Public Holiday/Special': 'Special (9-4)'
  };
  return shiftMap[shiftType] || shiftType;
};

/**
 * Extract base surname from roster display name for billing
 * Examples:
 * - "NARAYYA_(V.T)" → "NARAYYA"
 * - "NARAYYA_(S)" → "NARAYYA"
 * - "BHEKUR" → "BHEKUR" (no change if no suffix)
 * - "NARAYYA(R)" → "NARAYYA" (also handles (R) variants)
 */
export const extractBaseSurname = (rosterName: string): string => {
  // Remove _(X.X) or _(X) suffix if present (roster display name format)
  const withoutRosterSuffix = rosterName.replace(/_\([^)]+\)$/, '');
  
  // Remove (R) suffix if present (reserve variant format)
  return withoutRosterSuffix.replace(/\(R\)$/, '').trim();
};