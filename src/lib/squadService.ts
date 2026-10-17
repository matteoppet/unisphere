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
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getEmailDocId } from './authService';
import { Squad, SquadMember } from '../types';

/**
 * Normalizes email to Firestore document ID
 */
export function getUserDocId(email?: string, uid?: string): string {
  if (email && email.trim()) {
    return getEmailDocId(email);
  }
  if (auth.currentUser?.email) {
    return getEmailDocId(auth.currentUser.email);
  }
  if (uid && uid.trim()) {
    return uid.trim();
  }
  return 'default_user';
}

/**
 * Fetches all squads belonging to the current user across devices.
 * Queries:
 * 1. user's Firestore document (users/{userDocId}) for squadIds
 * 2. squads collection where memberUids contains currentUid or user email
 * 3. squads collection where createdBy equals currentUid or user email
 */
export async function fetchUserSquads(currentUid: string, email?: string): Promise<{
  squads: Squad[];
  activeSquadId: string | null;
}> {
  const userDocId = getUserDocId(email, currentUid);
  const foundSquadsMap = new Map<string, Squad>();
  let activeSquadId: string | null = null;

  try {
    // 1. Fetch user profile doc to get stored squadIds and activeSquadId
    const userDocRef = doc(db, 'users', userDocId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.activeSquadId) {
        activeSquadId = userData.activeSquadId;
      }

      const squadIds: string[] = Array.isArray(userData.squadIds) ? userData.squadIds : [];
      // Fetch each squad doc in parallel
      const squadPromises = squadIds.map(async (id) => {
        try {
          const sqSnap = await getDoc(doc(db, 'squads', id));
          if (sqSnap.exists()) {
            return sqSnap.data() as Squad;
          }
        } catch (e) {
          console.warn(`Failed to fetch squad ${id}`, e);
        }
        return null;
      });

      const resolved = await Promise.all(squadPromises);
      resolved.forEach((sq) => {
        if (sq && sq.id) foundSquadsMap.set(sq.id, sq);
      });
    }

    // 2. Query squads where memberUids contains currentUid
    if (currentUid) {
      try {
        const qMember = query(
          collection(db, 'squads'),
          where('memberUids', 'array-contains', currentUid)
        );
        const memberSnap = await getDocs(qMember);
        memberSnap.forEach((d) => {
          const sq = d.data() as Squad;
          if (sq && sq.id) foundSquadsMap.set(sq.id, sq);
        });
      } catch (err) {
        console.warn('Error querying squads by memberUids (uid):', err);
      }
    }

    // 3. Query squads where memberUids contains user's email (if different from uid)
    if (email && email !== currentUid) {
      try {
        const qEmail = query(
          collection(db, 'squads'),
          where('memberUids', 'array-contains', email.toLowerCase().trim())
        );
        const emailSnap = await getDocs(qEmail);
        emailSnap.forEach((d) => {
          const sq = d.data() as Squad;
          if (sq && sq.id) foundSquadsMap.set(sq.id, sq);
        });
      } catch (err) {
        console.warn('Error querying squads by memberUids (email):', err);
      }
    }

    // 4. Query squads where createdBy matches currentUid or email
    try {
      const qCreated = query(
        collection(db, 'squads'),
        where('createdBy', 'in', [currentUid, email || currentUid].filter(Boolean))
      );
      const createdSnap = await getDocs(qCreated);
      createdSnap.forEach((d) => {
        const sq = d.data() as Squad;
        if (sq && sq.id) foundSquadsMap.set(sq.id, sq);
      });
    } catch {
      // IN query might fail if array is empty or index not ready, safe to ignore
    }

  } catch (err) {
    console.warn('Error syncing user squads from Firestore:', err);
  }

  const squads = Array.from(foundSquadsMap.values());
  return { squads, activeSquadId };
}

/**
 * Saves a newly joined or created squad to the user's Firestore document.
 * Keeps devices in 100% real-time sync without needing to re-enter invite codes.
 */
export async function syncSquadToUserDoc(
  email: string | undefined,
  currentUid: string,
  squadId: string,
  makeActive = true
): Promise<void> {
  const userDocId = getUserDocId(email, currentUid);
  const userRef = doc(db, 'users', userDocId);

  const updatePayload: Record<string, any> = {
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

/**
 * Updates the user's active squad selection in Firestore so their active tab persists on all devices.
 */
export async function setActiveSquadInUserDoc(
  email: string | undefined,
  currentUid: string,
  squadId: string
): Promise<void> {
  const userDocId = getUserDocId(email, currentUid);
  const userRef = doc(db, 'users', userDocId);

  try {
    await setDoc(
      userRef,
      {
        activeSquadId: squadId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to set active squad in user doc:', err);
  }
}

/**
 * Removes a squad from the user's Firestore document upon leave or deletion.
 */
export async function removeSquadFromUserDoc(
  email: string | undefined,
  currentUid: string,
  squadId: string,
  nextActiveSquadId?: string | null
): Promise<void> {
  const userDocId = getUserDocId(email, currentUid);
  const userRef = doc(db, 'users', userDocId);

  const payload: Record<string, any> = {
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
 * Adds or updates a squad member record in Firestore and ensures squad.memberUids contains the user.
 */
export async function saveSquadMemberToCloud(
  squadId: string,
  member: SquadMember
): Promise<void> {
  try {
    // 1. Member subdocument
    const memberRef = doc(db, 'squads', squadId, 'members', member.uid);
    await setDoc(memberRef, member, { merge: true });

    // 2. Ensure member is in squad's memberUids array
    const squadRef = doc(db, 'squads', squadId);
    await updateDoc(squadRef, {
      memberUids: arrayUnion(member.uid, member.email || member.uid),
    }).catch(() => {
      // Squad doc may not exist or might need setDoc
    });
  } catch (err) {
    console.warn('Failed to save squad member to cloud:', err);
  }
}

/**
 * Synchronizes any local squads into the user's Firestore profile so existing groups
 * are never lost when opening from another device.
 */
export async function backfillLocalSquadsToFirestore(
  email: string | undefined,
  currentUid: string,
  localSquads: Squad[]
): Promise<void> {
  if (!localSquads || localSquads.length === 0) return;
  const userDocId = getUserDocId(email, currentUid);
  const squadIds = localSquads.map((s) => s.id);

  try {
    // Ensure squad documents exist in Firestore
    for (const squad of localSquads) {
      const sqRef = doc(db, 'squads', squad.id);
      const snap = await getDoc(sqRef);
      if (!snap.exists()) {
        await setDoc(sqRef, {
          ...squad,
          memberUids: arrayUnion(currentUid, email || currentUid),
        });
      } else {
        await updateDoc(sqRef, {
          memberUids: arrayUnion(currentUid, email || currentUid),
        }).catch(() => {});
      }
    }

    // Add all squadIds to user document
    const userRef = doc(db, 'users', userDocId);
    await setDoc(
      userRef,
      {
        squadIds: arrayUnion(...squadIds),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to backfill local squads to Firestore:', err);
  }
}
