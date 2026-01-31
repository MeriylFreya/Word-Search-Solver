# 🔍 Word Search Solver - AI Powered
wordsearchsolver.netlify.app

## What is This Project?

**Word Search Solver** is a web-based application that helps you solve word search puzzles automatically using AI technology. Simply upload a photo of your word search puzzle, and the app will:

1. **Extract the letter grid** automatically using OCR (Optical Character Recognition)
2. **Find all the words** you're looking for in any direction
3. **Highlight the results** on the grid with colored circles

No more searching manually through hundreds of letters - let AI do the work!

---

## Key Features

✨ **Smart Image Processing**
- Upload a photo of your word search puzzle
- AI automatically recognizes and extracts all the letters
- Works with printed or handwritten puzzles

🤖 **Intelligent Word Detection**
- Auto-detects common English words in the grid
- Find words hidden horizontally, vertically, and diagonally
- Searches in all 8 directions (left, right, up, down, and diagonals)

📝 **Easy to Use**
- Drag & drop image upload or click to browse
- Manual grid entry if needed
- Add custom words to search for
- View results with colored highlights

📊 **Real-time Preview**
- See the extracted grid immediately
- Live updates as you edit
- Visual word status (found/not found)

---

## How to Use

### Step 1: Upload Your Puzzle
- Click **"Choose Image"** or drag & drop a photo of your word search
- The app extracts the letter grid automatically

### Step 2: Review & Edit (if needed)
- Check the extracted grid in the **"Grid Letters"** section
- Fix any letters that OCR might have misread
- The grid updates in real-time

### Step 3: Add Words
- Words are auto-detected from the grid
- Add more words separated by commas in the **"Words to Find"** section
- Or click **"Try Sample Puzzle"** to test with an example

### Step 4: Solve!
- Click **"🚀 Solve Puzzle"** button
- All found words are highlighted in color on the grid
- See statistics: how many words you found vs total

---

## Technologies Used

### Frontend (What Runs in Your Browser)
- **HTML5** - Page structure
- **CSS3** - Beautiful styling with gradients and animations
- **JavaScript** - Core logic and algorithms

### AI & Libraries
- **Tesseract.js** - AI-powered text recognition (OCR)
  - Automatically reads letters from images
  - Works completely in your browser (no server needed)
  
- **English Dictionary** - Built-in word validation
  - Knows 2000+ common English words
  - Can auto-detect meaningful words from the grid

### Other Tools
- **Canvas API** - Drawing the grid and highlighting words
- **Fetch API** - Loading external word lists

---

## How It Works (Technical Overview)

### Image Processing Pipeline
1. **Upload** → User selects image
2. **Preprocessing** → Image is enhanced for better recognition
   - Convert to grayscale
   - Increase contrast
   - Reduce noise
3. **OCR** → Tesseract reads the letters
4. **Cleanup** → Extract valid letters and organize into grid

### Word Finding Algorithm
```
For each starting position in grid:
  For each of 8 directions (horizontal, vertical, diagonal):
    Check if word matches from this position
    If match found → Store the positions
    Highlight all letters of the word
```

---

## File Structure

```
WordHunt/
├── index.html          (Main application - contains everything)
└── README.md          (This file - documentation)
```

---

## Browser Requirements

✅ Works in any modern web browser:
- Chrome/Chromium
- Firefox
- Safari
- Edge

⚠️ Requires:
- JavaScript enabled
- Internet connection (for loading libraries)
- Modern browser (from 2020+)

---

## Tips for Best Results

📷 **For OCR Accuracy:**
- Use clear, high-quality images
- Ensure good lighting
- Keep the puzzle straight (not tilted)
- Use printed puzzles (clearer than handwritten)

🎯 **For Word Finding:**
- Verify the extracted grid matches your image
- Add words that are clearly visible in the puzzle
- Use common English words for better detection

---

## Example

**Sample Puzzle:**
```
FORWARDXYZ
MZBSWIMQRT
AOCGPYTHEN
THINKDRAWU
HAPPYJOYCE
BCODELIFEM
```

**Sample Words:** FORWARD, SWIM, THINK, DRAW, CODE, LIFE, HAPPY

**Result:** All 7 words found and highlighted! ✅

---

## Future Enhancements

🚀 Potential features:
- Support for multiple languages
- Download results as image
- Difficulty levels
- Multiplayer mode
- Save puzzle history

---

## License

Free to use and modify for personal projects.

---

## Questions?

This is a simple, all-in-one HTML file. No installation needed - just open `index.html` in your browser and start solving!

Happy puzzle hunting! 🎉
