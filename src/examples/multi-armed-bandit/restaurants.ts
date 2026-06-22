import type { Restaurant } from "./simulation";

export const DEFAULT_RESTAURANTS: Restaurant[] = [
  { name: "Chez Claudette", dist: [0.1, 0.3, 0.6] },
  { name: "La Banquise", dist: [0.2, 0.4, 0.4] },
  { name: "Poutineville", dist: [0.5, 0.3, 0.2] },
];

export const DEFAULT_EPSILON = 0.1;
export const DEFAULT_OPTIMISTIC_INIT = 4;
export const DEFAULT_SEED = 12345;
export const MAX_VALUE = 3;
