export const TAU = Math.PI * 2;
export const PI = Math.PI;

export const FIXED_TIMESTEP_HZ = 60;
export const FIXED_DT = 1 / FIXED_TIMESTEP_HZ;
export const MAX_STEPS_PER_FRAME = 5;

export const SHIELD_RADIUS = 120;
export const CORE_RADIUS = 30;
export const ARENA_RADIUS = 300;
export const SPAWN_RADIUS = 340;

export const RADIAL_TOLERANCE = 12;
export const COYOTE_FRAMES = 2;

export const PLAYER_ANGULAR_SPEED = 0.07;
export const PLAYER_SHIELD_ARC = PI / 5;
export const PLAYER_MAX_HEALTH = 5;

export const TIMING_ZONE_PERFECT = 0.087;
export const TIMING_ZONE_GOOD = 0.175;
export const TIMING_ZONE_SCRAPE = 0.262;

export const MIN_TELEGRAPH_TICKS = Math.ceil(0.4 / FIXED_DT);

export const SCORE_PERFECT = 150;
export const SCORE_GOOD = 100;
export const SCORE_SCRAPE = 50;
export const SCORE_BLAST_KILL = 80;
export const SCORE_RICOCHET_KILL = 50;
export const SURVIVAL_BONUS_INTERVAL_TICKS = FIXED_TIMESTEP_HZ * 10;
export const SURVIVAL_BONUS_BASE = 200;

export const SPAWN_MIN_ANGLE_GAP = 0.5;
export const SPAWN_MAX_ATTEMPTS = 10;

export const ENERGY_MAX = 100;
export const ENERGY_START = 50;
export const ENERGY_REGEN_PER_TICK = 0.05;
export const ENERGY_PERFECT_BONUS = 15;
export const ENERGY_GOOD_BONUS = 8;
export const ENERGY_SCRAPE_BONUS = 3;
export const ENERGY_COMBO_5_BONUS = 10;
export const ENERGY_COMBO_10_BONUS = 15;
export const ENERGY_COMBO_20_BONUS = 20;

export const BLAST_COST = 25;
export const BLAST_SPEED = 6;
export const BLAST_ANGULAR_WIDTH = 0.12;
export const BLAST_COOLDOWN_TICKS = 90;
export const BLAST_MAX_RADIUS = ARENA_RADIUS + 20;

export const SLAM_COST = 40;
export const SLAM_CHARGE_TICKS = 30;
export const SLAM_ACTIVE_TICKS = 6;
export const SLAM_ARC = PI / 1.5;
export const SLAM_COOLDOWN_TICKS = 300;
export const SLAM_SLOW_FACTOR = 0.5;

export const STUN_DURATION_TICKS = 60;

export const RICOCHET_SPEED_MULT = 1.5;
export const RICOCHET_MAX_TICKS = 90;
export const RICOCHET_COLLISION_RADIUS = 0.15;

// --- Weapon Progression ---
export const WEAPON_XP_THRESHOLDS = [0, 8, 20, 40, 70]; // XP needed to reach level 2,3,4,5
export const WEAPON_MAX_LEVEL = 5;

// Shield XP per deflect quality
export const SHIELD_XP_PERFECT = 3;
export const SHIELD_XP_GOOD = 2;
export const SHIELD_XP_SCRAPE = 1;

// Blast XP
export const BLAST_XP_PER_KILL = 3;

// Slam XP
export const SLAM_XP_PER_HIT = 2;

// Pulse XP
export const PULSE_XP_PER_AFFECTED = 1;

// Shield level bonuses (arc multiplier)
export const SHIELD_ARC_MULT = [1.0, 1.0, 1.15, 1.15, 1.30, 1.30]; // index = level
export const SHIELD_COYOTE_BONUS = [0, 0, 0, 1, 1, 1]; // extra coyote frames per level

// Blast level bonuses
export const BLAST_COOLDOWN_MULT = [1.0, 1.0, 0.8, 0.8, 0.8, 0.8]; // index = level
export const BLAST_COST_MULT = [1.0, 1.0, 1.0, 1.0, 0.75, 0.75];
// Level 3: piercing, Level 5: twin shot (handled in code)

// Slam level bonuses
export const SLAM_ARC_MULT = [1.0, 1.0, 1.2, 1.2, 1.4, 1.4];
export const SLAM_COOLDOWN_MULT = [1.0, 1.0, 1.0, 0.75, 0.75, 0.75];

// Pulse weapon
export const PULSE_UNLOCK_COMBINED_LEVEL = 8; // sum of shield+blast+slam levels
export const PULSE_COST = 50;
export const PULSE_COOLDOWN_TICKS = FIXED_TIMESTEP_HZ * 10;
export const PULSE_ACTIVE_TICKS = FIXED_TIMESTEP_HZ * 3;
export const PULSE_SLOW_BASE = 0.5;
export const PULSE_SLOW_PER_LEVEL = [0.5, 0.5, 0.6, 0.6, 0.7, 0.8]; // index = level
export const PULSE_COOLDOWN_LEVEL_MULT = [1.0, 1.0, 1.0, 0.8, 0.8, 0.8];
