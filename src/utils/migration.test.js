import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateLegacyUserDoc,
  migrateLegacySquadsForUser,
  runOneTimeLegacyMigration,
} from '../lib/migrationService.js';

describe('One-Time Legacy Email-to-UID Migration Service (Milestone 2)', () => {
  it('migrates legacy /users/<emailSlug> doc to /users/<uid>, strips passwordHash, and deletes legacy doc', async () => {
    const store = new Map([
      [
        'users/mat.petrini@uni.it',
        {
          uid: 'mat.petrini@uni.it',
          email: 'Mat.Petrini@Uni.IT',
          name: 'Matteo Petrini',
          passwordHash: 'pbkdf2$secret$hash',
          courses: [{ id: 'c1', title: 'Analisi 1' }],
        },
      ],
    ]);
    const deletedPaths = [];
    const writes = [];

    const ops = {
      async getUserDoc(docId) {
        return store.get(`users/${docId}`) || null;
      },
      async setUserDoc(docId, data) {
        writes.push({ docId, data });
        store.set(`users/${docId}`, data);
      },
      async deleteUserDoc(docId) {
        deletedPaths.push(`users/${docId}`);
        store.delete(`users/${docId}`);
      },
    };

    const res = await migrateLegacyUserDoc({
      uid: 'UidMatteo99',
      email: 'Mat.Petrini@Uni.IT',
      ops,
    });

    assert.equal(res.migrated, true);
    assert.equal(res.deletedLegacy, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].docId, 'UidMatteo99');
    assert.equal(writes[0].data.uid, 'UidMatteo99');
    assert.equal(writes[0].data.email, 'mat.petrini@uni.it');
    assert.equal(writes[0].data.migratedFromEmailId, 'mat.petrini@uni.it');
    assert.equal('passwordHash' in writes[0].data, false);
    assert.deepEqual(writes[0].data.courses, [{ id: 'c1', title: 'Analisi 1' }]);
    assert.deepEqual(deletedPaths, ['users/mat.petrini@uni.it']);
  });

  it('is idempotent and never overwrites an existing /users/<uid> document', async () => {
    const existingNew = { uid: 'UidMatteo99', name: 'New Workspace', courses: [{ id: 'new-1' }] };
    const store = new Map([
      ['users/UidMatteo99', existingNew],
      ['users/mat@uni.it', { uid: 'mat@uni.it', name: 'Stale Old Workspace', passwordHash: 'old' }],
    ]);
    let setCalled = 0;

    const ops = {
      async getUserDoc(docId) {
        return store.get(`users/${docId}`) || null;
      },
      async setUserDoc() {
        setCalled += 1;
      },
      async deleteUserDoc() {},
    };

    const res = await migrateLegacyUserDoc({
      uid: 'UidMatteo99',
      email: 'mat@uni.it',
      ops,
    });

    assert.equal(res.migrated, false);
    assert.equal(setCalled, 0);
    assert.deepEqual(store.get('users/UidMatteo99'), existingNew);
  });

  it('migrates legacy email-keyed Squads, transferring createdBy + memberUids BEFORE subdocs and cleanup', async () => {
    const callOrder = [];
    const squadDoc = {
      id: 'sq-1',
      name: 'Meccanica',
      createdBy: 'mat@uni.it',
      memberUids: ['mat@uni.it', 'UidFriend2'],
      memberCount: 2,
      nextSession: {
        title: 'Review',
        when: 'Fri 10:00',
        attendees: ['Matteo', 'Friend'],
        attendeeUids: ['mat@uni.it', 'UidFriend2'],
      },
    };
    const legacyMember = { uid: 'mat@uni.it', displayName: 'Matteo', elo: 1200 };
    const legacyPresence = { uid: 'mat@uni.it', status: 'live', subject: 'Analisi 1' };

    const ops = {
      async querySquadsByMember(legacyId) {
        assert.equal(legacyId, 'mat@uni.it');
        return [structuredClone(squadDoc)];
      },
      async updateSquadDoc(squadId, patch) {
        callOrder.push({ step: 'updateSquadDoc', squadId, patch });
      },
      async getSquadMember(squadId, memberId) {
        if (memberId === 'mat@uni.it') return structuredClone(legacyMember);
        return null;
      },
      async setSquadMember(squadId, memberId, data) {
        callOrder.push({ step: 'setSquadMember', squadId, memberId, data });
      },
      async deleteSquadMember(squadId, memberId) {
        callOrder.push({ step: 'deleteSquadMember', squadId, memberId });
      },
      async getSquadPresence(squadId, memberId) {
        if (memberId === 'mat@uni.it') return structuredClone(legacyPresence);
        return null;
      },
      async setSquadPresence(squadId, memberId, data) {
        callOrder.push({ step: 'setSquadPresence', squadId, memberId, data });
      },
      async deleteSquadPresence(squadId, memberId) {
        callOrder.push({ step: 'deleteSquadPresence', squadId, memberId });
      },
    };

    const res = await migrateLegacySquadsForUser({
      uid: 'UidMatteo99',
      email: 'mat@uni.it',
      ops,
    });

    assert.deepEqual(res.migratedSquadIds, ['sq-1']);
    const stepNames = callOrder.map((c) => c.step);
    // First squad update grants uid ownership/membership BEFORE touching members/presence
    assert.equal(stepNames[0], 'updateSquadDoc');
    assert.equal(callOrder[0].patch.createdBy, 'UidMatteo99');
    assert.ok(callOrder[0].patch.addMemberUids.includes('UidMatteo99'));

    const setMemberIdx = callOrder.findIndex((c) => c.step === 'setSquadMember');
    const delMemberIdx = callOrder.findIndex((c) => c.step === 'deleteSquadMember');
    const finalSquadUpdateIdx = callOrder.length - 1;
    assert.ok(setMemberIdx > 0 && delMemberIdx > setMemberIdx);
    assert.equal(callOrder[finalSquadUpdateIdx].step, 'updateSquadDoc');
    assert.deepEqual(callOrder[finalSquadUpdateIdx].patch.removeMemberUids, ['mat@uni.it']);
    assert.deepEqual(callOrder[finalSquadUpdateIdx].patch.nextSession.attendeeUids, [
      'UidFriend2',
      'UidMatteo99',
    ]);
  });

  it('runOneTimeLegacyMigration orchestrates user doc, squad migration, and friendProfile lookup sync', async () => {
    const syncCalls = [];
    const res = await runOneTimeLegacyMigration({
      authUser: { uid: 'UidMatteo99', email: 'mat@uni.it', displayName: 'Matteo' },
      profile: { name: 'Matteo' },
      courses: [],
      studyLogs: [],
      assignments: [],
      ops: {
        getUserDoc: async (id) =>
          id === 'mat@uni.it' ? { name: 'Matteo', email: 'mat@uni.it' } : null,
        setUserDoc: async () => {},
        deleteUserDoc: async () => {},
        querySquadsByMember: async () => [],
        syncFriendProfileAndLookup: async (arg) => {
          syncCalls.push(arg);
        },
      },
    });

    assert.equal(res.userMigrated, true);
    assert.equal(syncCalls.length, 1);
    assert.equal(syncCalls[0].uid, 'UidMatteo99');
    assert.equal(syncCalls[0].email, 'mat@uni.it');
  });
});
