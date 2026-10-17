import { LootDropReward } from '../types';

/**
 * Calculates student level and progress toward the next level from XP.
 */
export function calculateLevel(xp: number = 0) {
  const safeXp = Math.max(0, xp);
  // Tier progression: Level 1 (0-100), Level 2 (100-300), Level 3 (300-600), etc.
  const level = Math.floor(Math.sqrt(safeXp / 50)) + 1;
  const currentLevelBaseXp = Math.pow(level - 1, 2) * 50;
  const nextLevelXp = Math.pow(level, 2) * 50;
  const progressXp = safeXp - currentLevelBaseXp;
  const neededXp = nextLevelXp - currentLevelBaseXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((progressXp / neededXp) * 100)));

  return {
    level,
    safeXp,
    currentLevelBaseXp,
    nextLevelXp,
    progressPercent,
  };
}

/**
 * Returns dynamic power border styles based on daily/weekly completion percentage.
 * Levels up from muted zinc -> glowing indigo -> radiant cyan -> triumphant emerald at 100%.
 */
export function getPowerBorderClass(completionPercent: number = 0): string {
  const p = Math.max(0, completionPercent);
  if (p >= 100) {
    return 'border-emerald-500/70 dark:border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/20 transition-all duration-500';
  }
  if (p >= 75) {
    return 'border-[#3B77BC]/60 dark:border-[#3B77BC]/50 shadow-[0_0_18px_rgba(59,119,188,0.18)] ring-1 ring-[#3B77BC]/10 transition-all duration-500';
  }
  if (p >= 40) {
    return 'border-[#5A738E]/50 dark:border-[#5A738E]/40 shadow-[0_0_15px_rgba(90,115,142,0.1)] transition-all duration-500';
  }
  return 'border-zinc-200 dark:border-zinc-800/80 transition-all duration-500';
}

/**
 * Returns dynamic progress bar fill styling matching the power border level.
 */
export function getPowerBarFillClass(completionPercent: number = 0): string {
  const p = Math.max(0, completionPercent);
  if (p >= 100) {
    return 'bg-gradient-to-r from-[#81C046] via-[#95D45B] to-[#81C046] shadow-[0_0_12px_rgba(129,192,70,0.5)]';
  }
  if (p >= 75) {
    return 'bg-gradient-to-r from-[#3B77BC] via-[#689FE1] to-[#3B77BC] shadow-[0_0_10px_rgba(59,119,188,0.4)]';
  }
  if (p >= 40) {
    return 'bg-gradient-to-r from-[#5A738E] to-[#4B6584]';
  }
  return 'bg-zinc-700 dark:bg-zinc-300';
}

/**
 * Calculates Subject ELO / Academic Power Rating from weekly telemetry.
 */
export function calculateElo(
  minutesThisWeek: number = 0,
  tasksThisWeek: number = 0,
  streak: number = 0
): number {
  const base = 1000;
  const timeWeight = Math.round(minutesThisWeek * 1.4);
  const taskWeight = tasksThisWeek * 25;
  const streakWeight = Math.min(200, streak * 15);
  return base + timeWeight + taskWeight + streakWeight;
}

/**
 * Updates streak based on last active YYYY-MM-DD.
 */
export function updateStreak(currentStreak: number = 0, lastActiveDate?: string): { streak: number; today: string } {
  const today = new Date().toISOString().split('T')[0];
  if (!lastActiveDate) {
    return { streak: 1, today };
  }
  if (lastActiveDate === today) {
    return { streak: Math.max(1, currentStreak), today };
  }

  const lastDate = new Date(lastActiveDate);
  const now = new Date(today);
  const diffTime = Math.abs(now.getTime() - lastDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return { streak: currentStreak + 1, today };
  } else if (diffDays > 1) {
    return { streak: 1, today };
  }
  return { streak: currentStreak, today };
}

/**
 * Rolls an XP Loot Drop reward for completing a study session.
 */
export function rollLootDrop(sessionMinutes: number): LootDropReward {
  const roll = Math.random();
  if (roll > 0.85 || sessionMinutes >= 60) {
    return {
      xp: 150,
      rarity: 'Legendary',
      title: 'Grand Academic Mastery',
      description: 'Transcendent concentration unlocked. +150 XP bonus awarded!',
    };
  }
  if (roll > 0.6) {
    return {
      xp: 100,
      rarity: 'Epic',
      title: 'Deep Flow Relic',
      description: 'Immense cognitive momentum sustained. +100 XP added to telemetry.',
    };
  }
  if (roll > 0.3) {
    return {
      xp: 75,
      rarity: 'Rare',
      title: 'Synaptic Surge',
      description: 'High retention study block finalized. +75 XP earned.',
    };
  }
  return {
    xp: 50,
    rarity: 'Common',
    title: 'Focus Essence',
    description: 'Solid study repetition recorded. +50 XP claimed.',
  };
}

/**
 * 6-character alphanumeric invite code generator for Squads
 */
export function generateSquadCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
