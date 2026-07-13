export interface Shift {
  id: string;
  label: string;
  time: string;
  color: string;
  displayColor: string;
}

export interface DaySchedule {
  [key: string]: string[]; // date string -> array of shift IDs
}

export interface SpecialDates {
  [key: string]: boolean; // date string -> is special date
}

export interface DateNotes {
  [key: string]: string; // date string -> note text
}

export interface ShiftCombination {
  id: string;
  combination: string;
  hours: number;
  useManualAmount?: boolean;
  manualAmount?: number;
}

export interface Settings {
  basicSalary: number;
  hourlyRate: number;
  shiftCombinations: ShiftCombination[];
  useManualMode?: boolean;
}

export interface MonthlySalaries {
  [key: string]: number; // monthKey (YYYY-MM) -> salary
}

export interface ExportData {
  schedule: DaySchedule;
  specialDates: SpecialDates;
  settings: Settings;
  scheduleTitle: string;
  exportDate: string;
  version: string;
  monthlySalaries?: MonthlySalaries;
}

export interface AuthCode {
  code: string;
  name: string;
  title?: string;
  salary?: number;
  employeeId?: string;
  firstName?: string;
  surname?: string;
}

export interface Institution {
  code: string;
  name: string;
  address?: string;
  contact_info?: string;
  is_active: boolean;
  created_at?: string;
}

export interface StaffUser {
  id: string;
  surname: string;
  name: string;
  id_number: string;
  passcode?: string | null;
  is_admin: boolean;
  is_active: boolean;
  last_login?: string;
  created_at?: string;
  institution_code?: string;
  registration_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  posting_institution?: string;
  nickname?: string | null; // Optional nickname for roster display
}
