import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const handler = async (event, context) => {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Handle preflight options request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight OK" })
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed. Use POST." })
    };
  }

  try {
    console.log("[Solve Function] Received request to solve word search puzzle.");

    if (!event.body) {
      console.error("[Solve Function] Empty request body.");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing body in request. Please provide base64 image." })
      };
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (e) {
      console.error("[Solve Function] Failed to parse request body as JSON:", e.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON format in request body." })
      };
    }

    const { image } = parsedBody;
    if (!image) {
      console.error("[Solve Function] Missing 'image' property in JSON payload.");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing 'image' property in JSON payload containing base64 string." })
      };
    }

    // Check for correct format and extract base64 raw data
    let base64Data = image;
    let mimeType = "image/png";

    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
        console.log(`[Solve Function] Parsed data URL. MimeType: ${mimeType}, Content Length: ${base64Data.length}`);
      } else {
        console.warn("[Solve Function] Image starts with 'data:' but regex match failed.");
      }
    }

    // Verify key exists
    if (!process.env.GEMINI_API_KEY) {
      console.error("[Solve Function] Error: GEMINI_API_KEY environment variable is not defined!");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Gemini API key is not configured on the server." })
      };
    }

    console.log("[Solve Function] Contacting Gemini API...");

    const promptText = `Analyze this word search puzzle image.
Your task is to accurately extract:
1. "grid": A 2-dimensional array of single characters representing the letter grid sequence exactly as pictured from left-to-right, row-by-row (top-to-bottom).
2. "words": A list of target words to find, extracted from the word bank displayed in the image.

Ensure the "grid" rows have matching columns alignment, containing uppercase letters. Do not attempt to solve the coordinate paths yourself, just extract the grid and word bank.`;

    const response = await ai.models.generateContent({
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
              description: "Clean list of words to find in the grid."
            }
          },
          required: ["grid", "words"]
        }
      }
    });

    const textResponse = response.text;
    console.log("[Solve Function] Gemini API raw response text:", textResponse);

    if (!textResponse) {
      throw new Error("Zero-length response text from Gemini API.");
    }

    // Safely parse JSON and handle errors
    let solvedData;
    try {
      solvedData = JSON.parse(textResponse);
    } catch (parseError) {
      console.error("[Solve Function] AI returned non-parseable JSON. Attempting cleanup on:", textResponse);
      const startIdx = textResponse.indexOf("{");
      const endIdx = textResponse.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
        const cleanedStr = textResponse.substring(startIdx, endIdx + 1);
        solvedData = JSON.parse(cleanedStr);
      } else {
        throw new Error("Could not extract a valid JSON structure from response.");
      }
    }

    // Validate structure consistency
    if (!solvedData.grid || !Array.isArray(solvedData.grid)) {
      solvedData.grid = [];
    }
    if (!solvedData.words || !Array.isArray(solvedData.words)) {
      solvedData.words = [];
    }

    // Programmatically solve the word search from extracted grid & word list
    console.log("[Solve Function] Programmatically solving word search...");
    
    const grid = solvedData.grid;
    const words = solvedData.words;
    const solutions = [];

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

    console.log(`[Solve Function] Successfully solved. Grid size: ${numRows}x${numCols}. Extracted ${words.length} words and programmatically found ${solutions.length} solutions.`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(solvedData)
    };

  } catch (error) {
    console.error("[Solve Function] Critical handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error occurred when parsing word search image.",
        details: error.message
      })
    };
  }
};
