import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Check,
  FileImage,
  HelpCircle,
  Lightbulb,
  Play,
  ArrowRight,
  Award,
  Flame,
  MousePointerClick,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Responsive grid coordinate helpers (returns center offset coordinate, 0-100 scale)
const getCellCenterPercent = (coord, total) => {
  return ((coord + 0.5) / total) * 100;
};

// Pastel rainbow glow categories for highlight capsules
const GLOW_COLORS = [
  { stroke: "rgb(236, 72, 153)", fill: "rgba(236, 72, 153, 0.22)" }, // Pink
  { stroke: "rgb(16, 185, 129)", fill: "rgba(16, 185, 129, 0.22)" }, // Emerald
  { stroke: "rgb(59, 130, 246)", fill: "rgba(59, 130, 246, 0.22)" }, // Blue
  { stroke: "rgb(245, 158, 11)", fill: "rgba(245, 158, 11, 0.22)" }, // Amber
  { stroke: "rgb(139, 92, 246)", fill: "rgba(139, 92, 246, 0.22)" }, // Violet
  { stroke: "rgb(20, 184, 166)", fill: "rgba(20, 184, 166, 0.22)" }, // Teal
  { stroke: "rgb(244, 63, 94)", fill: "rgba(244, 63, 94, 0.22)" },  // Rose
  { stroke: "rgb(6, 182, 212)", fill: "rgba(6, 182, 212, 0.22)" }   // Cyan
];

// Pre-loaded offline demo schema
const DEMO_PUZZLE = {
  grid: [
    ["G", "E", "M", "I", "N", "I", "A", "I", "S", "Y", "S"],
    ["O", "C", "R", "S", "O", "L", "V", "E", "R", "W", "E"],
    ["O", "P", "U", "Z", "Z", "L", "E", "G", "C", "O", "A"],
    ["G", "E", "S", "W", "O", "R", "D", "R", "H", "R", "R"],
    ["L", "X", "I", "M", "A", "G", "E", "I", "Y", "D", "C"],
    ["E", "V", "I", "S", "I", "O", "N", "D", "K", "S", "H"],
    ["D", "E", "T", "E", "C", "T", "I", "O", "N", "E", "W"],
    ["M", "X", "W", "A", "P", "F", "E", "T", "C", "H", "B"],
    ["V", "I", "L", "I", "G", "H", "T", "O", "U", "T", "Z"],
    ["N", "E", "T", "L", "I", "F", "Y", "J", "S", "O", "N"]
  ],
  words: ["GEMINI", "OCR", "SOLVER", "PUZZLE", "WORD", "IMAGE", "VISION", "DETECTION", "NETLIFY", "JSON", "GOOGLE", "FETCH"],
  solutions: [
    { word: "GEMINI", startRow: 0, startCol: 0, endRow: 0, endCol: 5 },
    { word: "OCR", startRow: 1, startCol: 0, endRow: 1, endCol: 2 },
    { word: "SOLVER", startRow: 1, startCol: 3, endRow: 1, endCol: 8 },
    { word: "PUZZLE", startRow: 2, startCol: 2, endRow: 2, endCol: 7 },
    { word: "WORD", startRow: 3, startCol: 3, endRow: 3, endCol: 6 },
    { word: "IMAGE", startRow: 4, startCol: 2, endRow: 4, endCol: 6 },
    { word: "VISION", startRow: 5, startCol: 1, endRow: 5, endCol: 6 },
    { word: "DETECTION", startRow: 6, startCol: 0, endRow: 6, endCol: 8 },
    { word: "NETLIFY", startRow: 9, startCol: 0, endRow: 9, endCol: 6 },
    { word: "JSON", startRow: 9, startCol: 7, endRow: 9, endCol: 10 },
    { word: "GOOGLE", startRow: 0, startCol: 0, endRow: 5, endCol: 0 },
    { word: "FETCH", startRow: 7, startCol: 5, endRow: 7, endCol: 9 }
  ]
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  
  // Track words found manually/automatically
  const [foundWords, setFoundWords] = useState<string[]>([]);
  // Hover state to highlight a single word
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  // Track coordinate tracing state (click start then click end letter)
  const [selectedStart, setSelectedStart] = useState<{ row: number; col: number } | null>(null);
  const [activeMessage, setActiveMessage] = useState<string | null>("Upload a word search image to begin.");

  // Scan steps messages
  const loadSteps = [
    "Uploading image to compute node...",
    "Contacting Gemini Vision OCR model...",
    "Detecting grid row & column layout...",
    "Filtering word ban lists...",
    "Calculating vector solution paths..."
  ];

  // Rotate logging feedback
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setScanStep((prev) => (prev + 1) % loadSteps.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert raw file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setImage(null);
    setGrid(null);
    setWords([]);
    setSolutions([]);
    setFoundWords([]);
    setSelectedStart(null);
    setError(null);
    setLoading(true);
    setScanStep(0);
    setActiveMessage("Stitch-parsing puzzle file...");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = reader.result as string;
      setImage(base64String);
      await sendToSolver(base64String);
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // POST base64 payload to Netlify Function solved endpoint
  const sendToSolver = async (base64Image: string) => {
    try {
      console.log("[Client] Posting block image to netlify function...");
      const res = await fetch("/.netlify/functions/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image: base64Image })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Http Error ${res.status}`);
      }

      const data = await res.json();
      console.log("[Client] Solver returned success payload:", data);

      if (!data.grid || data.grid.length === 0) {
        throw new Error("No grid detected in image. Please ensure your photo focuses clearly on the puzzle.");
      }

      setGrid(data.grid);
      setWords(data.words || []);
      setSolutions(data.solutions || []);
      setFoundWords([]);
      setActiveMessage(`Puzzle successfully solved! Double-click or pick letters to play, or hit Solve All.`);
    } catch (err: any) {
      console.error("[Client] Solve Request Failed:", err);
      setError(err.message || "An unexpected error occurred during OCR scanning.");
    } finally {
      setLoading(false);
    }
  };

  // Load offline demo for instant verification
  const handleLoadDemo = () => {
    setError(null);
    setImage("demo"); // Set dummy flag to show mock puzzle layout
    setLoading(true);
    setScanStep(0);
    
    // Simulate a brief awesome scan experience
    setTimeout(() => {
      setGrid(DEMO_PUZZLE.grid);
      setWords(DEMO_PUZZLE.words);
      setSolutions(DEMO_PUZZLE.solutions);
      setFoundWords([]);
      setSelectedStart(null);
      setLoading(false);
      setActiveMessage("Demo puzzle loaded successfully! Try click tracing columns or solved rows manually.");
    }, 1200);
  };

  // Tracing cell click handler
  const handleCellClick = (r: number, c: number) => {
    if (!grid || !solutions) return;

    if (!selectedStart) {
      // First coordinate click
      setSelectedStart({ row: r, col: c });
      setActiveMessage(`Start letter selected: ${grid[r][c]}. Click the ending letter of your word!`);
    } else {
      // Second coordinate click
      const r1 = selectedStart.row;
      const c1 = selectedStart.col;
      const r2 = r;
      const c2 = c;

      if (r1 === r2 && c1 === c2) {
        // Deselect
        setSelectedStart(null);
        setActiveMessage("Selection cancelled.");
        return;
      }

      // Check coordinates against solutions matrix
      const match = solutions.find((sol) => {
        return (
          (sol.startRow === r1 && sol.startCol === c1 && sol.endRow === r2 && sol.endCol === c2) ||
          (sol.startRow === r2 && sol.startCol === c2 && sol.endRow === r1 && sol.endCol === c1)
        );
      });

      if (match) {
        if (!foundWords.includes(match.word)) {
          setFoundWords((prev) => [...prev, match.word]);
          setActiveMessage(`Found word: **${match.word}**! Superb tracking! 🎉`);
        } else {
          setActiveMessage(`You already highlighted ${match.word}.`);
        }
      } else {
        // Try testing if they select back-to-front or if it exists in list
        setActiveMessage("No word spans between those letters. Keep searching!");
      }
      setSelectedStart(null);
    }
  };

  // Highlight all words directly
  const handleSolveAll = () => {
    if (!solutions) return;
    const allWords = solutions.map((s) => s.word);
    setFoundWords(allWords);
    setActiveMessage("AI instantly uncovered all words hidden in the matrix!");
  };

  // Clean application workspace
  const handleReset = () => {
    setImage(null);
    setGrid(null);
    setWords([]);
    setSolutions([]);
    setFoundWords([]);
    setSelectedStart(null);
    setError(null);
    setActiveMessage("Upload a word search image to begin.");
  };

  // SVG Dimension constraints for drawing coordinate path pills
  const totalRows = grid ? grid.length : 1;
  const totalCols = grid && grid[0] ? grid[0].length : 1;

  const dragOverHandler = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const dropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div id="word-solve-container" className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-pink-100 flex flex-col justify-between">
      {/* Top Header navbar */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-pink-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif tracking-tight text-slate-900 leading-none">
                WordSolve <span className="font-hand text-pink-500 font-bold text-3xl align-middle pl-0.5">AI</span>
              </h1>
              <p className="text-xs text-slate-500 tracking-wider uppercase font-mono mt-1">Premium Puzzle Solver</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleLoadDemo}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all duration-200 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>Load Demo Puzzle</span>
            </button>
            
            <a
              href="#instructions"
              className="text-sm font-medium text-slate-500 hover:text-slate-800 transition duration-150 hidden sm:inline"
            >
              Instructions
            </a>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Dynamic Warning Notification Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start space-x-3 text-rose-800 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-rose-900">Scanning Process Failed</h4>
                <p className="text-sm mt-0.5 leading-relaxed">{error}</p>
                <button
                  onClick={() => setImage(null)}
                  className="mt-2 text-xs font-semibold text-rose-700 underline hover:text-rose-900 cursor-pointer"
                >
                  Dismiss & try another image
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* State 1: Setup Dropzone View */}
        {!image && !loading && (
          <div className="space-y-12">
            
            {/* Elegant Hero Pitch */}
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-4xl sm:text-5xl font-serif text-slate-900 tracking-tight leading-tight">
                Solve any Word Search <br />
                puzzle in <span className="underline decoration-pink-400 decoration-wavy underline-offset-8">seconds</span>
              </h2>
              <p className="text-lg text-slate-600 font-sans tracking-wide leading-relaxed">
                Take a quick photo or screenshot of any word search layout. Upload it below, and let advanced Google Gemini AI extract letters, lists, and highlight solved coordinate lines instantly.
              </p>
            </div>

            {/* Dropper Area */}
            <div
              onDragOver={dragOverHandler}
              onDrop={dropHandler}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-pink-400 bg-white hover:bg-slate-50 rounded-3xl p-10 sm:p-16 text-center cursor-pointer transition-all duration-300 shadow-sm shadow-slate-100 hover:shadow-md flex flex-col items-center group max-w-3xl mx-auto"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800">Drag and drop puzzle image</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md leading-relaxed">
                Supports PNG, JPG, or screen captures. Make sure character rows are flat and legible.
              </p>
              
              <div className="mt-8 flex items-center space-x-3">
                <span className="h-px w-8 bg-slate-200"></span>
                <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">or</span>
                <span className="h-px w-8 bg-slate-200"></span>
              </div>

              <button
                type="button"
                className="mt-6 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition shadow-sm cursor-pointer"
              >
                Browse local files
              </button>
            </div>

            {/* How it works grid */}
            <div id="instructions" className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="text-2xl font-hand text-pink-500 font-bold">01. Snap Photo</div>
                <h4 className="font-semibold text-slate-800">Upload Puzzle Scan</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Support blurry screenshots or tilted captures. Gemini reads character layouts under custom decorative typography.
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="text-2xl font-hand text-indigo-500 font-bold">02. OCR Analysis</div>
                <h4 className="font-semibold text-slate-800">Interactive Extraction</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  The back-end Netlify Function constructs a strict characters grid and extracts terms listed in the word bank.
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="text-2xl font-hand text-emerald-500 font-bold">03. Trace & Highlight</div>
                <h4 className="font-semibold text-slate-800">Solve Automatically</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Select word start/end letters to trace coordinates himself, or hit "Solve All" for rich colored vectors overlays.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* State 2: Scanning / Loading Overlay */}
        {loading && (
          <div className="max-w-2xl mx-auto rounded-3xl bg-white border border-slate-100 p-8 text-center space-y-8 shadow-md">
            
            {/* Blueprint Scan Animation block */}
            <div className="relative w-48 h-48 mx-auto bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center">
              <FileImage className="w-16 h-16 text-slate-300" />
              
              {/* Vertical Green Glowing Laser laser line */}
              <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-lg shadow-pink-400"
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-serif text-slate-900 leading-tight">Gemini AI OCR Analyzing...</h3>
              <p className="text-sm text-slate-500 tracking-wide font-mono px-4 max-w-md mx-auto">
                CURRENT OPERATION: <span className="text-indigo-600 animate-pulse font-semibold">{loadSteps[scanStep]}</span>
              </p>
            </div>

            {/* Circular loading timeline steps */}
            <div className="grid grid-cols-5 gap-3 max-w-md mx-auto pt-4">
              {loadSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    index <= scanStep ? "bg-gradient-to-r from-pink-500 to-indigo-500" : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
            
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              *First-time cold starts on Serverless Functions can take a few seconds deeper as containers spin up the Google Gen AI client headers.
            </p>
          </div>
        )}

        {/* State 3: Main Active Game Board Layout */}
        {!loading && grid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            
            {/* Left Hand: Interactive puzzle letter grid board */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                
                {/* Board controls bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400 font-mono uppercase tracking-widest flex items-center space-x-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span>Grid Live Layout</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-950 flex items-center gap-1.5 font-serif">
                      <span>Interactive Letter Matrix</span>
                      <span className="text-xs bg-slate-100 px-2 py-0.5 text-slate-600 rounded-full font-sans">
                        {totalRows} × {totalCols}
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSolveAll}
                      className="px-4 py-2 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white rounded-full text-xs font-semibold shadow-md shadow-pink-500/10 cursor-pointer flex items-center space-x-1.5 transition-all duration-200 hover:scale-[1.02]"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Solve All Words</span>
                    </button>

                    <button
                      onClick={handleReset}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-full cursor-pointer transition"
                      title="Upload New Puzzle"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub banner advice notification */}
                <div className="bg-slate-50 rounded-2xl p-4 flex items-start space-x-2 text-xs text-slate-600 leading-relaxed border border-slate-100">
                  <MousePointerClick className="w-4 h-4 text-pink-500 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <span className="font-semibold text-slate-800">Dynamic Cell Tracing:</span> Click the <span className="font-semibold">Starting letter</span>, then click the <span className="font-semibold">Ending letter</span> of a word to highlights. Matches are checked off your board!
                  </div>
                </div>

                {/* Relocatable Canvas Box containing characters and percent-SVG capsule lines overlays */}
                <div className="relative w-full aspect-square sm:aspect-video rounded-2xl bg-neutral-900 border border-neutral-900 p-4 sm:p-6 overflow-hidden shadow-inner flex items-center justify-center">
                  
                  {/* Letters Grid block */}
                  <div className="grid h-full w-full gap-0.5 select-none relative z-10"
                    style={{
                      gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))`,
                      gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))`
                    }}
                  >
                    {grid.map((rowArr, rIdx) =>
                      rowArr.map((char, cIdx) => {
                        const isStartSel = selectedStart?.row === rIdx && selectedStart?.col === cIdx;
                        
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            onClick={() => handleCellClick(rIdx, cIdx)}
                            className={`flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-200 cursor-pointer rounded-md ${
                              isStartSel
                                ? "bg-pink-500 text-white shadow-md shadow-pink-500/30 scale-110 z-20 animate-pulse"
                                : "text-neutral-200 hover:bg-neutral-800 hover:text-white"
                            }`}
                          >
                            {char}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* SVG overlay layer - draws glow percentage cables over coordinates */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-20"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {/* Render found permanent paths */}
                    {solutions.map((sol, solIdx) => {
                      const isFound = foundWords.includes(sol.word);
                      const isHovered = hoveredWord === sol.word;
                      
                      if (!isFound && !isHovered) return null;

                      const startCoord = getCellCenterPercent(sol.startCol, totalCols);
                      const startYCoord = getCellCenterPercent(sol.startRow, totalRows);
                      const endCoord = getCellCenterPercent(sol.endCol, totalCols);
                      const endYCoord = getCellCenterPercent(sol.endRow, totalRows);

                      const colPattern = GLOW_COLORS[solIdx % GLOW_COLORS.length];

                      return (
                        <g key={`sol-line-${sol.word}`}>
                          {/* Inner glowing pill */}
                          <line
                            x1={`${startCoord}%`}
                            y1={`${startYCoord}%`}
                            x2={`${endCoord}%`}
                            y2={`${endYCoord}%`}
                            stroke={colPattern.fill}
                            strokeWidth="6"
                            strokeLinecap="round"
                          />
                          {/* Center focus line */}
                          <line
                            x1={`${startCoord}%`}
                            y1={`${startYCoord}%`}
                            x2={`${endCoord}%`}
                            y2={`${endYCoord}%`}
                            stroke={colPattern.stroke}
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            opacity={isHovered ? 1.0 : 0.7}
                          />
                        </g>
                      );
                    })}

                    {/* Render incomplete hover guide guidance path if clicked start */}
                    {selectedStart && (
                      <circle
                        cx={`${getCellCenterPercent(selectedStart.col, totalCols)}%`}
                        cy={`${getCellCenterPercent(selectedStart.row, totalRows)}%`}
                        r="3"
                        fill="rgba(236,72,153,0.3)"
                        className="animate-ping"
                      />
                    )}
                  </svg>

                </div>

                {/* Action telemetry readout footer text */}
                <div className="py-2.5 px-4 bg-slate-900 text-slate-100 rounded-xl text-xs flex items-center justify-between font-mono">
                  <span>INFO ENGINE:</span>
                  <span className="text-pink-300 font-semibold">{activeMessage}</span>
                </div>

              </div>

              {/* Sample uploaded Thumbnail Source Preview (if we loaded some files) */}
              {image && image !== "demo" && (
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden relative shrink-0 border border-slate-200">
                    <img src={image} className="object-cover w-full h-full" alt="source input" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 leading-none mb-1">OCR Image Source</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      This is the active file currently mapped to the grid coordinates matrix above. Keep files focused clearly for best spelling results.
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Right Hand: Solved checklist and word bank lists card */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                
                {/* Checklist title */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-bold text-slate-950 font-serif">Word Bank</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">Checklist Lists</p>
                  </div>

                  <div className="bg-pink-100 text-pink-700 px-3 py-1 font-bold font-mono text-sm rounded-full flex items-center space-x-1 shadow-sm shadow-pink-500/5">
                    <Check className="w-4 h-4" />
                    <span>{foundWords.length}/{words.length}</span>
                  </div>
                </div>

                {/* Sub status details details */}
                {words.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-3">
                    <BookOpen className="w-12 h-12 text-slate-200 mx-auto" />
                    <p className="text-sm">No keywords loaded inside bank.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    
                    {/* Word bank wrapper */}
                    <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                      {words.map((wordStr, index) => {
                        const isFound = foundWords.includes(wordStr);
                        return (
                          <div
                            key={`checklist-${wordStr}`}
                            onMouseEnter={() => setHoveredWord(wordStr)}
                            onMouseLeave={() => setHoveredWord(null)}
                            className={`p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between text-xs font-semibold cursor-pointer ${
                              isFound
                                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                            }`}
                          >
                            <span className="tracking-wide uppercase truncate mr-1">{wordStr}</span>
                            {isFound ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-slate-400 capitalize text-center pt-2 leading-relaxed">
                      *Hover mouse over any checklist keyword to blink its puzzle coordinates highlights.
                    </div>

                  </div>
                )}

              </div>

              {/* Tips block advice card */}
              <div className="rounded-3xl p-6 bg-gradient-to-br from-indigo-900 to-slate-950 text-white shadow-sm space-y-4 relative overflow-hidden">
                {/* Background layout decor */}
                <div className="absolute right-0 bottom-0 text-slate-800/10 font-bold font-hand text-8xl pointer-events-none select-none">
                  A.I.
                </div>
                
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-pink-300">
                  <Lightbulb className="w-5 h-5" />
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-slate-100 font-serif text-lg leading-tight">Supported Puzzle Modes</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    WordSolve AI parses horizontal, vertical, and diagonal paths in both standard or reverse directions!
                  </p>
                </div>

                <div className="h-px bg-white/10" />

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <CheckCircle className="w-3.5 h-3.5 text-pink-300" />
                    <span>Works on blurry cell photos</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <CheckCircle className="w-3.5 h-3.5 text-pink-300" />
                    <span>Resolves custom decorative fonts</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <CheckCircle className="w-3.5 h-3.5 text-pink-300" />
                    <span>Handles skewed screenshots safely</span>
                  </div>
                </div>
              </div>

            </div>

          </motion.div>
        )}

      </main>

      {/* Persistent Elegant Footer block */}
      <footer className="w-full bg-white border-t border-slate-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-800 font-serif">WordSolve AI</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Experience prompt, premium OCR detection. Powered securely server-side by Google Gemini Vision.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-slate-500">
            <a href="/privacy.html" target="_blank" className="hover:text-slate-800 underline transition">
              Privacy Policy
            </a>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">© 2026 WordSolve AI. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
