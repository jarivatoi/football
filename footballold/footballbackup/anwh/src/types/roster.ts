export interface RosterEntry {
  id: string;
  date: string;
  shift_type: string;
  assigned_name: string;
  original_assigned_name?: string; // Store the original PDF assignment
  last_edited_by: string;
  last_edited_at: string;
  created_at: string;
  change_description?: string; // Can include attached center info (e.g., "Imported from PDF - Center: ENT Hospital")
  text_color?: string; // Admin-set text color (highest priority)
  shift_marker?: string; // Shift marker: Early, Late, First, Second
}

export interface AuthCode {
  code: string;
  name: string;
}

export interface RosterFormData {
  date: string;
  shiftType: string;
  assignedName: string;
  changeDescription: string;
  textColor?: string;
}

export type ViewType = 'table' | 'card' | 'log';
export type ShiftFilterType = 'all' | 'Morning Shift (9-4)' | 'Evening Shift (4-10)' | 'Night Duty' | 'Saturday Regular (12-10)' | 'Sunday/Public Holiday/Special';

interface RosterEntryCellProps {
  entry: RosterEntry;
  onUpdate?: (updatedEntry: RosterEntry) => void;
  allEntriesForShift?: RosterEntry[];
}

export interface RosterPanelState {
  entries: RosterEntry[];
  loading: boolean;
  error: string | null;
  activeView: ViewType;
  selectedShiftFilter: ShiftFilterType;
  editingEntry: RosterEntry | null;
  showDeleteConfirm: string | null;
  authCode: string;
  editorName: string | null;
  isAuthenticated: boolean;
  formData: RosterFormData;
  showSuccessMessage: boolean;
  successMessage: string;
}