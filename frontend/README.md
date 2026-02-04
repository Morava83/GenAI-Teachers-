# MathForge Frontend

AI-powered math problem generator for teachers.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
Create a `.env` file:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-key
```

### 3. Start the backend
In the project root:
```bash
# Add your Groq API key to .env
echo "GROQ_API_KEY=your-key-here" > ../.env

# Run the backend
python3 ../services/mock-backend.py
```
Backend runs on `http://127.0.0.1:8000`

### 4. Start the frontend
```bash
npm run dev
```
Frontend runs on `http://localhost:5173`

## Production

Set `VITE_API_URL` environment variable to your deployed backend URL.
