import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoints
  app.post("/api/extract", async (req, res) => {
    try {
      const { image } = req.body; // base64 representation of the image
      if (!image) {
        return res.status(400).json({ error: "Missing image parameter" });
      }

      // Check if GEMINI_API_KEY is defined
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing on server" });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Split mime and base64 parts
      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      let mimeType = "image/png";
      let base64Data = image;

      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };

      const promptPart = {
        text: `You are an expert at parsing word search puzzle grids and word lists from images.
Analyze the target image containing a word search puzzle. Extract:
1. The 2D letter grid. Preserve the exact layout (rows and columns). Keep the length of all rows consistent. Ignore background decorative artwork.
2. The list of uppercase strings containing the words to find in the puzzle. Focus strictly on words in the word bank/list, and ignore any other miscellaneous words on the page.

If letters are blurry or handwritten, intelligently infer what they are based on standard alignments and puzzle structure. For characters that appear like numbers or symbols, correct them (e.g., 0 to O, 1 to I, 5 to S, 8 to B, | to I).`,
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grid: {
                type: Type.ARRAY,
                description: "A 2D array representing the letters of the grid. It must be rectangular (all row arrays having the exact same length value).",
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING
                  }
                }
              },
              words: {
                type: Type.ARRAY,
                description: "The list of target search words to find in the puzzle grid. Exclude decorative headers or surrounding text.",
                items: {
                  type: Type.STRING
                }
              }
            },
            required: ["grid", "words"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("AI did not return any OCR response");
      }

      const jsonResults = JSON.parse(responseText.trim());
      
      // Clean and validate the response
      const validated = cleanAndValidateOCRResponse(jsonResults);

      return res.json(validated);
    } catch (err: any) {
      console.error("AI OCR error:", err);
      return res.status(500).json({ error: err.message || "An error occurred during AI OCR grid extraction" });
    }
  });

  // Helper to validate and clean the OCR structure
  function cleanAndValidateOCRResponse(raw: any) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid AI extraction format");
    }

    let words = Array.isArray(raw.words) ? raw.words : [];
    let grid = Array.isArray(raw.grid) ? raw.grid : [];

    // Clean words
    words = words
      .map((w: any) => {
        if (typeof w !== "string") return "";
        let cleaned = w.trim().toUpperCase();
        cleaned = cleaned
          .replace(/0/g, 'O')
          .replace(/1/g, 'I')
          .replace(/5/g, 'S')
          .replace(/8/g, 'B')
          .replace(/\|/g, 'I');
        return cleaned.replace(/[^A-Z]/g, '');
      })
      .filter((w: string) => w.length > 0);

    // Clean grid cells
    grid = grid.map((row: any) => {
      if (!Array.isArray(row)) return [];
      return row.map((cell: any) => {
        if (typeof cell !== "string") return "X";
        let cleaned = cell.trim().toUpperCase().charAt(0);
        // Fallback corrections
        cleaned = cleaned
          .replace(/0/g, 'O')
          .replace(/1/g, 'I')
          .replace(/5/g, 'S')
          .replace(/8/g, 'B')
          .replace(/\|/g, 'I');
        if (!/^[A-Z]$/.test(cleaned)) {
          return "X";
        }
        return cleaned;
      });
    }).filter((row: any[]) => row.length > 0);

    if (grid.length === 0) {
      throw new Error("No grid elements extracted");
    }

    // Grid dimension alignment (make rectangular)
    const rowLengths = grid.map((r: any[]) => r.length);
    const maxLen = Math.max(...rowLengths);

    grid = grid.map((r: any[]) => {
      if (r.length < maxLen) {
        const padding = Array(maxLen - r.length).fill("X");
        return r.concat(padding);
      } else if (r.length > maxLen) {
        return r.slice(0, maxLen);
      }
      return r;
    });

    return { grid, words };
  }

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
