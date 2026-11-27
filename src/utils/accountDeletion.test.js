import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectRandomNextCreator,
  cleanNextSessionForUser,
  deleteCurrentUserAccount,
} from '../lib/accountDeletionService.js';

describe('GDPR Art. 17 Self-Serve Account Deletion Service (Milestone 2)', () => {
  it('selectRandomNextCreator returns null when empty or solo and selects deterministically with randomFn', () => {
    assert.equal(selectRandomNextCreator([], 'UidA'), null);
    assert.equal(selectRandomNextCreator([{ uid: 'UidA', displayName: 'Alice' }], 'UidA'), null);

    const members = [
      { uid: 'UidA', displayName: 'Alice' },
      { uid: 'UidB', displayName: 'Bob' },
      { uid: 'UidC', displayName: 'Charlie' },
    ];
    assert.deepEqual(selectRandomNextCreator(members, 'UidA', () => 0.0), {
      uid: 'UidB',
      name: 'Bob',
    });
    assert.deepEqual(selectRandomNextCreator(members, 'UidA', () => 0.9999), {
      uid: 'UidC',
      name: 'Charlie',
    });
  });

  it('cleanNextSessionForUser removes deleting user from attendeeUids and attendees cleanly', () => {
    const unchanged = cleanNextSessionForUser(
      { title: 'Review', attendeeUids: ['UidOther'], attendees: ['Other'] },
      'UidDel'
    );
    assert.equal(unchanged.changed, false);

    const cleaned = cleanNextSessionForUser(
      {
        title: 'Review',
        attendeeUids: ['UidDel', 'UidOther'],
        attendees: ['Alice', 'Other'],
      },
      'UidDel',
      'Alice'
    );
    assert.equal(cleaned.changed, true);
    assert.deepEqual(cleaned.nextSession.attendeeUids, ['UidOther']);
    assert.deepEqual(cleaned.nextSession.attendees, ['Other']);
  });

  it('aborts in Phase 1 when reauthenticateWithCredential fails, leaving listeners, Firestore, Auth, and storage untouched', async () => {
    const events = [];
    const res = await deleteCurrentUserAccount({
      authUser: { uid: 'UidDel1', email: 'del@uni.it', displayName: 'Alice' },
      password: 'wrong-password',
      cleanupActiveListeners: () => events.push('cleanupActiveListeners'),
      clearBrowserStorage: () => events.push('clearBrowserStorage'),
      ops: {
        reauthenticate: async () => {
          const err = new Error('Wrong password');
          err.code = 'auth/wrong-password';
          throw err;
        },
        queryUserSquads: async () => events.push('queryUserSquads'),
        deleteAuthUser: async () => events.push('deleteAuthUser'),
      },
    });

    assert.equal(res.ok, false);
    assert.match(res.error || '', /incorrect password/i);
    assert.deepEqual(events, []);
  });

  it('executes strict 5-phase deletion for non-empty owned squad (random transfer + shared artifact erasure) and solo empty squad', async () => {
    const log = [];
    const squads = [
      {
        id: 'sq-shared',
        code: 'SHA111',
        createdBy: 'UidDel1',
        memberUids: ['UidDel1', 'UidBob2', 'UidCara3'],
        memberCount: 3,
        nextSession: {
          title: 'Lab',
          attendees: ['Alice', 'Bob'],
          attendeeUids: ['UidDel1', 'UidBob2'],
        },
      },
      {
        id: 'sq-solo',
        code: 'SOL222',
        createdBy: 'UidDel1',
        memberUids: ['UidDel1'],
        memberCount: 1,
      },
    ];

    const res = await deleteCurrentUserAccount({
      authUser: { uid: 'UidDel1', email: 'Alice@Uni.IT', displayName: 'Alice' },
      password: 'correct-password',
      randomFn: () => 0.9, // Picks last eligible member -> Charlie / Cara
      cleanupActiveListeners: () => log.push('phase2:cleanupListeners'),
      clearBrowserStorage: () => log.push('phase5:clearStorage'),
      ops: {
        reauthenticate: async (user, pwd) => {
          assert.equal(pwd, 'correct-password');
          log.push(`phase1:reauth:${user.uid}`);
        },
        queryUserSquads: async (uid) => {
          log.push(`phase3:querySquads:${uid}`);
          return structuredClone(squads);
        },
        getSquadMembers: async (squadId) =>
          squadId === 'sq-shared'
            ? [
                { uid: 'UidDel1', displayName: 'Alice' },
                { uid: 'UidBob2', displayName: 'Bob' },
                { uid: 'UidCara3', displayName: 'Cara' },
              ]
            : [{ uid: 'UidDel1', displayName: 'Alice' }],
        deleteAuthorSquadDocs: async (squadId, sub, uid) => {
          log.push(`phase3:${squadId}:deleteAuthor:${sub}:${uid}`);
        },
        deleteSquadMemberDoc: async (squadId, uid) => {
          log.push(`phase3:${squadId}:deleteMember:${uid}`);
        },
        deleteSquadPresenceDoc: async (squadId, uid) => {
          log.push(`phase3:${squadId}:deletePresence:${uid}`);
        },
        updateSquadDoc: async (squadId, patch) => {
          log.push({ step: `phase3:${squadId}:updateSquad`, patch });
        },
        deleteAllSubcollectionDocs: async (squadId, sub) => {
          log.push(`phase3:${squadId}:deleteAll:${sub}`);
        },
        deleteSquadInvite: async (code) => {
          log.push(`phase3:deleteInvite:${code}`);
        },
        deleteSquadDoc: async (squadId) => {
          log.push(`phase3:${squadId}:deleteSquadDoc`);
        },
        deleteFriendshipsForUser: async (uid) => {
          log.push(`phase4:deleteFriendships:${uid}`);
        },
        deleteFriendLookup: async (emailHash) => {
          log.push(`phase4:deleteLookup:${emailHash}`);
        },
        deleteFriendProfile: async (uid) => {
          log.push(`phase4:deleteFriendProfile:${uid}`);
        },
        deleteUserDoc: async (docId) => {
          log.push(`phase4:deleteUser:${docId}`);
        },
        deleteAuthUser: async (user) => {
          log.push(`phase5:deleteAuthUser:${user.uid}`);
        },
      },
    });

    assert.equal(res.ok, true);
    assert.equal(res.transferredSquads, 1);
    assert.equal(res.deletedSquads, 1);

    // Phase ordering invariants
    assert.equal(log[0], 'phase1:reauth:UidDel1');
    assert.equal(log[1], 'phase2:cleanupListeners');

    // Non-empty owned squad: delete author activities/sessions + member/presence BEFORE transfer + arrayRemove
    const delActIdx = log.indexOf('phase3:sq-shared:deleteAuthor:activities:UidDel1');
    const delSessIdx = log.indexOf('phase3:sq-shared:deleteAuthor:sessions:UidDel1');
    const delMemIdx = log.indexOf('phase3:sq-shared:deleteMember:UidDel1');
    const delPresIdx = log.indexOf('phase3:sq-shared:deletePresence:UidDel1');
    const updSharedIdx = log.findIndex(
      (x) => typeof x === 'object' && x.step === 'phase3:sq-shared:updateSquad'
    );
    assert.ok(delActIdx > 1 && delSessIdx > 1 && delMemIdx > 1 && delPresIdx > 1);
    assert.ok(updSharedIdx > delMemIdx && updSharedIdx > delPresIdx);
    const sharedPatch = log[updSharedIdx].patch;
    assert.equal(sharedPatch.createdBy, 'UidCara3');
    assert.equal(sharedPatch.creatorName, 'Cara');
    assert.deepEqual(sharedPatch.removeMemberUids, ['UidDel1']);
    assert.deepEqual(sharedPatch.nextSession.attendeeUids, ['UidBob2']);
    assert.deepEqual(sharedPatch.nextSession.attendees, ['Bob']);

    // Solo owned squad: delete all subcollections + invite BEFORE deleting squad doc
    const soloDelMem = log.indexOf('phase3:sq-solo:deleteAll:members');
    const soloDelInv = log.indexOf('phase3:deleteInvite:SOL222');
    const soloDelSq = log.indexOf('phase3:sq-solo:deleteSquadDoc');
    assert.ok(soloDelInv > soloDelMem && soloDelSq > soloDelInv);

    // Phase 4 deletes personal graph, Phase 5 calls deleteAuthUser + clearStorage LAST
    const delUserIdx = log.indexOf('phase4:deleteUser:UidDel1');
    const delLegacyUserIdx = log.indexOf('phase4:deleteUser:alice@uni.it');
    const delAuthIdx = log.indexOf('phase5:deleteAuthUser:UidDel1');
    const clearStorageIdx = log.indexOf('phase5:clearStorage');
    assert.ok(delUserIdx > soloDelSq && delLegacyUserIdx > soloDelSq);
    assert.ok(delAuthIdx > delUserIdx && clearStorageIdx > delAuthIdx);
  });

  it('aborts BEFORE deleteUser and browser storage clear if a Firestore error occurs in Phase 3/4', async () => {
    let deletedAuth = false;
    let clearedStorage = false;
    const res = await deleteCurrentUserAccount({
      authUser: { uid: 'UidDel1', email: 'alice@uni.it', displayName: 'Alice' },
      password: 'correct-password',
      cleanupActiveListeners: () => {},
      clearBrowserStorage: () => {
        clearedStorage = true;
      },
      ops: {
        reauthenticate: async () => {},
        queryUserSquads: async () => [],
        deleteFriendshipsForUser: async () => {
          throw new Error('network-failure');
        },
        deleteAuthUser: async () => {
          deletedAuth = true;
        },
      },
    });

    assert.equal(res.ok, false);
    assert.match(res.error || '', /network-failure/i);
    assert.equal(deletedAuth, false);
    assert.equal(clearedStorage, false);
  });
});
