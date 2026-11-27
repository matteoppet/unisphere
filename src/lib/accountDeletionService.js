import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { getEmailDocId, hashEmailForLookup, sanitizeTextInput } from './authService.js';
import { normalizeUserId } from '../utils/telemetry.js';

/**
 * Randomly selects a remaining Squad creator from eligible members, excluding `excludedUid`.
 * Returns `null` when no other members remain.
 */
export function selectRandomNextCreator(members = [], excludedUid = '', randomFn = Math.random) {
  const cleanExcluded = normalizeUserId(excludedUid);
  const eligible = (Array.isArray(members) ? members : []).filter((m) => {
    const mUid = normalizeUserId(m?.uid || '');
    return Boolean(mUid && mUid !== cleanExcluded);
  });
  if (eligible.length === 0) return null;

  const raw = Number(typeof randomFn === 'function' ? randomFn() : Math.random());
  const bounded = Number.isFinite(raw) ? Math.min(0.999999999, Math.max(0, raw)) : 0;
  const idx = Math.min(eligible.length - 1, Math.floor(bounded * eligible.length));
  const chosen = eligible[idx];
  const chosenUid = normalizeUserId(chosen.uid);
  const chosenName =
    sanitizeTextInput(chosen.name || chosen.displayName || '', 100) || 'Squad Member';

  return {
    uid: chosenUid,
    name: chosenName,
  };
}

/**
 * Removes the deleting user from `nextSession.attendeeUids` and `nextSession.attendees`.
 */
export function cleanNextSessionForUser(nextSession, excludedUid = '', excludedDisplayName = '') {
  if (!nextSession || typeof nextSession !== 'object') {
    return { nextSession: nextSession ?? null, changed: false };
  }
  const cleanExcluded = normalizeUserId(excludedUid);
  const cleanNameLower = String(excludedDisplayName || '').trim().toLowerCase();
  let changed = false;

  const prevUids = Array.isArray(nextSession.attendeeUids) ? nextSession.attendeeUids : [];
  const removedIndices = new Set();
  const nextUids = prevUids.filter((id, idx) => {
    const keep = normalizeUserId(id) !== cleanExcluded;
    if (!keep) {
      changed = true;
      removedIndices.add(idx);
    }
    return keep;
  });

  const prevNames = Array.isArray(nextSession.attendees) ? nextSession.attendees : [];
  const sameLength = prevNames.length === prevUids.length && prevUids.length > 0;
  const nextNames = prevNames.filter((name, idx) => {
    if (sameLength && removedIndices.has(idx)) {
      changed = true;
      return false;
    }
    if (cleanNameLower && String(name || '').trim().toLowerCase() === cleanNameLower) {
      changed = true;
      return false;
    }
    return true;
  });

  if (!changed) {
    return { nextSession, changed: false };
  }

  return {
    changed: true,
    nextSession: {
      ...nextSession,
      attendeeUids: nextUids,
      attendees: nextNames,
      updatedAt: new Date().toISOString(),
    },
  };
}

function classifyAuthReauthError(err) {
  const code = String(err?.code || '');
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'Incorrect password. Please try again.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Please sign in again and retry deleting your account.';
  }
  return err instanceof Error && err.message
    ? err.message
    : 'Re-authentication failed. Please verify your password and try again.';
}

export function createDefaultDeletionOps(
  dbInstance,
  firestoreApi = {
    doc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    arrayRemove,
  }
) {
  return {
    async reauthenticate(authUser, password) {
      const credential = EmailAuthProvider.credential(String(authUser.email || '').trim(), password);
      await reauthenticateWithCredential(authUser, credential);
    },
    async queryUserSquads(uid) {
      if (!dbInstance || !uid) return [];
      const snap = await firestoreApi.getDocs(
        firestoreApi.query(
          firestoreApi.collection(dbInstance, 'squads'),
          firestoreApi.where('memberUids', 'array-contains', uid)
        )
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async getSquadMembers(squadId) {
      if (!dbInstance || !squadId) return [];
      const snap = await firestoreApi.getDocs(
        firestoreApi.collection(dbInstance, 'squads', squadId, 'members')
      );
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    },
    async deleteAuthorSquadDocs(squadId, subcollection, uid) {
      if (!dbInstance || !squadId || !uid) return;
      const snap = await firestoreApi.getDocs(
        firestoreApi.query(
          firestoreApi.collection(dbInstance, 'squads', squadId, subcollection),
          firestoreApi.where('uid', '==', uid)
        )
      );
      for (const d of snap.docs) {
        await firestoreApi.deleteDoc(d.ref);
      }
    },
    async deleteSquadMemberDoc(squadId, uid) {
      if (!dbInstance || !squadId || !uid) return;
      await firestoreApi.deleteDoc(firestoreApi.doc(dbInstance, 'squads', squadId, 'members', uid));
    },
    async deleteSquadPresenceDoc(squadId, uid) {
      if (!dbInstance || !squadId || !uid) return;
      await firestoreApi.deleteDoc(
        firestoreApi.doc(dbInstance, 'squads', squadId, 'presence', uid)
      );
    },
    async updateSquadDoc(squadId, patch) {
      if (!dbInstance || !squadId || !patch) return;
      const firestorePatch = { ...patch };
      if (Array.isArray(patch.removeMemberUids) && patch.removeMemberUids.length > 0) {
        delete firestorePatch.removeMemberUids;
        firestorePatch.memberUids = firestoreApi.arrayRemove(...patch.removeMemberUids);
      }
      await firestoreApi.updateDoc(
        firestoreApi.doc(dbInstance, 'squads', squadId),
        firestorePatch
      );
    },
    async deleteAllSubcollectionDocs(squadId, subcollection) {
      if (!dbInstance || !squadId) return;
      const snap = await firestoreApi.getDocs(
        firestoreApi.collection(dbInstance, 'squads', squadId, subcollection)
      );
      for (const d of snap.docs) {
        await firestoreApi.deleteDoc(d.ref);
      }
    },
    async deleteSquadInvite(code) {
      if (!dbInstance || !code) return;
      const ref = firestoreApi.doc(dbInstance, 'squadInvites', String(code).trim().toUpperCase());
      const snap = await firestoreApi.getDoc(ref);
      if (snap.exists()) {
        await firestoreApi.deleteDoc(ref);
      }
    },
    async deleteSquadDoc(squadId) {
      if (!dbInstance || !squadId) return;
      await firestoreApi.deleteDoc(firestoreApi.doc(dbInstance, 'squads', squadId));
    },
    async deleteFriendshipsForUser(uid) {
      if (!dbInstance || !uid) return;
      const snap = await firestoreApi.getDocs(
        firestoreApi.query(
          firestoreApi.collection(dbInstance, 'friendships'),
          firestoreApi.where('users', 'array-contains', uid)
        )
      );
      for (const d of snap.docs) {
        await firestoreApi.deleteDoc(d.ref);
      }
    },
    async deleteFriendLookup(emailHash) {
      if (!dbInstance || !emailHash) return;
      const ref = firestoreApi.doc(dbInstance, 'friendLookups', emailHash);
      const snap = await firestoreApi.getDoc(ref);
      if (snap.exists()) {
        await firestoreApi.deleteDoc(ref);
      }
    },
    async deleteFriendProfile(uid) {
      if (!dbInstance || !uid) return;
      await firestoreApi.deleteDoc(firestoreApi.doc(dbInstance, 'friendProfiles', uid));
    },
    async deleteUserDoc(docId) {
      if (!dbInstance || !docId) return;
      await firestoreApi.deleteDoc(firestoreApi.doc(dbInstance, 'users', docId));
    },
    async deleteAuthUser(authUser) {
      await deleteUser(authUser);
    },
  };
}

/**
 * Executes 5-phase GDPR Art. 17 self-serve account deletion:
 * 1. Re-authenticate via password credential.
 * 2. Unsubscribe active real-time listeners.
 * 3. Delete shared Squad entries + transfer owned non-empty Squads randomly (or delete solo Squads).
 * 4. Delete friendships, friendLookups, friendProfiles, and user documents.
 * 5. Delete Firebase Auth user and clear browser storage ONLY after Phases 1-4 succeed.
 */
export async function deleteCurrentUserAccount({
  authUser,
  password,
  cleanupActiveListeners = () => {},
  clearBrowserStorage = () => {},
  randomFn = Math.random,
  ops = null,
} = {}) {
  const uid = normalizeUserId(authUser?.uid || '');
  const email = String(authUser?.email || '').trim().toLowerCase();
  const displayName = String(authUser?.displayName || '').trim();
  if (!authUser || !uid || !email) {
    return {
      ok: false,
      error: 'You must be signed in to permanently delete your account.',
      transferredSquads: 0,
      deletedSquads: 0,
    };
  }
  if (!String(password || '')) {
    return {
      ok: false,
      error: 'Please enter your current password to confirm deletion.',
      transferredSquads: 0,
      deletedSquads: 0,
    };
  }

  const effectiveOps = ops || createDefaultDeletionOps(db);

  // Phase 1: Password re-authentication first
  try {
    await effectiveOps.reauthenticate(authUser, String(password));
  } catch (reauthErr) {
    return {
      ok: false,
      error: classifyAuthReauthError(reauthErr),
      transferredSquads: 0,
      deletedSquads: 0,
    };
  }

  // Phase 2: Tear down active Firestore listeners cleanly before mutating docs
  try {
    cleanupActiveListeners();
  } catch {}

  let transferredSquads = 0;
  let deletedSquads = 0;

  const legacyEmailId = getEmailDocId(email);
  const authorIdsToDelete = Array.from(new Set([uid, legacyEmailId].filter(Boolean)));

  try {
    // Phase 3: Squads cleanup & random ownership transfer
    const userSquads = (await effectiveOps.queryUserSquads?.(uid)) || [];
    for (const sq of userSquads) {
      if (!sq?.id) continue;
      const members = (await effectiveOps.getSquadMembers?.(sq.id)) || [];
      const memberUidSet = Array.isArray(sq.memberUids)
        ? new Set(sq.memberUids.map((id) => normalizeUserId(id)).filter(Boolean))
        : null;
      const reconciledCandidates = [];
      const seenCandidateUids = new Set();
      for (const m of members) {
        const mUid = normalizeUserId(m?.uid || '');
        if (!mUid || mUid === uid || seenCandidateUids.has(mUid)) continue;
        if (memberUidSet && memberUidSet.size > 0 && !memberUidSet.has(mUid)) continue;
        seenCandidateUids.add(mUid);
        reconciledCandidates.push(m);
      }
      if (memberUidSet) {
        for (const mUid of memberUidSet) {
          if (mUid && mUid !== uid && !seenCandidateUids.has(mUid)) {
            seenCandidateUids.add(mUid);
            reconciledCandidates.push({ uid: mUid, displayName: 'Squad Member' });
          }
        }
      }

      const isCreator = normalizeUserId(sq.createdBy || '') === uid;
      const nextCreator = isCreator
        ? selectRandomNextCreator(reconciledCandidates, uid, randomFn)
        : null;

      if (isCreator && !nextCreator) {
        // Solo creator empty squad: delete all subcollection docs + invite BEFORE squad doc
        for (const sub of ['members', 'presence', 'activities', 'sessions']) {
          await effectiveOps.deleteAllSubcollectionDocs?.(sq.id, sub);
        }
        if (sq.code) {
          await effectiveOps.deleteSquadInvite?.(sq.code);
        }
        await effectiveOps.deleteSquadDoc?.(sq.id);
        deletedSquads += 1;
        continue;
      }

      // Non-empty squad (transferring creator or regular member leaving)
      const selfMemberDoc = members.find((m) => normalizeUserId(m?.uid || '') === uid);
      const resolvedMemberName =
        String(selfMemberDoc?.displayName || selfMemberDoc?.name || displayName || '').trim();

      for (const authorId of authorIdsToDelete) {
        await effectiveOps.deleteAuthorSquadDocs?.(sq.id, 'activities', authorId);
        await effectiveOps.deleteAuthorSquadDocs?.(sq.id, 'sessions', authorId);
      }
      await effectiveOps.deleteSquadMemberDoc?.(sq.id, uid);
      await effectiveOps.deleteSquadPresenceDoc?.(sq.id, uid);

      const nowIso = new Date().toISOString();
      const remainingCount = Math.max(
        0,
        memberUidSet
          ? Array.from(memberUidSet).filter((id) => id !== uid).length
          : reconciledCandidates.length
      );
      const { nextSession, changed: sessionChanged } = cleanNextSessionForUser(
        sq.nextSession,
        uid,
        resolvedMemberName
      );

      const patch = {
        removeMemberUids: [uid],
        memberCount: remainingCount,
        updatedAt: nowIso,
        ...(isCreator && nextCreator
          ? { createdBy: nextCreator.uid, creatorName: nextCreator.name }
          : {}),
        ...(sessionChanged ? { nextSession } : {}),
      };

      await effectiveOps.updateSquadDoc?.(sq.id, patch);
      if (isCreator && nextCreator) {
        transferredSquads += 1;
      }
    }

    // Phase 4: Delete personal & social graph documents
    await effectiveOps.deleteFriendshipsForUser?.(uid);
    if (email && email !== uid) {
      await effectiveOps.deleteFriendshipsForUser?.(email);
    }
    if (legacyEmailId && legacyEmailId !== uid && legacyEmailId !== email) {
      await effectiveOps.deleteFriendshipsForUser?.(legacyEmailId);
    }
    const emailHash = await hashEmailForLookup(email);
    if (emailHash) {
      await effectiveOps.deleteFriendLookup?.(emailHash);
    }
    await effectiveOps.deleteFriendProfile?.(uid);
    await effectiveOps.deleteUserDoc?.(uid);

    if (legacyEmailId && legacyEmailId !== uid) {
      await effectiveOps.deleteUserDoc?.(legacyEmailId);
    }

    // Phase 5: Delete Firebase Auth user & clear local browser state last
    await effectiveOps.deleteAuthUser(authUser);
    try {
      clearBrowserStorage();
    } catch {}

    return {
      ok: true,
      transferredSquads,
      deletedSquads,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? `Could not complete account deletion (${err.message}). Your login was preserved so you can retry.`
          : 'Could not complete account deletion. Your login was preserved so you can retry.',
      transferredSquads,
      deletedSquads,
    };
  }
}
