import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getWeeklyDailyMinutesMap,
  getWeeklySubjectMinutesMap,
  aggregateSquadWeeklyDays,
  aggregateSquadSubjectHours,
  getMemberWeekDaysSummary,
  formatLiveElapsed,
  canManageSquad,
  sortSquadMembers,
  deduplicateSquadMembers,
  isCurrentUserRemovedFromSquad,
  getMemberEffectiveTelemetry,
  calculateTableScrollMaxHeight,
  getFriendshipId,
  partitionFriendships,
  filterFriendsByQuery,
  buildFriendTelemetrySummary,
} from './telemetry.js';
import { sanitizeUserProfile, stripUndefinedDeep } from '../lib/authService.js';
import * as squadService from '../lib/squadService.js';

describe('Squads Redesign, Live Library, Admin (#36), Leave (#42) & Friend Calendar (#43)', () => {
  const refWednesday = new Date(2026, 10, 11, 15, 0, 0); // Wed 11 Nov 2026 (Week: Mon 9 Nov - Sun 15 Nov)

  describe('canManageSquad (#36)', () => {
    it('returns true only for the creator of the squad', () => {
      const squad = {
        id: 'squad-1',
        name: 'Meccanica Canale 2',
        createdBy: 'mat.petrini@stud.uniroma3.it',
      };
      assert.equal(canManageSquad(squad, 'mat.petrini@stud.uniroma3.it'), true);
      assert.equal(canManageSquad(squad, 'MAT.PETRINI@stud.uniroma3.it '), true);
      assert.equal(canManageSquad(squad, 'other@stud.uniroma3.it'), false);
      assert.equal(canManageSquad(null, 'mat.petrini@stud.uniroma3.it'), false);
      assert.equal(canManageSquad(squad, ''), false);
    });
  });

  describe('getWeeklyDailyMinutesMap & getWeeklySubjectMinutesMap', () => {
    it('maps only current-week study logs by date (Mon-Sun) and by subject', () => {
      const logs = [
        { id: '1', date: '2026-11-09', courseName: 'Analisi 1', durationMinutes: 90 }, // Mon
        { id: '2', date: '2026-11-09', courseName: 'Elementi di Informatica', durationMinutes: 30 }, // Mon
        { id: '3', date: '2026-11-11', courseName: 'Analisi 1', durationMinutes: 60 }, // Wed
        { id: '4', date: '2026-11-02', courseName: 'Analisi 1', durationMinutes: 180 }, // Previous week
      ];

      const dailyMap = getWeeklyDailyMinutesMap(logs, refWednesday);
      assert.equal(dailyMap['2026-11-09'], 120);
      assert.equal(dailyMap['2026-11-10'], 0);
      assert.equal(dailyMap['2026-11-11'], 60);
      assert.equal('2026-11-02' in dailyMap, false);

      const subjMap = getWeeklySubjectMinutesMap(logs, refWednesday);
      assert.equal(subjMap['Analisi 1'], 150);
      assert.equal(subjMap['Elementi di Informatica'], 30);
    });
  });

  describe('getMemberWeekDaysSummary (#43 Friend Weekly Calendar)', () => {
    it('builds a 7-day calendar and subject breakdown for an active squad member', () => {
      const friend = {
        uid: 'lorenzo@stud.uniroma3.it',
        displayName: 'Lorenzo Bianchi',
        minutesThisWeek: 210,
        currentStreak: 9,
        updatedAt: '2026-11-11T12:00:00.000Z',
        dailyMinutes: {
          '2026-11-09': 120,
          '2026-11-11': 90,
        },
        subjectMinutes: {
          'Analisi 1': 150,
          'Algebra Lineare': 60,
        },
      };

      const calendar = getMemberWeekDaysSummary(friend, refWednesday);
      assert.equal(calendar.weekDays.length, 7);
      assert.equal(calendar.weekDays[0].shortDay, 'Mon');
      assert.equal(calendar.weekDays[0].formattedDate, '9 Nov');
      assert.equal(calendar.weekDays[0].minutes, 120);
      assert.equal(calendar.weekDays[0].hours, '2h');

      assert.equal(calendar.weekDays[1].shortDay, 'Tue');
      assert.equal(calendar.weekDays[1].minutes, 0);
      assert.equal(calendar.weekDays[1].hours, '0h');

      assert.equal(calendar.weekDays[2].shortDay, 'Wed');
      assert.equal(calendar.weekDays[2].minutes, 90);
      assert.equal(calendar.weekDays[2].hours, '1h 30m');

      assert.equal(calendar.totalMinutes, 210);
      assert.equal(calendar.totalHours, '3h 30m');
      assert.equal(calendar.subjects.length, 2);
      assert.equal(calendar.subjects[0].subject, 'Analisi 1');
      assert.equal(calendar.subjects[0].hours, '2h 30m');
    });

    it('resets friend calendar days and subjects to 0h when member was last updated in a prior week', () => {
      const staleFriend = {
        uid: 'davide@stud.uniroma3.it',
        displayName: 'Davide Moretti',
        minutesThisWeek: 300,
        updatedAt: '2026-11-04T12:00:00.000Z', // Previous week
        dailyMinutes: {
          '2026-11-04': 300,
        },
        subjectMinutes: {
          'Analisi 1': 300,
        },
      };

      const calendar = getMemberWeekDaysSummary(staleFriend, refWednesday);
      assert.equal(calendar.totalMinutes, 0);
      assert.equal(calendar.totalHours, '0h');
      assert.ok(calendar.weekDays.every((d) => d.minutes === 0 && d.hours === '0h'));
      assert.equal(calendar.subjects.length, 0);
    });
  });

  describe('aggregateSquadWeeklyDays & aggregateSquadSubjectHours', () => {
    it('sums daily study minutes and subject hours across all active squad members', () => {
      const members = [
        {
          uid: 'u1',
          displayName: 'Lorenzo',
          updatedAt: '2026-11-11T10:00:00.000Z',
          dailyMinutes: { '2026-11-09': 120, '2026-11-11': 60 },
          subjectMinutes: { 'Analisi 1': 120, 'Algebra Lineare': 60 },
        },
        {
          uid: 'u2',
          displayName: 'Giulia',
          updatedAt: '2026-11-11T11:00:00.000Z',
          dailyMinutes: { '2026-11-09': 90, '2026-11-10': 60 },
          subjectMinutes: { 'Analisi 1': 90, 'Elementi di Informatica': 60 },
        },
      ];

      const squadDays = aggregateSquadWeeklyDays(members, refWednesday);
      assert.equal(squadDays.length, 7);
      assert.equal(squadDays[0].minutes, 210); // Mon: 120 + 90
      assert.equal(squadDays[0].hours, '3h 30m');
      assert.equal(squadDays[1].minutes, 60);  // Tue: 60
      assert.equal(squadDays[1].hours, '1h');
      assert.equal(squadDays[2].minutes, 60);  // Wed: 60

      const subjectHours = aggregateSquadSubjectHours(members, refWednesday);
      assert.deepEqual(
        subjectHours.map((s) => ({ subject: s.subject, hours: s.hours })),
        [
          { subject: 'Analisi 1', hours: '3h 30m' },
          { subject: 'Algebra Lineare', hours: '1h' },
          { subject: 'Elementi di Informatica', hours: '1h' },
        ]
      );
    });
  });

  describe('formatLiveElapsed & sortSquadMembers', () => {
    it('calculates elapsed live study duration from startedAt timestamp', () => {
      const nowMs = Date.parse('2026-11-11T16:15:00.000Z');
      const startedAt = '2026-11-11T15:00:00.000Z';
      const elapsed = formatLiveElapsed(startedAt, nowMs);
      assert.equal(elapsed.elapsedMinutes, 75);
      assert.equal(elapsed.formatted, '1h 15m');

      const justStarted = formatLiveElapsed(nowMs - 30 * 1000, nowMs);
      assert.equal(justStarted.elapsedMinutes, 1);
      assert.equal(justStarted.formatted, '1m');
    });

    it('sorts squad members by weekly hours, streak, or name', () => {
      const list = [
        { uid: '1', displayName: 'Matteo', minutesThisWeek: 670, currentStreak: 6 },
        { uid: '2', displayName: 'Lorenzo', minutesThisWeek: 880, currentStreak: 9 },
        { uid: '3', displayName: 'Giulia', minutesThisWeek: 735, currentStreak: 12 },
      ];

      assert.deepEqual(
        sortSquadMembers(list, 'hours').map((m) => m.displayName),
        ['Lorenzo', 'Giulia', 'Matteo']
      );
      assert.deepEqual(
        sortSquadMembers(list, 'streak').map((m) => m.displayName),
        ['Giulia', 'Lorenzo', 'Matteo']
      );
      assert.deepEqual(
        sortSquadMembers(list, 'name').map((m) => m.displayName),
        ['Giulia', 'Lorenzo', 'Matteo']
      );
    });

    it('deduplicates squad members when a user has both a legacy UID and an email doc ID ("Matteo Petrini" doubled)', () => {
      const rawMembers = [
        {
          uid: 'mat.petrini@stud.uniroma3.it',
          displayName: 'Matteo Petrini',
          minutesThisWeek: 670,
          currentStreak: 10,
          updatedAt: '2026-11-14T17:00:00.000Z',
        },
        {
          uid: 'legacy-firebase-uid-123',
          displayName: 'Matteo Petrini',
          email: 'mat.petrini@stud.uniroma3.it',
          minutesThisWeek: 0,
          currentStreak: 0,
          updatedAt: '2026-10-20T12:00:00.000Z',
        },
        {
          uid: '582910',
          displayName: 'Matteo Petrini',
          minutesThisWeek: 0,
          currentStreak: 0,
          updatedAt: '2026-10-18T12:00:00.000Z',
        },
        {
          uid: 'federico@stud.uniroma3.it',
          displayName: 'Federico Gasbarri',
          minutesThisWeek: 330,
          currentStreak: 0,
          updatedAt: '2026-11-14T10:00:00.000Z',
        },
      ];

      const { members, staleLegacyUids } = deduplicateSquadMembers(rawMembers, {
        myUid: 'mat.petrini@stud.uniroma3.it',
        myDisplayName: 'Matteo Petrini',
        studentId: '582910',
      });

      assert.equal(members.length, 2);
      const matteoEntries = members.filter((m) => m.displayName === 'Matteo Petrini');
      assert.equal(matteoEntries.length, 1);
      assert.equal(matteoEntries[0].uid, 'mat.petrini@stud.uniroma3.it');
      assert.equal(matteoEntries[0].minutesThisWeek, 670);
      assert.deepEqual(staleLegacyUids.sort(), ['582910', 'legacy-firebase-uid-123']);
    });
  });

  describe('Leave Squad Persistence Fix (#42) & Squad Service Operations', () => {
    it('preserves activeSquadId: null in sanitizeUserProfile and stripUndefinedDeep when leaving the last squad (#42)', () => {
      const prevProfile = {
        name: 'Matteo',
        activeSquadId: 'squad-old',
        squadIds: ['squad-old'],
      };
      const updated = sanitizeUserProfile(
        {
          ...prevProfile,
          activeSquadId: null,
          squadIds: [],
        },
        prevProfile,
        'mat.petrini@stud.uniroma3.it'
      );
      assert.equal(updated.activeSquadId, null);
      assert.deepEqual(updated.squadIds, []);

      const cloudPayload = stripUndefinedDeep({
        activeSquadId: updated.activeSquadId,
        squadIds: updated.squadIds,
      });
      assert.equal('activeSquadId' in cloudPayload, true);
      assert.equal(cloudPayload.activeSquadId, null);
    });

    it('exports all squad management, leave (#42), admin (#36), live library, feed, and session functions from squadService.js', () => {
      assert.equal(typeof squadService.leaveSquadCleanly, 'function');
      assert.equal(typeof squadService.updateSquadAdminDetails, 'function');
      assert.equal(typeof squadService.removeMemberFromSquad, 'function');
      assert.equal(typeof squadService.deleteSquadCompletely, 'function');
      assert.equal(typeof squadService.setMemberLiveStatus, 'function');
      assert.equal(typeof squadService.clearMemberLiveStatus, 'function');
      assert.equal(typeof squadService.addSquadFeedNote, 'function');
      assert.equal(typeof squadService.deleteSquadFeedNote, 'function');
      assert.equal(typeof squadService.updateSquadNextSession, 'function');
      assert.equal(typeof squadService.nudgeSquadMember, 'function');
    });

    it('verifies firestore.rules supports description, nextSession, dailyMinutes, subjectMinutes, and squad subcollection deletions', () => {
      const repoRoot = path.resolve(import.meta.dirname || '.', '../..');
      const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
      assert.ok(rules.includes("'description'"));
      assert.ok(rules.includes("'nextSession'"));
      assert.ok(rules.includes("'dailyMinutes'"));
      assert.ok(rules.includes("'subjectMinutes'"));
    });
  });

  describe('Squads Page Markup, Modals, Live Library, Feed Bolding & Wiring', () => {
    const repoRoot = path.resolve(import.meta.dirname || '.', '../..');

    it('renders the redesigned Squads View in pages/squads.html matching screenshot + Live Library + hidden Create/Join & Admin modals (#36, #43)', () => {
      const squadsHtml = fs.readFileSync(path.join(repoRoot, 'pages/squads.html'), 'utf8');

      // Title row links: + Create or Join a Squad, Admin Panel (hidden by default for non-creators)
      assert.match(squadsHtml, /id="btn-open-create-join-squad"/);
      assert.match(squadsHtml, /\+\s*Create or Join a Squad/);
      assert.match(squadsHtml, /id="btn-open-admin-panel"[^>]*hidden/);
      assert.match(squadsHtml, /id="btn-leave-active-squad"/);

      // 5-item summary bar
      assert.match(squadsHtml, /Active Squad/);
      assert.match(squadsHtml, /Squad Weekly Time/);
      assert.match(squadsHtml, /My Weekly Time/);
      assert.match(squadsHtml, /My Streak/);
      assert.match(squadsHtml, /Invite Code/);
      assert.match(squadsHtml, /id="btn-copy-squad-code-top"/);

      // Left card: Expanded Live Library lobby replacing Squad Goal (without Hours by Subject)
      assert.match(squadsHtml, /Live Library/);
      assert.match(squadsHtml, /id="btn-go-live-toggle"/);
      assert.match(squadsHtml, /id="squad-live-library-list"/);
      assert.doesNotMatch(squadsHtml, /<h4 class="subsection-title">Hours by Subject<\/h4>/);
      assert.doesNotMatch(squadsHtml, /id="squad-subject-hours-tbody"/);

      // Right card: Squad Members with Sort, Copy Invite, 7-day tracker, and Member table
      assert.match(squadsHtml, /Squad Members/);
      assert.match(squadsHtml, /id="squad-members-sort"/);
      assert.match(squadsHtml, /id="btn-copy-squad-code-card"/);
      assert.match(squadsHtml, /id="squad-7day-thead"/);
      assert.match(squadsHtml, /id="squad-7day-tbody"/);
      assert.match(squadsHtml, /id="squad-members-tbody"/);

      // Bottom card: Squad Feed + Next Group Session
      assert.match(squadsHtml, /Squad Feed/);
      assert.match(squadsHtml, /Recent Activity &amp; Shared Resources/);
      assert.match(squadsHtml, /id="btn-add-squad-note"/);
      assert.match(squadsHtml, /id="squad-feed-list"/);
      assert.match(squadsHtml, /Next Group Session/);
      assert.match(squadsHtml, /id="btn-toggle-session-attending"/);

      // Native <dialog> modals only opened when pressed
      assert.match(squadsHtml, /<dialog[^>]*id="modal-squad-create-join"/);
      assert.match(squadsHtml, /<dialog[^>]*id="modal-squad-admin"/);
      assert.match(squadsHtml, /<dialog[^>]*id="modal-friend-calendar"/);
      assert.match(squadsHtml, /<dialog[^>]*id="modal-go-live"/);
      assert.match(squadsHtml, /<dialog[^>]*id="modal-squad-note"/);
      assert.match(squadsHtml, /<dialog[^>]*id="modal-group-session"/);
    });

    it('wires bold author names in Squad Feed, expanded Live Library without "Go Live with ...", Friend Calendar modal (#43), Admin Panel (#36), and Leave Squad (#42) in src/app.js', () => {
      const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
      const cssSrc = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');

      assert.match(appSrc, /leaveSquadCleanly/);
      assert.match(appSrc, /canManageSquad/);
      assert.match(appSrc, /getMemberWeekDaysSummary/);
      assert.match(appSrc, /openFriendCalendarModal/);
      assert.match(appSrc, /openSquadAdminModal/);
      assert.doesNotMatch(appSrc, /Go Live with /);
      assert.doesNotMatch(appSrc, /Library is quiet/);
      assert.doesNotMatch(appSrc, /data-join-live-subject/);
      assert.match(appSrc, /<strong>\$\{escapeHtml\(item\.displayName/);
      assert.match(appSrc, /getElementById\('admin-squad-name'\)/);
      assert.match(appSrc, /getElementById\('admin-squad-description'\)/);
      assert.match(appSrc, /getElementById\('admin-squad-goal'\)/);
      assert.match(appSrc, /getElementById\('live-study-subject'\)/);
      assert.match(appSrc, /getElementById\('squad-note-course'\)/);
      assert.doesNotMatch(appSrc, /getWeeklySubjectMinutesMap\(studyLogs,\s*courses\)/);
      assert.match(cssSrc, /\.live-library-box\s*\{[\s\S]*?flex:\s*1/);
    });

    it('hides squad widgets and shows centered "Join or Create a Squad" text when not in any squad', () => {
      const squadsHtml = fs.readFileSync(path.join(repoRoot, 'pages/squads.html'), 'utf8');
      const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
      const cssSrc = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');

      assert.match(squadsHtml, /id="squads-empty-state"/);
      assert.match(squadsHtml, /Join or Create a Squad/);
      assert.match(squadsHtml, /id="squads-active-widgets"[^>]*hidden/);

      assert.match(appSrc, /getElementById\('squads-empty-state'\)/);
      assert.match(appSrc, /getElementById\('squads-active-widgets'\)/);
      assert.match(cssSrc, /\.squads-empty-state\s*\{[\s\S]*?text-align:\s*center/);
    });

    it('detects window size and sets Squad Feed height to fill Y minus 200px', () => {
      const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
      const cssSrc = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');

      // 1080px window, elementTop at 600px, 200px bottom offset -> 280px
      assert.equal(calculateTableScrollMaxHeight(1080, 600, 1280, 200), 280);

      assert.match(
        appSrc,
        /calculateTableScrollMaxHeight\(viewportHeight,\s*elementTop,\s*viewportWidth,\s*200\)/
      );
      assert.match(appSrc, /squadFeedEl\.style\.minHeight\s*=\s*`\$\{feedH\}px`/);
      assert.match(appSrc, /squadFeedEl\.style\.maxHeight\s*=\s*`\$\{feedH\}px`/);
      assert.match(cssSrc, /#squad-feed-list\s*\{[\s\S]*?overflow-y:\s*auto/);
    });

    it('properly authorizes and removes a member when clicking Remove in Admin Panel (#36)', () => {
      const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');
      const serviceSrc = fs.readFileSync(path.join(repoRoot, 'src/lib/squadService.js'), 'utf8');

      // Remove member handler must use isCurrentUserSquadCreator(activeSquad) and not re-call showModal on an already open dialog
      const removeBlockMatch = appSrc.match(
        /const removeMemberUid = target\.getAttribute\('data-admin-remove-member'\);[\s\S]*?return;\s*\}/
      );
      assert.ok(removeBlockMatch, 'data-admin-remove-member handler block should exist');
      assert.match(removeBlockMatch[0], /isCurrentUserSquadCreator\(activeSquad\)/);
      assert.doesNotMatch(removeBlockMatch[0], /openSquadAdminModal\(\)/);

      // Service must record removal so removed members stay removed even across snapshots
      assert.match(serviceSrc, /member_removed/);

      // Removed user's own browser must detect removal and immediately evict via performLeaveSquad
      assert.equal(
        isCurrentUserRemovedFromSquad(
          { id: 'sq-1', createdBy: 'admin@uni.it', memberUids: ['admin@uni.it'] },
          [{ uid: 'mario@uni.it', displayName: 'Mario Rossi', joinedAt: '2026-11-14T10:00:00.000Z' }],
          [
            {
              id: 'removed_mario_uni_it',
              uid: 'mario@uni.it',
              displayName: 'Mario Rossi',
              type: 'member_removed',
              status: 'removed',
              createdAt: '2026-11-14T12:00:00.000Z',
              updatedAt: '2026-11-14T12:00:00.000Z',
            },
          ],
          { myUid: 'mario@uni.it', myDisplayName: 'Mario Rossi', email: 'mario@uni.it' }
        ),
        true
      );

      // Squad creator must never be evicted by isCurrentUserRemovedFromSquad
      assert.equal(
        isCurrentUserRemovedFromSquad(
          { id: 'sq-1', createdBy: 'admin@uni.it', memberUids: ['admin@uni.it'] },
          [],
          [
            {
              id: 'removed_admin_uni_it',
              uid: 'admin@uni.it',
              type: 'member_removed',
              status: 'removed',
              updatedAt: '2026-11-14T12:00:00.000Z',
            },
          ],
          { myUid: 'admin@uni.it', myDisplayName: 'Admin', email: 'admin@uni.it' }
        ),
        false
      );

      // Rejoined user (joinedAt newer than removedAt) must not be evicted
      assert.equal(
        isCurrentUserRemovedFromSquad(
          { id: 'sq-1', createdBy: 'admin@uni.it', memberUids: ['admin@uni.it', 'mario@uni.it'] },
          [{ uid: 'mario@uni.it', displayName: 'Mario Rossi', joinedAt: '2026-11-14T14:00:00.000Z' }],
          [
            {
              id: 'removed_mario_uni_it',
              uid: 'mario@uni.it',
              displayName: 'Mario Rossi',
              type: 'member_removed',
              status: 'removed',
              updatedAt: '2026-11-14T12:00:00.000Z',
            },
          ],
          { myUid: 'mario@uni.it', myDisplayName: 'Mario Rossi', email: 'mario@uni.it' }
        ),
        false
      );

      assert.match(appSrc, /isCurrentUserRemovedFromSquad\(/);
    });
  });

  describe('Friends System Utilities & Privacy-Safe Telemetry (#44)', () => {
    it('builds deterministic canonical friendship IDs and rejects self-friending', () => {
      assert.equal(
        getFriendshipId('Mat.Petrini@stud.uniroma3.it ', 'lorenzo@stud.uniroma3.it'),
        'lorenzo@stud.uniroma3.it__mat.petrini@stud.uniroma3.it'
      );
      assert.equal(
        getFriendshipId('lorenzo@stud.uniroma3.it', 'mat.petrini@stud.uniroma3.it'),
        'lorenzo@stud.uniroma3.it__mat.petrini@stud.uniroma3.it'
      );
      assert.equal(getFriendshipId('mat.petrini@stud.uniroma3.it', 'MAT.PETRINI@stud.uniroma3.it'), '');
      assert.equal(getFriendshipId('', 'lorenzo@stud.uniroma3.it'), '');
    });

    it('partitions friendships into acceptedFriends, incomingRequests, and outgoingRequests', () => {
      const myUid = 'mat.petrini@stud.uniroma3.it';
      const docs = [
        {
          id: 'giulia@stud.uniroma3.it__mat.petrini@stud.uniroma3.it',
          users: ['giulia@stud.uniroma3.it', myUid],
          requesterUid: myUid,
          requesterEmail: myUid,
          requesterName: 'Matteo Petrini',
          recipientUid: 'giulia@stud.uniroma3.it',
          recipientEmail: 'giulia@stud.uniroma3.it',
          recipientName: 'Giulia Conti',
          status: 'accepted',
          createdAt: '2026-11-10T10:00:00.000Z',
          updatedAt: '2026-11-11T10:00:00.000Z',
        },
        {
          id: 'lorenzo@stud.uniroma3.it__mat.petrini@stud.uniroma3.it',
          users: ['lorenzo@stud.uniroma3.it', myUid],
          requesterUid: 'lorenzo@stud.uniroma3.it',
          requesterEmail: 'lorenzo@stud.uniroma3.it',
          requesterName: 'Lorenzo Bianchi',
          recipientUid: myUid,
          recipientEmail: myUid,
          recipientName: 'Matteo Petrini',
          status: 'pending',
          createdAt: '2026-11-12T09:00:00.000Z',
        },
        {
          id: 'davide@stud.uniroma3.it__mat.petrini@stud.uniroma3.it',
          users: ['davide@stud.uniroma3.it', myUid],
          requesterUid: myUid,
          requesterEmail: myUid,
          requesterName: 'Matteo Petrini',
          recipientUid: 'davide@stud.uniroma3.it',
          recipientEmail: 'davide@stud.uniroma3.it',
          recipientName: 'Davide Moretti',
          status: 'pending',
          createdAt: '2026-11-13T11:00:00.000Z',
        },
      ];

      const { acceptedFriends, incomingRequests, outgoingRequests } = partitionFriendships(docs, myUid);
      assert.equal(acceptedFriends.length, 1);
      assert.equal(acceptedFriends[0].uid, 'giulia@stud.uniroma3.it');
      assert.equal(acceptedFriends[0].displayName, 'Giulia Conti');

      assert.equal(incomingRequests.length, 1);
      assert.equal(incomingRequests[0].uid, 'lorenzo@stud.uniroma3.it');
      assert.equal(incomingRequests[0].displayName, 'Lorenzo Bianchi');

      assert.equal(outgoingRequests.length, 1);
      assert.equal(outgoingRequests[0].uid, 'davide@stud.uniroma3.it');
      assert.equal(outgoingRequests[0].displayName, 'Davide Moretti');
    });

    it('filters friends case-insensitively by display name or email', () => {
      const friends = [
        { uid: 'giulia@stud.uniroma3.it', email: 'giulia@stud.uniroma3.it', displayName: 'Giulia Conti' },
        { uid: 'lorenzo@stud.uniroma3.it', email: 'lorenzo@stud.uniroma3.it', displayName: 'Lorenzo Bianchi' },
      ];
      assert.equal(filterFriendsByQuery(friends, '').length, 2);
      assert.deepEqual(
        filterFriendsByQuery(friends, 'giul').map((f) => f.displayName),
        ['Giulia Conti']
      );
      assert.deepEqual(
        filterFriendsByQuery(friends, 'LORENZO@').map((f) => f.displayName),
        ['Lorenzo Bianchi']
      );
      assert.equal(filterFriendsByQuery(friends, 'nonexistent').length, 0);
    });

    it('computes privacy-safe friend telemetry summary from user doc and resets stale prior-week logs', () => {
      const userDoc = {
        name: 'Giulia Conti',
        email: 'giulia@stud.uniroma3.it',
        institution: 'Università Roma Tre',
        degreeName: 'Ingegneria Informatica',
        degreeType: 'Laurea Triennale',
        academicYear: 'Year 2',
        status: 'Enrolled',
        weeklyGoalHours: 25,
        xp: 1450,
        passwordHash: 'secret-hash-must-not-leak',
        quickNotes: 'private notes must not leak',
        checklist: 'private checklist',
        studyLogs: [
          { id: 'l1', date: '2026-11-09', courseName: 'Analisi 1', durationMinutes: 120 }, // Mon
          { id: 'l2', date: '2026-11-10', courseName: 'Fisica 1', durationMinutes: 60 },  // Tue
          { id: 'l3', date: '2026-11-11', courseName: 'Analisi 1', durationMinutes: 90 }, // Wed
          { id: 'l4', date: '2026-11-01', courseName: 'Analisi 1', durationMinutes: 300 }, // Prior week
        ],
        assignments: [
          { id: 'a1', title: 'Homework 1', status: 'completed', completedAt: new Date(2026, 10, 10, 12, 0).getTime() },
        ],
        courses: [
          { id: 'c1', title: 'Analisi 1', code: 'MAT01', semester: 'Sem 1', status: 'Active', grade: 30, cfu: 12 },
          { id: 'c2', title: 'Fisica 1', code: 'FIS01', semester: 'Sem 1', status: 'Passed', grade: 28, cfu: 9 },
        ],
      };

      const summary = buildFriendTelemetrySummary(userDoc, { uid: 'giulia@stud.uniroma3.it' }, refWednesday);
      assert.equal(summary.displayName, 'Giulia Conti');
      assert.equal(summary.institution, 'Università Roma Tre');
      assert.equal(summary.degreeName, 'Ingegneria Informatica');
      assert.equal(summary.weekTotalMinutes, 270);
      assert.equal(summary.weekTotalHours, '4h 30m');
      assert.equal(summary.currentStreak, 3);
      assert.equal(summary.tasksCompletedThisWeek, 1);
      assert.equal(summary.weekDays.length, 7);
      assert.equal(summary.weekDays[0].minutes, 120);
      assert.equal(summary.subjects.length, 2);
      assert.equal(summary.subjects[0].subject, 'Analisi 1');
      assert.equal(summary.subjects[0].hours, '3h 30m');

      // Privacy assertions: no passwordHash, quickNotes, checklist, or course grades leaked
      assert.equal('passwordHash' in summary, false);
      assert.equal('quickNotes' in summary, false);
      assert.equal('checklist' in summary, false);
      assert.equal(summary.courses.length, 2);
      assert.equal(summary.courses[0].title, 'Analisi 1');
      assert.equal('grade' in summary.courses[0], false);

      // Prior-week-only friend must show 0h for current week
      const priorOnlySummary = buildFriendTelemetrySummary(
        {
          name: 'Prior Only',
          studyLogs: [{ id: 'p1', date: '2026-11-01', courseName: 'Analisi 1', durationMinutes: 240 }],
          minutesStudiedThisWeek: 240,
          updatedAt: '2026-11-01T12:00:00.000Z',
        },
        { uid: 'prior@stud.uniroma3.it' },
        refWednesday
      );
      assert.equal(priorOnlySummary.weekTotalMinutes, 0);
      assert.equal(priorOnlySummary.weekTotalHours, '0h');
      assert.equal(priorOnlySummary.subjects.length, 0);
    });

    it('supports friend-request send, auto-accept on reverse pending, accept, and remove workflow in squadService.js', async () => {
      assert.equal(typeof squadService.sendFriendRequest, 'function');
      assert.equal(typeof squadService.acceptFriendRequest, 'function');
      assert.equal(typeof squadService.declineOrRemoveFriendship, 'function');
      assert.equal(typeof squadService.fetchUserFriendships, 'function');
      assert.equal(typeof squadService.fetchFriendProfileTelemetry, 'function');

      // Reject self-request and empty input
      const selfRes = await squadService.sendFriendRequest({
        fromUid: 'mat.petrini@stud.uniroma3.it',
        fromEmail: 'mat.petrini@stud.uniroma3.it',
        fromName: 'Matteo Petrini',
        toEmailOrUid: 'mat.petrini@stud.uniroma3.it',
      });
      assert.equal(selfRes.ok, false);
      assert.match(selfRes.error || '', /yourself/i);

      const emptyRes = await squadService.sendFriendRequest({
        fromUid: 'mat.petrini@stud.uniroma3.it',
        fromEmail: 'mat.petrini@stud.uniroma3.it',
        fromName: 'Matteo Petrini',
        toEmailOrUid: '   ',
      });
      assert.equal(emptyRes.ok, false);

      // Send pending friend request from Matteo to Lorenzo
      const sendRes = await squadService.sendFriendRequest({
        fromUid: 'mat.petrini@stud.uniroma3.it',
        fromEmail: 'mat.petrini@stud.uniroma3.it',
        fromName: 'Matteo Petrini',
        toEmailOrUid: 'lorenzo.bianchi@stud.uniroma3.it',
        toName: 'Lorenzo Bianchi',
      });
      assert.equal(sendRes.ok, true);
      assert.equal(sendRes.status, 'pending');
      assert.equal(
        sendRes.friendship.id,
        'lorenzo.bianchi@stud.uniroma3.it__mat.petrini@stud.uniroma3.it'
      );

      // Reverse request from Lorenzo to Matteo auto-accepts the pending request
      const reverseRes = await squadService.sendFriendRequest({
        fromUid: 'lorenzo.bianchi@stud.uniroma3.it',
        fromEmail: 'lorenzo.bianchi@stud.uniroma3.it',
        fromName: 'Lorenzo Bianchi',
        toEmailOrUid: 'mat.petrini@stud.uniroma3.it',
      });
      assert.equal(reverseRes.ok, true);
      assert.equal(reverseRes.status, 'accepted');
      assert.equal(reverseRes.friendship.status, 'accepted');

      // Remove friendship cleanly
      const removed = await squadService.declineOrRemoveFriendship(
        sendRes.friendship.id,
        'mat.petrini@stud.uniroma3.it'
      );
      assert.equal(removed, true);
    });

    it('verifies firestore.rules defines match /friendships/{friendshipId} and isValidFriendshipPayload (#44)', () => {
      const repoRoot = path.resolve(import.meta.dirname || '.', '../..');
      const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
      assert.match(rules, /match\s+\/friendships\/\{friendshipId\}/);
      assert.match(rules, /isValidFriendshipPayload/);
      assert.match(rules, /requesterUid/);
      assert.match(rules, /recipientUid/);
      assert.match(rules, /data\.requesterUid != data\.recipientUid/);
    });

    it('renders the Friends left sidebar + right Current Squad / Friend Infos & Stats dual view in pages/squads.html and wires real-time friends workflow in src/app.js (#44)', () => {
      const repoRoot = path.resolve(import.meta.dirname || '.', '../..');
      const squadsHtml = fs.readFileSync(path.join(repoRoot, 'pages/squads.html'), 'utf8');
      const cssSrc = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
      const appSrc = fs.readFileSync(path.join(repoRoot, 'src/app.js'), 'utf8');

      // Left Friends sidebar with search bar, requests section, and friends list
      assert.match(squadsHtml, /id="friends-sidebar"/);
      assert.match(squadsHtml, /id="form-friend-search-add"/);
      assert.match(squadsHtml, /id="friend-search-input"/);
      assert.match(squadsHtml, /id="btn-send-friend-request"/);
      assert.match(squadsHtml, /id="friends-requests-section"/);
      assert.match(squadsHtml, /id="friends-incoming-list"/);
      assert.match(squadsHtml, /id="friends-outgoing-list"/);
      assert.match(squadsHtml, /id="friends-sidebar-list"/);

      // Right main pane with Current Squad View container and Friend Infos & Stats container
      assert.match(squadsHtml, /id="squads-current-view-container"/);
      assert.match(squadsHtml, /id="friend-info-stats-view"[^>]*hidden/);
      assert.match(squadsHtml, /id="friend-view-name"/);
      assert.match(squadsHtml, /id="btn-back-to-squad-view"/);
      assert.match(squadsHtml, /id="btn-remove-friend"/);
      assert.match(squadsHtml, /id="friend-summary-weekly-time"/);
      assert.match(squadsHtml, /id="friend-summary-streak"/);
      assert.match(squadsHtml, /id="friend-view-7day-thead"/);
      assert.match(squadsHtml, /id="friend-view-7day-tbody"/);
      assert.match(squadsHtml, /id="friend-view-subjects-tbody"/);
      assert.match(squadsHtml, /id="friend-view-profile-tbody"/);
      assert.match(squadsHtml, /id="friend-view-courses-tbody"/);

      // CSS layout classes for the two-column Friends + Squads workspace
      assert.match(cssSrc, /\.squads-workspace-layout/);
      assert.match(cssSrc, /\.friends-sidebar-card/);
      assert.match(cssSrc, /\.friends-sidebar-list/);

      // App.js wiring for real-time friendships listener, cleanup, and friend stats view
      assert.match(appSrc, /subscribeToUserFriendships/);
      assert.match(appSrc, /friendshipsUnsub/);
      assert.match(appSrc, /selectedFriendDocUnsub/);
      assert.match(appSrc, /sendFriendRequest/);
      assert.match(appSrc, /acceptFriendRequest/);
      assert.match(appSrc, /declineOrRemoveFriendship/);
      assert.match(appSrc, /partitionFriendships/);
      assert.match(appSrc, /filterFriendsByQuery/);
      assert.match(appSrc, /buildFriendTelemetrySummary/);
    });
  });
});
