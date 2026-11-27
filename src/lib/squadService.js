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
import { db, auth } from './firebase.js';
import {
  getEmailDocId,
  hashEmailForLookup,
  sanitizeTextInput,
  sanitizeResourceUrl,
} from './authService.js';
import {
  normalizeUserId,
  getFriendshipId,
  doesFriendshipMatchUser,
  buildFriendTelemetrySummary,
} from '../utils/telemetry.js';

const LEFT_SQUADS_STORAGE_KEY = 'unisphere_workspace_left_squad_ids';
export const FRIENDSHIPS_STORAGE_KEY = 'unisphere_workspace_friendships_v1';
const inMemoryFriendshipsMap = new Map();
const inMemoryFriendLookupsMap = new Map();
const isBrowserRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';

function getLeftSquadIdsSet() {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(LEFT_SQUADS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function recordLeftSquadId(squadId) {
  try {
    if (typeof localStorage === 'undefined' || !squadId) return;
    const set = getLeftSquadIdsSet();
    set.add(squadId);
    localStorage.setItem(LEFT_SQUADS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function clearLeftSquadId(squadId) {
  try {
    if (typeof localStorage === 'undefined' || !squadId) return;
    const set = getLeftSquadIdsSet();
    if (set.has(squadId)) {
      set.delete(squadId);
      localStorage.setItem(LEFT_SQUADS_STORAGE_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export function getUserDocId(email, uid) {
  const explicitUid = normalizeUserId(uid || '');
  if (explicitUid && !explicitUid.includes('@')) {
    return explicitUid;
  }
  const authUid = normalizeUserId(auth?.currentUser?.uid || '');
  if (authUid) {
    return authUid;
  }
  if (explicitUid) {
    return explicitUid;
  }
  if (email && email.trim()) {
    return getEmailDocId(email);
  }
  return 'default_user';
}

export async function fetchUserSquads(currentUid, email) {
  const userDocId = getUserDocId(email, currentUid);
  const foundSquadsMap = new Map();
  let activeSquadId = null;
  const leftSquadIds = getLeftSquadIdsSet();
  const cloudDb = isBrowserRuntime ? db : null;

  if (!cloudDb) {
    return { squads: [], activeSquadId: null };
  }

  try {
    const userDocRef = doc(cloudDb, 'users', userDocId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.activeSquadId && !leftSquadIds.has(userData.activeSquadId)) {
        activeSquadId = userData.activeSquadId;
      }

      const squadIds = Array.isArray(userData.squadIds)
        ? userData.squadIds.filter((id) => id && !leftSquadIds.has(id))
        : [];
      const squadPromises = squadIds.map(async (id) => {
        try {
          const sqSnap = await getDoc(doc(cloudDb, 'squads', id));
          if (sqSnap.exists()) {
            return sqSnap.data();
          }
        } catch (e) {
          console.warn(`Failed to fetch squad ${id}`, e);
        }
        return null;
      });

      const resolved = await Promise.all(squadPromises);
      resolved.forEach((sq) => {
        if (sq && sq.id && !leftSquadIds.has(sq.id)) {
          foundSquadsMap.set(sq.id, sq);
        }
      });
    }

    const queryIds = Array.from(
      new Set([normalizeUserId(currentUid), normalizeUserId(userDocId)].filter(Boolean))
    );
    for (const qId of queryIds) {
      try {
        const qMember = query(
          collection(cloudDb, 'squads'),
          where('memberUids', 'array-contains', qId)
        );
        const memberSnap = await getDocs(qMember);
        memberSnap.forEach((d) => {
          const sq = d.data();
          if (sq && sq.id && !leftSquadIds.has(sq.id)) {
            foundSquadsMap.set(sq.id, sq);
          }
        });
      } catch (err) {
        console.warn('Error querying squads by memberUids (uid):', err);
      }
    }

    // Verify the user has not been removed by an admin from any candidate squad
    const safeActId = String(userDocId)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 120);
    for (const sq of Array.from(foundSquadsMap.values())) {
      const isCreator =
        sq.createdBy &&
        (normalizeUserId(sq.createdBy) === normalizeUserId(userDocId) ||
          (currentUid && normalizeUserId(sq.createdBy) === normalizeUserId(currentUid)));
      if (isCreator) continue;
      try {
        const removedSnap = await getDoc(
          doc(cloudDb, 'squads', sq.id, 'activities', `removed_${safeActId}`)
        );
        if (removedSnap.exists()) {
          const rData = removedSnap.data();
          if (rData?.type === 'member_removed' && rData?.status === 'removed') {
            const removedAtMs = Date.parse(String(rData.updatedAt || rData.createdAt || '')) || 1;
            const memberSnap = await getDoc(doc(cloudDb, 'squads', sq.id, 'members', userDocId)).catch(
              () => null
            );
            const joinedAtMs =
              memberSnap && memberSnap.exists()
                ? Date.parse(String(memberSnap.data()?.joinedAt || '')) || 0
                : 0;
            if (joinedAtMs <= removedAtMs) {
              foundSquadsMap.delete(sq.id);
              if (activeSquadId === sq.id) {
                activeSquadId = null;
              }
              await leaveSquadCleanly(email, userDocId, sq.id, null);
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Error syncing user squads from Firestore:', err);
  }

  return {
    squads: Array.from(foundSquadsMap.values()),
    activeSquadId,
  };
}

export async function syncSquadToUserDoc(email, currentUid, squadId, makeActive = true) {
  clearLeftSquadId(squadId);
  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb) return;
  const userDocId = getUserDocId(email, currentUid);
  const userRef = doc(cloudDb, 'users', userDocId);

  const updatePayload = {
    squadIds: arrayUnion(squadId),
    updatedAt: new Date().toISOString(),
  };

  if (makeActive) {
    updatePayload.activeSquadId = squadId;
  }

  try {
    await setDoc(userRef, updatePayload, { merge: true });
  } catch (err) {
    console.warn('Failed to sync squad ID to user document:', err);
  }
}

export async function removeSquadFromUserDoc(
  email,
  currentUid,
  squadId,
  nextActiveSquadId = null,
  ops = null
) {
  recordLeftSquadId(squadId);
  if (ops && typeof ops.removeSquadFromUserDoc === 'function') {
    await ops.removeSquadFromUserDoc(squadId, nextActiveSquadId);
    return;
  }
  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb) return;
  const userDocId = getUserDocId(email, currentUid);
  const userRef = doc(cloudDb, 'users', userDocId);

  const payload = {
    squadIds: arrayRemove(squadId),
    activeSquadId: nextActiveSquadId || null,
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(userRef, payload, { merge: true });
  } catch (err) {
    console.warn('Failed to remove squad ID from user doc:', err);
  }
}

/**
 * Cleanly removes a user from a squad.
 * Deletes `members/{uid}` and `presence/{uid}` BEFORE removing `uid` from `squads/{squadId}.memberUids`
 * so `isSquadMember(squadId)` rules never deny the caller's own subcollection cleanup.
 */
export async function leaveSquadCleanly(
  email,
  currentUid,
  squadId,
  nextActiveSquadId = null,
  ops = null
) {
  if (!squadId) return;
  recordLeftSquadId(squadId);
  const userDocId = getUserDocId(email, currentUid);
  const candidateUids = Array.from(
    new Set(
      [userDocId, normalizeUserId(currentUid), normalizeUserId(auth?.currentUser?.uid)].filter(
        Boolean
      )
    )
  );

  await removeSquadFromUserDoc(email, currentUid, squadId, nextActiveSquadId, ops);

  if (ops) {
    for (const uid of candidateUids) {
      if (typeof ops.deleteMemberDoc === 'function') {
        await ops.deleteMemberDoc(squadId, uid);
      }
      if (typeof ops.deletePresenceDoc === 'function') {
        await ops.deletePresenceDoc(squadId, uid);
      }
      if (typeof ops.removeMemberUidFromSquad === 'function') {
        await ops.removeMemberUidFromSquad(squadId, uid);
      }
    }
    return;
  }

  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb) return;

  try {
    const squadRef = doc(cloudDb, 'squads', squadId);
    for (const uid of candidateUids) {
      await deleteDoc(doc(cloudDb, 'squads', squadId, 'members', uid)).catch(() => {});
      await deleteDoc(doc(cloudDb, 'squads', squadId, 'presence', uid)).catch(() => {});
      await updateDoc(squadRef, {
        memberUids: arrayRemove(uid),
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Notice while cleaning up squad membership on leave:', err);
  }
}

export async function createSquadInvite({ code, squadId, createdBy, ops = null } = {}) {
  const cleanCode = sanitizeTextInput(code, 20).replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  const cleanCreator = normalizeUserId(createdBy || auth?.currentUser?.uid || '');
  if (!cleanCode || !squadId || !cleanCreator) return null;
  const payload = {
    code: cleanCode,
    squadId: String(squadId).trim(),
    createdBy: cleanCreator,
    createdAt: new Date().toISOString(),
  };
  if (ops && typeof ops.setSquadInvite === 'function') {
    await ops.setSquadInvite(cleanCode, payload);
    return payload;
  }
  const cloudDb = isBrowserRuntime ? db : null;
  if (cloudDb) {
    await setDoc(doc(cloudDb, 'squadInvites', cleanCode), payload);
  }
  return payload;
}

export async function resolveSquadByInviteCode(code, ops = null) {
  const cleanCode = sanitizeTextInput(code, 20).replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  if (!cleanCode) return null;
  if (ops && typeof ops.getSquadInvite === 'function') {
    return ops.getSquadInvite(cleanCode);
  }
  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb) return null;
  const inviteSnap = await getDoc(doc(cloudDb, 'squadInvites', cleanCode));
  if (!inviteSnap.exists()) return null;
  const inviteData = inviteSnap.data();
  const squadId = String(inviteData?.squadId || '').trim();
  if (!squadId) return null;
  const squadSnap = await getDoc(doc(cloudDb, 'squads', squadId));
  return squadSnap.exists() ? { id: squadSnap.id, ...squadSnap.data() } : null;
}

export async function deleteSquadInvite(code, ops = null) {
  const cleanCode = sanitizeTextInput(code, 20).replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  if (!cleanCode) return;
  if (ops && typeof ops.deleteSquadInvite === 'function') {
    await ops.deleteSquadInvite(cleanCode);
    return;
  }
  const cloudDb = isBrowserRuntime ? db : null;
  if (cloudDb) {
    await deleteDoc(doc(cloudDb, 'squadInvites', cleanCode)).catch(() => {});
  }
}

/**
 * Joins a squad in strict Firestore rule order:
 * 1. Add caller UID to `squads/{squadId}.memberUids`
 * 2. Write `squads/{squadId}/members/{uid}`
 */
export async function joinSquadInCloud({ squadId, uid, member, ops = null } = {}) {
  const cleanUid = normalizeUserId(uid || member?.uid || auth?.currentUser?.uid || '');
  if (!squadId || !cleanUid) return;
  clearLeftSquadId(squadId);

  if (ops) {
    if (typeof ops.addMemberUidToSquad === 'function') {
      await ops.addMemberUidToSquad(squadId, cleanUid);
    }
    if (typeof ops.saveMemberDoc === 'function') {
      await ops.saveMemberDoc(squadId, { ...member, uid: cleanUid });
    }
    return;
  }

  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb) return;

  await updateDoc(doc(cloudDb, 'squads', squadId), {
    memberUids: arrayUnion(cleanUid),
    updatedAt: new Date().toISOString(),
  });
  await saveSquadMemberToCloud(squadId, { ...member, uid: cleanUid });
}

export async function saveSquadMemberToCloud(squadId, member) {
  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb || !squadId || !member?.uid) return;
  const cleanUid = normalizeUserId(member.uid);
  if (!cleanUid) return;
  if (member.joinedAt) {
    clearLeftSquadId(squadId);
  }
  const leftSquadIds = getLeftSquadIdsSet();
  if (leftSquadIds.has(squadId)) return;

  try {
    const { email: _omitEmail, ...rawSanitizedMember } = member || {};
    const sanitizedMember = { ...rawSanitizedMember, uid: cleanUid };
    const safeActId = String(cleanUid)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 120);

    if (sanitizedMember.joinedAt) {
      const nowIso = sanitizedMember.updatedAt || new Date().toISOString();
      await setDoc(
        doc(cloudDb, 'squads', squadId, 'activities', `removed_${safeActId}`),
        {
          uid: cleanUid,
          displayName: sanitizedMember.displayName || 'Student',
          type: 'member_rejoined',
          status: 'active',
          text: 'member_rejoined',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    } else {
      try {
        const removedSnap = await getDoc(
          doc(cloudDb, 'squads', squadId, 'activities', `removed_${safeActId}`)
        );
        if (removedSnap.exists()) {
          const rData = removedSnap.data();
          if (rData?.type === 'member_removed' && rData?.status === 'removed') {
            recordLeftSquadId(squadId);
            return;
          }
        }
      } catch {}
    }

    const memberRef = doc(cloudDb, 'squads', squadId, 'members', cleanUid);
    await setDoc(memberRef, sanitizedMember, { merge: true });

    const squadRef = doc(cloudDb, 'squads', squadId);
    await updateDoc(squadRef, {
      memberUids: arrayUnion(cleanUid),
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to save squad member to cloud:', err);
  }
}

/**
 * Updates squad name, description, and weekly goal hours from the creator Admin Panel (#36).
 */
export async function updateSquadAdminDetails(squadId, { name, description, weeklyGoalHours } = {}) {
  if (!squadId) return null;
  const cleanName = sanitizeTextInput(name, 100);
  const cleanDescription = sanitizeTextInput(description, 500, true);
  const goal = Math.min(1000, Math.max(1, Number(weeklyGoalHours) || 60));
  const updatedAt = new Date().toISOString();

  const patch = {
    ...(cleanName ? { name: cleanName } : {}),
    description: cleanDescription,
    weeklyGoalHours: goal,
    updatedAt,
  };

  if (db) {
    try {
      await setDoc(doc(db, 'squads', squadId), patch, { merge: true });
    } catch {
      if (cleanName) {
        await setDoc(doc(db, 'squads', squadId), { name: cleanName, updatedAt }, { merge: true }).catch(() => {});
      }
    }
  }
  return patch;
}

/**
 * Removes a member from the squad (Admin Panel #36).
 */
export async function removeMemberFromSquad(squadId, memberUid, memberName = '', recordTombstone = true) {
  const cloudDb = isBrowserRuntime ? db : null;
  if (!squadId || !memberUid || !cloudDb) return;
  const cleanUid = normalizeUserId(memberUid);
  const cleanName = sanitizeTextInput(memberName || '', 100);
  const nowIso = new Date().toISOString();
  const markerId = `removed_${cleanUid.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

  try {
    await deleteDoc(doc(cloudDb, 'squads', squadId, 'members', cleanUid)).catch(() => {});
    await deleteDoc(doc(cloudDb, 'squads', squadId, 'presence', cleanUid)).catch(() => {});
    await updateDoc(doc(cloudDb, 'squads', squadId), {
      memberUids: arrayRemove(cleanUid),
      updatedAt: nowIso,
    }).catch(() => {});
    if (recordTombstone) {
      await setDoc(
        doc(cloudDb, 'squads', squadId, 'activities', markerId),
        {
          id: markerId,
          uid: cleanUid,
          displayName: cleanName || 'Removed Member',
          type: 'member_removed',
          status: 'removed',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to remove member from squad:', err);
  }
}

/**
 * Deletes a squad document, its subcollections, its invite lookup, and removes it from the creator's profile.
 */
export async function deleteSquadCompletely(
  squadId,
  email,
  currentUid,
  nextActiveSquadId = null,
  code = '',
  ops = null
) {
  if (!squadId) return;
  recordLeftSquadId(squadId);
  await removeSquadFromUserDoc(email, currentUid, squadId, nextActiveSquadId, ops);

  if (ops) {
    for (const sub of ['members', 'presence', 'activities', 'sessions']) {
      if (typeof ops.deleteSubcollectionDocs === 'function') {
        await ops.deleteSubcollectionDocs(sub, squadId);
      }
    }
    if (code && typeof ops.deleteSquadInvite === 'function') {
      await ops.deleteSquadInvite(code);
    }
    if (typeof ops.deleteSquadDoc === 'function') {
      await ops.deleteSquadDoc(squadId);
    }
    return;
  }

  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb) return;
  try {
    let inviteCode = code;
    if (!inviteCode) {
      const sqSnap = await getDoc(doc(cloudDb, 'squads', squadId)).catch(() => null);
      inviteCode = sqSnap && sqSnap.exists() ? sqSnap.data()?.code || '' : '';
    }
    for (const sub of ['members', 'presence', 'activities', 'sessions']) {
      const subSnap = await getDocs(collection(cloudDb, 'squads', squadId, sub)).catch(() => null);
      if (subSnap) {
        for (const d of subSnap.docs) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    }
    if (inviteCode) {
      await deleteSquadInvite(inviteCode);
    }
    await deleteDoc(doc(cloudDb, 'squads', squadId));
  } catch (err) {
    console.warn('Failed to delete squad document:', err);
  }
}

/**
 * Sets or updates the user's Live Library session in `squads/{squadId}/presence/{uid}` and `members/{uid}`.
 */
export async function setMemberLiveStatus(squadId, { uid, displayName, subject, startedAt }) {
  if (!squadId || !uid) return null;
  const cleanSubject = sanitizeTextInput(subject || 'General Study', 120) || 'General Study';
  const cleanName = sanitizeTextInput(displayName || 'Student', 100) || 'Student';
  const startIso = startedAt || new Date().toISOString();
  const nowIso = new Date().toISOString();

  const presenceDoc = {
    uid,
    displayName: cleanName,
    status: 'live',
    subject: cleanSubject,
    startedAt: startIso,
    updatedAt: nowIso,
  };

  if (db) {
    try {
      await setDoc(doc(db, 'squads', squadId, 'presence', uid), presenceDoc, { merge: true });
      await setDoc(
        doc(db, 'squads', squadId, 'members', uid),
        {
          uid,
          displayName: cleanName,
          status: 'live',
          liveSubject: cleanSubject,
          liveStartedAt: startIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to set live library status:', err);
    }
  }
  return presenceDoc;
}

/**
 * Clears the user's Live Library session when they stop studying live.
 */
export async function clearMemberLiveStatus(squadId, uid) {
  if (!squadId || !uid) return;
  if (db) {
    try {
      await deleteDoc(doc(db, 'squads', squadId, 'presence', uid)).catch(() => {});
      await setDoc(
        doc(db, 'squads', squadId, 'members', uid),
        {
          status: 'online',
          liveSubject: null,
          liveStartedAt: null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    } catch (err) {
      console.warn('Failed to clear live status:', err);
    }
  }
}

/**
 * Adds a shared note or resource item to the Squad Feed (`squads/{squadId}/activities/{noteId}`).
 */
export async function addSquadFeedNote(
  squadId,
  { id, uid, displayName, text, courseName, url, type = 'note', createdAt }
) {
  if (!squadId || !uid) return null;
  const noteId = sanitizeTextInput(id || `note-${Date.now()}`, 100);
  const cleanName = sanitizeTextInput(displayName || 'Student', 100) || 'Student';
  const cleanText = sanitizeTextInput(text, 400);
  if (!cleanText) return null;
  const cleanCourse = sanitizeTextInput(courseName || '', 120);
  const safeUrl = url ? sanitizeResourceUrl(url) : null;
  const createdIso = createdAt || new Date().toISOString();

  const noteDoc = {
    id: noteId,
    uid,
    displayName: cleanName,
    type: sanitizeTextInput(type, 32) || 'note',
    text: cleanText,
    ...(cleanCourse ? { courseName: cleanCourse } : {}),
    ...(safeUrl ? { url: safeUrl } : {}),
    createdAt: createdIso,
  };

  if (db) {
    try {
      await setDoc(doc(db, 'squads', squadId, 'activities', noteId), noteDoc);
    } catch (err) {
      console.warn('Failed to save squad feed note:', err);
    }
  }
  return noteDoc;
}

/**
 * Deletes an item from the Squad Feed (`squads/{squadId}/activities/{noteId}`).
 */
export async function deleteSquadFeedNote(squadId, noteId) {
  if (!squadId || !noteId) return;
  if (db) {
    try {
      await deleteDoc(doc(db, 'squads', squadId, 'activities', noteId));
    } catch (err) {
      console.warn('Failed to delete squad feed note:', err);
    }
  }
}

/**
 * Updates the Next Group Session box on the squad document.
 */
export async function updateSquadNextSession(squadId, nextSession) {
  if (!squadId || !nextSession) return null;
  const cleanTitle = sanitizeTextInput(nextSession.title || 'Group Study Session', 160);
  const cleanWhen = sanitizeTextInput(nextSession.when || '', 100);
  const attendees = Array.isArray(nextSession.attendees)
    ? nextSession.attendees.map((a) => sanitizeTextInput(a, 80)).filter(Boolean).slice(0, 50)
    : [];
  const attendeeUids = Array.isArray(nextSession.attendeeUids)
    ? nextSession.attendeeUids.map((u) => sanitizeTextInput(u, 120)).filter(Boolean).slice(0, 50)
    : [];

  const sessionObj = {
    title: cleanTitle,
    when: cleanWhen,
    attendees,
    attendeeUids,
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    try {
      await setDoc(
        doc(db, 'squads', squadId),
        { nextSession: sessionObj, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to update next group session:', err);
    }
  }
  return sessionObj;
}

/**
 * Sends a study nudge to a squad member and records it in the squad activity feed.
 */
export async function nudgeSquadMember(squadId, targetUid, targetName, fromUid, fromDisplayName) {
  if (!squadId || !targetUid) return;
  const sender = sanitizeTextInput(fromDisplayName || 'A squadmate', 100);
  const recipient = sanitizeTextInput(targetName || 'Squadmate', 100);
  const nowIso = new Date().toISOString();

  if (db) {
    try {
      await setDoc(
        doc(db, 'squads', squadId, 'members', targetUid),
        {
          lastNudgedBy: sender,
          lastNudgedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    } catch {}
  }

  return addSquadFeedNote(squadId, {
    id: `nudge-${Date.now()}`,
    uid: fromUid || 'system',
    displayName: sender,
    type: 'nudge',
    text: `nudged ${recipient} to lock in for a study session!`,
    createdAt: nowIso,
  });
}

// ===============================================================
// Friends System (#44) — Friend Requests & Friend Telemetry
// ===============================================================

function loadLocalFriendshipsMap() {
  const map = new Map(inMemoryFriendshipsMap);
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(FRIENDSHIPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id) {
              map.set(item.id, item);
              inMemoryFriendshipsMap.set(item.id, item);
            }
          }
        }
      }
    }
  } catch {}
  return map;
}

function saveLocalFriendshipDoc(docObj) {
  if (!docObj || !docObj.id) return;
  const map = loadLocalFriendshipsMap();
  map.set(docObj.id, docObj);
  inMemoryFriendshipsMap.set(docObj.id, docObj);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FRIENDSHIPS_STORAGE_KEY, JSON.stringify(Array.from(map.values())));
    }
  } catch {}
}

function deleteLocalFriendshipDoc(friendshipId) {
  if (!friendshipId) return;
  const map = loadLocalFriendshipsMap();
  map.delete(friendshipId);
  inMemoryFriendshipsMap.delete(friendshipId);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FRIENDSHIPS_STORAGE_KEY, JSON.stringify(Array.from(map.values())));
    }
  } catch {}
}

function withFastTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function deriveDisplayNameFromEmail(emailOrUid = '') {
  const raw = String(emailOrUid || '').trim();
  if (!raw) return 'Student';
  const local = raw.includes('@') ? raw.split('@')[0] : raw;
  const parts = local
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'Student';
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/**
 * Syncs the current user's grade-free `/friendProfiles/{uid}` projection and exact-email `/friendLookups/{emailHash}`.
 */
export async function syncFriendProfileAndLookup({ uid, email, friendProfile, ops = null } = {}) {
  const cleanUid = normalizeUserId(uid || friendProfile?.uid || auth?.currentUser?.uid || '');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!cleanUid) return;

  const profilePayload = {
    ...(friendProfile && typeof friendProfile === 'object' ? friendProfile : {}),
    uid: cleanUid,
    updatedAt: friendProfile?.updatedAt || new Date().toISOString(),
  };

  let lookupPayload = null;
  let emailHash = '';
  if (normalizedEmail) {
    emailHash = await hashEmailForLookup(normalizedEmail);
    if (emailHash) {
      lookupPayload = {
        uid: cleanUid,
        displayName:
          sanitizeTextInput(profilePayload.displayName || profilePayload.name || 'Student', 100) ||
          'Student',
        emailHash,
        updatedAt: profilePayload.updatedAt,
      };
      inMemoryFriendLookupsMap.set(emailHash, lookupPayload);
    }
  }

  if (ops) {
    if (typeof ops.setFriendProfile === 'function') {
      await ops.setFriendProfile(cleanUid, profilePayload);
    }
    if (lookupPayload && emailHash && typeof ops.setFriendLookup === 'function') {
      await ops.setFriendLookup(emailHash, lookupPayload);
    }
    return;
  }

  const cloudDb = isBrowserRuntime ? db : null;
  if (!cloudDb) return;

  const writes = [
    setDoc(doc(cloudDb, 'friendProfiles', cleanUid), profilePayload, { merge: true }).catch(
      () => {}
    ),
  ];
  if (lookupPayload && emailHash) {
    writes.push(
      setDoc(doc(cloudDb, 'friendLookups', emailHash), lookupPayload, { merge: true }).catch(
        () => {}
      )
    );
  }
  await Promise.all(writes);
}

async function resolveTargetUserForFriendRequest(rawTarget, toName, cloudDb, ops) {
  const trimmed = String(rawTarget || '').trim();
  if (!trimmed) return { ok: false, error: 'Please enter a valid student email address or ID.' };

  if (!trimmed.includes('@')) {
    const uid = normalizeUserId(trimmed);
    return {
      ok: Boolean(uid),
      uid,
      displayName: sanitizeTextInput(toName, 100) || deriveDisplayNameFromEmail(uid),
    };
  }

  const normalizedEmail = trimmed.toLowerCase();
  const emailHash = await hashEmailForLookup(normalizedEmail);
  let lookupDoc = null;

  if (ops && typeof ops.getFriendLookup === 'function') {
    lookupDoc = await ops.getFriendLookup(emailHash).catch(() => null);
  } else if (cloudDb && emailHash) {
    try {
      const snap = await withFastTimeout(getDoc(doc(cloudDb, 'friendLookups', emailHash)), 3500);
      if (snap && snap.exists()) {
        lookupDoc = snap.data();
      }
    } catch {}
  } else if (emailHash && inMemoryFriendLookupsMap.has(emailHash)) {
    lookupDoc = inMemoryFriendLookupsMap.get(emailHash);
  }

  if (!lookupDoc || !lookupDoc.uid) {
    return { ok: false, error: 'No UniSphere account found for that email address.' };
  }

  return {
    ok: true,
    uid: normalizeUserId(lookupDoc.uid),
    displayName:
      sanitizeTextInput(toName || lookupDoc.displayName || '', 100) ||
      deriveDisplayNameFromEmail(normalizedEmail),
  };
}

async function syncFriendshipToCloud(cloudDb, friendshipDoc, ops = null) {
  if (!friendshipDoc?.id) return;
  if (ops && typeof ops.setFriendship === 'function') {
    await ops.setFriendship(friendshipDoc.id, friendshipDoc);
    return;
  }
  if (!cloudDb) return;
  await withFastTimeout(
    setDoc(doc(cloudDb, 'friendships', friendshipDoc.id), friendshipDoc, { merge: true }),
    2500
  ).catch(() => {});
}

/**
 * Sends a UID-keyed friend request (resolving emails via `/friendLookups/{sha256(email)}`)
 * or auto-accepts if the target has already sent a pending request (#44).
 */
export async function sendFriendRequest({
  fromUid,
  fromEmail,
  fromName,
  toEmailOrUid,
  toName = '',
  ops = null,
} = {}) {
  const senderUid = normalizeUserId(fromUid || auth?.currentUser?.uid || fromEmail || '');
  const rawTarget = String(toEmailOrUid || '').trim();
  const cloudDb = isBrowserRuntime ? db : null;

  if (!senderUid || !rawTarget) {
    return { ok: false, error: 'Please enter a valid student email address or name.' };
  }

  if (
    rawTarget.includes('@') &&
    fromEmail &&
    rawTarget.toLowerCase() === String(fromEmail).trim().toLowerCase()
  ) {
    return { ok: false, error: 'You cannot send a friend request to yourself.' };
  }

  const targetResolution = await resolveTargetUserForFriendRequest(
    rawTarget,
    toName,
    cloudDb,
    ops
  );
  if (!targetResolution.ok) {
    return { ok: false, error: targetResolution.error };
  }

  const targetUid = targetResolution.uid;
  const friendshipId = getFriendshipId(senderUid, targetUid);
  if (!friendshipId) {
    return { ok: false, error: 'You cannot send a friend request to yourself.' };
  }

  const localMap = loadLocalFriendshipsMap();
  let existing = ops
    ? await ops.getFriendship?.(friendshipId).catch(() => null)
    : localMap.get(friendshipId) || null;

  if (cloudDb && !ops && !existing) {
    try {
      const snap = await withFastTimeout(getDoc(doc(cloudDb, 'friendships', friendshipId)), 3500);
      if (snap && snap.exists()) {
        existing = { id: snap.id, ...snap.data() };
      }
    } catch {}
  }

  if (existing && (existing.status === 'removed' || existing.status === 'declined')) {
    existing = null;
  }

  const nowIso = new Date().toISOString();

  if (existing) {
    if (existing.status === 'accepted') {
      saveLocalFriendshipDoc(existing);
      await syncFriendshipToCloud(cloudDb, existing, ops);
      return { ok: true, status: 'already_friends', friendship: existing };
    }
    const existingRecipient = normalizeUserId(existing.recipientUid || '');
    if (existing.status === 'pending' && existingRecipient === senderUid) {
      const acceptedDoc = {
        ...existing,
        id: friendshipId,
        status: 'accepted',
        updatedAt: nowIso,
      };
      saveLocalFriendshipDoc(acceptedDoc);
      await syncFriendshipToCloud(cloudDb, acceptedDoc, ops);
      return { ok: true, status: 'accepted', friendship: acceptedDoc };
    }
    const refreshedPending = {
      ...existing,
      id: friendshipId,
      updatedAt: nowIso,
    };
    saveLocalFriendshipDoc(refreshedPending);
    await syncFriendshipToCloud(cloudDb, refreshedPending, ops);
    return { ok: true, status: 'pending', friendship: refreshedPending };
  }

  const cleanSenderName =
    sanitizeTextInput(fromName || deriveDisplayNameFromEmail(fromEmail || senderUid), 100) ||
    'Student';
  const usersPair = senderUid < targetUid ? [senderUid, targetUid] : [targetUid, senderUid];

  const friendshipDoc = {
    id: friendshipId,
    users: usersPair,
    requesterUid: senderUid,
    requesterName: cleanSenderName,
    recipientUid: targetUid,
    recipientName: targetResolution.displayName,
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  saveLocalFriendshipDoc(friendshipDoc);
  await syncFriendshipToCloud(cloudDb, friendshipDoc, ops);

  return { ok: true, status: 'pending', friendship: friendshipDoc };
}

/**
 * Accepts an incoming pending friend request (#44).
 */
export async function acceptFriendRequest(
  friendshipId,
  currentUid = '',
  currentDisplayName = '',
  ops = null
) {
  if (!friendshipId) return null;
  const cloudDb = isBrowserRuntime ? db : null;
  const cleanId = String(friendshipId).trim().slice(0, 512);
  const nowIso = new Date().toISOString();
  const localMap = loadLocalFriendshipsMap();
  let existing = ops
    ? await ops.getFriendship?.(cleanId).catch(() => null)
    : localMap.get(cleanId) || null;

  if (!existing && cloudDb && !ops) {
    try {
      const snap = await withFastTimeout(getDoc(doc(cloudDb, 'friendships', cleanId)), 3500);
      if (snap && snap.exists()) {
        existing = { id: snap.id, ...snap.data() };
      }
    } catch {}
  }

  const base = existing || { id: cleanId };
  const normCurrentUid = normalizeUserId(currentUid || auth?.currentUser?.uid || '');
  const reqUid = normalizeUserId(base.requesterUid || '');
  const nextRecipientUid =
    normCurrentUid && normCurrentUid !== reqUid && normCurrentUid !== 'local_student'
      ? normCurrentUid
      : normalizeUserId(base.recipientUid || '');
  const nextRecipientName =
    sanitizeTextInput(currentDisplayName || base.recipientName || '', 100) ||
    deriveDisplayNameFromEmail(nextRecipientUid);

  const usersPair =
    reqUid && nextRecipientUid
      ? reqUid < nextRecipientUid
        ? [reqUid, nextRecipientUid]
        : [nextRecipientUid, reqUid]
      : base.users;

  const updated = {
    ...base,
    id: cleanId,
    ...(Array.isArray(usersPair) ? { users: usersPair } : {}),
    ...(nextRecipientUid ? { recipientUid: nextRecipientUid } : {}),
    ...(nextRecipientName ? { recipientName: nextRecipientName } : {}),
    status: 'accepted',
    updatedAt: nowIso,
  };
  saveLocalFriendshipDoc(updated);
  if (ops && typeof ops.updateFriendship === 'function') {
    await ops.updateFriendship(cleanId, { status: 'accepted', updatedAt: nowIso });
  } else if (ops && typeof ops.setFriendship === 'function') {
    await ops.setFriendship(cleanId, updated);
  } else if (cloudDb) {
    await withFastTimeout(
      updateDoc(doc(cloudDb, 'friendships', cleanId), {
        status: 'accepted',
        updatedAt: nowIso,
      }),
      2500
    ).catch(async () => {
      await syncFriendshipToCloud(cloudDb, updated);
    });
  }

  return updated;
}

/**
 * Declines a friend request or removes an existing friend (#44).
 */
export async function declineOrRemoveFriendship(friendshipId, _currentUid = '', ops = null) {
  if (!friendshipId) return false;
  const cloudDb = isBrowserRuntime ? db : null;
  const cleanId = String(friendshipId).trim().slice(0, 512);
  deleteLocalFriendshipDoc(cleanId);

  if (ops && typeof ops.deleteFriendship === 'function') {
    await ops.deleteFriendship(cleanId);
    return true;
  }

  if (cloudDb) {
    await withFastTimeout(deleteDoc(doc(cloudDb, 'friendships', cleanId)), 2500).catch(() => {});
  }
  return true;
}

/**
 * Fetches all friendship records involving `currentUid` using participant-scoped query (#44).
 */
export async function fetchUserFriendships(currentUid, currentDisplayName = '', ops = null) {
  const normUid = normalizeUserId(currentUid || auth?.currentUser?.uid || '');
  if (!normUid && !currentDisplayName) return [];
  const cloudDb = isBrowserRuntime ? db : null;

  const mergedMap = new Map();
  if (!ops) {
    const localMap = loadLocalFriendshipsMap();
    for (const [id, item] of localMap.entries()) {
      if (
        item &&
        item.status !== 'removed' &&
        item.status !== 'declined' &&
        doesFriendshipMatchUser(item, normUid, currentDisplayName)
      ) {
        mergedMap.set(id, item);
      }
    }
  }

  if (ops && typeof ops.queryFriendshipsForUid === 'function') {
    const rows = await ops.queryFriendshipsForUid(normUid).catch(() => []);
    for (const record of Array.isArray(rows) ? rows : []) {
      if (record && record.id && record.status !== 'removed' && record.status !== 'declined') {
        mergedMap.set(record.id, record);
      }
    }
    return Array.from(mergedMap.values());
  }

  if (cloudDb && normUid) {
    try {
      const snap = await withFastTimeout(
        getDocs(query(collection(cloudDb, 'friendships'), where('users', 'array-contains', normUid))),
        4500
      );
      snap.forEach((d) => {
        const record = { id: d.id, ...d.data() };
        if (!record || !record.id) return;
        if (record.status === 'removed' || record.status === 'declined') {
          deleteLocalFriendshipDoc(record.id);
          mergedMap.delete(record.id);
          return;
        }
        mergedMap.set(record.id, record);
        saveLocalFriendshipDoc(record);
      });
    } catch {}
  }

  return Array.from(mergedMap.values());
}

/**
 * Fetches a friend's privacy-separated `/friendProfiles/{friendUid}` doc and returns a safe summary (#44).
 */
export async function fetchFriendProfileTelemetry(
  friendUid,
  fallbackFriend = {},
  ops = null
) {
  const normUid = normalizeUserId(friendUid || fallbackFriend?.uid || '');
  const cloudDb = isBrowserRuntime ? db : null;
  let profileData = {};

  if (ops && typeof ops.getFriendProfile === 'function' && normUid) {
    profileData = (await ops.getFriendProfile(normUid).catch(() => null)) || {};
  } else if (cloudDb && normUid) {
    try {
      const snap = await withFastTimeout(getDoc(doc(cloudDb, 'friendProfiles', normUid)), 2000);
      if (snap && snap.exists()) {
        profileData = snap.data() || {};
      }
    } catch {}
  }

  return buildFriendTelemetrySummary(profileData, { ...fallbackFriend, uid: normUid });
}
