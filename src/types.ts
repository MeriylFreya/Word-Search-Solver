/**
 * Type declarations for the WordSolve AI application.
 */

export type Coordinate = [number, number];

export interface WordColor {
  fill: string;
  stroke: string;
}

export type FoundPositionsMap = Record<string, Coordinate[]>;
export type WordColorsMap = Record<string, WordColor>;

export interface StatusState {
  type: "idle" | "loading" | "success" | "error";
  text: string;
}

export interface FloatingDoodle {
  id: number;
  text: string;
  left: string;
  top: string;
  color: string;
}
