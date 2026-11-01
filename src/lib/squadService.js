import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { getEmailDocId } from './authService.js';

export function getUserDocId(email, uid) {
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

export async function fetchUserSquads(currentUid, email) {
  const userDocId = getUserDocId(email, currentUid);
  const foundSquadsMap = new Map();
  let activeSquadId = null;

  try {
    const userDocRef = doc(db, 'users', userDocId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.activeSquadId) {
        activeSquadId = userData.activeSquadId;
      }

      const squadIds = Array.isArray(userData.squadIds) ? userData.squadIds : [];
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
        if (sq && sq.id) foundSquadsMap.set(sq.id, sq);
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
          if (sq && sq.id) foundSquadsMap.set(sq.id, sq);
        });
      } catch (err) {
        console.warn('Error querying squads by memberUids (uid):', err);
      }
    }

    if (email && email !== currentUid) {
      try {
        const qEmail = query(
          collection(db, 'squads'),
          where('memberUids', 'array-contains', email.toLowerCase().trim())
        );
        const emailSnap = await getDocs(qEmail);
        emailSnap.forEach((d) => {
          const sq = d.data();
          if (sq && sq.id) foundSquadsMap.set(sq.id, sq);
        });
      } catch (err) {
        console.warn('Error querying squads by memberUids (email):', err);
      }
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

export async function saveSquadMemberToCloud(squadId, member) {
  try {
    const memberRef = doc(db, 'squads', squadId, 'members', member.uid);
    await setDoc(memberRef, member, { merge: true });

    const squadRef = doc(db, 'squads', squadId);
    await updateDoc(squadRef, {
      memberUids: arrayUnion(member.uid, member.email || member.uid),
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to save squad member to cloud:', err);
  }
}
