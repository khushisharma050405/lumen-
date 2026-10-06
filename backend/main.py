import datetime
import os
import sys
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

# Load backend/.env at startup
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
else:
    load_dotenv(override=True)

from auth import (
    USERS_DB, hash_password, verify_password,
    create_access_token, get_current_user_from_header
)
from nlp_service import (
    check_grammar, get_autocomplete, compute_similarity,
    check_paraphrase, generate_paragraph, generate_paragraph_llm,
    improve_text, improve_text_llm, summarize_text, LLMProviderError
)

app = FastAPI(
    title="Lumen AI Writing Assistant API",
    description="Backend API powering the Lumen editorial workspace: NLP services, JWT auth, and drafts management.",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------------------------

class TextRequest(BaseModel):
    text: str

class GrammarResponse(BaseModel):
    issues: List[Dict[str, Any]]

class AutocompleteResponse(BaseModel):
    suggestion: str

class SimilarityRequest(BaseModel):
    text: str
    reference: str

class SimilarityResponse(BaseModel):
    sem: int
    lex: int
    score: int
    verdict: str
    reason: Optional[str] = None
    shared: List[str]
    sharedWords: Optional[List[str]] = []

class ParaphraseResponse(BaseModel):
    is_paraphrase: bool
    score: int
    verdict: str
    reason: Optional[str] = None
    shared_phrases: List[str]
    sharedWords: Optional[List[str]] = []
    sem: int
    lex: int

class GenerateRequest(BaseModel):
    topic: Optional[str] = ""
    prompt: Optional[str] = ""
    tone: Optional[str] = "Warm"
    length: Optional[str] = "Medium"
    existing_text: Optional[str] = ""

class GenerateResponse(BaseModel):
    text: str

class ImproveRequest(BaseModel):
    text: str
    mode: str = "concise"

class ImproveResponse(BaseModel):
    text: str

class SummarizeRequest(BaseModel):
    text: str
    sentences: int = Field(default=3, ge=1, le=10)

class SummarizeResponse(BaseModel):
    summary: List[str]
    text: str
    reduction: int

class UserSignUp(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    user: Dict[str, Any]

class DraftCreate(BaseModel):
    title: str
    text: str

class DraftItem(BaseModel):
    id: int
    title: str
    text: str
    date: str

# In-memory Drafts DB
DRAFTS_DB: List[Dict[str, Any]] = [
    {
        "id": 1,
        "title": "Notes on editing",
        "text": "Good prose seems easy, yet it almost never is. Many drafts I read have strong ideas but weak sentences. The remedy is simple: get the words down first, then revise them. A rough version would have given us something to sharpen together.",
        "date": "Sep 28"
    },
    {
        "id": 2,
        "title": "Cover letter, first pass",
        "text": "I am writing to apply for the editorial internship. I have spent two years running a campus magazine and i enjoy turning rough ideas into clean prose.",
        "date": "Sep 30"
    }
]

# ----------------------------------------------------------------------
# NLP Endpoints
# ----------------------------------------------------------------------

@app.get("/api/health")
def health_endpoint():
    api_key = os.getenv("LLM_API_KEY", "")
    model = os.getenv("LLM_MODEL", "")
    return {
        "llm_configured": bool(api_key.strip()),
        "model": model
    }

@app.post("/api/grammar", response_model=GrammarResponse)
def grammar_endpoint(req: TextRequest):
    issues = check_grammar(req.text)
    return {"issues": issues}

@app.post("/api/autocomplete", response_model=AutocompleteResponse)
def autocomplete_endpoint(req: TextRequest):
    suggestion = get_autocomplete(req.text)
    return {"suggestion": suggestion}

@app.post("/api/similarity", response_model=SimilarityResponse)
def similarity_endpoint(req: SimilarityRequest):
    result = compute_similarity(req.text, req.reference)
    return result

@app.post("/api/paraphrase", response_model=ParaphraseResponse)
def paraphrase_endpoint(req: SimilarityRequest):
    result = check_paraphrase(req.text, req.reference)
    return result

@app.post("/api/generate", response_model=GenerateResponse)
def generate_endpoint(req: GenerateRequest):
    topic = req.topic or req.prompt or ""
    try:
        generated = generate_paragraph_llm(
            topic=topic,
            tone=req.tone or "Warm",
            length=req.length or "Medium",
            existing_text=req.existing_text or ""
        )
        return {"text": generated}
    except LLMProviderError as e:
        raise HTTPException(
            status_code=e.status_code if 400 <= e.status_code < 600 else 502,
            detail=e.message
        )
    except Exception as e:
        print(f"[Generate Error] {str(e)}", file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/improve", response_model=ImproveResponse)
def improve_endpoint(req: ImproveRequest):
    try:
        improved = improve_text_llm(req.text, req.mode or "tighten")
        return {"text": improved}
    except LLMProviderError as e:
        raise HTTPException(
            status_code=e.status_code if 400 <= e.status_code < 600 else 502,
            detail=e.message
        )
    except Exception as e:
        print(f"[Improve Error] {str(e)}", file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/summarize", response_model=SummarizeResponse)
def summarize_endpoint(req: SummarizeRequest):
    result = summarize_text(req.text, req.sentences)
    return result

# ----------------------------------------------------------------------
# Auth Endpoints (JWT)
# ----------------------------------------------------------------------

@app.post("/api/auth/signup", response_model=AuthResponse)
def signup_endpoint(user_data: UserSignUp):
    email = user_data.email.lower()
    if email in USERS_DB:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    pwd_hash, salt = hash_password(user_data.password)
    user_id = f"usr_{os.urandom(6).hex()}"
    display_name = user_data.name.strip() if user_data.name else email.split("@")[0]

    USERS_DB[email] = {
        "id": user_id,
        "email": email,
        "name": display_name,
        "hash": pwd_hash,
        "salt": salt,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    token = create_access_token({"sub": email, "name": display_name, "uid": user_id})
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "name": display_name
        }
    }

@app.post("/api/auth/login", response_model=AuthResponse)
def login_endpoint(creds: UserLogin):
    email = creds.email.lower()
    user = USERS_DB.get(email)
    if not user or not verify_password(creds.password, user["hash"], user["salt"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": email, "name": user["name"], "uid": user["id"]})
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"]
        }
    }

@app.get("/api/auth/me")
def me_endpoint(current_user: Optional[Dict[str, Any]] = Depends(get_current_user_from_header)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": current_user}

# ----------------------------------------------------------------------
# Drafts Endpoints
# ----------------------------------------------------------------------

@app.get("/api/drafts", response_model=List[DraftItem])
def get_drafts():
    return DRAFTS_DB

@app.post("/api/drafts", response_model=DraftItem)
def create_draft(item: DraftCreate):
    now_date = datetime.datetime.now().strftime("%b %d")
    new_draft = {
        "id": int(datetime.datetime.now().timestamp() * 1000),
        "title": item.title or "Untitled draft",
        "text": item.text,
        "date": now_date
    }
    DRAFTS_DB.insert(0, new_draft)
    return new_draft

@app.delete("/api/drafts/{draft_id}")
def delete_draft(draft_id: int):
    global DRAFTS_DB
    before_len = len(DRAFTS_DB)
    DRAFTS_DB = [d for d in DRAFTS_DB if d["id"] != draft_id]
    if len(DRAFTS_DB) == before_len:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"success": True, "message": "Draft deleted"}
