/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { format, addMinutes, addHours, isWithinInterval, parse, parseISO, startOfDay } from 'date-fns';

export interface Nurse {
  id: string;
  name: string;
  machineCode: string;
}

export interface Patient {
  id: string;
  stt: number;
  patientId: string;
  name: string;
  date: string; // YYYY-MM-DD
  orderTime: string; // HH:mm
  times: number; // 1, 2, 3
  notes: string;
}

export interface TreatmentSession {
  id: string;
  patientId: string;
  patientName: string;
  sessionOrder: number; // 1, 2, 3
  orderTime: string;
  startTime: Date;
  endTime: Date;
  nurseId: string;
  nurseName: string;
  machineCode: string;
  status: 'valid' | 'warning' | 'conflict';
  notes: string;
}

export const NURSES: Nurse[] = [
  { id: 'DD1', name: 'ĐD1', machineCode: '032' },
  { id: 'DD2', name: 'ĐD2', machineCode: '121' },
  { id: 'DD3', name: 'ĐD3', machineCode: '368' }
];

export const TREATMENT_DURATION = 20; // minutes
export const START_DELAY = 8; // minutes
export const SESSION_GAP = 1; // minute

/**
 * Scheduling logic
 */
export function scheduleTreatments(patients: Patient[], customNurses: Nurse[] = NURSES, totalPatientsInDept?: number): TreatmentSession[] {
  const sortedPatients = [...patients].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.orderTime}`);
    const dateB = new Date(`${b.date}T${b.orderTime}`);
    return dateA.getTime() - dateB.getTime();
  });

  const participantCount = totalPatientsInDept !== undefined ? totalPatientsInDept : patients.length;
  const activeNurses = participantCount >= 30 ? customNurses : customNurses.slice(0, 2);
  const sessions: TreatmentSession[] = [];

  // Track availability per nurse/machine
  // We can use the endTime + gap as the next available slot
  // But since we have multiple sessions per patient and they can overlap across days,
  // we need a more robust check.

  const isSlotAvailable = (start: Date, end: Date, nurseId: string) => {
    return !sessions.some(s => {
      if (s.nurseId !== nurseId) return false;
      // Check overlap: (StartA < EndB) and (EndA > StartB)
      // We add the gap to the check
      const bufferStart = addMinutes(s.startTime, -SESSION_GAP);
      const bufferEnd = addMinutes(s.endTime, SESSION_GAP);
      return (start < bufferEnd) && (end > bufferStart);
    });
  };

  sortedPatients.forEach((patient, index) => {
    // 1. Assign Nurse (Round-robin based on index for the first session)
    const nurse = activeNurses[index % activeNurses.length];

    // 2. Generate Sessions
    const patientSessions: TreatmentSession[] = [];
    const baseTimeStr = `${patient.date} ${patient.orderTime}`;
    const baseTime = parse(baseTimeStr, 'yyyy-MM-dd HH:mm', new Date());

    if (isNaN(baseTime.getTime())) {
      console.warn(`Invalid order time for patient ${patient.name}: ${baseTimeStr}`);
      return; // Skip this patient
    }

    for (let i = 1; i <= patient.times; i++) {
      let sessionStartTime: Date;
      
      if (i === 1) {
        sessionStartTime = addMinutes(baseTime, START_DELAY);
      } else if (i === 2) {
        // Lần 2 = giờ bắt đầu lần 1 + 12 giờ (nếu có 2 lần) hoặc + 8 giờ (nếu có 3 lần)
        const gapHours = patient.times === 2 ? 12 : 8;
        sessionStartTime = addHours(patientSessions[0].startTime, gapHours);
      } else {
        // Lần 3 = giờ bắt đầu lần 2 + 7 giờ
        sessionStartTime = addHours(patientSessions[1].startTime, 7);
      }

      let sessionEndTime = addMinutes(sessionStartTime, TREATMENT_DURATION);

      // 3. Resolve Conflicts
      while (!isSlotAvailable(sessionStartTime, sessionEndTime, nurse.id)) {
        sessionStartTime = addMinutes(sessionStartTime, 1);
        sessionEndTime = addMinutes(sessionStartTime, TREATMENT_DURATION);
      }

      const session: TreatmentSession = {
        id: `${patient.id}-${i}`,
        patientId: patient.patientId,
        patientName: patient.name,
        sessionOrder: i,
        orderTime: patient.orderTime,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        nurseId: nurse.id,
        nurseName: nurse.name,
        machineCode: nurse.machineCode,
        status: 'valid',
        notes: patient.notes
      };

      patientSessions.push(session);
      sessions.push(session);
    }
  });

  return sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
