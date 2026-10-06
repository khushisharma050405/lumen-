import re
import math
import os
import sys
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Tuple, Set, Optional
from dotenv import load_dotenv

# Load backend/.env at startup
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path, override=True)
else:
    load_dotenv(override=True)


STOP_WORDS: Set[str] = set(
    "a an the and or but if of to in on at by for with from as is are was were be been it its this that these those i you he she we they my your our their so not no do does did have has had will would can could should than then there here".split()
)

SYNONYMS: Dict[str, str] = {
    "firm": "company", "company": "company", "business": "company", "corporation": "company", "enterprise": "company",
    "profit": "profit", "profits": "profit", "earning": "profit", "earnings": "profit", "revenue": "profit", "gains": "profit",
    "announce": "announce", "announced": "announce", "announces": "announce", "report": "announce", "reported": "announce",
    "reports": "announce", "declare": "announce", "declared": "announce",
    "record": "record", "highest": "record", "peak": "record", "top": "record",
    "rely": "depend", "relies": "depend", "relied": "depend", "depend": "depend", "depends": "depend", "depended": "depend",
    "how": "method", "way": "method", "manner": "method", "method": "method",
    "team": "team", "teams": "team", "group": "team", "groups": "team",
    "communicate": "communicate", "communicates": "communicate", "communicated": "communicate", "communicating": "communicate",
    "talk": "communicate", "converse": "communicate",
    "change": "change", "changes": "change", "changed": "change", "changing": "change", "alter": "change", "altered": "change",
    "remote": "remote", "distant": "remote",
    "work": "work", "working": "work", "worked": "work", "works": "work",
    "mountain": "mountain", "mountains": "mountain",
    "invoice": "invoice", "invoices": "invoice", "bill": "invoice"
}

def stem(word: str) -> str:
    w = (word or "").lower()
    if len(w) <= 3:
        return w
    if w.endswith("ings") and len(w) > 5:
        return w[:-4]
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith("ing") and len(w) > 5:
        w = w[:-3]
    elif w.endswith("ed") and len(w) > 4:
        w = w[:-2]
    elif w.endswith("es") and not w.endswith("ss") and len(w) > 4:
        w = w[:-2]
    elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        w = w[:-1]
    if w.endswith("e") and len(w) > 4:
        w = w[:-1]
    return w

def canonical(w: str) -> str:
    s = stem(w)
    return SYNONYMS.get(w, SYNONYMS.get(s, s))

def tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z']+", (text or "").lower())

def content_tokens(text: str) -> List[str]:
    return [w for w in tokenize(text) if w not in STOP_WORDS]

def make_bigrams(tokens: List[str]) -> Set[str]:
    if len(tokens) < 2:
        return set()
    return {f"{tokens[i]} {tokens[i+1]}" for i in range(len(tokens) - 1)}

def compute_similarity(a: str, b: str) -> Dict[str, Any]:
    if not a or not b or not a.strip() or not b.strip():
        return {
            "sem": 0, "lex": 0, "score": 0,
            "verdict": "Distinct",
            "reason": "Enter text in both inputs to calculate similarity.",
            "shared": [], "sharedWords": []
        }

    ca = content_tokens(a)
    cb = content_tokens(b)

    c_tok_a = [canonical(w) for w in ca]
    c_tok_b = [canonical(w) for w in cb]

    tf_a: Dict[str, int] = {}
    for w in c_tok_a:
        tf_a[w] = tf_a.get(w, 0) + 1
    tf_b: Dict[str, int] = {}
    for w in c_tok_b:
        tf_b[w] = tf_b.get(w, 0) + 1

    dot = sum(tf_a[w] * tf_b[w] for w in tf_a if w in tf_b)
    norm_a = sum(v ** 2 for v in tf_a.values())
    norm_b = sum(v ** 2 for v in tf_b.values())
    sem = (dot / math.sqrt(norm_a * norm_b)) if (norm_a and norm_b) else 0.0

    tok_a = tokenize(a)
    tok_b = tokenize(b)
    ba = make_bigrams(tok_a)
    bb = make_bigrams(tok_b)
    inter_bigrams = ba.intersection(bb)
    total_bigrams = len(ba.union(bb))
    lex = (len(inter_bigrams) / total_bigrams) if total_bigrams > 0 else 0.0

    m_pct = int(round(sem * 100))
    p_pct = int(round(lex * 100))
    score = int(round(0.6 * m_pct + 0.4 * p_pct))

    # Thresholds: Near-duplicate: meaning >= 60 and phrasing >= 50. Likely paraphrase: meaning >= 30. Otherwise Distinct.
    if m_pct >= 60 and p_pct >= 50:
        verdict = "Near-duplicate"
        reason = "Substantial overlap in both meaning and phrasing."
    elif m_pct >= 30:
        verdict = "Likely paraphrase"
        reason = "Shares core meaning with rephrased wording."
    else:
        verdict = "Distinct"
        reason = "Different phrasing and distinct core meaning."

    shared_bigrams = [
        phrase for phrase in inter_bigrams
        if any(w not in STOP_WORDS for w in phrase.split())
    ][:6]

    set_b = set(tok_b)
    shared_words = list(dict.fromkeys([
        w for w in ca
        if w in set_b or any(canonical(bw) == canonical(w) for bw in cb)
    ]))[:10]

    return {
        "sem": m_pct,
        "lex": p_pct,
        "score": score,
        "verdict": verdict,
        "reason": reason,
        "shared": shared_bigrams,
        "sharedWords": shared_words
    }

def check_paraphrase(text: str, reference: str) -> Dict[str, Any]:
    res = compute_similarity(text, reference)
    return {
        "is_paraphrase": res["verdict"] in ("Near-duplicate", "Likely paraphrase"),
        "score": res["score"],
        "verdict": res["verdict"],
        "reason": res["reason"],
        "shared_phrases": res["shared"],
        "sharedWords": res["sharedWords"],
        "sem": res["sem"],
        "lex": res["lex"]
    }

def generate_paragraph(prompt: str, tone: str) -> str:
    p = (prompt or "good writing").strip()
    cap_p = p.capitalize()
    low_p = p.lower()

    # Plural check: ends in 's' but not 'ss', or contains ' and '
    is_plural = bool(re.search(r'(?<!s)s$', p, re.IGNORECASE) or re.search(r'\band\b', p, re.IGNORECASE))
    verb = "deserve" if is_plural else "deserves"
    come_verb = "come" if is_plural else "comes"

    if tone == "concise":
        return f"{cap_p} {come_verb} down to one idea per paragraph. When developing {low_p}, state the point, support it, move on. Cut whatever the reader would not miss."
    if tone == "warm":
        return f"Let's talk about {low_p}. It's easier than it looks once you picture one reader across the table. Say what you'd tell them out loud, then tidy it up. The best drafts still sound like someone you'd want to hear from."
    return f"{cap_p} {verb} careful attention. At its core, approaching {low_p} asks the writer to balance clarity with purpose. A considered approach begins with a defined audience, then builds each paragraph toward a single point. In practice, the strongest drafts are revised far more than they are written."

def check_grammar(text: str) -> List[Dict[str, Any]]:
    from nlp_service import GRAMMAR_RULES, capitalize_like
    # Delegate to rules if needed
    issues: List[Dict[str, Any]] = []
    for src, fix, msg in GRAMMAR_RULES:
        for m in re.finditer(r'\b' + re.escape(src) + r'\b', text, re.IGNORECASE):
            matched = m.group()
            adjusted = capitalize_like(matched, fix)
            if matched != adjusted:
                issues.append({
                    "start": m.start(), "end": m.end(),
                    "fix": adjusted, "msg": msg
                })
    for m in re.finditer(r'\bi\b', text):
        issues.append({"start": m.start(), "end": m.end(), "fix": "I", "msg": 'Capitalize "I"'})
    for m in re.finditer(r'(?<=\S) {2,}(?=\S)', text):
        issues.append({"start": m.start(), "end": m.end(), "fix": " ", "msg": "Extra space"})
    for m in re.finditer(r'\b(\w+)\s+\1\b', text, re.IGNORECASE):
        issues.append({"start": m.start(), "end": m.end(), "fix": m.group(1), "msg": "Repeated word"})
    for m in re.finditer(r'(?:^|[.!?]\s+)([a-z])', text):
        pos = m.start(1)
        issues.append({"start": pos, "end": pos + 1, "fix": m.group(1).upper(), "msg": "Start the sentence with a capital"})
    issues.sort(key=lambda x: x["start"])
    deduped = []
    last_end = -1
    for issue in issues:
        if issue["start"] >= last_end:
            issue["id"] = f"{issue['start']}:{issue['fix']}"
            deduped.append(issue)
            last_end = issue["end"]
    return deduped

def capitalize_like(original: str, replacement: str) -> str:
    if original and original[0].isupper():
        return replacement[0].upper() + replacement[1:]
    return replacement

GRAMMAR_RULES = [
    ("teh", "the", "Typo"), ("recieve", "receive", "Spelling"), ("alot", "a lot", "Spelling"),
    ("definately", "definitely", "Spelling"), ("seperate", "separate", "Spelling"),
    ("togther", "together", "Spelling"), ("occured", "occurred", "Spelling"),
    ("dont", "don't", "Missing apostrophe"), ("cant", "can't", "Missing apostrophe"),
    ("doesnt", "doesn't", "Missing apostrophe"), ("wont", "won't", "Missing apostrophe"),
    ("should of", "should have", '"Of" should be "have"'),
    ("could of", "could have", '"Of" should be "have"'),
    ("would of", "would have", '"Of" should be "have"'),
    ("their is", "there is", "Their / there"), ("their are", "there are", "Their / there"),
]

def get_autocomplete(text: str) -> str:
    from nlp_service import AUTOCOMPLETE_BANK
    if not text or not text.strip():
        return ""
    stripped = text.rstrip().lower()
    has_space = bool(re.search(r'\s$', text))
    for trigger, comp in AUTOCOMPLETE_BANK:
        if stripped.endswith(trigger):
            return re.sub(r'^[ ,]', '', comp) if has_space else comp
    if re.search(r'[.!?]\s$', text):
        return "Good writing begins with one honest sentence."
    return ""

AUTOCOMPLETE_BANK = [
    ("in conclusion", ", the evidence points to one clear next step."),
    ("write first", ", then edit with a cooler head."),
    ("the main reason is", " that readers skim before they commit."),
    ("for example", ", a short opening line can set the tone for the whole piece."),
    ("however", ", clarity matters more than cleverness."),
    ("on the other hand", ", brevity can hide nuance."),
    ("as a result", ", the final draft reads faster and lands harder."),
    ("i would like to", " thank you for your time and consideration."),
    ("thank you for", " taking the time to read this."),
    ("looking forward to", " hearing your thoughts."),
    ("we should", " cut every sentence that does not earn its place."),
    ("in my experience", ", the first paragraph decides whether anyone reads the second."),
]

def improve_text(text: str, mode: str) -> str:
    t = text or ""
    if mode == "concise":
        t = re.sub(r'\b(very|really|basically|actually|just|quite)\s+', '', t, flags=re.IGNORECASE)
        t = re.sub(r'in order to', 'to', t, flags=re.IGNORECASE)
        t = re.sub(r'due to the fact that', 'because', t, flags=re.IGNORECASE)
        t = re.sub(r'at this point in time', 'now', t, flags=re.IGNORECASE)
        t = re.sub(r' {2,}', ' ', t)
    elif mode == "formal":
        replacements = [
            ("don't", "do not"), ("can't", "cannot"), ("won't", "will not"),
            ("doesn't", "does not"), ("it's", "it is"), ("we're", "we are"),
            ("I'm", "I am"), ("a lot of", "many"), ("get", "obtain"), ("help", "assist")
        ]
        for src, rep in replacements:
            t = re.sub(r'\b' + re.escape(src) + r'\b', lambda m: capitalize_like(m.group(), rep), t, flags=re.IGNORECASE)
    elif mode == "warm":
        replacements = [
            ("do not", "don't"), ("cannot", "can't"), ("will not", "won't"),
            ("it is", "it's"), ("we are", "we're"), ("I am", "I'm"),
            ("however", "still"), ("therefore", "so")
        ]
        for src, rep in replacements:
            t = re.sub(r'\b' + re.escape(src) + r'\b', lambda m: capitalize_like(m.group(), rep), t, flags=re.IGNORECASE)
    elif mode == "clarity":
        sents = re.split(r'(?<=[.!?])\s+', t)
        cleaned_sents = []
        for s in sents:
            words = s.split()
            if len(words) > 28:
                s = re.sub(r', (and|but|which) ', r'. \1 ', s)
                s = re.sub(r'\. (and|but|which) ', lambda m: '. ' + m.group(1).capitalize() + ' ', s)
            cleaned_sents.append(s)
        t = ' '.join(cleaned_sents)
    return t.strip()

def summarize_text(text: str, n: int = 3) -> Dict[str, Any]:
    if not text or not text.strip():
        return {"summary": [], "text": "", "reduction": 0}
    sents = [s.strip() for s in re.findall(r'[^.!?]+[.!?]+|[^.!?]+$', text) if s.strip()]
    if len(sents) <= n:
        return {"summary": sents, "text": " ".join(sents), "reduction": 0}
    freq: Dict[str, int] = {}
    for w in content_tokens(text):
        freq[w] = freq.get(w, 0) + 1
    scored = []
    for idx, s in enumerate(sents):
        tokens = content_tokens(s)
        token_sum = sum(freq.get(w, 0) for w in tokens)
        denom = math.sqrt(len(tokens) or 1)
        score = (token_sum / denom) + (1.5 if idx == 0 else 0.0)
        scored.append((score, idx, s))
    scored.sort(key=lambda x: x[0], reverse=True)
    top_n = scored[:n]
    top_n.sort(key=lambda x: x[1])
    summary_sents = [item[2] for item in top_n]
    summary_str = " ".join(summary_sents)
    pct = max(0, int(round(100 - (len(summary_str) / len(text)) * 100))) if len(text) else 0
    return {"summary": summary_sents, "text": summary_str, "reduction": pct}


class LLMProviderError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Provider error ({status_code}): {message}")


def call_llm(system_prompt: str, user_prompt: str) -> str:
    api_key = os.getenv("LLM_API_KEY", "").strip()
    if not api_key:
        raise LLMProviderError(503, "LLM_API_KEY is not configured in backend/.env")

    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip()
    model = os.getenv("LLM_MODEL", "openai/gpt-oss-120b").strip()

    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }

    req = urllib.request.Request(
        endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)"
        },
        data=json.dumps(payload).encode("utf-8")
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices")
            if not choices or not isinstance(choices, list):
                raise LLMProviderError(502, "Invalid response structure from LLM provider")
            return choices[0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        status_code = e.code
        raw_body = e.read().decode("utf-8", errors="replace")
        err_msg = raw_body
        try:
            err_json = json.loads(raw_body)
            if isinstance(err_json, dict):
                if "error" in err_json and isinstance(err_json["error"], dict):
                    err_msg = err_json["error"].get("message", raw_body)
                elif "detail" in err_json:
                    err_msg = str(err_json["detail"])
        except Exception:
            pass

        # Print to backend terminal without logging the API key
        print(f"[LLM Provider Error] status={status_code} message={err_msg}", file=sys.stderr, flush=True)
        raise LLMProviderError(status_code, err_msg)
    except urllib.error.URLError as e:
        err_msg = str(e.reason)
        print(f"[LLM Network Error] {err_msg}", file=sys.stderr, flush=True)
        raise LLMProviderError(502, f"Failed to connect to LLM provider: {err_msg}")
    except LLMProviderError:
        raise
    except Exception as e:
        err_msg = str(e)
        print(f"[LLM Unexpected Error] {err_msg}", file=sys.stderr, flush=True)
        raise LLMProviderError(500, err_msg)


def generate_paragraph_llm(topic: str, tone: str = "Warm", length: str = "Medium", existing_text: str = "") -> str:
    system_prompt = "Write one original paragraph about the topic in the given tone and length. Output only the paragraph, no title, no preamble."
    length_desc = "4-5 sentences"
    len_lower = (length or "").lower()
    if "short" in len_lower:
        length_desc = "2-3 sentences"
    elif "long" in len_lower:
        length_desc = "6-8 sentences"

    context = (existing_text or "")[-500:].strip()
    user_parts = [
        f"Topic: {topic or 'A thoughtful observation'}",
        f"Tone: {tone or 'Warm'}",
        f"Length: {length or 'Medium'} ({length_desc})"
    ]
    if context:
        user_parts.append(f"Context from existing draft (use to fit naturally into the draft):\n\"\"\"{context}\"\"\"")
    user_prompt = "\n".join(user_parts)

    return call_llm(system_prompt, user_prompt)


def improve_text_llm(text: str, mode: str = "tighten") -> str:
    system_prompt = "You are an expert prose editor. Output only the revised text, no title, no preamble, no explanations."
    mode_lower = (mode or "").lower()
    if "formal" in mode_lower:
        instruction = "Make the text formal, dignified, and professionally polished without sounding stiff."
    elif "soft" in mode_lower or "warm" in mode_lower:
        instruction = "Make the text warmer, more conversational, and more welcoming."
    elif "split" in mode_lower or "clarity" in mode_lower:
        instruction = "Split overly long or complex sentences into crisp, readable sentences with natural rhythm."
    else:  # tighten / concise
        instruction = "Tighten and eliminate unnecessary filler, redundant words, and wordiness while preserving the core meaning."

    user_prompt = f"Instruction: {instruction}\n\nText to revise:\n{text}"
    return call_llm(system_prompt, user_prompt)


