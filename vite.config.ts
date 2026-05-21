import dotenv from 'dotenv';
dotenv.config();

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {GoogleGenAI, Type} from "@google/genai";

const netlifySolveDevPlugin = () => ({
  name: 'netlify-solve-dev',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url && req.url.startsWith('/.netlify/functions/solve')) {
        if (req.method === 'POST') {
          try {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }
            const parsedBody = JSON.parse(body || '{}');
            const { image } = parsedBody;

            if (!image) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: "Missing 'image' property." }));
              return;
            }

            let base64Data = image;
            let mimeType = "image/png";

            if (image.startsWith("data:")) {
              const match = image.match(/^data:([^;]+);base64,(.*)$/);
              if (match) {
                mimeType = match[1];
                base64Data = match[2];
              }
            }

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: "GEMINI_API_KEY environment variable is not defined on Vite development server!" }));
              return;
            }

            const ai = new GoogleGenAI({ apiKey });
            const promptText = `Analyze this word search puzzle image.
Your task is to accurately extract:
1. "grid": A 2-dimensional array of single characters representing the letter grid sequence exactly as pictured from left-to-right, row-by-row (top-to-bottom).
2. "words": A list of target words to find, extracted from the word bank displayed in the image.

Ensure the "grid" rows have matching columns alignment, containing uppercase letters. Do not attempt to solve the coordinate paths yourself, just extract the grid and word bank.`;

            const aiResponse = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    grid: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      },
                      description: "2D grid of uppercase characters from the word search image."
                    },
                    words: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Clean lists of keywords / word bank words to find in the grid."
                    }
                  },
                  required: ["grid", "words"]
                }
              }
            });

            const textResponse = aiResponse.text;
            let solvedData = JSON.parse(textResponse || '{}');

            // Validate structure consistency
            if (!solvedData.grid || !Array.isArray(solvedData.grid)) {
              solvedData.grid = [];
            }
            if (!solvedData.words || !Array.isArray(solvedData.words)) {
              solvedData.words = [];
            }

            // Programmatically solve word search in dev proxy
            const grid = solvedData.grid;
            const words = solvedData.words;
            const solutions: any[] = [];

            const numRows = grid.length;
            const numCols = numRows > 0 ? grid[0].length : 0;

            const directions = [
              [0, 1],   // Right
              [0, -1],  // Left
              [1, 0],   // Down
              [-1, 0],  // Up
              [1, 1],   // Down-Right
              [-1, -1], // Up-Left
              [1, -1],  // Down-Left
              [-1, 1]   // Up-Right
            ];

            // Normalize comparison values by uppercase & removing spaces/symbols
            const normGrid = grid.map(row =>
              row.map(cell => String(cell || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))
            );

            for (const rawWord of words) {
              const cleanWord = String(rawWord || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (cleanWord.length === 0) continue;
              const wordLen = cleanWord.length;
              let foundWord = false;

              // Scan entire grid for occurrences of this word
              for (let r = 0; r < numRows && !foundWord; r++) {
                for (let c = 0; c < numCols && !foundWord; c++) {
                  if (normGrid[r][c] === cleanWord[0]) {
                    for (const [dr, dc] of directions) {
                      let matched = true;
                      let currR = r;
                      let currC = c;

                      for (let i = 1; i < wordLen; i++) {
                        currR += dr;
                        currC += dc;
                        if (
                          currR < 0 || currR >= numRows ||
                          currC < 0 || currC >= numCols ||
                          normGrid[currR][currC] !== cleanWord[i]
                        ) {
                          matched = false;
                          break;
                        }
                      }

                      if (matched) {
                        solutions.push({
                          word: rawWord,
                          startRow: r,
                          startCol: c,
                          endRow: r + dr * (wordLen - 1),
                          endCol: c + dc * (wordLen - 1)
                        });
                        foundWord = true;
                        break;
                      }
                    }
                  }
                }
              }
            }

            solvedData.solutions = solutions;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(solvedData));
          } catch (err: any) {
            console.error("Vite proxy netlify solve handler error:", err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || "Internal server error" }));
          }
          return;
        } else if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.end("OK");
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), netlifySolveDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
