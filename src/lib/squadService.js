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
import { getEmailDocId, sanitizeTextInput, sanitizeResourceUrl } from './authService.js';

const LEFT_SQUADS_STORAGE_KEY = 'unisphere_workspace_left_squad_ids';

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
  if (email && email.trim()) {
    return getEmailDocId(email);
  }
  if (auth?.currentUser?.email) {
    return getEmailDocId(auth.currentUser.email);
  }
  if (uid && uid.trim()) {
    return uid.trim();
  }
  return 'default_user';
}

export async function fetchUserSquads(currentUid, email) {
  const userDocId = getUserDocId(email, currentUid);
  const foundSquadsMap = new Map();
  let activeSquadId = null;
  const leftSquadIds = getLeftSquadIdsSet();

  if (!db) {
    return { squads: [], activeSquadId: null };
  }

  try {
    const userDocRef = doc(db, 'users', userDocId);
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
          const sqSnap = await getDoc(doc(db, 'squads', id));
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

    if (currentUid) {
      try {
        const qMember = query(
          collection(db, 'squads'),
          where('memberUids', 'array-contains', currentUid)
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
        (String(sq.createdBy).toLowerCase() === String(userDocId).toLowerCase() ||
          (currentUid && String(sq.createdBy).toLowerCase() === String(currentUid).toLowerCase()));
      if (isCreator) continue;
      try {
        const removedSnap = await getDoc(
          doc(db, 'squads', sq.id, 'activities', `removed_${safeActId}`)
        );
        if (removedSnap.exists()) {
          const rData = removedSnap.data();
          if (rData?.type === 'member_removed' && rData?.status === 'removed') {
            const removedAtMs = Date.parse(String(rData.updatedAt || rData.createdAt || '')) || 1;
            const memberSnap = await getDoc(doc(db, 'squads', sq.id, 'members', userDocId)).catch(
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
  if (!db) return;
  const userDocId = getUserDocId(email, currentUid);
  const userRef = doc(db, 'users', userDocId);

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

export async function removeSquadFromUserDoc(email, currentUid, squadId, nextActiveSquadId = null) {
  recordLeftSquadId(squadId);
  if (!db) return;
  const userDocId = getUserDocId(email, currentUid);
  const userRef = doc(db, 'users', userDocId);

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
 * Cleanly removes a user from a squad across the user profile, the squad document's
 * `memberUids` array, and the squad's `members` and `presence` subcollections (#42).
 */
export async function leaveSquadCleanly(email, currentUid, squadId, nextActiveSquadId = null) {
  if (!squadId) return;
  recordLeftSquadId(squadId);
  const userDocId = getUserDocId(email, currentUid);
  const candidateUids = Array.from(
    new Set([userDocId, currentUid, auth?.currentUser?.uid].filter(Boolean))
  );

  await removeSquadFromUserDoc(email, currentUid, squadId, nextActiveSquadId);

  if (!db) return;

  try {
    const squadRef = doc(db, 'squads', squadId);
    for (const uid of candidateUids) {
      await updateDoc(squadRef, {
        memberUids: arrayRemove(uid),
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
      await deleteDoc(doc(db, 'squads', squadId, 'members', uid)).catch(() => {});
      await deleteDoc(doc(db, 'squads', squadId, 'presence', uid)).catch(() => {});
    }
  } catch (err) {
    console.warn('Notice while cleaning up squad membership on leave:', err);
  }
}

export async function saveSquadMemberToCloud(squadId, member) {
  if (!db || !squadId || !member?.uid) return;
  if (member.joinedAt) {
    clearLeftSquadId(squadId);
  }
  const leftSquadIds = getLeftSquadIdsSet();
  if (leftSquadIds.has(squadId)) return;

  try {
    const { email: _omitEmail, ...sanitizedMember } = member || {};
    const safeActId = String(sanitizedMember.uid)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 120);

    if (sanitizedMember.joinedAt) {
      const nowIso = sanitizedMember.updatedAt || new Date().toISOString();
      await setDoc(
        doc(db, 'squads', squadId, 'activities', `removed_${safeActId}`),
        {
          uid: sanitizedMember.uid,
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
          doc(db, 'squads', squadId, 'activities', `removed_${safeActId}`)
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

    const memberRef = doc(db, 'squads', squadId, 'members', sanitizedMember.uid);
    try {
      await setDoc(memberRef, sanitizedMember, { merge: true });
    } catch {
      const legacyCompatibleMember = {
        uid: sanitizedMember.uid,
        displayName: sanitizedMember.displayName || 'Student',
        color: sanitizedMember.color || '#3B77BC',
        elo: Number(sanitizedMember.elo) || 1000,
        minutesThisWeek: Number(sanitizedMember.minutesThisWeek) || 0,
        tasksThisWeek: Number(sanitizedMember.tasksThisWeek) || 0,
        currentStreak: Number(sanitizedMember.currentStreak) || 0,
        ...(sanitizedMember.joinedAt ? { joinedAt: sanitizedMember.joinedAt } : {}),
        updatedAt: sanitizedMember.updatedAt || new Date().toISOString(),
      };
      await setDoc(memberRef, legacyCompatibleMember, { merge: true }).catch(() => {});
    }

    const squadRef = doc(db, 'squads', squadId);
    await updateDoc(squadRef, {
      memberUids: arrayUnion(sanitizedMember.uid),
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
  if (!squadId || !memberUid || !db) return;
  const cleanUid = String(memberUid).trim();
  const cleanName = sanitizeTextInput(memberName || '', 100);
  const nowIso = new Date().toISOString();
  const markerId = `removed_${getEmailDocId(cleanUid) || cleanUid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  try {
    const squadRef = doc(db, 'squads', squadId);
    await updateDoc(squadRef, {
      memberUids: arrayRemove(cleanUid),
      updatedAt: nowIso,
    }).catch(() => {});
    await deleteDoc(doc(db, 'squads', squadId, 'members', cleanUid)).catch(() => {});
    await deleteDoc(doc(db, 'squads', squadId, 'presence', cleanUid)).catch(() => {});
    if (recordTombstone) {
      await setDoc(
        doc(db, 'squads', squadId, 'activities', markerId),
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
 * Deletes a squad document completely (Admin Panel #36) and removes it from the creator's user profile.
 */
export async function deleteSquadCompletely(squadId, email, currentUid, nextActiveSquadId = null) {
  if (!squadId) return;
  recordLeftSquadId(squadId);
  await removeSquadFromUserDoc(email, currentUid, squadId, nextActiveSquadId);
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'squads', squadId));
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
