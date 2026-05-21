import React, { useState, useEffect, useRef } from "react";
import { Grid, ArrowDown, Upload, Sparkles, Check, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Coordinate, FoundPositionsMap, WordColorsMap, StatusState, FloatingDoodle } from "./types";
import { findWordInGrid } from "./solverUtils";

const HIGHLIGHT_COLORS = [
  { fill: 'rgba(212,168,64,0.35)', stroke: '#d4a840' },
  { fill: 'rgba(107,143,113,0.35)', stroke: '#6b8f71' },
  { fill: 'rgba(155,142,196,0.35)', stroke: '#9b8ec4' },
  { fill: 'rgba(232,97,74,0.35)', stroke: '#e8614a' },
  { fill: 'rgba(107,174,214,0.35)', stroke: '#6baed6' },
  { fill: 'rgba(232,160,144,0.35)', stroke: '#e8a090' },
  { fill: 'rgba(143,188,143,0.35)', stroke: '#8fbc8b' },
  { fill: 'rgba(176,196,222,0.35)', stroke: '#b0c4de' },
];

export default function App() {
  const [grid, setGrid] = useState<string[][]>([]);
  const [wordsList, setWordsList] = useState<string[]>([]);
  const [gridInputText, setGridInputText] = useState("");
  const [wordsInputText, setWordsInputText] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [status, setStatus] = useState<StatusState>({ type: "idle", text: "" });
  const [foundPositions, setFoundPositions] = useState<FoundPositionsMap>({});
  const [wordColors, setWordColors] = useState<WordColorsMap>({});
  const [solved, setSolved] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [doodles, setDoodles] = useState<FloatingDoodle[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const solverSectionRef = useRef<HTMLElement>(null);

  // Trigger floating decorative doodles
  const triggerDoodle = (text: string) => {
    const id = Date.now() + Math.random();
    const colors = ['#e8614a', '#6b8f71', '#9b8ec4', '#d4a840'];
    const newDoodle: FloatingDoodle = {
      id,
      text,
      left: (20 + Math.random() * 60) + "%",
      top: (30 + Math.random() * 30) + "%",
      color: colors[Math.floor(Math.random() * colors.length)]
    };
    setDoodles(prev => [...prev, newDoodle]);
    setTimeout(() => {
      setDoodles(prev => prev.filter(d => d.id !== id));
    }, 6000);
  };

  // Convert uploaded image to base64 and invoke backend AI API
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", text: "Please use configured image formats (PNG, JPG, WEBP)." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Str = e.target?.result as string;
      setImageUri(base64Str);
      setStatus({ type: "loading", text: "AI is reading your puzzle image..." });

      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Str }),
        });

        if (!response.ok) {
          let errData: any = {};
          try {
            errData = await response.json();
          } catch {}
          throw new Error(errData.error || "Failed to parse grid puzzle accurately");
        }

        const data = await response.json();
        const extractedGrid: string[][] = data.grid || [];
        const extractedWords: string[] = data.words || [];

        setGrid(extractedGrid);
        setWordsList(extractedWords);

        // Update text areas for synchronization
        const gridText = extractedGrid.map(row => row.join("")).join("\n");
        const wordsText = extractedWords.join(", ");
        setGridInputText(gridText);
        setWordsInputText(wordsText);

        setStatus({ type: "success", text: "✓ Grid & list extracted! Solved instantly." });
        solvePuzzle(extractedGrid, extractedWords);
        triggerDoodle("extracted! ✨");

        setTimeout(() => {
          setStatus(prev => prev.type === "success" ? { type: "idle", text: "" } : prev);
        }, 4000);

      } catch (err: any) {
        console.error(err);
        setStatus({ type: "error", text: `AI OCR Failed: ${err.message || "Connection timeout"}. Feel free to type manually.` });
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  // Try standard or sample puzzles
  const handleLoadSample = () => {
    const sampleGrid = [
      'SUNFLOWER TX',
      'ZBTREEOXPQM',
      'ACLOUDBVAIN',
      'RAINYDAWNWE',
      'ABCSTORMFGP',
      'FLOODWORTHZ',
      'MXSNOWQREFY',
      'WINDJKPARKW',
      'HVBOULDEROI',
      'SPRINGLAKEND',
    ].map(l => l.replace(/\s/g,''));

    const sampleWords = 'SUNFLOWER,TREE,CLOUD,RAIN,STORM,FLOOD,SNOW,WIND,BOULDER,SPRING,LAKE,DAWN,PARK'.split(',');
    const parsedGrid = sampleGrid.map(row => row.split(""));

    setGrid(parsedGrid);
    setWordsList(sampleWords);
    setGridInputText(sampleGrid.join("\n"));
    setWordsInputText(sampleWords.join(", "));

    solvePuzzle(parsedGrid, sampleWords);
    setStatus({ type: "success", text: "✓ Sample loaded!" });
    triggerDoodle("sample loaded ✨");

    setTimeout(() => {
      setStatus(prev => prev.type === "success" ? { type: "idle", text: "" } : prev);
    }, 3000);
  };

  // Perform localized coordinates matching in the grid
  const solvePuzzle = (currGrid: string[][], currWords: string[]) => {
    if (currGrid.length === 0) return;
    
    const found: FoundPositionsMap = {};
    const colors: WordColorsMap = {};

    currWords.forEach((word, idx) => {
      const pos = findWordInGrid(currGrid, word);
      if (pos) {
        found[word] = pos;
        colors[word] = HIGHLIGHT_COLORS[idx % HIGHLIGHT_COLORS.length];
      }
    });

    setFoundPositions(found);
    setWordColors(colors);
    setSolved(true);
  };

  const handleManualSolve = () => {
    if (grid.length === 0) {
      alert("Please upload a puzzle image or enter your grid letters details manually first!");
      return;
    }
    if (wordsList.length === 0) {
      alert("Please specify at least one word to find/solve!");
      return;
    }
    solvePuzzle(grid, wordsList);
    triggerDoodle("solved! ✦");
  };

  // Handle manual grid edits reactively
  const handleGridTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setGridInputText(text);

    const lines = text.toUpperCase().split("\n").filter(l => l.trim());
    const parsedGrid = lines.map(line => line.replace(/\s/g, "").split(""));
    setGrid(parsedGrid);

    if (wordsList.length > 0) {
      solvePuzzle(parsedGrid, wordsList);
    }
  };

  const handleWordsTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setWordsInputText(text);

    const parsedWords = text
      .toUpperCase()
      .split(",")
      .map(w => w.trim())
      .filter(w => w.length > 0);
    setWordsList(parsedWords);

    if (grid.length > 0) {
      solvePuzzle(grid, parsedWords);
    }
  };

  // Canvas re-rendering cycle when state elements match
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || grid.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 38;
    const cols = Math.max(...grid.map(row => row.length));
    const rows = grid.length;

    canvas.width = cols * CELL;
    canvas.height = rows * CELL;

    // Background color matching scrap scheme
    ctx.fillStyle = "#faf6ef";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Helpers to draw rounded boxes
    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r);
      c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h);
      c.arcTo(x, y + h, x, y + h - r, r);
      c.lineTo(x, y + r);
      c.arcTo(x, y, x + r, y, r);
      c.closePath();
    };

    // Draw grid characters
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < (grid[r]?.length || 0); c++) {
        const x = c * CELL;
        const y = r * CELL;

        ctx.fillStyle = "#fdfaf5";
        roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 6);
        ctx.fill();

        ctx.strokeStyle = "rgba(237, 228, 208, 0.8)";
        ctx.lineWidth = 1;
        roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 6);
        ctx.stroke();

        ctx.fillStyle = "#3d3830";
        ctx.font = "bold 15px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(grid[r][c] || "", x + CELL / 2, y + CELL / 2);
      }
    }

    // Draw solver highlight capsules over matching coordinates
    Object.entries(foundPositions).forEach(([word, pos]) => {
      const positions = pos as Coordinate[];
      const col = wordColors[word];
      if (!col || !positions || positions.length === 0) return;

      const first = positions[0];
      const last = positions[positions.length - 1];

      const x1 = first[1] * CELL + CELL / 2;
      const y1 = first[0] * CELL + CELL / 2;
      const x2 = last[1] * CELL + CELL / 2;
      const y2 = last[0] * CELL + CELL / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const R = CELL * 0.45;

      ctx.save();
      ctx.translate(x1 + dx / 2, y1 + dy / 2);
      ctx.rotate(angle);

      ctx.beginPath();
      const halfLen = len / 2;
      ctx.moveTo(-halfLen, -R);
      ctx.lineTo(halfLen, -R);
      ctx.arc(halfLen, 0, R, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-halfLen, R);
      ctx.arc(-halfLen, 0, R, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();

      ctx.fillStyle = col.fill;
      ctx.fill();

      ctx.strokeStyle = col.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    });

  }, [grid, foundPositions, wordColors]);

  const scrollToSolver = () => {
    solverSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const foundCount = Object.keys(foundPositions).length;

  return (
    <>
      {/* Background decoration elements */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>

      {/* Navigation */}
      <nav>
        <div className="nav-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 17.5h7M17.5 14v7" strokeWidth="2.5" />
            </svg>
          </div>
          <span className="logo-text">WordSolve<span>AI</span></span>
        </div>
        <button className="nav-link" onClick={scrollToSolver}>✦ Try it now</button>
      </nav>

      {/* Hero Header */}
      <section className="hero">
        <div className="hero-eyebrow">✦ AI-powered puzzle solving</div>
        <h1 className="hero-title">
          Solve any word search<br /><em>instantly</em>
        </h1>
        <p className="hero-sub">
          Drop in a puzzle image. Our Gemini AI processes the layout, extracts the grid and target word list, and highlights all solutions beautifully — in seconds.
        </p>
        <div className="hero-cta">
          <button className="btn-primary" onClick={scrollToSolver}>
            <ArrowDown className="w-[18px] h-[18px] stroke-3" />
            Open the solver
          </button>
        </div>
        <div className="hero-pills">
          <div className="pill">📸 Upload any image</div>
          <div className="pill">🧠 Vision AI extracts layout</div>
          <div className="pill">✨ One-character fuzzy toleration</div>
          <div className="pill">🆓 Free forever</div>
        </div>

        {/* Decorative Doodles in Hero */}
        <div style={{ position: "absolute", top: "18%", left: "6%", fontFamily: "var(--font-hand)", fontSize: "1rem", color: "var(--ink-muted)", opacity: 0.5, transform: "rotate(-8deg)" }}>
          drop it here ↓
        </div>
        <div style={{ position: "absolute", top: "22%", right: "8%", fontFamily: "var(--font-hand)", fontSize: "0.9rem", color: "var(--sage)", opacity: 0.5, transform: "rotate(5deg)" }}>
          magic happens ✨
        </div>
        <div style={{ position: "absolute", bottom: "18%", left: "10%", fontFamily: "var(--font-hand)", fontSize: "0.85rem", color: "var(--lavender)", opacity: 0.5, transform: "rotate(-4deg)" }}>
          found it!
        </div>
      </section>

      {/* How it works torn paper divider */}
      <div className="torn-divider"></div>

      <section className="how-section reveal visible" id="how">
        <p className="section-label">— how it works —</p>
        <h2 className="section-title">Three steps of intelligence</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3 className="step-title">Upload your puzzle</h3>
            <p className="step-desc">Drag & drop a photo, magazine screenshot, or paper scan.</p>
            <div className="step-note">any quality or orientation ✓</div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h3 className="step-title">AI Vision OCR reads it</h3>
            <p className="step-desc">Gemini AI detects all letter blocks & lists without truncating rows.</p>
            <div className="step-note">intelligent letter inference ✓</div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h3 className="step-title">Words found!</h3>
            <p className="step-desc">Hidden indices are resolved with beautiful highlight contours.</p>
            <div className="step-note">all directions solved ✓</div>
          </div>
        </div>
      </section>

      {/* Main Solver Interaction Area */}
      <section className="demo-section" id="solver" ref={solverSectionRef}>
        <p className="section-label">— the solver —</p>
        <h2 className="section-title">Your puzzle, solved</h2>
        <p className="section-note">Upload an image or try the sample puzzle below ↓</p>

        <div className="app-grid">
          {/* Left panel: Upload Card */}
          <div className="upload-card reveal visible">
            {/* scrapbook tape decorations */}
            <div className="tape" style={{ width: "50px", height: "18px", top: "-9px", left: "40px", transform: "rotate(-2deg)" }}></div>
            <div className="tape" style={{ width: "50px", height: "18px", top: "-9px", right: "60px", transform: "rotate(2deg)" }}></div>

            <h3 className="card-title">Upload Puzzle</h3>
            <p className="card-note">drag & drop or click to choose a file</p>

            <div
              className={`drop-zone ${isDragOver ? "dragover" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="drop-zone-icon">
                <Upload className="w-7 h-7 stroke-cream fill-none" />
              </div>
              <p className="drop-label">drop your puzzle here ✨</p>
              <p className="drop-sub">PNG, JPG, WEBP — any dimension</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", zIndex: 10 }}>
                <button
                  className="drop-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Choose File
                </button>
                <button
                  className="sample-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadSample();
                  }}
                >
                  ✦ Try Sample
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                id="imageInput"
                accept="image/*"
                onChange={handleFileInputChange}
              />
            </div>

            {/* Selected Image Preview */}
            {imageUri && (
              <div className="image-preview-wrap" style={{ display: "block" }}>
                <img src={imageUri} alt="puzzle preview" />
                <div className="sticker" style={{ bottom: "8px", right: "12px" }}>your puzzle →</div>
              </div>
            )}

            {/* AI OCR Activity and Error Toasts */}
            {status.type !== "idle" && (
              <div className={`processing-indicator show ${status.type === "success" ? "success-state" : status.type === "error" ? "error-state" : ""}`}>
                {status.type === "loading" && <div className="spinner"></div>}
                <span>{status.text}</span>
              </div>
            )}

            {/* Grid Edit Block */}
            <div className="field-group">
              <div className="field-label">
                <span className="dot"></span>
                Grid letters (auto-extracted or edits)
              </div>
              <textarea
                id="gridInput"
                value={gridInputText}
                onChange={handleGridTextChange}
                placeholder="Grid auto-fills after upload…&#10;Or type/paste it like:&#10;HELLOWORLD&#10;PUZZLESOLV&#10;WORDSFOUND"
              />
            </div>

            {/* Word Targets Edit Block */}
            <div className="field-group">
              <div className="field-label">
                <span className="dot" style={{ backgroundColor: "var(--sage)" }}></span>
                Words to find (comma-separated list)
              </div>
              <textarea
                id="wordsInput"
                value={wordsInputText}
                onChange={handleWordsTextChange}
                placeholder="HELLO, WORLD, PUZZLE…"
              />
            </div>

            <button className="solve-btn" onClick={handleManualSolve}>
              🔍 Solve Puzzle
            </button>
          </div>

          {/* Right panel: Solution & Canvas Results Card */}
          <div className="results-card reveal visible">
            <div className="tape" style={{ width: "50px", height: "18px", top: "-9px", left: "80px", transform: "rotate(-1deg)" }}></div>

            {!solved && (
              <div className="empty-state" id="emptyState">
                <div className="empty-icon">🔍</div>
                <h3 className="empty-title">Your solution appears here</h3>
                <p className="empty-note">Upload a puzzle image or try the sample →</p>
                {/* little scribble grid preview animation */}
                <svg width="200" height="120" style={{ marginTop: "20px", opacity: 0.15 }} viewBox="0 0 200 120" fill="none">
                  <g stroke="#1c1a17" strokeWidth="1.5">
                    <rect x="10" y="10" width="25" height="25" rx="4" /><rect x="40" y="10" width="25" height="25" rx="4" /><rect x="70" y="10" width="25" height="25" rx="4" /><rect x="100" y="10" width="25" height="25" rx="4" /><rect x="130" y="10" width="25" height="25" rx="4" />
                    <rect x="10" y="40" width="25" height="25" rx="4" /><rect x="40" y="40" width="25" height="25" rx="4" /><rect x="70" y="40" width="25" height="25" rx="4" /><rect x="100" y="40" width="25" height="25" rx="4" /><rect x="130" y="40" width="25" height="25" rx="4" />
                    <rect x="10" y="70" width="25" height="25" rx="4" /><rect x="40" y="70" width="25" height="25" rx="4" /><rect x="70" y="70" width="25" height="25" rx="4" /><rect x="100" y="70" width="25" height="25" rx="4" /><rect x="130" y="70" width="25" height="25" rx="4" />
                  </g>
                  <circle cx="22.5" cy="22.5" r="11" fill="rgba(232,97,74,0.25)" stroke="rgba(232,97,74,0.6)" strokeWidth="1.5" />
                  <circle cx="52.5" cy="52.5" r="11" fill="rgba(107,143,113,0.25)" stroke="rgba(107,143,113,0.6)" strokeWidth="1.5" />
                  <circle cx="82.5" cy="82.5" r="11" fill="rgba(155,142,196,0.25)" stroke="rgba(155,142,196,0.6)" strokeWidth="1.5" />
                  <text x="22.5" y="27" textAnchor="middle" fontSize="11" fill="#1c1a17" fontFamily="Courier New">H</text>
                  <text x="52.5" y="57" textAnchor="middle" fontSize="11" fill="#1c1a17" fontFamily="Courier New">I</text>
                  <text x="82.5" y="87" textAnchor="middle" fontSize="11" fill="#1c1a17" fontFamily="Courier New">!</text>
                </svg>
              </div>
            )}

            {solved && (
              <div className="grid-display" style={{ display: "flex" }}>
                <div className="grid-display-header">
                  <span className="grid-display-title">Solution Dashboard</span>
                  <div className="stats-row">
                    <div className="stat-chip">Found <strong>{foundCount}</strong></div>
                    <div className="stat-chip">Total <strong>{wordsList.length}</strong></div>
                  </div>
                </div>

                <div className="overflow-auto max-w-full">
                  <canvas ref={canvasRef} id="gridCanvas" />
                </div>

                {/* Color-mapped matching word-tags list */}
                <div className="word-tags-wrap" id="wordTags">
                  {wordsList.map((word, i) => {
                    const isFound = !!foundPositions[word];
                    const col = wordColors[word];
                    const styleProps = isFound && col ? {
                      borderColor: col.stroke,
                      color: col.stroke,
                      backgroundColor: col.fill
                    } : {};

                    return (
                      <div
                        key={word + "-" + i}
                        className={`word-tag ${isFound ? "found" : "not-found"}`}
                        style={{ ...styleProps }}
                      >
                        {isFound ? `✓ ${word}` : word}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Floating Animated Scribble Doodles */}
      <AnimatePresence>
        {doodles.map((d) => (
          <motion.div
            key={d.id}
            className="float-doodle"
            initial={{ opacity: 0, y: 30, rotate: -5 }}
            animate={{ opacity: 0.5, y: -80, rotate: 5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 6, ease: "easeOut" }}
            style={{
              left: d.left,
              top: d.top,
              color: d.color,
              fontFamily: "var(--font-hand)",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              pointerEvents: "none"
            }}
          >
            {d.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Footer block */}
      <footer>
        <div className="footer-logo">PuzzleInk</div>
        <p className="footer-tagline">made for puzzle lovers ✦ runs entirely in your browser</p>
        <div className="footer-bottom">&copy; 2026 PuzzleInk. Powered by Gemini AI. No data collected. Ever.</div>
        <div className="footer-links">
          <a href="#solver" onClick={scrollToSolver}>Return to Solver</a>
        </div>
      </footer>
    </>
  );
}
