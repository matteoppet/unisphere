import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { getEmailDocId } from './authService.js';
import { normalizeUserId, buildFriendProfilePayload } from '../utils/telemetry.js';
import { syncFriendProfileAndLookup } from './squadService.js';

const ALLOWED_LEGACY_USER_KEYS = new Set([
  'uid', 'authUid', 'email', 'name', 'studentId', 'authProvider', 'emailVerified',
  'degreeLevel', 'degreeName', 'degreeType', 'totalTargetCFU', 'enrolledYear', 'academicYear',
  'institution', 'status', 'currentSession', 'weeklyGoalHours', 'avatarUrl', 'logoUrl',
  'thesisPointsExpected', 'courses', 'studyLogs', 'assignments', 'quickNotes', 'checklist',
  'resourceLinks', 'activeSquadId', 'squadIds', 'xp', 'currentStreak',
  'minutesStudiedThisWeek', 'tasksCompletedThisWeek', 'lastActiveDate',
  'createdAt', 'updatedAt', 'updatedBy', 'migratedFromEmailId', 'migratedAt',
]);

function createDefaultMigrationOps(dbInstance) {
  return {
    async getUserDoc(docId) {
      if (!dbInstance || !docId) return null;
      const snap = await getDoc(doc(dbInstance, 'users', docId));
      return snap.exists() ? snap.data() : null;
    },
    async setUserDoc(docId, data) {
      if (!dbInstance || !docId) return;
      await setDoc(doc(dbInstance, 'users', docId), data, { merge: true });
    },
    async deleteUserDoc(docId) {
      if (!dbInstance || !docId) return;
      await deleteDoc(doc(dbInstance, 'users', docId));
    },
    async querySquadsByMember(memberId) {
      if (!dbInstance || !memberId) return [];
      const q = query(
        collection(dbInstance, 'squads'),
        where('memberUids', 'array-contains', memberId)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async updateSquadDoc(squadId, patch) {
      if (!dbInstance || !squadId || !patch) return;
      const firestorePatch = { ...patch };
      if (Array.isArray(patch.addMemberUids) && patch.addMemberUids.length > 0) {
        delete firestorePatch.addMemberUids;
        await updateDoc(doc(dbInstance, 'squads', squadId), {
          ...firestorePatch,
          memberUids: arrayUnion(...patch.addMemberUids),
        });
        return;
      }
      if (Array.isArray(patch.removeMemberUids) && patch.removeMemberUids.length > 0) {
        delete firestorePatch.removeMemberUids;
        await updateDoc(doc(dbInstance, 'squads', squadId), {
          ...firestorePatch,
          memberUids: arrayRemove(...patch.removeMemberUids),
        });
        return;
      }
      await updateDoc(doc(dbInstance, 'squads', squadId), firestorePatch);
    },
    async getSquadMember(squadId, memberId) {
      if (!dbInstance || !squadId || !memberId) return null;
      const snap = await getDoc(doc(dbInstance, 'squads', squadId, 'members', memberId));
      return snap.exists() ? snap.data() : null;
    },
    async setSquadMember(squadId, memberId, data) {
      if (!dbInstance || !squadId || !memberId) return;
      await setDoc(doc(dbInstance, 'squads', squadId, 'members', memberId), data, { merge: true });
    },
    async deleteSquadMember(squadId, memberId) {
      if (!dbInstance || !squadId || !memberId) return;
      await deleteDoc(doc(dbInstance, 'squads', squadId, 'members', memberId));
    },
    async getSquadPresence(squadId, memberId) {
      if (!dbInstance || !squadId || !memberId) return null;
      const snap = await getDoc(doc(dbInstance, 'squads', squadId, 'presence', memberId));
      return snap.exists() ? snap.data() : null;
    },
    async setSquadPresence(squadId, memberId, data) {
      if (!dbInstance || !squadId || !memberId) return;
      await setDoc(doc(dbInstance, 'squads', squadId, 'presence', memberId), data, { merge: true });
    },
    async deleteSquadPresence(squadId, memberId) {
      if (!dbInstance || !squadId || !memberId) return;
      await deleteDoc(doc(dbInstance, 'squads', squadId, 'presence', memberId));
    },
    async ensureSquadInvite(code, squadId, createdBy) {
      if (!dbInstance || !code || !squadId || !createdBy) return;
      const cleanCode = String(code).trim().toUpperCase();
      await setDoc(
        doc(dbInstance, 'squadInvites', cleanCode),
        {
          code: cleanCode,
          squadId,
          createdBy,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    },
    async syncFriendProfileAndLookup({ uid, email, friendProfile }) {
      await syncFriendProfileAndLookup({ uid, email, friendProfile });
    },
  };
}

/**
 * Idempotently migrates `/users/{emailSlug}` to `/users/{uid}`, filtering to rule-allowlisted keys.
 */
export async function migrateLegacyUserDoc({ uid, email, ops } = {}) {
  const cleanUid = normalizeUserId(uid || '');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const legacyId = normalizedEmail ? getEmailDocId(normalizedEmail) : '';
  if (!cleanUid || !legacyId || legacyId === cleanUid || !ops) {
    return { migrated: false, deletedLegacy: false, userData: null };
  }

  // Propagate read errors so transient offline/network failures never trigger false overwrites
  const existingUidDoc = await ops.getUserDoc(cleanUid);
  if (existingUidDoc) {
    return { migrated: false, deletedLegacy: false, userData: existingUidDoc };
  }

  const legacyDoc = await ops.getUserDoc(legacyId).catch(() => null);
  if (!legacyDoc) {
    return { migrated: false, deletedLegacy: false, userData: null };
  }

  const filteredRest = {};
  for (const [k, v] of Object.entries(legacyDoc)) {
    if (ALLOWED_LEGACY_USER_KEYS.has(k) && v !== undefined) {
      filteredRest[k] = v;
    }
  }
  const migratedData = {
    ...filteredRest,
    uid: cleanUid,
    authUid: cleanUid,
    email: normalizedEmail,
    migratedFromEmailId: legacyId,
    migratedAt: new Date().toISOString(),
  };

  await ops.setUserDoc(cleanUid, migratedData);
  let deletedLegacy = false;
  try {
    await ops.deleteUserDoc(legacyId);
    deletedLegacy = true;
  } catch {
    deletedLegacy = false;
  }

  return { migrated: true, deletedLegacy, userData: migratedData };
}

/**
 * Migrates email-keyed Squad memberships, ownership, and subdocuments to Firebase Auth `uid`.
 */
export async function migrateLegacySquadsForUser({ uid, email, ops } = {}) {
  const cleanUid = normalizeUserId(uid || '');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const legacyId = normalizedEmail ? getEmailDocId(normalizedEmail) : '';
  if (!cleanUid || !legacyId || legacyId === cleanUid || !ops) {
    return { migratedSquadIds: [] };
  }

  const legacySquads = await ops.querySquadsByMember(legacyId).catch(() => []);
  const migratedSquadIds = [];

  for (const sq of Array.isArray(legacySquads) ? legacySquads : []) {
    if (!sq?.id) continue;
    const nowIso = new Date().toISOString();

    // 1. Grant UID membership (and ownership if legacy creator) BEFORE moving subdocs
    const prePatch = {
      addMemberUids: [cleanUid],
      updatedAt: nowIso,
      ...(sq.createdBy === legacyId ? { createdBy: cleanUid } : {}),
    };
    await ops.updateSquadDoc(sq.id, prePatch);

    // 2. Migrate member & presence subdocs
    const legacyMember = await ops.getSquadMember(sq.id, legacyId).catch(() => null);
    if (legacyMember) {
      const { email: _omitMemberEmail, ...cleanMember } = legacyMember;
      await ops.setSquadMember(sq.id, cleanUid, {
        ...cleanMember,
        uid: cleanUid,
        updatedAt: nowIso,
      });
      await ops.deleteSquadMember(sq.id, legacyId).catch(() => {});
    }

    const legacyPresence = await ops.getSquadPresence(sq.id, legacyId).catch(() => null);
    if (legacyPresence) {
      await ops.setSquadPresence(sq.id, cleanUid, {
        ...legacyPresence,
        uid: cleanUid,
        updatedAt: nowIso,
      });
      await ops.deleteSquadPresence(sq.id, legacyId).catch(() => {});
    }

    // 3. Remove legacy email slug from memberUids & swap nextSession.attendeeUids
    const postPatch = {
      removeMemberUids: [legacyId],
      updatedAt: nowIso,
    };
    if (sq.nextSession && Array.isArray(sq.nextSession.attendeeUids)) {
      const nextUids = Array.from(
        new Set(
          sq.nextSession.attendeeUids
            .filter((id) => id !== legacyId)
            .concat(sq.nextSession.attendeeUids.includes(legacyId) ? [cleanUid] : [])
        )
      );
      postPatch.nextSession = {
        ...sq.nextSession,
        attendeeUids: nextUids,
      };
    }

    await ops.updateSquadDoc(sq.id, postPatch);
    if (sq.createdBy === legacyId && sq.code && typeof ops.ensureSquadInvite === 'function') {
      await ops.ensureSquadInvite(sq.code, sq.id, cleanUid).catch(() => {});
    }
    migratedSquadIds.push(sq.id);
  }

  return { migratedSquadIds };
}

/**
 * Runs one-time login migration from legacy email-keyed docs to UID-keyed docs + initial FriendProfile sync.
 */
export async function runOneTimeLegacyMigration({
  authUser,
  profile = {},
  courses = [],
  studyLogs = [],
  assignments = [],
  dbInstance = null,
  ops = null,
} = {}) {
  const uid = normalizeUserId(authUser?.uid || '');
  const email = String(authUser?.email || profile?.email || '').trim().toLowerCase();
  if (!uid || !email) {
    return { userMigrated: false, migratedSquadIds: [] };
  }

  const effectiveOps = ops || (dbInstance ? createDefaultMigrationOps(dbInstance) : null);
  if (!effectiveOps) {
    return { userMigrated: false, migratedSquadIds: [] };
  }

  const userRes = await migrateLegacyUserDoc({ uid, email, ops: effectiveOps });
  const squadRes = await migrateLegacySquadsForUser({ uid, email, ops: effectiveOps });

  const resolvedData = userRes.userData || {};
  const friendProfile = buildFriendProfilePayload({
    uid,
    profile: {
      ...profile,
      ...resolvedData,
      name: resolvedData.name || profile.name || authUser?.displayName || email.split('@')[0],
    },
    courses: Array.isArray(resolvedData.courses) ? resolvedData.courses : courses,
    studyLogs: Array.isArray(resolvedData.studyLogs) ? resolvedData.studyLogs : studyLogs,
    assignments: Array.isArray(resolvedData.assignments) ? resolvedData.assignments : assignments,
  });

  if (typeof effectiveOps.syncFriendProfileAndLookup === 'function') {
    await effectiveOps.syncFriendProfileAndLookup({ uid, email, friendProfile }).catch(() => {});
  }

  return {
    userMigrated: Boolean(userRes.migrated),
    migratedSquadIds: squadRes.migratedSquadIds,
  };
}
