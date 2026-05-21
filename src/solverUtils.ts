import { Coordinate } from "./types";

/**
 * Finds a word inside a letter grid using exact matching,
 * falling back to single character mismatch fuzzy matching if needed.
 * 
 * Supports 8 cardinal directions (horizontal, vertical, diagonal, forward/backward).
 */
export function findWordInGrid(grid: string[][], word: string): Coordinate[] | null {
  const W = word.toUpperCase();
  const rows = grid.length;
  if (rows === 0) return null;
  const cols = grid[0].length;

  const DIRECTIONS = [
    [0, 1],   // Right
    [1, 0],   // Down
    [0, -1],  // Left
    [-1, 0],  // Up
    [1, 1],   // Down-Right
    [1, -1],  // Down-Left
    [-1, 1],  // Up-Right
    [-1, -1]  // Up-Left
  ];

  // 1. Try Exact matching
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== W[0]) continue;
      for (const [dr, dc] of DIRECTIONS) {
        let isMatch = true;
        const coords: Coordinate[] = [];
        for (let i = 0; i < W.length; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] !== W[i]) {
            isMatch = false;
            break;
          }
          coords.push([nr, nc]);
        }
        if (isMatch) return coords;
      }
    }
  }

  // 2. Try Fuzzy matching with 1-character mismatch tolerance
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        let mismatches = 0;
        const coords: Coordinate[] = [];
        let isMatch = true;
        for (let i = 0; i < W.length; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
            isMatch = false;
            break;
          }
          if (grid[nr][nc] !== W[i]) {
            mismatches++;
            if (mismatches > 1) {
              isMatch = false;
              break;
            }
          }
          coords.push([nr, nc]);
        }
        if (isMatch && mismatches <= 1) {
          return coords; // Word matching with high tolerance
        }
      }
    }
  }

  return null;
}
