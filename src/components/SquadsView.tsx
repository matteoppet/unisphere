import React, { useState, useEffect, useRef } from 'react';
import {
  StudentProfile,
  Course,
  StudyLog,
  AssignmentItem,
  Squad,
  SquadMember,
  SquadPresence,
  SquadActivity,
  GhostSession,
  LootDropReward,
  COLOR_PALETTE,
} from '../types';
import { db, auth } from '../lib/firebase';
import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import {
  fetchUserSquads,
  syncSquadToUserDoc,
  setActiveSquadInUserDoc,
  removeSquadFromUserDoc,
  saveSquadMemberToCloud,
  backfillLocalSquadsToFirestore,
  getUserDocId,
} from '../lib/squadService';
import {
  generateSquadCode,
  calculateElo,
  rollLootDrop,
  calculateLevel,
  getPowerBorderClass,
} from '../utils/telemetry';
import {
  playMechanicalClick,
  playFuturisticChime,
  playLootDropChime,
  playPowerUp,
  playClickBeep,
} from '../utils/audio';
import { fireTaskConfetti, fireCelebrationConfetti } from '../utils/confetti';
import {
  Users,
  Swords,
  Timer,
  Zap,
  Trophy,
  Flame,
  Plus,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Play,
  Square,
  Award,
  Calendar,
  Clock,
  Compass,
  FileText,
  Download,
  Share2,
  X,
  Radio,
  BookOpen,
  Trash2,
  LogOut,
  AlertTriangle,
  Loader2,
  Shield,
  Crown,
  UserMinus,
  Edit3,
  Save,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';

interface SquadsViewProps {
  profile: StudentProfile;
  courses: Course[];
  studyLogs: StudyLog[];
  assignments: AssignmentItem[];
  onAddStudyLog: (log: Omit<StudyLog, 'id' | 'timestamp'>) => void;
  onUpdateProfileTelemetry?: (telemetry: Partial<StudentProfile>) => void;
}

const MEMBER_COLORS = COLOR_PALETTE;

export const SquadsView: React.FC<SquadsViewProps> = ({
  profile,
  courses,
  studyLogs,
  assignments,
  onAddStudyLog,
  onUpdateProfileTelemetry,
}) => {
  // Current user identifiers
  const currentUid = auth.currentUser?.uid || profile.studentId || profile.email || 'student';
  const currentUserName = profile.name || auth.currentUser?.displayName || 'Student';
  const currentUserEmail = auth.currentUser?.email || profile.email || '';
  const currentUserColor = profile.color || profile.accentColor || MEMBER_COLORS[0].hex;

  // --- Squad State & Multi-squad support ---
  const [squads, setSquads] = useState<Squad[]>(() => {
    try {
      const saved = localStorage.getItem('unisphere_squads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeSquadId, setActiveSquadId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('unisphere_active_squad_id') || profile.activeSquadId || null;
    } catch {
      return profile.activeSquadId || null;
    }
  });

  // --- Multi-Device Cloud Squad Synchronization ---
  // Syncs user's squads with Firestore database across all devices and browsers
  useEffect(() => {
    let isMounted = true;

    async function loadCloudSquads() {
      if (!currentUid && !currentUserEmail) return;
      try {
        const { squads: cloudSquads, activeSquadId: cloudActiveId } = await fetchUserSquads(
          currentUid,
          currentUserEmail
        );

        if (!isMounted) return;

        // If local storage had squads from earlier, merge them so user never loses anything
        let merged = [...cloudSquads];
        if (squads.length > 0) {
          const map = new Map<string, Squad>();
          cloudSquads.forEach((s) => map.set(s.id, s));
          let hasUnsyncedLocal = false;
          squads.forEach((localSq) => {
            if (!map.has(localSq.id)) {
              map.set(localSq.id, localSq);
              hasUnsyncedLocal = true;
            }
          });
          merged = Array.from(map.values());

          if (hasUnsyncedLocal) {
            backfillLocalSquadsToFirestore(currentUserEmail, currentUid, squads).catch(() => {});
          }
        }

        if (merged.length > 0) {
          setSquads(merged);
          try {
            localStorage.setItem('unisphere_squads', JSON.stringify(merged));
          } catch {}

          const preferredActive =
            cloudActiveId ||
            profile.activeSquadId ||
            activeSquadId ||
            (merged.length > 0 ? merged[0].id : null);

          if (preferredActive && merged.some((s) => s.id === preferredActive)) {
            setActiveSquadId(preferredActive);
            try {
              localStorage.setItem('unisphere_active_squad_id', preferredActive);
            } catch {}
          } else if (merged[0]) {
            setActiveSquadId(merged[0].id);
          }
        }
      } catch (err) {
        console.warn('Squad cloud sync error:', err);
      }
    }

    loadCloudSquads();

    // Real-time listener on user doc (users/{userDocId})
    // If a squad is created/joined from another device, auto-refresh here
    const userDocId = getUserDocId(currentUserEmail, currentUid);
    const userDocRef = doc(db, 'users', userDocId);
    const unsubUser = onSnapshot(
      userDocRef,
      async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const cloudSquadIds: string[] = Array.isArray(data.squadIds) ? data.squadIds : [];
        if (cloudSquadIds.length === 0) return;

        const currentIds = new Set(squads.map((s) => s.id));
        const missingIds = cloudSquadIds.filter((id) => !currentIds.has(id));

        if (missingIds.length > 0) {
          const { squads: updatedSquads } = await fetchUserSquads(currentUid, currentUserEmail);
          if (isMounted && updatedSquads.length > 0) {
            setSquads(updatedSquads);
            try {
              localStorage.setItem('unisphere_squads', JSON.stringify(updatedSquads));
            } catch {}
          }
        }

        if (data.activeSquadId && squads.some((s) => s.id === data.activeSquadId)) {
          setActiveSquadId(data.activeSquadId);
        }
      },
      (err) => console.warn('User squads realtime listener notice:', err)
    );

    return () => {
      isMounted = false;
      unsubUser();
    };
  }, [currentUid, currentUserEmail]);

  const handleSwitchSquad = (squadId: string) => {
    setActiveSquadId(squadId);
    setShowSwitcher(false);
    playClickBeep();
    try {
      localStorage.setItem('unisphere_active_squad_id', squadId);
    } catch {}
    setActiveSquadInUserDoc(currentUserEmail, currentUid, squadId).catch(() => {});
    onUpdateProfileTelemetry?.({ activeSquadId: squadId });
  };

  // Current active squad
  const currentSquad = squads.find((s) => s.id === activeSquadId) || squads[0] || null;

  // Creator check: only creator can delete the squad; others can leave it
  const isCreator = Boolean(
    currentSquad && (
      (currentSquad.createdBy && currentSquad.createdBy === currentUid) ||
      (auth.currentUser?.uid && currentSquad.createdBy === auth.currentUser.uid) ||
      (currentUserEmail && (currentSquad.createdBy === currentUserEmail || currentSquad.createdBy === profile.studentId)) ||
      (profile.studentId && currentSquad.createdBy === profile.studentId) ||
      (!currentSquad.createdBy && currentSquad.creatorName === currentUserName)
    )
  );

  // Real-time Squad Collections
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [presences, setPresences] = useState<SquadPresence[]>([]);
  const [activities, setActivities] = useState<SquadActivity[]>([]);
  const [ghostSessions, setGhostSessions] = useState<GhostSession[]>([]);

  // Modals & UI Controls
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showLootModal, setShowLootModal] = useState(false);
  const [currentLoot, setCurrentLoot] = useState<LootDropReward | null>(null);
  const [showWrappedModal, setShowWrappedModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'feed' | 'friends'>('feed');
  const [codeCopied, setCodeCopied] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newSquadNameInput, setNewSquadNameInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // --- Admin & Manage Squad State (Rename & Kick) ---
  const [showManageModal, setShowManageModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedSquadName, setEditedSquadName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [memberToKick, setMemberToKick] = useState<SquadMember | null>(null);
  const [showKickModal, setShowKickModal] = useState(false);
  const [kickLoading, setKickLoading] = useState(false);

  // --- Live Lock-In State ---
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [lockInCourse, setLockInCourse] = useState<string>(() => {
    return courses.find((c) => c.status === 'active')?.title || courses[0]?.title || 'General Deep Work';
  });
  const [lockInStartTime, setLockInStartTime] = useState<number | null>(null);
  const [lockInElapsedSeconds, setLockInElapsedSeconds] = useState(0);

  // --- Ghost Racing State ---
  const [activeGhostRace, setActiveGhostRace] = useState<GhostSession | null>(null);
  const [ghostRaceElapsedSeconds, setGhostRaceElapsedSeconds] = useState(0);
  const [ghostRaceActive, setGhostRaceActive] = useState(false);

  // --- Heatmap State & Calculation (20 Mon-Sun Weeks = 140 Days) ---
  const [hoveredHeatmapDay, setHoveredHeatmapDay] = useState<{
    dateStr: string;
    dayLabel: string;
    contributor: string;
    contributorColor: string;
    minutes: number;
    hasActivity: boolean;
    isFuture?: boolean;
    isToday?: boolean;
  } | null>(null);

  const WEEKS_COUNT = 20;

  const { heatmapDays, weeksHeader } = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Day of week index: Monday=0, Tuesday=1, ..., Sunday=6
    const currentDayOfWeek = (now.getDay() + 6) % 7;

    // Start of the current week (Monday)
    const thisWeekMonday = new Date(now);
    thisWeekMonday.setDate(now.getDate() - currentDayOfWeek);

    // The starting Monday 19 weeks prior (making 20 weeks total)
    const startMonday = new Date(thisWeekMonday);
    startMonday.setDate(thisWeekMonday.getDate() - (WEEKS_COUNT - 1) * 7);

    const daysList = [];
    const headersList: { weekIdx: number; monthLabel: string }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < WEEKS_COUNT; w++) {
      const weekStartDate = new Date(startMonday);
      weekStartDate.setDate(startMonday.getDate() + w * 7);

      const monthIndex = weekStartDate.getMonth();
      let monthLabel = '';
      if (monthIndex !== lastMonth) {
        monthLabel = weekStartDate.toLocaleDateString('en-US', { month: 'short' });
        lastMonth = monthIndex;
      }
      headersList.push({ weekIdx: w, monthLabel });

      // 7 days in this week column (0 = Mon, 1 = Tue, ..., 6 = Sun)
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(startMonday);
        dayDate.setDate(startMonday.getDate() + w * 7 + d);

        const year = dayDate.getFullYear();
        const month = String(dayDate.getMonth() + 1).padStart(2, '0');
        const dayNum = String(dayDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        const isToday = dayDate.getTime() === now.getTime();
        const isFuture = dayDate.getTime() > now.getTime();

        const myLogs = studyLogs.filter((l) => l.date === dateStr);
        const myMins = myLogs.reduce((acc, l) => acc + l.durationMinutes, 0);

        let contributor = currentUserName;
        let contributorColor = currentUserColor;
        let minutes = 0;

        if (!isFuture && myMins > 0) {
          contributor = currentUserName;
          contributorColor = currentUserColor;
          minutes = myMins;
        }

        daysList.push({
          dateStr,
          dayLabel: dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          contributor,
          contributorColor,
          minutes,
          hasActivity: minutes > 0,
          isToday,
          isFuture,
          dayOfWeekIndex: d,
          weekIndex: w,
        });
      }
    }

    return { heatmapDays: daysList, weeksHeader: headersList };
  }, [studyLogs, members, currentUserName, currentUserColor]);

  // Save squads to storage
  useEffect(() => {
    try {
      localStorage.setItem('unisphere_squads', JSON.stringify(squads));
      if (activeSquadId) {
        localStorage.setItem('unisphere_active_squad_id', activeSquadId);
      }
    } catch {}
  }, [squads, activeSquadId]);

  // Keep lockInCourse synced when courses load
  useEffect(() => {
    if (!lockInCourse && courses.length > 0) {
      setLockInCourse(courses.find((c) => c.status === 'active')?.title || courses[0].title);
    }
  }, [courses, lockInCourse]);

  // --- Lock-In Timer Interval ---
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLockedIn && lockInStartTime) {
      interval = setInterval(() => {
        const secs = Math.floor((Date.now() - lockInStartTime) / 1000);
        setLockInElapsedSeconds(secs);
      }, 1000);
    } else {
      setLockInElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLockedIn, lockInStartTime]);

  // --- Ghost Racing Timer Interval ---
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (ghostRaceActive && activeGhostRace) {
      interval = setInterval(() => {
        setGhostRaceElapsedSeconds((prev) => {
          const next = prev + 1;
          const targetTotalSecs = activeGhostRace.durationMinutes * 60;
          if (next >= targetTotalSecs) {
            handleCompleteGhostRace();
            return targetTotalSecs;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ghostRaceActive, activeGhostRace]);

  // --- Real-Time Firestore Sync (Only when viewing Squads view) ---
  useEffect(() => {
    if (!currentSquad) return;

    const squadId = currentSquad.id;

    // 1. Members Listener
    const membersRef = collection(db, 'squads', squadId, 'members');
    const unsubMembers = onSnapshot(
      membersRef,
      (snapshot) => {
        const list: SquadMember[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as SquadMember);
        });

        const thisWeekMins = studyLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
        const thisWeekTasks = assignments.filter((a) => a.status === 'completed').length;
        const selfMember: SquadMember = {
          uid: currentUid,
          displayName: currentUserName,
          color: currentUserColor,
          elo: calculateElo(thisWeekMins, thisWeekTasks, profile.currentStreak || 0),
          minutesThisWeek: thisWeekMins,
          tasksThisWeek: thisWeekTasks,
          currentStreak: profile.currentStreak || 1,
          joinedAt: new Date().toISOString(),
        };

        if (list.length === 0) {
          setMembers([selfMember]);
        } else if (!list.some((m) => m.uid === currentUid)) {
          setMembers([selfMember, ...list]);
        } else {
          setMembers(list);
        }
      },
      (err) => {
        console.warn('Members sync fallback to local', err);
      }
    );

    // 2. Presence Listener (Live Lock-In)
    const presenceRef = collection(db, 'squads', squadId, 'presence');
    const unsubPresence = onSnapshot(
      presenceRef,
      (snapshot) => {
        const list: SquadPresence[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as SquadPresence;
          if (data.status === 'locked-in') {
            list.push(data);
          }
        });
        setPresences(list);
      },
      (err) => {
        console.warn('Presence sync error', err);
      }
    );

    // 3. Activity Feed Listener
    const activityRef = query(
      collection(db, 'squads', squadId, 'activities'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubActivity = onSnapshot(
      activityRef,
      (snapshot) => {
        const list: SquadActivity[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as SquadActivity);
        });
        setActivities(list);
      },
      (err) => {
        console.warn('Activity sync error', err);
      }
    );

    // 4. Ghost Sessions Listener
    const sessionsRef = query(
      collection(db, 'squads', squadId, 'sessions'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubSessions = onSnapshot(
      sessionsRef,
      (snapshot) => {
        const list: GhostSession[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as GhostSession);
        });
        setGhostSessions(list);
      },
      (err) => {
        console.warn('Ghost sessions sync error', err);
      }
    );

    return () => {
      unsubMembers();
      unsubPresence();
      unsubActivity();
      unsubSessions();
    };
  }, [currentSquad?.id, currentUid, currentUserName]);

  // Sync user's telemetry into squad members whenever study logs or tasks change
  useEffect(() => {
    if (!currentSquad) return;
    const squadId = currentSquad.id;
    const thisWeekMins = studyLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
    const thisWeekTasks = assignments.filter((a) => a.status === 'completed').length;
    const userElo = calculateElo(thisWeekMins, thisWeekTasks, profile.currentStreak || 0);

    const memberDocRef = doc(db, 'squads', squadId, 'members', currentUid);
    setDoc(
      memberDocRef,
      {
        uid: currentUid,
        displayName: currentUserName,
        email: profile.email || auth.currentUser?.email || '',
        color: currentUserColor,
        elo: userElo,
        minutesThisWeek: thisWeekMins,
        tasksThisWeek: thisWeekTasks,
        currentStreak: profile.currentStreak || 1,
        joinedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch(() => {});
  }, [currentSquad?.id, studyLogs.length, assignments.length, profile.currentStreak]);

  // Keep edited squad name in sync with active squad
  useEffect(() => {
    if (currentSquad) {
      setEditedSquadName(currentSquad.name);
    }
  }, [currentSquad?.id, currentSquad?.name]);

  // --- Handlers: Squad Creation & Joining ---

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadNameInput.trim()) return;

    const squadCode = generateSquadCode();
    const newSquadId = `squad_${Date.now()}`;
    const newSquad: Squad = {
      id: newSquadId,
      name: newSquadNameInput.trim(),
      code: squadCode,
      createdAt: new Date().toISOString(),
      createdBy: currentUid,
      creatorName: currentUserName,
      memberCount: 1,
      memberUids: [currentUid],
    };

    try {
      await setDoc(doc(db, 'squads', newSquadId), newSquad);

      const thisWeekMins = studyLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
      const thisWeekTasks = assignments.filter((a) => a.status === 'completed').length;

      // Add self as first member
      const selfMember: SquadMember = {
        uid: currentUid,
        displayName: currentUserName,
        email: profile.email || '',
        color: currentUserColor,
        elo: calculateElo(thisWeekMins, thisWeekTasks, profile.currentStreak || 1),
        minutesThisWeek: thisWeekMins,
        tasksThisWeek: thisWeekTasks,
        currentStreak: profile.currentStreak || 1,
        joinedAt: new Date().toISOString(),
      };
      await saveSquadMemberToCloud(newSquadId, selfMember);

      // Post initial welcome activity
      await setDoc(doc(db, 'squads', newSquadId, 'activities', `act_${Date.now()}`), {
        id: `act_${Date.now()}`,
        uid: currentUid,
        displayName: currentUserName,
        type: 'session_complete',
        title: `Founded squad "${newSquad.name}" with invite code ${squadCode}`,
        xpEarned: 50,
        timestamp: Date.now(),
      });

      // Synchronize squad to user document in database for multi-device sync
      await syncSquadToUserDoc(currentUserEmail, currentUid, newSquadId, true);
    } catch (err) {
      console.warn('Squad firestore creation offline fallback', err);
    }

    const updated = [...squads, newSquad];
    setSquads(updated);
    setActiveSquadId(newSquadId);
    try {
      localStorage.setItem('unisphere_squads', JSON.stringify(updated));
      localStorage.setItem('unisphere_active_squad_id', newSquadId);
    } catch {}
    onUpdateProfileTelemetry?.({
      activeSquadId: newSquadId,
      squadIds: updated.map((s) => s.id),
    });
    setNewSquadNameInput('');
    setShowCreateModal(false);
    playPowerUp();
    fireCelebrationConfetti();
  };

  const handleJoinSquadByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) return;
    setJoinError(null);

    try {
      const squadsRef = collection(db, 'squads');
      const q = query(squadsRef, orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);

      let found: Squad | null = null;
      snap.forEach((docSnap) => {
        const sq = docSnap.data() as Squad;
        if (sq.code?.toUpperCase() === cleanCode) {
          found = sq;
        }
      });

      if (!found) {
        setJoinError(`No squad found with invite code "${cleanCode}". Please verify the code with your teammate.`);
        return;
      }

      const targetSquad: Squad = found;

      // Add self to squad in Firestore
      const thisWeekMins = studyLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
      const thisWeekTasks = assignments.filter((a) => a.status === 'completed').length;

      const selfMember: SquadMember = {
        uid: currentUid,
        displayName: currentUserName,
        email: currentUserEmail,
        color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)].hex,
        elo: calculateElo(thisWeekMins, thisWeekTasks, profile.currentStreak || 1),
        minutesThisWeek: thisWeekMins,
        tasksThisWeek: thisWeekTasks,
        currentStreak: profile.currentStreak || 1,
        joinedAt: new Date().toISOString(),
      };

      await saveSquadMemberToCloud(targetSquad.id, selfMember);

      // Add activity
      await setDoc(doc(db, 'squads', targetSquad.id, 'activities', `act_${Date.now()}`), {
        id: `act_${Date.now()}`,
        uid: currentUid,
        displayName: currentUserName,
        type: 'session_complete',
        title: `${currentUserName} joined the squad!`,
        xpEarned: 25,
        timestamp: Date.now(),
      }).catch(() => {});

      // Synchronize squad to user document in database for multi-device sync
      await syncSquadToUserDoc(currentUserEmail, currentUid, targetSquad.id, true);

      const updated = squads.some((s) => s.id === targetSquad.id)
        ? squads
        : [...squads, targetSquad];
      setSquads(updated);
      setActiveSquadId(targetSquad.id);
      try {
        localStorage.setItem('unisphere_squads', JSON.stringify(updated));
        localStorage.setItem('unisphere_active_squad_id', targetSquad.id);
      } catch {}
      onUpdateProfileTelemetry?.({
        activeSquadId: targetSquad.id,
        squadIds: updated.map((s) => s.id),
      });
      setJoinCodeInput('');
      setShowJoinModal(false);
      playPowerUp();
      fireCelebrationConfetti();
    } catch (err) {
      console.error('Error joining squad', err);
      setJoinError('Failed to join squad. Please try again.');
    }
  };

  const handleCopyCode = () => {
    if (!currentSquad?.code) return;
    navigator.clipboard.writeText(currentSquad.code);
    setCodeCopied(true);
    playClickBeep();
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // --- Handlers: Delete Squad (Creator only) & Leave Squad (Members) ---

  const handleDeleteSquad = async () => {
    if (!currentSquad) return;
    if (!isCreator) return;

    setActionLoading(true);
    try {
      const squadIdToDelete = currentSquad.id;

      // 1. Delete squad document in Firestore
      await deleteDoc(doc(db, 'squads', squadIdToDelete)).catch((err) =>
        console.warn('Firestore squad delete warning:', err)
      );

      // 2. Clear presence if locked in
      if (isLockedIn) {
        await deleteDoc(doc(db, 'squads', squadIdToDelete, 'presence', currentUid)).catch(() => {});
        setIsLockedIn(false);
      }

      // 3. Update local state
      const remaining = squads.filter((s) => s.id !== squadIdToDelete);
      setSquads(remaining);
      try {
        localStorage.setItem('unisphere_squads', JSON.stringify(remaining));
      } catch {}

      const nextSquad = remaining.length > 0 ? remaining[0] : null;
      setActiveSquadId(nextSquad ? nextSquad.id : null);
      try {
        if (nextSquad) {
          localStorage.setItem('unisphere_active_squad_id', nextSquad.id);
        } else {
          localStorage.removeItem('unisphere_active_squad_id');
        }
      } catch {}

      // 4. Update user document in Firestore for multi-device sync
      await removeSquadFromUserDoc(currentUserEmail, currentUid, squadIdToDelete, nextSquad ? nextSquad.id : null);
      onUpdateProfileTelemetry?.({
        activeSquadId: nextSquad ? nextSquad.id : undefined,
        squadIds: remaining.map((s) => s.id),
      });

      setShowDeleteConfirmModal(false);
      playClickBeep();
    } catch (err) {
      console.error('Failed to delete squad:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveSquad = async () => {
    if (!currentSquad) return;

    setActionLoading(true);
    try {
      const squadIdToLeave = currentSquad.id;

      // 1. Delete member record in Firestore
      await deleteDoc(doc(db, 'squads', squadIdToLeave, 'members', currentUid)).catch((err) =>
        console.warn('Firestore member delete warning:', err)
      );

      // 2. Update memberCount and memberUids on squad doc
      await updateDoc(doc(db, 'squads', squadIdToLeave), {
        memberUids: arrayRemove(currentUid),
        memberCount: increment(-1),
      }).catch(() => {});

      // 3. Clear presence if locked in
      if (isLockedIn) {
        await deleteDoc(doc(db, 'squads', squadIdToLeave, 'presence', currentUid)).catch(() => {});
        setIsLockedIn(false);
      }

      // 4. Post activity feed entry
      await setDoc(doc(db, 'squads', squadIdToLeave, 'activities', `act_${Date.now()}`), {
        id: `act_${Date.now()}`,
        uid: currentUid,
        displayName: currentUserName,
        type: 'session_complete',
        title: `${currentUserName} left the squad`,
        xpEarned: 0,
        timestamp: Date.now(),
      }).catch(() => {});

      // 5. Update local state
      const remaining = squads.filter((s) => s.id !== squadIdToLeave);
      setSquads(remaining);
      try {
        localStorage.setItem('unisphere_squads', JSON.stringify(remaining));
      } catch {}

      const nextSquad = remaining.length > 0 ? remaining[0] : null;
      setActiveSquadId(nextSquad ? nextSquad.id : null);
      try {
        if (nextSquad) {
          localStorage.setItem('unisphere_active_squad_id', nextSquad.id);
        } else {
          localStorage.removeItem('unisphere_active_squad_id');
        }
      } catch {}

      // 6. Update user document in Firestore for multi-device sync
      await removeSquadFromUserDoc(currentUserEmail, currentUid, squadIdToLeave, nextSquad ? nextSquad.id : null);
      onUpdateProfileTelemetry?.({
        activeSquadId: nextSquad ? nextSquad.id : undefined,
        squadIds: remaining.map((s) => s.id),
      });

      setShowLeaveConfirmModal(false);
      playClickBeep();
    } catch (err) {
      console.error('Failed to leave squad:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handlers: Squad Admin Controls (Rename Squad & Kick Member) ---

  const handleRenameSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSquad || !isCreator) return;
    const trimmed = editedSquadName.trim();
    if (!trimmed || trimmed === currentSquad.name) {
      setIsEditingName(false);
      return;
    }

    setRenameLoading(true);
    try {
      const squadId = currentSquad.id;
      await updateDoc(doc(db, 'squads', squadId), {
        name: trimmed,
      }).catch((err) => console.warn('Firestore squad rename warning:', err));

      const updatedSquads = squads.map((s) => (s.id === squadId ? { ...s, name: trimmed } : s));
      setSquads(updatedSquads);
      try {
        localStorage.setItem('unisphere_squads', JSON.stringify(updatedSquads));
      } catch {}

      await setDoc(doc(db, 'squads', squadId, 'activities', `act_${Date.now()}`), {
        id: `act_${Date.now()}`,
        uid: currentUid,
        displayName: currentUserName,
        type: 'session_complete',
        title: `Squad renamed to "${trimmed}" by ${currentUserName}`,
        xpEarned: 10,
        timestamp: Date.now(),
      }).catch(() => {});

      setIsEditingName(false);
      playClickBeep();
    } catch (err) {
      console.error('Failed to rename squad:', err);
    } finally {
      setRenameLoading(false);
    }
  };

  const handleKickMember = async () => {
    if (!currentSquad || !isCreator || !memberToKick) return;
    setKickLoading(true);
    try {
      const squadId = currentSquad.id;
      const uidToKick = memberToKick.uid;
      const nameToKick = memberToKick.displayName;

      // 1. Delete member record in Firestore
      await deleteDoc(doc(db, 'squads', squadId, 'members', uidToKick)).catch((err) =>
        console.warn('Member delete warning:', err)
      );

      // 2. Update memberCount and memberUids on squad doc
      await updateDoc(doc(db, 'squads', squadId), {
        memberUids: arrayRemove(uidToKick),
        memberCount: increment(-1),
      }).catch(() => {});

      // 3. Clear presence if kicked member was locked in
      await deleteDoc(doc(db, 'squads', squadId, 'presence', uidToKick)).catch(() => {});

      // 4. Post activity feed
      await setDoc(doc(db, 'squads', squadId, 'activities', `act_${Date.now()}`), {
        id: `act_${Date.now()}`,
        uid: currentUid,
        displayName: currentUserName,
        type: 'session_complete',
        title: `${nameToKick} was removed from the squad`,
        xpEarned: 0,
        timestamp: Date.now(),
      }).catch(() => {});

      // 5. Update local state
      setMembers((prev) => prev.filter((m) => m.uid !== uidToKick));
      setShowKickModal(false);
      setMemberToKick(null);
      playClickBeep();
    } catch (err) {
      console.error('Failed to kick member:', err);
    } finally {
      setKickLoading(false);
    }
  };

  // --- Handlers: Live Lock-In Focus Session ---

  const handleToggleLockIn = async () => {
    if (!currentSquad) return;
    const squadId = currentSquad.id;

    if (!isLockedIn) {
      // Start Lock-In
      const start = Date.now();
      setIsLockedIn(true);
      setLockInStartTime(start);
      playPowerUp();

      // Write presence to Firestore
      const presenceData: SquadPresence = {
        uid: currentUid,
        displayName: currentUserName,
        courseId: courses.find((c) => c.title === lockInCourse || c.shortTitle === lockInCourse)?.id || 'general',
        courseName: lockInCourse,
        startedAt: start,
        status: 'locked-in',
        color: currentUserColor,
        updatedAt: start,
      };

      try {
        await setDoc(doc(db, 'squads', squadId, 'presence', currentUid), presenceData);
      } catch (err) {
        console.warn('Presence write fallback', err);
      }
    } else {
      // Finish Lock-In Session
      const elapsedMinutes = Math.max(1, Math.round(lockInElapsedSeconds / 60));
      setIsLockedIn(false);
      setLockInStartTime(null);

      // Roll Loot Drop
      const loot = rollLootDrop(elapsedMinutes);
      setCurrentLoot(loot);
      setShowLootModal(true);
      playLootDropChime();
      fireCelebrationConfetti();

      // Clear presence in Firestore
      try {
        await setDoc(
          doc(db, 'squads', squadId, 'presence', currentUid),
          { status: 'idle', updatedAt: Date.now() },
          { merge: true }
        );

        // Record Activity Micro-Update
        await setDoc(doc(db, 'squads', squadId, 'activities', `act_${Date.now()}`), {
          id: `act_${Date.now()}`,
          uid: currentUid,
          displayName: currentUserName,
          type: 'session_complete',
          title: `Locked in on ${lockInCourse} for ${elapsedMinutes}m • Loot Drop: ${loot.title} (+${loot.xp} XP)`,
          xpEarned: loot.xp,
          timestamp: Date.now(),
        });

        // Save Ghost Session for friends to race against
        const newGhost: GhostSession = {
          id: `ghost_${Date.now()}`,
          uid: currentUid,
          memberName: currentUserName,
          courseName: lockInCourse,
          durationMinutes: elapsedMinutes,
          milestones: [
            { minute: Math.round(elapsedMinutes * 0.33), taskLabel: 'Concept mastery' },
            { minute: Math.round(elapsedMinutes * 0.66), taskLabel: 'Exercise progression' },
            { minute: elapsedMinutes, taskLabel: 'Session finale' },
          ],
          timestamp: Date.now(),
        };
        await setDoc(doc(db, 'squads', squadId, 'sessions', newGhost.id), newGhost);
      } catch (err) {
        console.warn('Lock-in end write error', err);
      }

      // Add to personal study log
      const matchedCourse = courses.find((c) => c.title === lockInCourse || c.shortTitle === lockInCourse);
      const todayStr = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      onAddStudyLog({
        courseName: matchedCourse ? matchedCourse.shortTitle : lockInCourse,
        courseId: matchedCourse?.id,
        durationMinutes: elapsedMinutes,
        date: todayStr,
        timeRange: `Squad Lock-In ${nowTime}`,
        notes: `Live Squad focus block on ${lockInCourse}. Claimed ${loot.rarity} Loot Drop: ${loot.title}.`,
        rating: 5,
        tag: 'Deep Work',
      });

      // Update user telemetry XP in profile
      if (onUpdateProfileTelemetry) {
        const nextXp = (profile.xp || 0) + loot.xp;
        onUpdateProfileTelemetry({ xp: nextXp });
      }
    }
  };

  // --- Handlers: Ghost Racing ---

  const handleStartGhostRace = (session: GhostSession) => {
    setActiveGhostRace(session);
    setGhostRaceElapsedSeconds(0);
    setGhostRaceActive(true);
    playPowerUp();
  };

  const handleCancelGhostRace = () => {
    setGhostRaceActive(false);
    setActiveGhostRace(null);
    setGhostRaceElapsedSeconds(0);
  };

  const handleCompleteGhostRace = async () => {
    if (!activeGhostRace) return;
    setGhostRaceActive(false);
    playFuturisticChime();
    fireCelebrationConfetti();

    const bonusXp = 100;
    const session = activeGhostRace;
    setActiveGhostRace(null);

    // Micro-update to feed
    if (currentSquad) {
      try {
        await setDoc(doc(db, 'squads', currentSquad.id, 'activities', `act_${Date.now()}`), {
          id: `act_${Date.now()}`,
          uid: currentUid,
          displayName: currentUserName,
          type: 'loot_drop',
          title: `Defeated ${session.memberName}'s Ghost on ${session.courseName} (${session.durationMinutes}m pace)! (+${bonusXp} XP)`,
          xpEarned: bonusXp,
          timestamp: Date.now(),
        });
      } catch {}
    }

    // Award bonus XP to student profile
    if (onUpdateProfileTelemetry) {
      onUpdateProfileTelemetry({ xp: (profile.xp || 0) + bonusXp });
    }
  };

  const handleSendCheer = async (teammateName: string) => {
    playPowerUp();
    fireTaskConfetti();
    if (currentSquad) {
      try {
        await setDoc(doc(db, 'squads', currentSquad.id, 'activities', `act_${Date.now()}`), {
          id: `act_${Date.now()}`,
          uid: currentUid,
          displayName: currentUserName,
          type: 'session_complete',
          title: `sent high-five cheer motivation to ${teammateName}! ⚡`,
          xpEarned: 10,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn('Cheer sync error', err);
      }
    }
  };

  // --- Weekly Sprint Leaderboard calculation ---
  const sortedMembers = [...members].sort((a, b) => b.elo - a.elo);
  const podiumTop3 = sortedMembers.slice(0, 3);

  // --- Sunday "Weekly Wrapped" Receipt calculations ---
  const mvpMember = sortedMembers[0] || {
    displayName: currentUserName,
    minutesThisWeek: studyLogs.reduce((acc, l) => acc + l.durationMinutes, 0),
    elo: 1250,
  };
  const nightOwlMember = sortedMembers.find((m) => m.minutesThisWeek > 120) || mvpMember;
  const clutchMember = sortedMembers[sortedMembers.length - 1] || mvpMember;
  const totalSquadHours = (members.reduce((acc, m) => acc + m.minutesThisWeek, 0) / 60).toFixed(1);

  // --- Shared Squad Modals & Dialogs (Available in both Empty and Active Views) ---
  const renderModals = () => (
    <>
      {/* 1. Create Squad Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Swords size={18} className="text-[#3B77BC] dark:text-[#689FE1]" />
                <span>Create Study Squad</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSquad} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Squad Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Math & Physics Cohort 2026"
                  value={newSquadNameInput}
                  onChange={(e) => setNewSquadNameInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#3B77BC]"
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                A 6-character invite code will be automatically provisioned for your teammates.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#3B77BC] hover:bg-[#2B5D99] text-white font-semibold">
                  Launch Squad
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 2. Join Squad Modal */}
      {showJoinModal && (
        <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Compass size={18} className="text-indigo-500" />
                <span>Join Squad via Code</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleJoinSquadByCode} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  6-Character Invite Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="e.g. X7K9LP"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full text-center tracking-widest uppercase font-mono font-bold text-base px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {joinError && <p className="text-rose-500 text-[11px]">{joinError}</p>}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowJoinModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                  Join Squad
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 3. Delete Squad Confirmation Modal (Creator only) */}
      {showDeleteConfirmModal && currentSquad && (
        <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Trash2 size={18} />
                <span>Delete Squad</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-800 dark:text-rose-300">
                    Permanently delete &quot;{currentSquad.name}&quot;?
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed">
                    As the creator of this squad, deleting it will remove the squad, leaderboard history, active study presences, and invite code for all members. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleDeleteSquad}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  <span>{actionLoading ? 'Deleting...' : 'Delete Squad'}</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 4. Leave Squad Confirmation Modal (Non-creator members) */}
      {showLeaveConfirmModal && currentSquad && (
        <Dialog open={showLeaveConfirmModal} onOpenChange={setShowLeaveConfirmModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <LogOut size={18} />
                <span>Leave Squad</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    Leave &quot;{currentSquad.name}&quot;?
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    You will be removed from this squad&apos;s members list, weekly podium, and live library lobby. You can rejoin at any time using an invite code provided by the squad creator.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => setShowLeaveConfirmModal(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleLeaveSquad}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  <span>{actionLoading ? 'Leaving...' : 'Leave Squad'}</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 5. Kick Member Confirmation Modal (Creator only) */}
      {showKickModal && memberToKick && currentSquad && (
        <Dialog open={showKickModal} onOpenChange={setShowKickModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <UserMinus size={18} />
                <span>Kick Member from Squad</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-800 dark:text-rose-300">
                    Remove &quot;{memberToKick.displayName}&quot; from {currentSquad.name}?
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed">
                    This will remove them from the squad roster, weekly ELO leaderboard, and active study sessions. They will need the invite code to rejoin.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={kickLoading}
                  onClick={() => {
                    setShowKickModal(false);
                    setMemberToKick(null);
                  }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={kickLoading}
                  onClick={handleKickMember}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  {kickLoading ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                  <span>{kickLoading ? 'Removing...' : 'Kick Member'}</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 6. Manage Squad Modal (Admin Control Section for Creator) */}
      {showManageModal && currentSquad && isCreator && (
        <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800">
            <DialogHeader className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#3B77BC]/10 border border-[#3B77BC]/30 text-[#3B77BC] dark:text-[#689FE1] flex items-center justify-center font-bold shrink-0">
                  <Shield size={18} />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Manage Squad
                  </DialogTitle>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Administrative authority for <span className="font-semibold text-zinc-800 dark:text-zinc-200">{currentSquad.name}</span>
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Card 1: Rename Squad */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-black space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Edit3 size={14} className="text-[#3B77BC]" />
                    <span>Rename Squad</span>
                  </span>
                  {!isEditingName && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditedSquadName(currentSquad.name);
                        setIsEditingName(true);
                        playClickBeep();
                      }}
                      className="h-6 text-[11px] font-semibold text-[#3B77BC] dark:text-[#689FE1] hover:bg-[#3B77BC]/10 px-2 cursor-pointer"
                    >
                      Edit Name
                    </Button>
                  )}
                </div>

                {isEditingName ? (
                  <form onSubmit={handleRenameSquad} className="space-y-2">
                    <input
                      type="text"
                      required
                      value={editedSquadName}
                      onChange={(e) => setEditedSquadName(e.target.value)}
                      placeholder="Enter squad name..."
                      className="w-full text-xs px-3 py-1.5 border border-[#3B77BC]/50 rounded-lg bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#3B77BC] font-semibold"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingName(false)}
                        className="h-7 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={renameLoading || !editedSquadName.trim()}
                        className="h-7 text-xs bg-[#3B77BC] hover:bg-[#2B5D99] text-white font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {renameLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        <span>Save Name</span>
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-black border border-zinc-200/60 dark:border-zinc-800">
                    <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {currentSquad.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                      Created {new Date(currentSquad.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Card 2: Exclusive Squad Invite Code */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-black space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Compass size={14} className="text-[#81C046]" />
                    <span>Squad Invite Code</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">Share with classmates</span>
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-black border border-zinc-200/60 dark:border-zinc-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-base font-black tracking-widest text-[#3B77BC] dark:text-[#689FE1] bg-[#3B77BC]/10 px-2.5 py-0.5 rounded">
                      {currentSquad.code}
                    </span>
                    <span className="text-[10px] text-zinc-400 hidden sm:inline">
                      (6-character code)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCopyCode}
                    className="h-7 px-3 text-xs font-bold bg-[#3B77BC] hover:bg-[#2B5D99] text-white flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                  >
                    {codeCopied ? <Check size={12} className="text-[#81C046]" /> : <Copy size={12} />}
                    <span>{codeCopied ? 'Copied!' : 'Copy Code'}</span>
                  </Button>
                </div>
              </div>

              {/* Card 3: Members Moderation (Kick out) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Users size={14} className="text-zinc-400" />
                    <span>Manage Members ({members.length})</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Creator can remove members
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-black">
                  {members.map((m) => {
                    const isSelf = m.uid === currentUid;
                    const isMemberCreator =
                      m.uid === currentSquad.createdBy ||
                      (!currentSquad.createdBy && m.displayName === currentSquad.creatorName);

                    return (
                      <div
                        key={m.uid}
                        className="p-2.5 flex items-center justify-between gap-2.5 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0"
                            style={{ backgroundColor: m.color || MEMBER_COLORS[0].hex }}
                          >
                            {m.displayName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {m.displayName}
                              </span>
                              {isMemberCreator && (
                                <span className="text-[10px] text-[#FCCF03] font-semibold flex items-center gap-0.5">
                                  <Crown size={11} className="inline text-[#FCCF03]" />
                                  Creator
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] text-[#3B77BC] dark:text-[#689FE1] font-mono font-bold">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              {m.minutesThisWeek || 0}m studied this week • {m.elo || 1000} ELO
                            </div>
                          </div>
                        </div>

                        {!isMemberCreator && !isSelf && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMemberToKick(m);
                              setShowKickModal(true);
                              playClickBeep();
                            }}
                            className="h-6 px-2 text-[11px] font-semibold text-[#DE482B] dark:text-[#F37055] border-[#DE482B]/30 hover:bg-[#DE482B]/10 cursor-pointer flex items-center gap-1 shrink-0"
                            title={`Kick ${m.displayName} from squad`}
                          >
                            <UserMinus size={12} />
                            <span>Kick Out</span>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 4: Danger Zone: Delete Squad */}
              <div className="p-3.5 rounded-xl border border-[#DE482B]/30 dark:border-[#DE482B]/30 bg-[#DE482B]/5 dark:bg-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#DE482B] dark:text-[#F37055]">
                    <AlertTriangle size={14} className="text-[#DE482B]" />
                    <span>Danger Zone: Delete Squad</span>
                  </div>
                  <p className="text-[11px] text-[#DE482B]/90 dark:text-[#F37055]/90">
                    Permanently disband &quot;{currentSquad.name}&quot; and erase all cohort records.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirmModal(true);
                    playClickBeep();
                  }}
                  className="bg-[#DE482B] hover:bg-[#BD361B] text-white font-bold text-xs h-7 px-3 shrink-0 cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  <span>Delete Squad</span>
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowManageModal(false)}
                className="cursor-pointer"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );

  // --- Render Empty State (No Squad Yet) ---
  if (!currentSquad) {
    return (
      <div className="flex-1 bg-white dark:bg-black min-h-[calc(100vh-4.5rem)] flex items-center justify-center p-4 sm:p-8 select-none transition-colors">
        <div className="w-full max-w-3xl my-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3B77BC]/10 border border-[#3B77BC]/30 text-[#3B77BC] dark:text-[#689FE1] text-xs font-semibold tracking-wide font-mono uppercase">
              <Users size={14} className="text-[#3B77BC]" />
              <span>Modular Squads Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Study With Friends &amp; Level Up Together
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
              Real-time library presence, weekly ELO sprint podiums, merged squad heatmaps, and asynchronous ghost racing. Isolated from solo views.
            </p>
          </div>

          {/* Two Sleek Action Cards Centered with Consistent ObsidianUI Borders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {/* 1. Create a Squad */}
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-2xl p-6 sm:p-7 shadow-xs dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:border-[#3B77BC]/50 hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#3B77BC]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#3B77BC]/10 dark:bg-[#3B77BC]/20 border border-[#3B77BC]/30 text-[#3B77BC] dark:text-[#689FE1] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <Swords size={22} />
                </div>
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Create a New Squad
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Provision an isolated squad cohort with live presence, shared heatmaps, ghost pace rivalry, and admin controls.
                </p>
              </div>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="w-full bg-[#3B77BC] hover:bg-[#2B5D99] text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Plus size={16} />
                <span>Create Squad</span>
              </Button>
            </div>

            {/* 2. Join via Code */}
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-2xl p-6 sm:p-7 shadow-xs dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:border-[#81C046]/50 hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#81C046]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#81C046]/10 dark:bg-[#81C046]/20 border border-[#81C046]/30 text-[#81C046] dark:text-[#95D45B] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <Compass size={22} />
                </div>
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Join via Code
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Enter an existing 6-character squad code shared by an admin to synchronize your weekly podium and telemetry.
                </p>
              </div>
              <Button
                onClick={() => setShowJoinModal(true)}
                variant="outline"
                className="w-full font-bold text-xs py-2.5 rounded-xl border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 cursor-pointer flex items-center justify-center gap-2 shadow-2xs transition-all"
              >
                <span>Enter Squad Code</span>
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // --- Render Active Squad Bento Dashboard ---
  return (
    <div className="flex-1 bg-white dark:bg-black overflow-y-auto p-2.5 sm:p-3.5 space-y-3 select-none transition-colors">
      {/* Top Squad Navigation & Switcher Header */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#3B77BC] text-white flex items-center justify-center shrink-0 font-bold shadow-2xs">
            <Users size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                {currentSquad.name}
              </h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSwitcher(!showSwitcher)}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer transition-colors"
                  title="Switch or create squad"
                >
                  <ChevronDown size={14} />
                </button>
                {showSwitcher && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowSwitcher(false)}
                    />
                    <div className="absolute left-0 mt-1 w-60 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black shadow-xl z-30 p-1.5 space-y-1">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase px-2 py-0.5">
                        Your Squads
                      </div>
                      {squads.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSwitchSquad(s.id)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                            s.id === currentSquad.id
                              ? 'bg-[#3B77BC]/10 text-[#3B77BC] dark:text-[#689FE1] font-bold'
                              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <span className="truncate">{s.name}</span>
                          {s.id === currentSquad.id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3B77BC] shrink-0 ml-1" />
                          )}
                        </button>
                      ))}
                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSwitcher(false);
                            setShowCreateModal(true);
                            playClickBeep();
                          }}
                          className="w-full text-left px-2 py-1.5 rounded text-xs text-[#3B77BC] dark:text-[#689FE1] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Create Another Squad</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSwitcher(false);
                            setShowJoinModal(true);
                            playClickBeep();
                          }}
                          className="w-full text-left px-2 py-1.5 rounded text-xs text-[#81C046] dark:text-[#95D45B] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <Compass size={13} />
                          <span>Join via Code</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {isCreator ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowManageModal(true);
                playClickBeep();
              }}
              className="h-8 text-xs font-semibold flex items-center gap-1.5 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 cursor-pointer shadow-2xs transition-colors"
              title="Manage squad, rename, members, invite code"
            >
              <Shield size={14} className="text-[#3B77BC] dark:text-[#689FE1]" />
              <span>Manage Squad</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowLeaveConfirmModal(true);
                playClickBeep();
              }}
              className="h-8 text-xs font-semibold flex items-center gap-1.5 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer shadow-2xs transition-colors"
              title="Leave this squad"
            >
              <LogOut size={14} />
              <span>Leave Squad</span>
            </Button>
          )}
        </div>
      </div>

      {/* MODULE 1: Live Library Lobby (Real-Time Presence & "Lock-In" Status Bar) */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-xl p-3 shadow-sm space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Radio size={16} className={isLockedIn ? 'text-emerald-500 animate-pulse' : 'text-zinc-400'} />
            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
              Live Library Lobby
            </span>
            <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-900/50">
              {presences.length} Studying Now
            </span>
          </div>

          {/* "Lock In" Action Controller */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isLockedIn ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase">Course:</span>
                  <select
                    value={lockInCourse}
                    onChange={(e) => setLockInCourse(e.target.value)}
                    className="text-xs py-1 px-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#3B77BC] font-medium"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.shortTitle || c.title}>
                        {c.shortTitle || c.title}
                      </option>
                    ))}
                    {courses.length === 0 && <option value="General Deep Work">General Deep Work</option>}
                  </select>
                </div>
                <Button
                  onClick={handleToggleLockIn}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-3 rounded-md flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Lock In</span>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>{lockInCourse}:</span>
                  <span>
                    {Math.floor(lockInElapsedSeconds / 60)}m {lockInElapsedSeconds % 60}s
                  </span>
                </div>
                <Button
                  onClick={handleToggleLockIn}
                  variant="default"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-8 px-3 rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <Square size={12} fill="currentColor" />
                  <span>Finish &amp; Claim XP</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Pulsing Member Presence Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {presences.length === 0 ? (
            <div className="col-span-full py-4 text-center text-xs text-zinc-400">
              The library lobby is quiet. Lock in above to study and broadcast live focus to your squad!
            </div>
          ) : (
            presences.map((p) => {
              const elapsedMins = Math.max(1, Math.floor((Date.now() - p.startedAt) / 60000));
              return (
                <div
                  key={p.uid}
                  className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 flex items-center justify-between gap-2 shadow-2xs transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold font-mono">
                        {p.displayName.charAt(0)}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {p.displayName}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        Locked in on <span className="font-semibold text-emerald-600 dark:text-emerald-400">{p.courseName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    {elapsedMins}m
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* GHOST RACING LIVE HUD (If active) */}
      {ghostRaceActive && activeGhostRace && (
        <div className="border border-[#DE482B]/40 bg-[#DE482B]/5 dark:bg-black rounded-xl p-3 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords size={16} className="text-[#DE482B] animate-spin" />
              <span className="font-bold text-xs text-[#DE482B] dark:text-[#F37055]">
                Ghost Racing: {activeGhostRace.memberName} ({activeGhostRace.courseName})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#DE482B] dark:text-[#F37055]">
                {Math.floor(ghostRaceElapsedSeconds / 60)}m / {activeGhostRace.durationMinutes}m
              </span>
              <Button size="sm" variant="ghost" onClick={handleCancelGhostRace} className="h-6 text-xs text-zinc-400">
                Abort
              </Button>
            </div>
          </div>
          {/* Dual Progress Bars */}
          <div className="space-y-1.5 pt-1">
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-[#DE482B] dark:text-[#F37055] font-mono">
                <span>Your Live Progress</span>
                <span>{Math.round((ghostRaceElapsedSeconds / (activeGhostRace.durationMinutes * 60)) * 100)}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#3B77BC] to-[#DE482B] h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (ghostRaceElapsedSeconds / (activeGhostRace.durationMinutes * 60)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>{activeGhostRace.memberName}&apos;s Ghost Pace</span>
                <span>100% Target</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden opacity-60">
                <div className="bg-[#DE482B] h-full w-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BENTO GRID: Modules 2, 3, 4, 5, 6 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* LEFT COLUMN: Podium & Merged Heatmap (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* MODULE 2.1: Weekly Sprint Podium */}
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Trophy size={16} className="text-amber-500" />
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Weekly Sprint Podium
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">(Resets Mon 00:00)</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWrappedModal(true)}
                className="h-7 text-[11px] gap-1 font-semibold text-indigo-600 dark:text-indigo-400"
              >
                <Award size={13} />
                <span>Weekly Wrapped</span>
              </Button>
            </div>

            {/* Top 3 Visual Podium */}
            <div className="grid grid-cols-3 gap-2 pt-2 items-end">
              {/* 2nd Place */}
              {podiumTop3[1] ? (
                <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-center">
                  <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-xs mb-1">
                    2
                  </div>
                  <div className="font-bold text-xs truncate max-w-full text-zinc-900 dark:text-zinc-100">
                    {podiumTop3[1].displayName}
                  </div>
                  <div className="font-mono text-[10px] text-[#3B77BC] dark:text-[#689FE1] font-bold">
                    {podiumTop3[1].elo} ELO
                  </div>
                  <div className="font-mono text-[9px] text-zinc-400">
                    {Math.round(podiumTop3[1].minutesThisWeek / 60)}h studied
                  </div>
                </div>
              ) : (
                <div className="h-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-400">
                  2nd Place
                </div>
              )}

              {/* 1st Place (Crown) */}
              {podiumTop3[0] ? (
                <div className="flex flex-col items-center p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-center shadow-md -translate-y-1">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center font-black text-xs mb-1 shadow-2xs">
                    1
                  </div>
                  <div className="font-extrabold text-xs truncate max-w-full text-amber-500">
                    {podiumTop3[0].displayName}
                  </div>
                  <div className="font-mono text-xs text-amber-500 font-black">
                    {podiumTop3[0].elo} ELO
                  </div>
                  <div className="font-mono text-[10px] text-zinc-400">
                    {Math.round(podiumTop3[0].minutesThisWeek / 60)}h • {podiumTop3[0].tasksThisWeek} tasks
                  </div>
                </div>
              ) : (
                <div className="h-20 border border-dashed border-amber-500/30 rounded-lg flex items-center justify-center text-[10px] text-amber-400">
                  1st Place
                </div>
              )}

              {/* 3rd Place */}
              {podiumTop3[2] ? (
                <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-center">
                  <div className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center font-bold text-xs mb-1">
                    3
                  </div>
                  <div className="font-bold text-xs truncate max-w-full text-zinc-900 dark:text-zinc-100">
                    {podiumTop3[2].displayName}
                  </div>
                  <div className="font-mono text-[10px] text-[#3B77BC] dark:text-[#689FE1] font-bold">
                    {podiumTop3[2].elo} ELO
                  </div>
                  <div className="font-mono text-[9px] text-zinc-400">
                    {Math.round(podiumTop3[2].minutesThisWeek / 60)}h studied
                  </div>
                </div>
              ) : (
                <div className="h-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-center text-[10px] text-zinc-400">
                  3rd Place
                </div>
              )}
            </div>
          </div>

          {/* MODULE 2.2: Merged Commit Heatmap */}
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-xl p-3 sm:p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Calendar size={15} className="text-[#3B77BC] dark:text-[#689FE1]" />
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Merged Squad Heatmap
                </span>
                <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">(20-Week Semester View)</span>
              </div>
              {/* Member Color Legend */}
              <div className="flex items-center gap-2.5 text-[10px]">
                {members.slice(0, 4).map((m, idx) => (
                  <div key={m.uid} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-1 ring-zinc-900 shadow-2xs shrink-0"
                      style={{ backgroundColor: m.color || MEMBER_COLORS[idx % MEMBER_COLORS.length].hex }}
                    />
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[90px]">{m.displayName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GitHub-Style Contribution Grid with Weekdays and Month timeline */}
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[560px] select-none">
                {/* Timeline Month Header aligned to the 20 week columns */}
                <div className="flex items-start gap-2 mb-1.5">
                  <div className="w-6 shrink-0" />
                  <div className="grid grid-flow-col auto-cols-fr gap-1 sm:gap-1.5 flex-1 text-[9.5px] font-mono text-zinc-400 dark:text-zinc-500">
                    {weeksHeader.map((wh, idx) => (
                      <span key={idx} className="truncate">
                        {wh.monthLabel}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {/* Day of Week Row Labels (Mon, Wed, Fri) */}
                  <div className="grid grid-rows-7 gap-1 text-[9px] font-mono text-zinc-400 dark:text-zinc-500 shrink-0 select-none pt-0.5 w-6">
                    <span className="h-3 sm:h-3.5 leading-none flex items-center">Mon</span>
                    <span className="h-3 sm:h-3.5 leading-none flex items-center opacity-0">Tue</span>
                    <span className="h-3 sm:h-3.5 leading-none flex items-center">Wed</span>
                    <span className="h-3 sm:h-3.5 leading-none flex items-center opacity-0">Thu</span>
                    <span className="h-3 sm:h-3.5 leading-none flex items-center">Fri</span>
                    <span className="h-3 sm:h-3.5 leading-none flex items-center opacity-0">Sat</span>
                    <span className="h-3 sm:h-3.5 leading-none flex items-center opacity-0">Sun</span>
                  </div>

                  {/* 20-Column x 7-Row Grid (Mon=Row 0 to Sun=Row 6) */}
                  <div className="grid grid-flow-col grid-rows-7 gap-1 sm:gap-1.5 flex-1">
                    {heatmapDays.map((day, idx) => {
                      let opacity = 0.4;
                      if (day.minutes >= 90) opacity = 1.0;
                      else if (day.minutes >= 60) opacity = 0.85;
                      else if (day.minutes >= 30) opacity = 0.65;
                      else if (day.minutes > 0) opacity = 0.45;

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredHeatmapDay(day)}
                          onMouseLeave={() => setHoveredHeatmapDay(null)}
                          className={`h-3 sm:h-3.5 rounded-[3px] transition-transform duration-100 hover:scale-135 cursor-pointer relative ${
                            day.isToday ? 'ring-1 ring-[#3B77BC] ring-offset-1 ring-offset-black z-10' : ''
                          }`}
                          style={{
                            backgroundColor: day.hasActivity ? day.contributorColor : undefined,
                            opacity: day.hasActivity ? opacity : undefined,
                            boxShadow:
                              day.hasActivity && day.minutes >= 60
                                ? `0 0 6px ${day.contributorColor}70`
                                : undefined,
                          }}
                        >
                          {!day.hasActivity && !day.isFuture && (
                            <div className="w-full h-full rounded-[3px] bg-zinc-200 dark:bg-zinc-800/80 border border-zinc-300/40 dark:border-zinc-700/50" />
                          )}
                          {day.isFuture && (
                            <div className="w-full h-full rounded-[3px] border border-dashed border-zinc-300/40 dark:border-zinc-800/60 opacity-30" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive Tooltip Status & Scale Legend Footer */}
                <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-mono text-[10px] text-zinc-700 dark:text-zinc-300 min-h-[16px] flex items-center">
                    {hoveredHeatmapDay ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: hoveredHeatmapDay.hasActivity
                              ? hoveredHeatmapDay.contributorColor
                              : '#71717A',
                          }}
                        />
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {hoveredHeatmapDay.dateStr}:
                        </span>
                        <span>
                          {hoveredHeatmapDay.hasActivity
                            ? `${hoveredHeatmapDay.contributor} studied ${hoveredHeatmapDay.minutes}m`
                            : 'No squad study logged'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        Hover over any day tile to inspect contributor &amp; focus minutes
                      </span>
                    )}
                  </div>

                  {/* Intensity Swatches */}
                  <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[9.5px] shrink-0">
                    <span>Less</span>
                    <div className="w-2.5 h-2.5 rounded-[2px] bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" title="0 minutes" />
                    <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: `${currentUserColor}4D` }} title="1-30 minutes" />
                    <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: `${currentUserColor}99` }} title="31-60 minutes" />
                    <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: `${currentUserColor}D9` }} title="61-90 minutes" />
                    <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: currentUserColor, boxShadow: `0 0 4px ${currentUserColor}80` }} title="90+ minutes" />
                    <span>More</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Ghost Racing & Squad Activity Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* MODULE 2.3: Ghost Racing (Asynchronous Rivalry) */}
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-xl p-3 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Swords size={15} className="text-[#DE482B]" />
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                  Ghost Racing
                </span>
              </div>
              <span className="text-[10px] text-[#DE482B] dark:text-[#F37055] font-mono font-bold">+100 XP Bonus</span>
            </div>

            {/* Ghost Session Cards */}
            <div className="space-y-2">
              {ghostSessions.length === 0 ? (
                <div className="py-4 text-center text-xs text-zinc-400">
                  No completed study sessions recorded yet. Finish a live session above to record a ghost pace for your squad!
                </div>
              ) : (
                ghostSessions.slice(0, 3).map((ghost) => (
                  <div
                    key={ghost.id}
                    className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-black hover:border-[#DE482B]/40 transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {ghost.courseName}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {ghost.memberName} • {ghost.durationMinutes}m pace
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartGhostRace(ghost)}
                      disabled={ghostRaceActive}
                      className="bg-[#DE482B] hover:bg-[#BD361B] text-white text-[11px] h-7 px-2.5 font-bold cursor-pointer shrink-0"
                    >
                      Race Ghost
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MODULE 2.4: Squad Friends Roster & Live Feed Tabs */}
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-xl p-3 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('friends');
                    playClickBeep();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeRightTab === 'friends'
                      ? 'bg-white dark:bg-black text-[#3B77BC] dark:text-[#689FE1] shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Users size={13} />
                  <span>Friends ({members.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('feed');
                    playClickBeep();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeRightTab === 'feed'
                      ? 'bg-white dark:bg-black text-[#FCCF03] shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Zap size={13} />
                  <span>Feed</span>
                </button>
              </div>

              {activeRightTab === 'friends' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowMembersModal(true);
                    playClickBeep();
                  }}
                  className="text-[11px] font-semibold text-[#3B77BC] dark:text-[#689FE1] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Full Roster</span>
                  <ArrowRight size={11} />
                </button>
              ) : (
                <span className="text-[10px] text-zinc-400 font-mono">Live Sync</span>
              )}
            </div>

            {/* Friends Tab Content */}
            {activeRightTab === 'friends' ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {sortedMembers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-400">
                    No classmates in this squad yet. Open Manage Squad in the header to view and share your squad invite code!
                  </div>
                ) : (
                  sortedMembers.map((m, idx) => {
                  const isSelf = m.uid === currentUid;
                  const memberPresence = presences.find((p) => p.uid === m.uid);
                  const memberColor = m.color || MEMBER_COLORS[idx % MEMBER_COLORS.length].hex;

                  return (
                    <div
                      key={m.uid}
                      className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                        isSelf
                          ? 'bg-[#3B77BC]/10 dark:bg-black border-[#3B77BC]/40'
                          : 'bg-zinc-50 dark:bg-black border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold font-mono shadow-2xs"
                            style={{ backgroundColor: memberColor }}
                          >
                            {m.displayName.charAt(0)}
                          </div>
                          {memberPresence ? (
                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1.5 ring-zinc-900 animate-pulse" />
                          ) : (
                            <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-zinc-400 ring-1 ring-zinc-900" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                              {m.displayName}
                            </span>
                            {isSelf && (
                              <span className="text-[9px] px-1 rounded bg-[#3B77BC]/10 text-[#3B77BC] dark:text-[#689FE1] font-mono font-bold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {memberPresence ? (
                              <span className="text-emerald-500 font-medium">
                                Studying {memberPresence.courseName}
                              </span>
                            ) : (
                              <span>
                                {Math.round(m.minutesThisWeek / 60)}h studied • {m.tasksThisWeek} tasks
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="text-right font-mono mr-1">
                          <div className="text-xs font-bold text-amber-500 leading-none">
                            {m.elo}
                          </div>
                          <div className="text-[9px] text-zinc-400 leading-none mt-0.5">
                            ELO
                          </div>
                        </div>

                        {!isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSendCheer(m.displayName)}
                            className="h-6 w-6 p-0 text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 rounded cursor-pointer"
                            title={`Send high-five motivation to ${m.displayName}`}
                          >
                            <Sparkles size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            ) : (
              /* Squad Activity Feed Tab Content */
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activities.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-400">
                    No activity logged yet today. Complete tasks or focus sessions to show off!
                  </div>
                ) : (
                  activities.slice(0, 8).map((act) => (
                    <div
                      key={act.id}
                      className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800 text-[11px] flex items-start gap-2"
                    >
                      <Sparkles size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 mr-1">
                          {act.displayName}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">{act.title}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* XP LOOT DROP MODAL */}
      {showLootModal && currentLoot && (
        <Dialog open={showLootModal} onOpenChange={setShowLootModal}>
          <DialogContent className="max-w-sm text-center p-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-zinc-950 flex items-center justify-center shadow-xl animate-bounce">
              <Trophy size={32} />
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="text-amber-500 border-amber-500/50 uppercase font-black tracking-widest text-[10px]">
                {currentLoot.rarity} Loot Drop
              </Badge>
              <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                {currentLoot.title}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {currentLoot.description}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 font-mono font-black text-base">
              +{currentLoot.xp} XP Claimed!
            </div>
            <Button
              onClick={() => setShowLootModal(false)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
            >
              Equip &amp; Continue
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* SUNDAY "WEEKLY WRAPPED" RECEIPT MODAL */}
      {showWrappedModal && (
        <Dialog open={showWrappedModal} onOpenChange={setShowWrappedModal}>
          <DialogContent className="max-w-md p-6 font-mono">
            <div className="border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-5 rounded-lg text-xs space-y-4 shadow-2xl relative">
              <div className="text-center border-b border-dashed border-zinc-300 dark:border-zinc-700 pb-3 space-y-1">
                <div className="font-extrabold text-sm tracking-wider uppercase">
                  UNISPHERE // WEEKLY WRAPPED
                </div>
                <div className="text-[10px] text-zinc-500">
                  {currentSquad.name} • {new Date().toLocaleDateString()}
                </div>
              </div>

              {/* Receipt Lines */}
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Week MVP (Top ELO):</span>
                  <span className="font-bold text-amber-500">{mvpMember.displayName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Night Owl (Latest Focus):</span>
                  <span className="font-bold text-[#81C046] dark:text-[#95D45B]">{nightOwlMember.displayName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Clutch Player (Deadlines):</span>
                  <span className="font-bold text-[#3B77BC] dark:text-[#689FE1]">{clutchMember.displayName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Total Squad Study Hours:</span>
                  <span className="font-bold text-emerald-400">{totalSquadHours} Hours</span>
                </div>
              </div>

              {/* Barcode Mock */}
              <div className="text-center pt-2">
                <div className="font-mono text-zinc-400 text-[10px] tracking-widest">
                  ||||| | |||| ||| |||| | ||||| ||
                </div>
                <div className="text-[9px] text-zinc-500 mt-1">
                  Keep locking in • See you on Monday!
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `🏆 UniSphere Weekly Wrapped for ${currentSquad.name}\nMVP: ${mvpMember.displayName}\nTotal Squad Hours: ${totalSquadHours}h`
                    );
                    playClickBeep();
                    setShowWrappedModal(false);
                  }}
                  className="w-full bg-[#3B77BC] hover:bg-[#2B5D99] text-white font-bold text-xs"
                >
                  <Share2 size={13} className="mr-1.5" />
                  <span>Copy Wrapped Summary</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* SQUAD ROSTER & FRIENDS MODAL */}
      {showMembersModal && (
        <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
          <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800">
            <DialogHeader className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#3B77BC]/10 text-[#3B77BC] dark:text-[#689FE1] flex items-center justify-center font-bold shrink-0">
                  <Users size={18} />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-zinc-900 dark:text-zinc-100">
                    {currentSquad.name} • Friends Roster
                  </DialogTitle>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
                    {members.length} classmates in this study cohort • Synchronized academic telemetry
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* Quick Cohort Summary Bar */}
            <div className="grid grid-cols-3 gap-2 py-3 border-b border-zinc-100 dark:border-zinc-800 text-center">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-black border border-zinc-200/60 dark:border-zinc-800">
                <div className="text-[10px] uppercase font-bold text-zinc-400 font-mono">Members</div>
                <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 font-mono">
                  {members.length} Friends
                </div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="text-[10px] uppercase font-bold text-emerald-500 font-mono">Locked In Now</div>
                <div className="text-sm font-extrabold text-emerald-500 font-mono">
                  {presences.length} Live
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[#3B77BC]/10 border border-[#3B77BC]/30">
                <div className="text-[10px] uppercase font-bold text-[#3B77BC] dark:text-[#689FE1] font-mono">Squad Total</div>
                <div className="text-sm font-extrabold text-[#3B77BC] dark:text-[#689FE1] font-mono">
                  {totalSquadHours}h
                </div>
              </div>
            </div>

            {/* Scrollable Friends Cards List */}
            <div className="overflow-y-auto space-y-2.5 py-3 pr-1 flex-1">
              {sortedMembers.map((m, index) => {
                const isSelf = m.uid === currentUid;
                const memberPresence = presences.find((p) => p.uid === m.uid);
                const hasGhost = ghostSessions.some((g) => g.uid === m.uid || g.memberName === m.displayName);
                const memberColor = m.color || MEMBER_COLORS[index % MEMBER_COLORS.length].hex;

                return (
                  <div
                    key={m.uid}
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelf
                        ? 'bg-[#3B77BC]/10 dark:bg-black border-[#3B77BC]/40'
                        : 'bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold font-mono text-sm shadow-md"
                          style={{ backgroundColor: memberColor }}
                        >
                          {m.displayName.charAt(0)}
                        </div>
                        {memberPresence ? (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-zinc-900 animate-pulse" />
                        ) : (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-500 ring-2 ring-zinc-900" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                            {m.displayName}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] text-[#3B77BC] dark:text-[#689FE1] font-mono font-bold">
                              (You)
                            </span>
                          )}
                          {index === 0 && (
                            <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                              <Crown size={11} className="inline" /> #1 MVP
                            </span>
                          )}
                        </div>

                        {/* Status text */}
                        <div className="text-[11px] mt-0.5">
                          {memberPresence ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                              Locked in on {memberPresence.courseName}
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-mono text-[10px]">
                              {m.minutesThisWeek > 0 ? `${Math.round(m.minutesThisWeek / 60)}h studied this week` : 'Ready to lock in'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Telemetry chips & actions */}
                    <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-black text-xs text-amber-500">
                            {m.elo} ELO
                          </span>
                          <span className="text-[9px] text-zinc-400 font-mono">
                            {m.tasksThisWeek} tasks • 🔥{m.currentStreak || 1}d
                          </span>
                        </div>
                      </div>

                      {!isSelf && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendCheer(m.displayName)}
                            className="h-7 px-2 text-[11px] gap-1 hover:text-amber-400 hover:border-amber-500/40 cursor-pointer"
                            title="Send high-five motivation"
                          >
                            <Sparkles size={12} className="text-amber-500" />
                            <span>Cheer</span>
                          </Button>
                          {hasGhost && (
                            <Button
                              size="sm"
                              onClick={() => {
                                const ghost = ghostSessions.find(
                                  (g) => g.uid === m.uid || g.memberName === m.displayName
                                );
                                if (ghost) {
                                  setShowMembersModal(false);
                                  handleStartGhostRace(ghost);
                                }
                              }}
                              className="h-7 px-2 text-[11px] bg-[#DE482B] hover:bg-[#BD361B] text-white font-bold cursor-pointer"
                            >
                              <Swords size={12} className="mr-1" />
                              <span>Race</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Roster Summary Footer */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-50 dark:bg-zinc-950/60 -mx-5 -mb-5 p-4 rounded-b-lg">
              <div className="min-w-0">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 flex-wrap">
                  <span>{currentSquad.name}</span>
                  {isCreator && (
                    <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-0.5">
                      <Crown size={11} className="inline text-amber-500" /> Creator
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {currentSquad.creatorName ? `Founded by ${currentSquad.creatorName} • ` : ''}
                  {members.length} classmates enrolled in cohort.
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMembersModal(false)}
                  className="text-xs h-8 px-4 cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Shared Modals (Create, Join, Delete Confirmation, Leave Confirmation) */}
      {renderModals()}
    </div>
  );
};
