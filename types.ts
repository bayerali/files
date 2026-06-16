export type ColorName = "green" | "blue" | "orange" | "red" | "purple" | "teal";
export type ShiftType = "Frueh" | "Spaet" | "Nacht";
export type Line = "SVP03" | "SVP05" | "SVP06" | "SVP09";
export type CompletionStatus = "done" | "blocked" | "skipped";

export interface Activity {
  id: number;
  name: string;
  color: ColorName;
  sortOrder: number;
  parentId: number | null;
  archived?: boolean;
}

export interface ShiftActivity {
  id: number;
  activityId: number;
  nameSnapshot: string;
  colorSnapshot: ColorName;
  parentIdSnapshot: number | null;
  sortOrderSnapshot?: number;
}

export interface Completion {
  id: number;
  shiftActivityId: number;
  status: CompletionStatus;
  timestamp: number;
  note: string;
  imageData: string | null;
}

export interface ShiftNote {
  id: number;
  text: string;
  createdAt: number;
  kind: "handover" | "warning" | "info";
}

export interface Shift {
  id: number;
  date: string;
  shiftType: ShiftType;
  line: Line;
  operator: string;
  createdAt: number;
  shiftActivities: ShiftActivity[];
  completions: Completion[];
  notes: ShiftNote[];
}

export interface DB {
  version: 2;
  nextId: number;
  activities: Activity[];
  shifts: Shift[];
}
