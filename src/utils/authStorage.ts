import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StudentProfile, Course, StudyLog, AssignmentItem } from '../types';

export const SESSION_STORAGE_KEY = 'unisphere_session_email';

export async function hashPassword(pwd: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd + '_unisphere_academic_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getAccountDocId(email: string): string {
  return email.trim().toLowerCase().replace(/@/g, '_at_').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export interface UserCloudData {
  uid: string;
  email: string;
  name: string;
  studentId: string;
  passwordHash: string;
  degreeLevel: string;
  degreeName: string;
  degreeType: string;
  totalTargetCFU: number;
  enrolledYear: string;
  academicYear: string;
  institution: string;
  status: string;
  currentSession?: string;
  weeklyGoalHours?: number;
  avatarUrl?: string;
  logoUrl?: string;
  thesisPointsExpected?: number;
  courses?: Course[];
  studyLogs?: StudyLog[];
  assignments?: AssignmentItem[];
  quickNotes?: string;
  checklist?: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchUserFromCloud(email: string): Promise<UserCloudData | null> {
  const docId = getAccountDocId(email);
  try {
    const snap = await getDoc(doc(db, 'users', docId));
    if (snap.exists()) {
      return snap.data() as UserCloudData;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching cloud profile for', email, err);
    return null;
  }
}

export async function saveUserToCloud(data: Partial<UserCloudData> & { email: string }): Promise<void> {
  const docId = getAccountDocId(data.email);
  try {
    await setDoc(doc(db, 'users', docId), {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error syncing cloud user data', err);
  }
}
