import { Patient, TreatmentSession, Nurse, NURSES, scheduleTreatments } from './scheduler';
import { format, subDays, parseISO } from 'date-fns';

export interface DailySchedule {
  date: string; // YYYY-MM-DD
  patients: Patient[];
  sessions: TreatmentSession[];
  totalPatients: number;
  updatedAt: string;
}

const STORAGE_KEY = 'nebulizer_daily_schedules_v2';

export function getAllSchedules(): Record<string, DailySchedule> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    
    // Revive Date objects in sessions
    Object.keys(parsed).forEach(date => {
      if (parsed[date] && Array.isArray(parsed[date].sessions)) {
        parsed[date].sessions = parsed[date].sessions.map((s: any) => ({
          ...s,
          startTime: typeof s.startTime === 'string' ? new Date(s.startTime) : new Date(s.startTime),
          endTime: typeof s.endTime === 'string' ? new Date(s.endTime) : new Date(s.endTime),
        }));
      }
    });

    return parsed;
  } catch (e) {
    console.error('Failed to load daily schedules from localStorage:', e);
    return {};
  }
}

export function getScheduleByDate(dateStr: string): DailySchedule | null {
  const all = getAllSchedules();
  return all[dateStr] || null;
}

export function saveScheduleByDate(
  dateStr: string,
  patients: Patient[],
  sessions: TreatmentSession[],
  totalPatients: number
): DailySchedule {
  const all = getAllSchedules();
  
  const dailySchedule: DailySchedule = {
    date: dateStr,
    patients,
    sessions,
    totalPatients,
    updatedAt: new Date().toISOString(),
  };

  all[dateStr] = dailySchedule;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save schedule to localStorage:', e);
  }

  return dailySchedule;
}

export function getAvailableDates(): string[] {
  const all = getAllSchedules();
  return Object.keys(all).sort((a, b) => b.localeCompare(a)); // Newest first
}

export function getYesterdayDate(fromDateStr?: string): string {
  const baseDate = fromDateStr ? parseISO(fromDateStr) : new Date();
  const yesterday = subDays(baseDate, 1);
  return format(yesterday, 'yyyy-MM-dd');
}

export function convertPatientsToRawText(patients: Patient[]): string {
  if (!patients || patients.length === 0) return '';
  return patients
    .map(p => `${p.name} - ${p.orderTime || '08:00'} - ${p.times || 1}`)
    .join('\n');
}

export function getPatientsAsRawText(dateStr: string): string {
  const schedule = getScheduleByDate(dateStr);
  if (!schedule || !schedule.patients) return '';
  return convertPatientsToRawText(schedule.patients);
}

const MACHINES_STORAGE_KEY = 'hospital_department_machines_v1';
export const DEFAULT_MACHINES = ['032', '121', '368'];

export function getDepartmentMachines(): string[] {
  try {
    const raw = localStorage.getItem(MACHINES_STORAGE_KEY);
    if (!raw) return DEFAULT_MACHINES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_MACHINES;
  } catch {
    return DEFAULT_MACHINES;
  }
}

export function saveDepartmentMachines(machines: string[]): void {
  try {
    localStorage.setItem(MACHINES_STORAGE_KEY, JSON.stringify(machines));
  } catch (e) {
    console.error('Failed to save machines to localStorage:', e);
  }
}
