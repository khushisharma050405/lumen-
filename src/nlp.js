// Lightweight, offline NLP heuristics with stemming, synonym normalization, and refined generation rules.
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')
const isUp = (s) => (s ? s[0] !== s[0].toLowerCase() : false)

const word = (src, fix, msg) => ({
  re: new RegExp('\\b' + src + '\\b', 'gi'),
  msg,
  f: (m) => ({
    start: m.index,
    end: m.index + m[0].length,
    fix: isUp(m[0]) ? cap(fix) : fix
  })
})

const RULES = [
  word('teh', 'the', 'Typo'),
  word('recieve', 'receive', 'Spelling'),
  word('alot', 'a lot', 'Spelling'),
  word('definately', 'definitely', 'Spelling'),
  word('seperate', 'separate', 'Spelling'),
  word('togther', 'together', 'Spelling'),
  word('occured', 'occurred', 'Spelling'),
  word('dont', "don't", 'Missing apostrophe'),
  word('cant', "can't", 'Missing apostrophe'),
  word('doesnt', "doesn't", 'Missing apostrophe'),
  word('wont', "won't", 'Missing apostrophe'),
  word('should of', 'should have', '"Of" should be "have"'),
  word('could of', 'could have', '"Of" should be "have"'),
  word('would of', 'would have', '"Of" should be "have"'),
  word('their is', 'there is', 'Their / there'),
  word('their are', 'there are', 'Their / there'),
  { re: /\bi\b/g, msg: 'Capitalize "I"', f: (m) => ({ start: m.index, end: m.index + 1, fix: 'I' }) },
  { re: /(?<=\S) {2,}(?=\S)/g, msg: 'Extra space', f: (m) => ({ start: m.index, end: m.index + m[0].length, fix: ' ' }) },
  { re: /\b(\w+)\s+\1\b/gi, msg: 'Repeated word', f: (m) => ({ start: m.index, end: m.index + m[0].length, fix: m[1] }) },
  {
    re: /(?:^|[.!?]\s+)([a-z])/g,
    msg: 'Start the sentence with a capital',
    f: (m) => {
      const s = m.index + m[0].length - 1
      return { start: s, end: s + 1, fix: m[1].toUpperCase() }
    }
  }
]

export function findIssues(text) {
  if (!text) return []
  const all = []
  for (const r of RULES) {
    for (const m of text.matchAll(r.re)) {
      const x = r.f(m)
      if (x.fix !== text.slice(x.start, x.end)) all.push({ ...x, msg: r.msg })
    }
  }
  all.sort((a, b) => a.start - b.start)
  const out = []
  let end = -1
  for (const x of all) {
    if (x.start >= end) {
      out.push({ ...x, id: x.start + ':' + x.fix })
      end = x.end
    }
  }
  return out
}

const BANK = [
  ['in conclusion', ', the evidence points to one clear next step.'],
  ['write first', ', then edit with a cooler head.'],
  ['the main reason is', ' that readers skim before they commit.'],
  ['for example', ', a short opening line can set the tone for the whole piece.'],
  ['however', ', clarity matters more than cleverness.'],
  ['on the other hand', ', brevity can hide nuance.'],
  ['as a result', ', the final draft reads faster and lands harder.'],
  ['i would like to', ' thank you for your time and consideration.'],
  ['thank you for', ' taking the time to read this.'],
  ['looking forward to', ' hearing your thoughts.'],
  ['we should', ' cut every sentence that does not earn its place.'],
  ['in my experience', ', the first paragraph decides whether anyone reads the second.'],
]

export function suggest(text) {
  if (!text.trim()) return ''
  const low = text.toLowerCase().replace(/\s+$/, '')
  const sp = /\s$/.test(text)
  for (const [t, c] of BANK) {
    if (low.endsWith(t)) return sp ? c.replace(/^ /, '') : c
  }
  if (/[.!?]\s$/.test(text)) return 'Good writing begins with one honest sentence.'
  return ''
}

const STOP = new Set(
  'a an the and or but if of to in on at by for with from as is are was were be been it its this that these those i you he she we they my your our their so not no do does did have has had will would can could should than then there here'.split(' ')
)

// Curated synonym canonical dictionary for high-precision semantic matching
const SYNONYMS = {
  // company / firm / business / enterprise
  firm: 'company',
  company: 'company',
  business: 'company',
  corporation: 'company',
  enterprise: 'company',

  // profits / earnings / revenue
  profit: 'profit',
  profits: 'profit',
  earning: 'profit',
  earnings: 'profit',
  revenue: 'profit',
  gains: 'profit',

  // report / announce / state
  announce: 'announce',
  announced: 'announce',
  announces: 'announce',
  report: 'announce',
  reported: 'announce',
  reports: 'announce',
  declare: 'announce',
  declared: 'announce',

  // record / highest / top / peak
  record: 'record',
  highest: 'record',
  peak: 'record',
  top: 'record',

  // rely / depend
  rely: 'depend',
  relies: 'depend',
  relied: 'depend',
  depend: 'depend',
  depends: 'depend',
  depended: 'depend',

  // way / how / method / manner
  how: 'method',
  way: 'method',
  manner: 'method',
  method: 'method',

  // team / group / squad
  team: 'team',
  teams: 'team',
  group: 'team',
  groups: 'team',

  // communicate / interact / converse
  communicate: 'communicate',
  communicates: 'communicate',
  communicated: 'communicate',
  communicating: 'communicate',
  talk: 'communicate',
  converse: 'communicate',

  // change / alter / transform
  change: 'change',
  changes: 'change',
  changed: 'change',
  changing: 'change',
  alter: 'change',
  altered: 'change',

  // remote / distant
  remote: 'remote',
  distant: 'remote',

  // work / labor / job
  work: 'work',
  working: 'work',
  worked: 'work',
  works: 'work',

  // mountain / hill
  mountain: 'mountain',
  mountains: 'mountain',

  // invoice / bill
  invoice: 'invoice',
  invoices: 'invoice',
  bill: 'invoice',
}

export function stem(word) {
  let w = (word || '').toLowerCase()
  if (w.length <= 3) return w
  if (w.endsWith('ings') && w.length > 5) return w.slice(0, -4)
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y'
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3)
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('es') && !w.endsWith('ss') && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) w = w.slice(0, -1)
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1)
  return w
}

export function canonical(w) {
  const s = stem(w)
  return SYNONYMS[w] || SYNONYMS[s] || s
}

const tok = (s) => (s || '').toLowerCase().match(/[a-z']+/g) || []
const content = (s) => tok(s).filter((w) => !STOP.has(w))
const bigrams = (t) => new Set(t.slice(1).map((w, i) => t[i] + ' ' + w))

export function similarity(a, b) {
  if (!a || !b || !a.trim() || !b.trim()) {
    return {
      sem: 0,
      lex: 0,
      score: 0,
      verdict: 'Distinct',
      reason: 'Enter text in both inputs to calculate similarity.',
      shared: [],
      sharedWords: []
    }
  }

  const ca = content(a)
  const cb = content(b)

  // Map to canonical stemmed tokens with synonym normalization
  const cTokA = ca.map(canonical)
  const cTokB = cb.map(canonical)

  const tf = (t) => t.reduce((m, w) => ((m[w] = (m[w] || 0) + 1), m), {})
  const A = tf(cTokA)
  const B = tf(cTokB)

  let dot = 0
  let na = 0
  let nb = 0
  for (const k in A) {
    na += A[k] ** 2
    if (B[k]) dot += A[k] * B[k]
  }
  for (const k in B) nb += B[k] ** 2

  const sem = na && nb ? dot / Math.sqrt(na * nb) : 0

  // Surface bigram phrasing overlap
  const tokA = tok(a)
  const tokB = tok(b)
  const ba = bigrams(tokA)
  const bb = bigrams(tokB)
  const interBigrams = [...ba].filter((x) => bb.has(x))
  const totalBigrams = ba.size + bb.size - interBigrams.length
  const lex = totalBigrams > 0 ? interBigrams.length / totalBigrams : 0

  const mPct = Math.round(sem * 100)
  const pPct = Math.round(lex * 100)
  const score = Math.round(0.6 * mPct + 0.4 * pPct)

  // Verdict thresholds strictly matching rules:
  // Near-duplicate: meaning >= 60 and phrasing >= 50.
  // Likely paraphrase: meaning >= 30.
  // Otherwise Distinct.
  let verdict = 'Distinct'
  let reason = 'Different phrasing and distinct core meaning.'

  if (mPct >= 60 && pPct >= 50) {
    verdict = 'Near-duplicate'
    reason = 'Substantial overlap in both meaning and phrasing.'
  } else if (mPct >= 30) {
    verdict = 'Likely paraphrase'
    reason = 'Shares core meaning with rephrased wording.'
  }

  // Shared phrases (bigrams)
  const shared = interBigrams.filter((p) => p.split(' ').some((w) => !STOP.has(w))).slice(0, 6)

  // Shared content words (including stemmed / synonym matches)
  const setTokB = new Set(tokB)
  const sharedWords = [
    ...new Set(
      ca.filter((w) => setTokB.has(w) || cb.some((bWord) => canonical(bWord) === canonical(w)))
    )
  ].slice(0, 10)

  return {
    sem: mPct,
    lex: pPct,
    score,
    verdict,
    reason,
    shared,
    sharedWords
  }
}

export function summarize(text, n = 3) {
  const sents = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean)
  if (sents.length <= n) return sents
  const freq = {}
  content(text).forEach((w) => (freq[w] = (freq[w] || 0) + 1))
  const scored = sents.map((s, i) => {
    const t = content(s)
    return {
      i,
      s,
      v: t.reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(t.length || 1) + (i === 0 ? 1.5 : 0)
    }
  })
  return scored
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
}

export function improve(text, mode) {
  let t = text || ''
  if (mode === 'concise') {
    t = t
      .replace(/\b(very|really|basically|actually|just|quite)\s+/gi, '')
      .replace(/in order to/gi, 'to')
      .replace(/due to the fact that/gi, 'because')
      .replace(/at this point in time/gi, 'now')
      .replace(/ {2,}/g, ' ')
  } else if (mode === 'formal') {
    const map = [
      ["don't", 'do not'],
      ["can't", 'cannot'],
      ["won't", 'will not'],
      ["doesn't", 'does not'],
      ["it's", 'it is'],
      ["we're", 'we are'],
      ["I'm", 'I am'],
      ['a lot of', 'many'],
      ['get', 'obtain'],
      ['help', 'assist']
    ]
    map.forEach(([a, b]) => {
      t = t.replace(new RegExp('\\b' + a + '\\b', 'gi'), (m) => (isUp(m) ? cap(b) : b))
    })
  } else if (mode === 'warm') {
    const map = [
      ['do not', "don't"],
      ['cannot', "can't"],
      ['will not', "won't"],
      ['it is', "it's"],
      ['we are', "we're"],
      ['I am', "I'm"],
      ['however', 'still'],
      ['therefore', 'so']
    ]
    map.forEach(([a, b]) => {
      t = t.replace(new RegExp('\\b' + a + '\\b', 'gi'), (m) => (isUp(m) ? cap(b) : b))
    })
  } else if (mode === 'clarity') {
    t = t
      .split(/(?<=[.!?])\s+/)
      .map((s) =>
        s.split(' ').length > 28
          ? s.replace(/, (and|but|which) /, '. ' + '$1 ').replace(/\. (and|but|which) /, (m, g) => '. ' + cap(g) + ' ')
          : s
      )
      .join(' ')
  }
  return t.trim()
}

export function generate(prompt, tone) {
  const p = (prompt || 'good writing').trim()
  const P = cap(p)
  const lowP = p.toLowerCase()

  // Plural check: ends in 's' but not 'ss', or contains ' and '
  const isPlural = /(?<!s)s$/i.test(p) || /\band\b/i.test(p)
  const verb = isPlural ? 'deserve' : 'deserves'
  const comeVerb = isPlural ? 'come' : 'comes'

  if (tone === 'concise') {
    return `${P} ${comeVerb} down to one idea per paragraph. When developing ${lowP}, state the point, support it, move on. Cut whatever the reader would not miss.`
  }
  if (tone === 'warm') {
    return `Let's talk about ${lowP}. It's easier than it looks once you picture one reader across the table. Say what you'd tell them out loud, then tidy it up. The best drafts still sound like someone you'd want to hear from.`
  }
  // Default: formal
  return `${P} ${verb} careful attention. At its core, approaching ${lowP} asks the writer to balance clarity with purpose. A considered approach begins with a defined audience, then builds each paragraph toward a single point. In practice, the strongest drafts are revised far more than they are written.`
}
