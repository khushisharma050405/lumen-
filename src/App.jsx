import { useState, useMemo, useEffect, useRef } from 'react'
import { findIssues, suggest, similarity, summarize, improve, generate } from './nlp'

const SAMPLE = `Teh best writing feels effortless, but it rarely is. I recieve alot of drafts where the ideas are strong and the sentences are not.  Their is a simple fix: write first, then edit. You should of started with a rough version, and we definately can make it sharper togther. In my experience`
const REF = `Good prose seems easy, yet it almost never is. Many drafts I read have strong ideas but weak sentences. The remedy is simple: get the words down first, then revise them. A rough version would have given us something to sharpen together.`
const STEPS = [
  ['Write', 'A quiet page that stays out of the way.'],
  ['Grammar autocorrect', 'Mistakes are underlined where they happen. Fix one or all.'],
  ['Sentence autocomplete', 'A faint continuation appears. Press Tab to keep it.'],
  ['Paraphrase detection', 'Compare against a source to see if a passage is reworded.'],
  ['Text similarity', 'Lexical and meaning overlap, with the shared phrases listed.'],
  ['Text generation', 'Draft a paragraph in a tone, or improve what you wrote.'],
  ['Summarization', 'Pull the key sentences at the length you choose.'],
]

function useLS(k, d) {
  const [v, s] = useState(() => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } })
  useEffect(() => { localStorage.setItem(k, JSON.stringify(v)) }, [k, v])
  return [v, s]
}
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

export default function App() {
  const [view, setView] = useState('home')
  const [text, setText] = useLS('margin.text', SAMPLE)
  const [drafts, setDrafts] = useLS('margin.drafts', [
    { id: 1, title: 'Notes on editing', text: REF, date: 'Sep 28' },
    { id: 2, title: 'Cover letter, first pass', text: 'I am writing to apply for the editorial internship. I have spent two years running a campus magazine and i enjoy turning rough ideas into clean prose.', date: 'Sep 30' },
  ])
  const [settings, setSettings] = useLS('margin.settings', { grammar: true, complete: true, tone: 'formal', sumLen: 3, font: 'serif', size: 19 })
  const [toast, setToast] = useState('')
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 1800) }
  const save = () => {
    const title = text.trim().split(/[.!?\n]/)[0].slice(0, 40) || 'Untitled draft'
    setDrafts([{ id: Date.now(), title, text, date: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' }) }, ...drafts])
    say('Draft saved')
  }
  const nav = (v) => { setView(v); window.scrollTo(0, 0) }
  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={() => nav('home')}>Margin</button>
        <nav>
          {[['home', 'Home'], ['write', 'Write'], ['history', `Drafts (${drafts.length})`], ['settings', 'Settings']].map(([k, l]) => (
            <button key={k} className={view === k ? 'on' : ''} onClick={() => nav(k)}>{l}</button>
          ))}
        </nav>
      </header>
      {view === 'home' && <Home go={nav} />}
      {view === 'write' && <Workspace {...{ text, setText, settings, save, say }} />}
      {view === 'history' && <History {...{ drafts, setDrafts, setText, go: nav, say }} />}
      {view === 'settings' && <Settings {...{ settings, setSettings, say }} />}
      <div className={'toast' + (toast ? ' show' : '')} role="status">{toast}</div>
    </div>
  )
}

function Home({ go }) {
  return (
    <main className="home">
      <section className="hero">
        <h1>Write the first draft badly. Let the margin help you fix it.</h1>
        <p>Margin is a writing desk with a quiet editor beside it. It corrects as you type, offers the next sentence, checks what you borrowed, and shortens what runs long.</p>
        <div className="row"><button className="btn primary" onClick={() => go('write')}>Open the editor</button><button className="btn" onClick={() => go('history')}>See saved drafts</button></div>
      </section>
      <section className="specimen" aria-hidden="true">
        <p>I <mark>recieve</mark> alot of drafts<span className="ghost"> where the ideas are strong and the sentences are not.</span></p>
        <small>Underline shows the fix. The pale text is a suggestion — Tab keeps it.</small>
      </section>
      <section className="flow">
        <h2>One workflow, seven steps</h2>
        <ol>{STEPS.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ol>
      </section>
    </main>
  )
}

function Workspace({ text, setText, settings, save, say }) {
  const [tab, setTab] = useState('grammar')
  const [atEnd, setAtEnd] = useState(true)
  const [focus, setFocus] = useState(false)
  const issues = useMemo(() => (settings.grammar ? findIssues(text) : []), [text, settings.grammar])
  const ghost = settings.complete && focus && atEnd ? suggest(text) : ''
  const ta = useRef()
  const fix = (x) => setText(text.slice(0, x.start) + x.fix + text.slice(x.end))
  const fixAll = () => { let t = text; [...issues].reverse().forEach((x) => (t = t.slice(0, x.start) + x.fix + t.slice(x.end))); setText(t); say(`${issues.length} fixes applied`) }
  const parts = []; let i = 0
  issues.forEach((x) => { parts.push(text.slice(i, x.start), <mark key={x.id}>{text.slice(x.start, x.end) || ' '}</mark>); i = x.end })
  parts.push(text.slice(i))
  const w = words(text)
  const font = { fontFamily: settings.font === 'serif' ? 'var(--serif)' : 'var(--sans)', fontSize: settings.size }
  return (
    <main className="work">
      <section className="editor">
        <div className="toolbar">
          <button onClick={fixAll} disabled={!issues.length}>Fix all ({issues.length})</button>
          <button onClick={save}>Save draft</button>
          <button onClick={() => { navigator.clipboard?.writeText(text); say('Copied') }}>Copy</button>
          <button onClick={() => { setText(''); ta.current?.focus() }}>Clear</button>
          <button onClick={() => setText(SAMPLE)}>Sample</button>
          <span className="count">{w} words · {text.length} characters · {Math.max(1, Math.round(w / 220))} min read</span>
        </div>
        <div className="page" style={font}>
          <div className="mirror" aria-hidden="true">{parts}<span className="ghost">{ghost}</span>{'\n '}</div>
          <textarea ref={ta} value={text} spellCheck={false} placeholder="Start with one honest sentence…"
            onChange={(e) => { setText(e.target.value); setAtEnd(e.target.selectionStart === e.target.value.length) }}
            onSelect={(e) => setAtEnd(e.target.selectionStart === text.length)}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            onKeyDown={(e) => { if (e.key === 'Tab' && ghost) { e.preventDefault(); setText(text + ghost) } }} />
        </div>
        <p className="hint">{ghost ? <>Suggestion ready — press <kbd>Tab</kbd> to accept.</> : 'Suggestions appear when the cursor is at the end of your text.'}</p>
      </section>
      <aside className="side">
        <div className="tabs" role="tablist">
          {[['grammar', 'Grammar'], ['similar', 'Similarity'], ['generate', 'Generate'], ['summary', 'Summary']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="panel" key={tab}>
          {tab === 'grammar' && <Grammar {...{ issues, fix, settings }} />}
          {tab === 'similar' && <Similar text={text} />}
          {tab === 'generate' && <Generate {...{ text, setText, settings, say }} />}
          {tab === 'summary' && <Summary {...{ text, settings, say }} />}
        </div>
      </aside>
    </main>
  )
}

function Grammar({ issues, fix, settings }) {
  if (!settings.grammar) return <p className="muted">Grammar autocorrect is off. Turn it on in Settings.</p>
  if (!issues.length) return <p className="muted">No issues found. Your draft reads clean.</p>
  return <ul className="issues">{issues.map((x) => (
    <li key={x.id}><div><small>{x.msg}</small></div>
      <button onClick={() => fix(x)}>Apply: “{x.fix.trim() || 'single space'}”</button></li>))}</ul>
}

function Similar({ text }) {
  const [ref, setRef] = useState(REF)
  const r = useMemo(() => similarity(text, ref), [text, ref])
  return (<>
    <label className="lbl">Source passage to compare against</label>
    <textarea className="box" rows={5} value={ref} onChange={(e) => setRef(e.target.value)} />
    <div className="verdict"><b>{r.verdict}</b><span>{r.score}% overall match</span></div>
    {[['Meaning overlap', r.sem], ['Exact phrasing', r.lex]].map(([l, v]) => (
      <div className="meter" key={l}><span>{l}</span><i><u style={{ width: v + '%' }} /></i><em>{v}%</em></div>))}
    <label className="lbl">Phrases both passages share</label>
    {r.shared.length ? <p className="chips">{r.shared.map((s) => <span key={s}>{s}</span>)}</p> : <p className="muted">No shared phrases.</p>}
  </>)
}

function Generate({ text, setText, settings, say }) {
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState(settings.tone)
  const [out, setOut] = useState('')
  return (<>
    <label className="lbl">What should the paragraph be about?</label>
    <input className="box" value={prompt} placeholder="e.g. revising a first draft" onChange={(e) => setPrompt(e.target.value)} />
    <label className="lbl">Tone</label>
    <div className="seg">{['formal', 'concise', 'warm'].map((t) => <button key={t} className={tone === t ? 'on' : ''} onClick={() => setTone(t)}>{t}</button>)}</div>
    <button className="btn primary full" onClick={() => setOut(generate(prompt, tone))}>Generate paragraph</button>
    <label className="lbl">Or improve your whole draft</label>
    <div className="seg">{[['concise', 'Tighten'], ['formal', 'Formalize'], ['warm', 'Soften'], ['clarity', 'Split long']].map(([m, l]) =>
      <button key={m} onClick={() => setOut(improve(text, m))}>{l}</button>)}</div>
    {out && <div className="result"><p>{out}</p>
      <div className="row"><button className="btn primary" onClick={() => { setText(out); say('Draft replaced') }}>Replace draft</button>
        <button className="btn" onClick={() => { setText(text.replace(/\s*$/, '') + '\n\n' + out); say('Added to draft') }}>Add below</button></div></div>}
  </>)
}

function Summary({ text, settings, say }) {
  const [n, setN] = useState(settings.sumLen)
  const s = useMemo(() => summarize(text, n), [text, n])
  const sum = s.join(' ')
  const pct = text.length ? Math.max(0, Math.round(100 - (sum.length / text.length) * 100)) : 0
  return (<>
    <label className="lbl">Length: {n} sentence{n > 1 ? 's' : ''}</label>
    <input type="range" min="1" max="6" value={n} onChange={(e) => setN(+e.target.value)} />
    {s.length ? <><ul className="sum">{s.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <p className="muted">{words(sum)} of {words(text)} words — {pct}% shorter</p>
      <button className="btn" onClick={() => { navigator.clipboard?.writeText(sum); say('Summary copied') }}>Copy summary</button></>
      : <p className="muted">Write a few sentences to summarize.</p>}
  </>)
}

function History({ drafts, setDrafts, setText, go, say }) {
  const [q, setQ] = useState('')
  const list = drafts.filter((d) => (d.title + d.text).toLowerCase().includes(q.toLowerCase()))
  return (
    <main className="narrow">
      <h1>Saved drafts</h1>
      <input className="box" placeholder="Search drafts" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list.length && <p className="muted">{drafts.length ? 'No drafts match that search.' : 'Nothing saved yet. Save a draft from the editor.'}</p>}
      <ul className="drafts">{list.map((d) => (
        <li key={d.id}>
          <div><h3>{d.title}</h3><p>{d.text.slice(0, 140)}{d.text.length > 140 ? '…' : ''}</p><small>{d.date} · {words(d.text)} words</small></div>
          <div className="row"><button className="btn primary" onClick={() => { setText(d.text); go('write') }}>Open</button>
            <button className="btn" onClick={() => { setDrafts(drafts.filter((x) => x.id !== d.id)); say('Draft deleted') }}>Delete</button></div>
        </li>))}</ul>
    </main>
  )
}

function Settings({ settings: s, setSettings, say }) {
  const set = (k, v) => setSettings({ ...s, [k]: v })
  const Row = ({ t, d, children }) => <div className="srow"><div><b>{t}</b><p>{d}</p></div>{children}</div>
  const Tog = ({ k }) => <button role="switch" aria-checked={s[k]} className={'sw' + (s[k] ? ' on' : '')} onClick={() => set(k, !s[k])}><i /></button>
  return (
    <main className="narrow">
      <h1>Settings</h1>
      <Row t="Grammar autocorrect" d="Underline mistakes while you type."><Tog k="grammar" /></Row>
      <Row t="Sentence autocomplete" d="Show a faint continuation at the end of your text."><Tog k="complete" /></Row>
      <Row t="Default tone" d="Used when generating a paragraph."><div className="seg">{['formal', 'concise', 'warm'].map((t) => <button key={t} className={s.tone === t ? 'on' : ''} onClick={() => set('tone', t)}>{t}</button>)}</div></Row>
      <Row t="Summary length" d={`${s.sumLen} sentences by default.`}><input type="range" min="1" max="6" value={s.sumLen} onChange={(e) => set('sumLen', +e.target.value)} /></Row>
      <Row t="Editor typeface" d="Serif for drafting, sans for editing."><div className="seg">{['serif', 'sans'].map((t) => <button key={t} className={s.font === t ? 'on' : ''} onClick={() => set('font', t)}>{t}</button>)}</div></Row>
      <Row t="Editor text size" d={`${s.size}px`}><input type="range" min="15" max="24" value={s.size} onChange={(e) => set('size', +e.target.value)} /></Row>
      <button className="btn" onClick={() => { localStorage.clear(); say('Local data cleared — reload to reset'); }}>Clear local data</button>
    </main>
  )
}
