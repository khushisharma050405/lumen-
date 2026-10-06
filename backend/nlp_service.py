import re
import math
from typing import List, Dict, Any, Tuple

# Common stop words for similarity & summarization
STOP_WORDS = set(
    "a an the and or but if of to in on at by for with from as is are was were be been it its this that these those i you he she we they my your our their so not no do does did have has had will would can could should than then there here".split()
)

GRAMMAR_RULES = [
    ("teh", "the", "Typo"),
    ("recieve", "receive", "Spelling"),
    ("alot", "a lot", "Spelling"),
    ("definately", "definitely", "Spelling"),
    ("seperate", "separate", "Spelling"),
    ("togther", "together", "Spelling"),
    ("occured", "occurred", "Spelling"),
    ("dont", "don't", "Missing apostrophe"),
    ("cant", "can't", "Missing apostrophe"),
    ("doesnt", "doesn't", "Missing apostrophe"),
    ("wont", "won't", "Missing apostrophe"),
    ("should of", "should have", '"Of" should be "have"'),
    ("could of", "could have", '"Of" should be "have"'),
    ("would of", "would have", '"Of" should be "have"'),
    ("their is", "there is", "Their / there"),
    ("their are", "there are", "Their / there"),
]

AUTOCOMPLETE_BANK: List[Tuple[str, str]] = [
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

def capitalize_like(original: str, replacement: str) -> str:
    if original and original[0].isupper():
        return replacement[0].upper() + replacement[1:]
    return replacement

def check_grammar(text: str) -> List[Dict[str, Any]]:
    if not text:
        return []
    
    issues: List[Dict[str, Any]] = []

    # Dictionary typo & phrase rules
    for src, fix, msg in GRAMMAR_RULES:
        pattern = re.compile(r'\b' + re.escape(src) + r'\b', re.IGNORECASE)
        for m in pattern.finditer(text):
            matched = m.group()
            adjusted_fix = capitalize_like(matched, fix)
            if matched != adjusted_fix:
                issues.append({
                    "start": m.start(),
                    "end": m.end(),
                    "fix": adjusted_fix,
                    "msg": msg
                })

    # Capitalize standalone "i"
    for m in re.finditer(r'\bi\b', text):
        issues.append({
            "start": m.start(),
            "end": m.end(),
            "fix": "I",
            "msg": 'Capitalize "I"'
        })

    # Extra spaces
    for m in re.finditer(r'(?<=\S) {2,}(?=\S)', text):
        issues.append({
            "start": m.start(),
            "end": m.end(),
            "fix": " ",
            "msg": "Extra space"
        })

    # Repeated words (e.g. "the the")
    for m in re.finditer(r'\b(\w+)\s+\1\b', text, re.IGNORECASE):
        issues.append({
            "start": m.start(),
            "end": m.end(),
            "fix": m.group(1),
            "msg": "Repeated word"
        })

    # Sentence initial capitalization
    for m in re.finditer(r'(?:^|[.!?]\s+)([a-z])', text):
        pos = m.start(1)
        issues.append({
            "start": pos,
            "end": pos + 1,
            "fix": m.group(1).upper(),
            "msg": "Start the sentence with a capital"
        })

    # Deduplicate overlapping issues
    issues.sort(key=lambda x: x["start"])
    deduped: List[Dict[str, Any]] = []
    last_end = -1
    for issue in issues:
        if issue["start"] >= last_end:
            issue["id"] = f"{issue['start']}:{issue['fix']}"
            deduped.append(issue)
            last_end = issue["end"]

    return deduped

def get_autocomplete(text: str) -> str:
    if not text or not text.strip():
        return ""
    stripped = text.rstrip().lower()
    has_trailing_space = bool(re.search(r'\s$', text))

    for trigger, completion in AUTOCOMPLETE_BANK:
        if stripped.endswith(trigger):
            if has_trailing_space:
                return re.sub(r'^[ ,]', '', completion)
            return completion

    if re.search(r'[.!?]\s$', text):
        return "Good writing begins with one honest sentence."

    return ""

def tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z']+", text.lower())

def content_tokens(text: str) -> List[str]:
    return [w for w in tokenize(text) if w not in STOP_WORDS]

def make_bigrams(tokens: List[str]) -> set:
    if len(tokens) < 2:
        return set()
    return {f"{tokens[i]} {tokens[i+1]}" for i in range(len(tokens) - 1)}

def compute_similarity(a: str, b: str) -> Dict[str, Any]:
    ca = content_tokens(a)
    cb = content_tokens(b)

    # Term frequency vectors
    tf_a: Dict[str, int] = {}
    for w in ca:
        tf_a[w] = tf_a.get(w, 0) + 1
    tf_b: Dict[str, int] = {}
    for w in cb:
        tf_b[w] = tf_b.get(w, 0) + 1

    dot = sum(tf_a[w] * tf_b[w] for w in tf_a if w in tf_b)
    norm_a = sum(v ** 2 for v in tf_a.values())
    norm_b = sum(v ** 2 for v in tf_b.values())
    sem = (dot / math.sqrt(norm_a * norm_b)) if (norm_a and norm_b) else 0.0

    ba = make_bigrams(tokenize(a))
    bb = make_bigrams(tokenize(b))
    inter = ba.intersection(bb)
    total_bi = len(ba.union(bb))
    lex = (len(inter) / total_bi) if total_bi else 0.0

    score = int(round(100 * (0.6 * sem + 0.4 * lex)))
    if sem >= 0.6 and lex >= 0.5:
        verdict = "Near-duplicate"
    elif sem >= 0.3:
        verdict = "Likely paraphrase"
    else:
        verdict = "Distinct"

    shared = [
        phrase for phrase in inter
        if any(w not in STOP_WORDS for w in phrase.split())
    ][:6]

    return {
        "sem": int(round(sem * 100)),
        "lex": int(round(lex * 100)),
        "score": score,
        "verdict": verdict,
        "shared": shared
    }

def check_paraphrase(text: str, reference: str) -> Dict[str, Any]:
    res = compute_similarity(text, reference)
    is_para = res["verdict"] in ("Near-duplicate", "Likely paraphrase")
    return {
        "is_paraphrase": is_para,
        "score": res["score"],
        "verdict": res["verdict"],
        "shared_phrases": res["shared"],
        "sem": res["sem"],
        "lex": res["lex"]
    }

def generate_paragraph(prompt: str, tone: str) -> str:
    p = (prompt or "good writing").strip()
    cap_p = p.capitalize()
    if tone == "concise":
        return (
            f"{cap_p} comes down to one idea per paragraph. "
            "State the point, support it, move on. Cut whatever the reader would not miss."
        )
    if tone == "warm":
        return (
            f"Let's talk about {p}. It's easier than it looks once you picture one reader across the table. "
            "Say what you'd tell them out loud, then tidy it up. The best drafts still sound like someone you'd want to hear from."
        )
    # Default: formal
    return (
        f"{cap_p} deserves careful attention. At its core, it asks the writer to balance clarity with purpose. "
        "A considered approach begins with a defined audience, then builds each paragraph toward a single point. "
        "In practice, the strongest drafts are revised far more than they are written."
    )

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
            pattern = re.compile(r'\b' + re.escape(src) + r'\b', re.IGNORECASE)
            t = pattern.sub(lambda m: capitalize_like(m.group(), rep), t)
    elif mode == "warm":
        replacements = [
            ("do not", "don't"), ("cannot", "can't"), ("will not", "won't"),
            ("it is", "it's"), ("we are", "we're"), ("I am", "I'm"),
            ("however", "still"), ("therefore", "so")
        ]
        for src, rep in replacements:
            pattern = re.compile(r'\b' + re.escape(src) + r'\b', re.IGNORECASE)
            t = pattern.sub(lambda m: capitalize_like(m.group(), rep), t)
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

    sents = [
        s.strip() for s in re.findall(r'[^.!?]+[.!?]+|[^.!?]+$', text)
        if s.strip()
    ]
    if len(sents) <= n:
        return {
            "summary": sents,
            "text": " ".join(sents),
            "reduction": 0
        }

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

    pct = 0
    if len(text):
        pct = max(0, int(round(100 - (len(summary_str) / len(text)) * 100)))

    return {
        "summary": summary_sents,
        "text": summary_str,
        "reduction": pct
    }
