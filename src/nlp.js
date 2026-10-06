// Lightweight, offline NLP heuristics — swap these for real API calls when ready.
const cap = (s) => s[0].toUpperCase() + s.slice(1)
const isUp = (s) => s[0] !== s[0].toLowerCase()
const word = (src, fix, msg) => ({
  re: new RegExp('\\b' + src + '\\b', 'gi'), msg,
  f: (m) => ({ start: m.index, end: m.index + m[0].length, fix: isUp(m[0]) ? cap(fix) : fix }),
})
const RULES = [
  word('teh', 'the', 'Typo'), word('recieve', 'receive', 'Spelling'), word('alot', 'a lot', 'Spelling'),
  word('definately', 'definitely', 'Spelling'), word('seperate', 'separate', 'Spelling'),
  word('togther', 'together', 'Spelling'), word('occured', 'occurred', 'Spelling'),
  word('dont', "don't", 'Missing apostrophe'), word('cant', "can't", 'Missing apostrophe'),
  word('doesnt', "doesn't", 'Missing apostrophe'), word('wont', "won't", 'Missing apostrophe'),
  word('should of', 'should have', '"Of" should be "have"'), word('could of', 'could have', '"Of" should be "have"'),
  word('would of', 'would have', '"Of" should be "have"'), word('their is', 'there is', 'Their / there'),
  word('their are', 'there are', 'Their / there'),
  { re: /\bi\b/g, msg: 'Capitalize "I"', f: (m) => ({ start: m.index, end: m.index + 1, fix: 'I' }) },
  { re: /(?<=\S) {2,}(?=\S)/g, msg: 'Extra space', f: (m) => ({ start: m.index, end: m.index + m[0].length, fix: ' ' }) },
  { re: /\b(\w+)\s+\1\b/gi, msg: 'Repeated word', f: (m) => ({ start: m.index, end: m.index + m[0].length, fix: m[1] }) },
  { re: /(?:^|[.!?]\s+)([a-z])/g, msg: 'Start the sentence with a capital',
    f: (m) => { const s = m.index + m[0].length - 1; return { start: s, end: s + 1, fix: m[1].toUpperCase() } } },
]
export function findIssues(text) {
  const all = []
  for (const r of RULES) for (const m of text.matchAll(r.re)) {
    const x = r.f(m)
    if (x.fix !== text.slice(x.start, x.end)) all.push({ ...x, msg: r.msg })
  }
  all.sort((a, b) => a.start - b.start)
  const out = []; let end = -1
  for (const x of all) if (x.start >= end) { out.push({ ...x, id: x.start + ':' + x.fix }); end = x.end }
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
  for (const [t, c] of BANK) if (low.endsWith(t)) return sp ? c.replace(/^ /, '') : c
  if (/[.!?]\s$/.test(text)) return 'Good writing begins with one honest sentence.'
  return ''
}

const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been it its this that these those i you he she we they my your our their so not no do does did have has had will would can could should than then there here'.split(' '))
const tok = (s) => s.toLowerCase().match(/[a-z']+/g) || []
const content = (s) => tok(s).filter((w) => !STOP.has(w))
const bigrams = (t) => new Set(t.slice(1).map((w, i) => t[i] + ' ' + w))
export function similarity(a, b) {
  const ca = content(a), cb = content(b)
  const tf = (t) => t.reduce((m, w) => ((m[w] = (m[w] || 0) + 1), m), {})
  const A = tf(ca), B = tf(cb)
  let dot = 0, na = 0, nb = 0
  for (const k in A) { na += A[k] ** 2; if (B[k]) dot += A[k] * B[k] }
  for (const k in B) nb += B[k] ** 2
  const sem = na && nb ? dot / Math.sqrt(na * nb) : 0
  const ba = bigrams(tok(a)), bb = bigrams(tok(b))
  const inter = [...ba].filter((x) => bb.has(x))
  const lex = ba.size + bb.size - inter.length ? inter.length / (ba.size + bb.size - inter.length) : 0
  const score = Math.round(100 * (0.6 * sem + 0.4 * lex))
  const verdict = sem >= 0.6 && lex >= 0.5 ? 'Near-duplicate' : sem >= 0.3 ? 'Likely paraphrase' : 'Distinct'
  const shared = inter.filter((p) => p.split(' ').some((w) => !STOP.has(w))).slice(0, 6)
  return { sem: Math.round(sem * 100), lex: Math.round(lex * 100), score, verdict, shared }
}

export function summarize(text, n = 3) {
  const sents = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean)
  if (sents.length <= n) return sents
  const freq = {}
  content(text).forEach((w) => (freq[w] = (freq[w] || 0) + 1))
  const scored = sents.map((s, i) => {
    const t = content(s)
    return { i, s, v: t.reduce((a, w) => a + freq[w], 0) / Math.sqrt(t.length || 1) + (i === 0 ? 1.5 : 0) }
  })
  return scored.sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s)
}

export function improve(text, mode) {
  let t = text
  if (mode === 'concise') {
    t = t.replace(/\b(very|really|basically|actually|just|quite)\s+/gi, '')
      .replace(/in order to/gi, 'to').replace(/due to the fact that/gi, 'because')
      .replace(/at this point in time/gi, 'now').replace(/ {2,}/g, ' ')
  } else if (mode === 'formal') {
    const map = [["don't", 'do not'], ["can't", 'cannot'], ["won't", 'will not'], ["doesn't", 'does not'], ["it's", 'it is'], ["we're", 'we are'], ["I'm", 'I am'], ['a lot of', 'many'], ['get', 'obtain'], ['help', 'assist']]
    map.forEach(([a, b]) => (t = t.replace(new RegExp('\\b' + a + '\\b', 'gi'), (m) => (isUp(m) ? cap(b) : b))))
  } else if (mode === 'warm') {
    const map = [['do not', "don't"], ['cannot', "can't"], ['will not', "won't"], ['it is', "it's"], ['we are', "we're"], ['I am', "I'm"], ['however', 'still'], ['therefore', 'so']]
    map.forEach(([a, b]) => (t = t.replace(new RegExp('\\b' + a + '\\b', 'gi'), (m) => (isUp(m) ? cap(b) : b))))
  } else if (mode === 'clarity') {
    t = t.split(/(?<=[.!?])\s+/).map((s) => (s.split(' ').length > 28 ? s.replace(/, (and|but|which) /, '. ' + '$1 ').replace(/\. (and|but|which) /, (m, g) => '. ' + cap(g) + ' ') : s)).join(' ')
  }
  return t.trim()
}

export function generate(prompt, tone) {
  const p = prompt.trim() || 'good writing'
  const P = cap(p)
  if (tone === 'concise') return `${P} comes down to one idea per paragraph. State the point, support it, move on. Cut whatever the reader would not miss.`
  if (tone === 'warm') return `Let's talk about ${p}. It's easier than it looks once you picture one reader across the table. Say what you'd tell them out loud, then tidy it up. The best drafts still sound like someone you'd want to hear from.`
  return `${P} deserves careful attention. At its core, it asks the writer to balance clarity with purpose. A considered approach begins with a defined audience, then builds each paragraph toward a single point. In practice, the strongest drafts are revised far more than they are written.`
}
