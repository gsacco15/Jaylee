/** Shared types for the dogs' brains, bodies and the world. */

export interface Vec {
  x: number;
  y: number;
}

/** Where Jaylee currently is. */
export type Medium = 'land' | 'water';

/** Tricks she knows (each maps to sprite animations behind the scenes). */
export type Trick = 'sit' | 'wave' | 'hop' | 'sniff' | 'curious' | 'beg' | 'wink' | 'look';

/**
 * Everything Jaylee can be asked to do, by the player, by her own brain,
 * or (later) by a chat / AI personality. This is the control surface.
 */
export type Intent =
  | { kind: 'goTo'; x: number; y: number }
  | { kind: 'swim' }
  | { kind: 'leavePool' }
  | { kind: 'fetch' }
  | { kind: 'trick'; trick: Trick }
  | { kind: 'zoomies' }
  | { kind: 'wander' }
  | { kind: 'rest' }
  | { kind: 'seekAttention' }
  | { kind: 'eatTreat' }
  // With a friend in the yard:
  | { kind: 'playWith' }    // play chase with the other dog
  | { kind: 'greet' }       // trot over and sniff hello
  | { kind: 'joinFriend' }  // go to wherever the other dog is (even the pool)
  | { kind: 'tugFriend' }   // tug-of-war with the other dog
  | { kind: 'tug' }         // tug-of-war with the human
  | { kind: 'sleep' };      // curl up for a nap

export type IntentKind = Intent['kind'];

/** Who asked for an intent. The brain treats them differently. */
export type Source = 'player' | 'self' | 'chat' | 'friend';

/** What her body is physically doing right now (drives need changes). */
export type Activity = 'idle' | 'running' | 'swimming' | 'paddling' | 'trick' | 'eating' | 'tugging' | 'sleeping';

/**
 * Drives in 0..1. Higher means a stronger urge,
 * except energy, where 1 = fully rested.
 */
export interface Needs {
  energy: number;
  boredom: number;
  heat: number;
  curiosity: number;
  affection: number;
  /** Wants to play with the other dog (only grows when one is around). */
  social: number;
}

/** Personality: fixed weights that shape her choices, 0..1. */
export interface Traits {
  waterLove: number;
  playfulness: number;
  curiosity: number;
  cuddliness: number;
  obedience: number;
  sociability: number;
}

export interface Personality {
  name: string;
  traits: Traits;
}

export type Mood = 'happy' | 'playful' | 'sleepy' | 'hot' | 'curious' | 'needy' | 'content';

/** Outcome of the brain considering a request. */
export type Decision =
  | { accept: true; intent: Intent; line: string }
  | { accept: false; line: string };

/** Things that happen to Jaylee that her brain reacts to. */
export type WorldEvent =
  | { type: 'petted' }
  | { type: 'treat' }
  | { type: 'ballThrown'; to: Vec }
  | { type: 'ballLanded'; inWater: boolean }
  | { type: 'fetched' }
  | { type: 'enteredWater' }
  | { type: 'leftWater' }
  | { type: 'talkedTo' }
  | { type: 'playedWithFriend' }
  | { type: 'tugged'; won: boolean }
  | { type: 'feeling'; emotion: Emotion };

/** How something said in chat made her feel. Shifts her needs. */
export type Emotion = 'loved' | 'excited' | 'calm' | 'curious' | 'sad' | 'hot' | 'scared';

/** Lasting habit changes her human can ask for in chat. Shifts her traits. */
export type Habit =
  | 'swimMore' | 'swimLess' | 'playMore' | 'playLess'
  | 'cuddleMore' | 'cuddleLess' | 'exploreMore' | 'exploreLess' | 'listenMore'
  | 'friendlier' | 'moreIndependent';

/** Read-only view of Jaylee, safe to hand to UI or an AI model. */
export interface Snapshot {
  id: string;
  name: string;
  position: Vec;
  medium: Medium;
  activity: Activity;
  busy: boolean;
  needs: Readonly<Needs>;
  mood: Mood;
  happiness: number;
  wet: boolean;
  ball: 'none' | 'flying' | 'lawn' | 'pool' | 'mouth';
  stats: Readonly<Stats>;
  traits: Readonly<Traits>;
  /** The other dog, when both are in the yard. */
  friend: { name: string; medium: Medium; activity: Activity; distance: number } | null;
  timeOfDay: TimeOfDay;
  rope: 'lawn' | 'tug' | 'carried';
}

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export interface Stats {
  fetches: number;
  swims: number;
  pets: number;
  treats: number;
}
