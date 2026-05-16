/**
 * Curriculum data -- static sign language lesson content.
 * v2: Added J and Z (motion letters routed to dynamic player).
 */

export const COLLISION_GROUPS: string[][] = [
  ["A", "E", "M", "N", "S", "T"],
  ["D", "G", "L", "Q"],
  ["H", "U", "V"],
  ["K", "P"],
  ["C", "O"],
];

export function inSameGroup(a: string, b: string): boolean {
  if (a === b) return true;
  for (const g of COLLISION_GROUPS) {
    if (g.includes(a) && g.includes(b)) return true;
  }
  return false;
}

// All 26 ASL letters. J and Z are motion letters -- routed to dynamic player.
export const STATIC_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S",
  "T", "U", "V", "W", "X", "Y",
];

// J and Z require motion -- handled by the dynamic Transformer (W2)
export const MOTION_LETTERS = ["J", "Z"] as const;
export type MotionLetter = (typeof MOTION_LETTERS)[number];

export function isMotionLetter(letter: string): letter is MotionLetter {
  return MOTION_LETTERS.includes(letter as MotionLetter);
}

// All 26 letters for the listing page (J and Z shown with motion badge)
export const ALL_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
  "U", "V", "W", "X", "Y", "Z",
];

export const LETTER_DESCRIPTIONS: Record<string, string> = {
  A: "Closed fist - thumb resting alongside index - palm forward.",
  B: "Flat hand - fingers extended and together - thumb folded across palm.",
  C: "Curved hand forming a C shape - palm to the side.",
  D: "Index extended up - other fingers and thumb meet to form a circle.",
  E: "All fingertips curled to touch the thumb across the palm.",
  F: "Thumb and index touch in a circle - other three fingers extended up.",
  G: "Index extended sideways - thumb parallel - other fingers closed.",
  H: "Index and middle extended together sideways - others closed.",
  I: "Pinky extended up - all other fingers and thumb closed.",
  J: "Pinky extended up, then trace a J curve downward. Motion letter.",
  K: "Index up, middle out at angle, thumb between - others closed.",
  L: "Index up - thumb out - other fingers curled. Forms an L.",
  M: "Thumb tucked under index, middle, and ring - pinky out.",
  N: "Thumb tucked under index and middle - ring and pinky closed.",
  O: "All fingers curled to touch the thumb - forms an O.",
  P: "Like K but pointed downward.",
  Q: "Like G but pointed downward.",
  R: "Index and middle crossed - others closed.",
  S: "Closed fist with thumb across the front of the fingers.",
  T: "Closed fist with thumb tucked between index and middle.",
  U: "Index and middle extended together up - others closed.",
  V: "Index and middle extended apart up - others closed. Peace.",
  W: "Index, middle, and ring extended up - pinky and thumb closed.",
  X: "Index bent into a hook - others closed.",
  Y: "Thumb and pinky extended - index/middle/ring curled. Hang loose.",
  Z: "Index extended, trace a Z shape in the air. Motion letter.",
};

export interface FingerPattern {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export const PATTERNS: Record<string, FingerPattern> = {
  A: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  B: { thumb: false, index: true,  middle: true,  ring: true,  pinky: true  },
  C: { thumb: true,  index: false, middle: false, ring: false, pinky: false },
  D: { thumb: true,  index: true,  middle: false, ring: false, pinky: false },
  E: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  F: { thumb: true,  index: false, middle: true,  ring: true,  pinky: true  },
  G: { thumb: true,  index: true,  middle: false, ring: false, pinky: false },
  H: { thumb: false, index: true,  middle: true,  ring: false, pinky: false },
  I: { thumb: false, index: false, middle: false, ring: false, pinky: true  },
  K: { thumb: true,  index: true,  middle: true,  ring: false, pinky: false },
  L: { thumb: true,  index: true,  middle: false, ring: false, pinky: false },
  M: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  N: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  O: { thumb: true,  index: false, middle: false, ring: false, pinky: false },
  P: { thumb: true,  index: true,  middle: true,  ring: false, pinky: false },
  Q: { thumb: true,  index: true,  middle: false, ring: false, pinky: false },
  R: { thumb: false, index: true,  middle: true,  ring: false, pinky: false },
  S: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  T: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  U: { thumb: false, index: true,  middle: true,  ring: false, pinky: false },
  V: { thumb: false, index: true,  middle: true,  ring: false, pinky: false },
  W: { thumb: false, index: true,  middle: true,  ring: true,  pinky: false },
  X: { thumb: false, index: true,  middle: false, ring: false, pinky: false },
  Y: { thumb: true,  index: false, middle: false, ring: false, pinky: true  },
};

// ---- Dynamic signs (v2: expanded vocabulary, J and Z added) ----

// Core 8 signs from v1
const CORE_DYNAMIC_SIGNS: Record<string, string> = {
  HELLO:   "Right hand starts near forehead, salutes outward.",
  GOODBYE: "Open hand at chest height, fingers wave (curl/uncurl).",
  YES:     "Closed fist, nods up-down twice.",
  NO:      "Index + middle extended, snap closed twice.",
  PLEASE:  "Flat hand on chest, small circular motion.",
  THANKS:  "Flat hand starts at chin, moves outward.",
  SORRY:   "Closed fist on chest, small circular motion.",
  HELP:    "Closed fist lifts upward (on a flat palm in real ASL).",
};

// J and Z motion letters (W2)
const MOTION_LETTER_SIGNS: Record<string, string> = {
  J: "Pinky extended up, trace a J curve downward and hook left.",
  Z: "Index extended, trace a Z: right, diagonal down-left, right.",
};

// v2 expanded vocabulary (W3) -- top 200 signs from ASL-LEX frequency list
// These are added progressively as real WLASL data is trained.
// Signs are grouped by semantic category for the lesson browser.
export const SIGN_CATEGORIES: Record<string, string[]> = {
  "Greetings": ["HELLO", "GOODBYE", "PLEASE", "THANKS", "SORRY"],
  "Basic responses": ["YES", "NO", "HELP"],
  "Motion letters": ["J", "Z"],
  "Family": ["MOTHER", "FATHER", "SISTER", "BROTHER", "FAMILY", "BABY", "CHILD", "FRIEND"],
  "Food": ["FOOD", "WATER", "MILK", "BREAD", "EAT", "DRINK", "HUNGRY", "COFFEE"],
  "Time": ["TODAY", "TOMORROW", "YESTERDAY", "MORNING", "NIGHT", "WEEK", "MONTH", "YEAR"],
  "Colors": ["RED", "BLUE", "GREEN", "YELLOW", "WHITE", "BLACK", "ORANGE", "PURPLE"],
  "Numbers": ["ONE", "TWO", "THREE", "FOUR", "FIVE", "TEN", "HUNDRED", "THOUSAND"],
  "Places": ["HOME", "SCHOOL", "WORK", "HOSPITAL", "STORE", "CHURCH", "CITY", "COUNTRY"],
  "Actions": ["GO", "COME", "WANT", "NEED", "LIKE", "LOVE", "KNOW", "THINK"],
};

// Descriptions for expanded vocabulary (W3)
// These are populated as real data is trained; placeholder descriptions used until then.
const EXPANDED_SIGNS: Record<string, string> = {
  MOTHER: "Dominant hand open, thumb touches chin.",
  FATHER: "Dominant hand open, thumb touches forehead.",
  SISTER: "A-handshape slides from jaw to chin.",
  BROTHER: "A-handshape slides from forehead to chin.",
  FAMILY: "F-handshapes circle outward.",
  BABY: "Cradle arms and rock side to side.",
  CHILD: "Pat downward with flat hand.",
  FRIEND: "Hook index fingers together, then reverse.",
  FOOD: "Flat O-hand taps lips twice.",
  WATER: "W-handshape taps chin twice.",
  MILK: "Squeeze closed fist twice.",
  BREAD: "Slice across back of non-dominant hand.",
  EAT: "Flat O-hand taps lips.",
  DRINK: "C-handshape tilts toward mouth.",
  HUNGRY: "C-handshape slides down chest.",
  COFFEE: "S-handshape grinds on top of other S.",
  TODAY: "Y-hands drop down twice.",
  TOMORROW: "A-handshape arcs forward from cheek.",
  YESTERDAY: "A-handshape arcs backward from cheek.",
  MORNING: "Flat hand rises from elbow crook.",
  NIGHT: "Bent hand arcs down over wrist.",
  WEEK: "Index finger slides across palm.",
  MONTH: "Index finger slides down index finger.",
  YEAR: "S-hands circle around each other.",
  RED: "Index finger brushes down lips.",
  BLUE: "B-handshape shakes at shoulder.",
  GREEN: "G-handshape shakes at shoulder.",
  YELLOW: "Y-handshape shakes at shoulder.",
  WHITE: "5-handshape pulls from chest to O.",
  BLACK: "Index finger slides across forehead.",
  ORANGE: "Squeeze C-handshape at chin.",
  PURPLE: "P-handshape shakes at shoulder.",
  ONE: "Index finger points up.",
  TWO: "Index and middle fingers point up.",
  THREE: "Thumb, index, middle extend.",
  FOUR: "Four fingers extend, thumb tucked.",
  FIVE: "All five fingers extend.",
  TEN: "A-handshape shakes with thumb up.",
  HUNDRED: "C-handshape after number.",
  THOUSAND: "Bent hand taps palm.",
  HOME: "Flat O-hand taps cheek twice.",
  SCHOOL: "Clap hands twice.",
  WORK: "S-hands tap wrists together.",
  HOSPITAL: "H-handshape draws cross on upper arm.",
  STORE: "Flat O-hands swing forward twice.",
  CHURCH: "C-handshape taps back of S-hand.",
  CITY: "Fingertips touch repeatedly while moving.",
  COUNTRY: "Y-handshape circles elbow.",
  GO: "Index fingers arc forward.",
  COME: "Index fingers arc toward body.",
  WANT: "Claw hands pull toward body.",
  NEED: "X-handshape bends down twice.",
  LIKE: "8-handshape pulls from chest.",
  LOVE: "Cross arms over chest.",
  KNOW: "Bent hand taps forehead.",
  THINK: "Index finger circles at temple.",
};

export const DYNAMIC_SIGNS: Record<string, string> = {
  ...CORE_DYNAMIC_SIGNS,
  ...MOTION_LETTER_SIGNS,
  ...EXPANDED_SIGNS,
};

export const DYNAMIC_LABELS = Object.keys(DYNAMIC_SIGNS);

// Signs available in the current model (subset of DYNAMIC_LABELS)
// This is updated as real data is trained. v1 model only has the 8 core signs.
// v2 adds J and Z; W3 adds the full 200.
export const AVAILABLE_DYNAMIC_SIGNS = new Set([
  ...Object.keys(CORE_DYNAMIC_SIGNS),
  ...Object.keys(MOTION_LETTER_SIGNS),
  // W3 signs are added here as models are trained and deployed
]);

export interface CurriculumItem {
  id: string;
  type: "static" | "dynamic";
  label: string;
  description: string;
  category?: string;
  available: boolean;
}

export const CURRICULUM: CurriculumItem[] = [
  ...STATIC_LETTERS.map((letter) => ({
    id: `asl-static-${letter}`,
    type: "static" as const,
    label: letter,
    description: LETTER_DESCRIPTIONS[letter],
    available: true,
  })),
  ...MOTION_LETTERS.map((letter) => ({
    id: `asl-dynamic-${letter}`,
    type: "dynamic" as const,
    label: letter,
    description: LETTER_DESCRIPTIONS[letter],
    category: "Motion letters",
    available: true,
  })),
  ...Object.entries(DYNAMIC_SIGNS)
    .filter(([word]) => !MOTION_LETTERS.includes(word as MotionLetter))
    .map(([word, desc]) => {
      const category = Object.entries(SIGN_CATEGORIES).find(([, signs]) =>
        signs.includes(word)
      )?.[0];
      return {
        id: `asl-dynamic-${word}`,
        type: "dynamic" as const,
        label: word,
        description: desc,
        category,
        available: AVAILABLE_DYNAMIC_SIGNS.has(word),
      };
    }),
];