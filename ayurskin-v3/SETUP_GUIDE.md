# AyurSkin AI v3 — Complete Setup & Deployment Guide

---

## QUICK START CHECKLIST

- [ ] Node.js v20 installed
- [ ] Python 3.11 installed
- [ ] MongoDB running locally
- [ ] VS Code installed
- [ ] `backend/.env` created with API keys
- [ ] `frontend/.env` created
- [ ] `npm install` in `backend/`
- [ ] `npm install` in `frontend/`
- [ ] `pip install -r requirements.txt` in `ml/` (venv active)
- [ ] All 6 terminals running (see Step 6)
- [ ] App opens at http://localhost:5173

---

## STEP 1 — INSTALL REQUIRED SOFTWARE

### Node.js (v18 or v20)
Download from https://nodejs.org — LTS version
Verify: `node --version`

### Python 3.11
Download from https://python.org/downloads — Python 3.11.x
CRITICAL: check "Add Python to PATH" during install
Do NOT use Python 3.12 — TensorFlow requires 3.11 or lower
Verify: `python --version`

### MongoDB Community Server
Download from https://www.mongodb.com/try/download/community
- Windows: installs as a service, starts automatically
- macOS: `brew install mongodb-community` then `brew services start mongodb-community`
- Linux: `sudo systemctl start mongod`

### Visual Studio Code
Download from https://code.visualstudio.com

---

## STEP 2 — VS CODE EXTENSIONS

Press Ctrl+Shift+X and install: ESLint, Prettier, Python, Pylance, MongoDB for VS Code, REST Client, ES7+ React/Redux

---

## STEP 3 — ENVIRONMENT VARIABLES

### Backend
Copy `backend/.env.example` to `backend/.env` and fill in:

```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/ayurskin
JWT_SECRET=your-long-random-secret-key-minimum-32-characters
FRONTEND_URL=http://localhost:5173
ML_SERVICE_URL=http://localhost:5001
DETECTION_SERVICE_URL=http://localhost:5002
REGION_SERVICE_URL=http://localhost:5003
OPENWEATHER_API_KEY=your_key_here
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key_here
```

Getting free API keys:
- Gemini (AI chatbot, FREE 1500 req/day): https://aistudio.google.com/apikey
- Groq alternative (FREE 14400 req/day): https://console.groq.com — set LLM_PROVIDER=groq and GROQ_API_KEY
- OpenWeatherMap (optional): https://openweathermap.org/api

### Frontend
Copy `frontend/.env.example` to `frontend/.env`:
```
VITE_API_URL=http://localhost:3001/api
```

---

## STEP 4 — INSTALL DEPENDENCIES

Terminal 1 — Backend:
```
cd backend
npm install
```

Terminal 2 — Frontend:
```
cd frontend
npm install
```

Terminal 3 — Python (activate venv first):

Windows:
```
cd ml
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

macOS/Linux:
```
cd ml
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## STEP 5 — START ALL SERVICES (6 terminals)

| Terminal | Folder | Command |
|---|---|---|
| 1 | anywhere | mongod |
| 2 | backend/ | npm run dev |
| 3 | frontend/ | npm run dev |
| 4 | ml/ (venv active) | python ml_service.py |
| 5 | ml/ (venv active) | python detection/detection_service.py |
| 6 | ml/ (venv active) | python region_service.py |

IMPORTANT: ml/ is Python only — never run npm inside ml/

Activate venv before Python commands:
- Windows: venv\Scripts\activate
- macOS/Linux: source venv/bin/activate

Open http://localhost:5173 in your browser.

---

## STEP 6 — TRAIN THE ML MODEL

### Get Dataset (free, Kaggle account needed)
- https://www.kaggle.com/datasets/shubhamgoel27/dermnet
- https://www.kaggle.com/datasets/rutviklathiyateksun/acne-grading-dataset

Sort into folders (200+ images each):
```
ml/data/raw/acne/
ml/data/raw/normal/
ml/data/raw/pigmentation/
ml/data/raw/tanning/
```

### Run Training
```
cd ml
venv\Scripts\activate   (or source venv/bin/activate on Mac)
python train_pipeline.py
```

Phase 1: ~10-20 min on CPU
Phase 2: ~30-60 min on CPU

If interrupted, run again — it auto-resumes from checkpoint.
After training completes, restart ml_service.py.

---

## STEP 7 — TROUBLESHOOTING

Cannot connect to MongoDB:
- Windows: open Services app, find MongoDB, click Start
- macOS: brew services restart mongodb-community

Port 3001 already in use:
- Windows: netstat -ano | findstr :3001 then taskkill /PID <number> /F
- Mac/Linux: lsof -ti :3001 | xargs kill

Python "No module named X":
- Make sure (venv) is showing in terminal — run activate command first

ML shows "heuristic fallback":
- Normal until model is trained. App works, just less accurate.

Chatbot not working:
- Check GEMINI_API_KEY in backend/.env
- Try LLM_PROVIDER=groq with GROQ_API_KEY instead

---

## STEP 8 — FREE DEPLOYMENT

Deploy architecture:
- Frontend: Vercel (free, unlimited bandwidth)
- Backend + ML: Render (free, 750 hrs/month)
- Database: MongoDB Atlas (free, 512 MB)

### 8.1 Push to GitHub

```
git init
git add .
git commit -m "AyurSkin v3"
```
Go to github.com, create repo named ayurskin-v3, then:
```
git remote add origin https://github.com/YOUR_USERNAME/ayurskin-v3.git
git push -u origin main
```

### 8.2 MongoDB Atlas

1. Go to https://cloud.mongodb.com, sign up free (no credit card)
2. Create cluster: M0 Free, region Mumbai (ap-south-1)
3. Security > Database Access > Add User (create username + password)
4. Security > Network Access > Add IP > 0.0.0.0/0 (allow all)
5. Connect > Drivers > copy connection string:
   mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/ayurskin

### 8.3 Render — Backend

1. Go to https://render.com, sign up with GitHub
2. New > Web Service > connect your repo
3. Root Directory: backend
4. Build Command: npm install && npm run build
5. Start Command: node dist/index.js
6. Instance Type: Free
7. Add environment variables (all your .env values, MONGODB_URI = Atlas string)
8. Deploy — copy URL: https://ayurskin-backend.onrender.com

### 8.4 Render — ML Services

Repeat New > Web Service for each:

ML Classifier:
- Root Directory: ml
- Build: pip install -r requirements.txt
- Start: python ml_service.py

Detection:
- Start: python detection/detection_service.py

Region Analysis:
- Start: python region_service.py

After each deploys, update backend env vars ML_SERVICE_URL, DETECTION_SERVICE_URL, REGION_SERVICE_URL.

Note: Free Render services sleep after 15 min idle. First request takes ~30s to wake. Normal on free tier.

### 8.5 Vercel — Frontend

1. Go to https://vercel.com, sign up with GitHub
2. New Project > Import repo
3. Framework: Vite, Root Directory: frontend
4. Build Command: npm run build, Output Directory: dist
5. Add env var: VITE_API_URL = https://ayurskin-backend.onrender.com/api
6. Deploy — get URL: https://ayurskin-v3.vercel.app

### 8.6 Final step

Go to Render > backend service > Environment > update FRONTEND_URL to your Vercel URL > redeploy.

Your app is now live worldwide.

---

## BUGS FIXED DURING DEVELOPMENT

| File | Fix Applied |
|---|---|
| ml/train_pipeline.py | Removed include_preprocessing (not available in TF < 2.12). Fixed data pipeline — passes raw [0,255] to EfficientNetB0 which handles normalisation internally. Added checkpoint resume logic so interrupted training can continue. Fixed classification_report crash when test split has fewer than 4 classes present. |
| backend/src/services/pdfReportService.ts | Removed switchToPage() footer loop which crashes when bufferPages:false (default). Footer is now drawn forward on each page as it is created using drawFooter() and newPage() helpers. Removed emoji from PDF text (PDFKit built-in fonts cannot render emoji). |
| backend/src/services/llmChatbot.ts | Added support for Gemini, Groq, and OpenRouter as free alternatives to Anthropic. Fixed Gemini "First content should be with role user" error by stripping any leading assistant messages from history and enforcing strict user/model alternation before sending to Gemini API. |

---

AyurSkin AI v3 — React + Node.js + Python TensorFlow + MediaPipe + MongoDB + Gemini AI
