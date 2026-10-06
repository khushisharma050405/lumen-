import { useState, useMemo, useEffect, useRef } from 'react'
import { findIssues, suggest, similarity, summarize, improve, generate } from './nlp'
import { LeafIcon } from './icons'
import { Landing } from './Landing'

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
  const [v, s] = useState(() => {
    try {
      const item = localStorage.getItem(k)
      return item !== null ? JSON.parse(item) : d
    } catch {
      return d
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch (e) {
      console.warn('LocalStorage error:', e)
    }
  }, [k, v])
  return [v, s]
}

const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

function getRouteFromPath(pathname) {
  if (pathname === '/login') return { view: 'landing', authMode: 'login' }
  if (pathname === '/signup') return { view: 'landing', authMode: 'signup' }
  if (pathname === '/write') return { view: 'write', authMode: null }
  if (pathname === '/history') return { view: 'history', authMode: null }
  if (pathname === '/settings') return { view: 'settings', authMode: null }
  return { view: 'landing', authMode: 'login' }
}

export default function App() {
  const initialRoute = useMemo(() => getRouteFromPath(window.location.pathname), [])
  const [view, setView] = useState(initialRoute.view)
  const [authMode, setAuthMode] = useState(initialRoute.authMode || 'login')
  const [activeTab, setActiveTab] = useState('grammar')
  const [showAbout, setShowAbout] = useState(false)

  const [text, setText] = useLS('verse.text', SAMPLE)
  const [drafts, setDrafts] = useLS('verse.drafts', [
    { id: 1, title: 'Notes on editing', text: REF, date: 'Sep 28' },
    { id: 2, title: 'Cover letter, first pass', text: 'I am writing to apply for the editorial internship. I have spent two years running a campus magazine and i enjoy turning rough ideas into clean prose.', date: 'Sep 30' },
  ])
  const [settings, setSettings] = useLS('verse.settings', {
    grammar: true,
    complete: true,
    tone: 'formal',
    sumLen: 3,
    font: 'serif',
    size: 19
  })
  const [user, setUser] = useLS('verse.user', null)
  const [token, setToken] = useLS('verse.token', null)
  const [toast, setToast] = useState('')

  const say = (m) => {
    setToast(m)
    setTimeout(() => setToast(''), 2200)
  }

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPath(window.location.pathname)
      setView(route.view)
      if (route.authMode) setAuthMode(route.authMode)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const nav = (targetView, extraTab) => {
    if (extraTab) setActiveTab(extraTab)

    let path = '/'
    if (targetView === 'write') path = '/write'
    else if (targetView === 'history') path = '/history'
    else if (targetView === 'settings') path = '/settings'
    else if (targetView === 'login') {
      path = '/login'
      setAuthMode('login')
      targetView = 'landing'
    } else if (targetView === 'signup') {
      path = '/signup'
      setAuthMode('signup')
      targetView = 'landing'
    } else {
      path = '/'
    }

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }

    setView(targetView)
    window.scrollTo(0, 0)
  }

  const save = () => {
    const title = text.trim().split(/[.!?\n]/)[0].slice(0, 40) || 'Untitled draft'
    const newDraft = {
      id: Date.now(),
      title,
      text,
      date: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })
    }
    setDrafts([newDraft, ...drafts])
    say('Draft saved')
  }

  const handleAuthSuccess = async ({ mode, email, password, name }) => {
    // Attempt backend login/signup if available; fallback smoothly
    let signedUser = { email, name: name || email.split('@')[0] }
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.token) setToken(data.token)
        if (data.user) signedUser = data.user
      }
    } catch {
      // Offline fallback: simulate successful session
    }

    setUser(signedUser)
    say(`Welcome to Verse, ${signedUser.name || 'Writer'}!`)
    nav('write')
  }

  const handleLogout = () => {
    setUser(null)
    setToken(null)
    say('Logged out')
    nav('landing')
  }

  return (
    <div className="app">
      {/* Top Navbar */}
      <header className="top">
        <button className="brand" onClick={() => nav('landing')} aria-label="Verse Home">
          <LeafIcon size={24} />
          <span>V E R S E</span>
        </button>

        <nav>
          <button
            onClick={() => {
              if (view !== 'landing') nav('landing')
              setTimeout(() => {
                const el = document.getElementById('features')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }, 60)
            }}
          >
            Features
          </button>
          <button onClick={() => setShowAbout(true)}>About</button>
          <button
            className={view === 'write' ? 'on' : ''}
            onClick={() => nav('write')}
          >
            Write
          </button>
          <button
            className={view === 'history' ? 'on' : ''}
            onClick={() => nav('history')}
          >
            Drafts ({drafts.length})
          </button>
          <button
            className={view === 'settings' ? 'on' : ''}
            onClick={() => nav('settings')}
          >
            Settings
          </button>
          {user ? (
            <button className="btn" onClick={handleLogout} style={{ padding: '6px 14px', fontSize: '13.5px' }}>
              Log out ({user.name?.split(' ')[0] || 'User'})
            </button>
          ) : (
            <button
              className={view === 'landing' && authMode === 'login' && window.location.pathname === '/login' ? 'on' : ''}
              onClick={() => nav('login')}
            >
              Login
            </button>
          )}
        </nav>
      </header>

      {/* Main Routed Views */}
      {view === 'landing' && (
        <Landing
          go={nav}
          initialMode={authMode}
          user={user}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
        />
      )}

      {view === 'write' && (
        <Workspace
          text={text}
          setText={setText}
          settings={settings}
          save={save}
          say={say}
          initialTab={activeTab}
        />
      )}

      {view === 'history' && (
        <History
          drafts={drafts}
          setDrafts={setDrafts}
          setText={setText}
          go={nav}
          say={say}
        />
      )}

      {view === 'settings' && (
        <Settings
          settings={settings}
          setSettings={setSettings}
          say={say}
        />
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="about-modal-backdrop" onClick={() => setShowAbout(false)} role="dialog" aria-modal="true">
          <div className="about-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="auth-leaf-wrapper">
              <LeafIcon size={32} />
            </div>
            <h2>About Verse</h2>
            <p>
              Verse is a calm, intelligent writing sanctuary designed to elevate your craft without distraction.
              Combining gentle real-time assistance with deep stylistic refinement, Verse helps you write with precision and resonance.
            </p>
            <div className="about-stats-row">
              <div><b>6</b><span>Core Tools</span></div>
              <div><b>100%</b><span>Offline Capable</span></div>
              <div><b>0</b><span>Clutter</span></div>
            </div>
            <button className="btn btn-sage pill-cta full-btn" onClick={() => setShowAbout(false)}>
              Back to Writing
            </button>
          </div>
        </div>
      )}

      {/* Floating Status Toast */}
      <div className={'toast' + (toast ? ' show' : '')} role="status">{toast}</div>
    </div>
  )
}

function Workspace({ text, setText, settings, save, say, initialTab = 'grammar' }) {
  const [tab, setTab] = useState(initialTab)
  const [atEnd, setAtEnd] = useState(true)
  const [focus, setFocus] = useState(false)
  const issues = useMemo(() => (settings.grammar ? findIssues(text) : []), [text, settings.grammar])
  const ghost = settings.complete && focus && atEnd ? suggest(text) : ''
  const ta = useRef()

  const fix = (x) => setText(text.slice(0, x.start) + x.fix + text.slice(x.end))
  const fixAll = () => {
    let t = text
    ;[...issues].reverse().forEach((x) => (t = t.slice(0, x.start) + x.fix + t.slice(x.end)))
    setText(t)
    say(`${issues.length} fixes applied`)
  }

  const parts = []
  let i = 0
  issues.forEach((x) => {
    parts.push(text.slice(i, x.start), <mark key={x.id}>{text.slice(x.start, x.end) || ' '}</mark>)
    i = x.end
  })
  parts.push(text.slice(i))

  const w = words(text)
  const font = {
    fontFamily: settings.font === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)',
    fontSize: settings.size
  }

  return (
    <main className="work">
      <section className="editor">
        <div className="toolbar">
          <button onClick={fixAll} disabled={!issues.length}>
            Fix all ({issues.length})
          </button>
          <button onClick={save}>Save draft</button>
          <button onClick={() => { navigator.clipboard?.writeText(text); say('Copied to clipboard') }}>
            Copy
          </button>
          <button onClick={() => { setText(''); ta.current?.focus() }}>
            Clear
          </button>
          <button onClick={() => setText(SAMPLE)}>
            Sample
          </button>
          <span className="count">
            {w} words · {text.length} characters · {Math.max(1, Math.round(w / 220))} min read
          </span>
        </div>

        <div className="page" style={font}>
          <div className="mirror" aria-hidden="true">
            {parts}
            <span className="ghost">{ghost}</span>
            {'\n '}
          </div>
          <textarea
            ref={ta}
            value={text}
            spellCheck={false}
            placeholder="Start with one honest sentence…"
            onChange={(e) => {
              setText(e.target.value)
              setAtEnd(e.target.selectionStart === e.target.value.length)
            }}
            onSelect={(e) => setAtEnd(e.target.selectionStart === text.length)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && ghost) {
                e.preventDefault()
                setText(text + ghost)
              }
            }}
          />
        </div>
        <p className="hint">
          {ghost ? (
            <>Suggestion ready — press <kbd>Tab</kbd> to accept.</>
          ) : (
            'Suggestions appear automatically when cursor is at the end of your draft.'
          )}
        </p>
      </section>

      <aside className="side">
        <div className="tabs" role="tablist">
          {[
            ['grammar', 'Grammar'],
            ['similar', 'Similarity'],
            ['generate', 'Generate'],
            ['summary', 'Summary'],
          ].map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'on' : ''}
              onClick={() => setTab(k)}
            >
              {l}
            </button>
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
  if (!issues.length) return <p className="muted">No issues found. Your draft reads clean and sharp.</p>
  return (
    <ul className="issues">
      {issues.map((x) => (
        <li key={x.id}>
          <div>
            <small>{x.msg}</small>
          </div>
          <button onClick={() => fix(x)}>
            Apply: “{x.fix.trim() || 'single space'}”
          </button>
        </li>
      ))}
    </ul>
  )
}

function Similar({ text }) {
  const [ref, setRef] = useState(REF)
  const r = useMemo(() => similarity(text, ref), [text, ref])
  return (
    <>
      <label className="lbl">Source passage to compare against</label>
      <textarea className="box" rows={5} value={ref} onChange={(e) => setRef(e.target.value)} />
      <div className="verdict">
        <b>{r.verdict}</b>
        <span>{r.score}% overall match</span>
      </div>
      {[
        ['Meaning overlap', r.sem],
        ['Exact phrasing', r.lex],
      ].map(([l, v]) => (
        <div className="meter" key={l}>
          <span>{l}</span>
          <i><u style={{ width: v + '%' }} /></i>
          <em>{v}%</em>
        </div>
      ))}
      <label className="lbl">Phrases both passages share</label>
      {r.shared.length ? (
        <p className="chips">
          {r.shared.map((s) => <span key={s}>{s}</span>)}
        </p>
      ) : (
        <p className="muted">No shared phrases.</p>
      )}
    </>
  )
}

function Generate({ text, setText, settings, say }) {
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState(settings.tone)
  const [out, setOut] = useState('')
  return (
    <>
      <label className="lbl">What should the paragraph be about?</label>
      <input
        className="box"
        value={prompt}
        placeholder="e.g. revising a first draft"
        onChange={(e) => setPrompt(e.target.value)}
      />
      <label className="lbl">Tone</label>
      <div className="seg">
        {['formal', 'concise', 'warm'].map((t) => (
          <button key={t} className={tone === t ? 'on' : ''} onClick={() => setTone(t)}>
            {t}
          </button>
        ))}
      </div>
      <button className="btn primary full" onClick={() => setOut(generate(prompt, tone))}>
        Generate paragraph
      </button>
      <label className="lbl">Or refine your whole draft</label>
      <div className="seg">
        {[
          ['concise', 'Tighten'],
          ['formal', 'Formalize'],
          ['warm', 'Soften'],
          ['clarity', 'Split long'],
        ].map(([m, l]) => (
          <button key={m} onClick={() => setOut(improve(text, m))}>
            {l}
          </button>
        ))}
      </div>
      {out && (
        <div className="result">
          <p>{out}</p>
          <div className="row">
            <button className="btn primary" onClick={() => { setText(out); say('Draft replaced') }}>
              Replace draft
            </button>
            <button className="btn" onClick={() => { setText(text.replace(/\s*$/, '') + '\n\n' + out); say('Added to draft') }}>
              Add below
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Summary({ text, settings, say }) {
  const [n, setN] = useState(settings.sumLen)
  const s = useMemo(() => summarize(text, n), [text, n])
  const sum = s.join(' ')
  const pct = text.length ? Math.max(0, Math.round(100 - (sum.length / text.length) * 100)) : 0
  return (
    <>
      <label className="lbl">Length: {n} sentence{n > 1 ? 's' : ''}</label>
      <input type="range" min="1" max="6" value={n} onChange={(e) => setN(+e.target.value)} />
      {s.length ? (
        <>
          <ul className="sum">
            {s.map((x, idx) => <li key={idx}>{x}</li>)}
          </ul>
          <p className="muted">
            {words(sum)} of {words(text)} words — {pct}% shorter
          </p>
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(sum); say('Summary copied') }}>
            Copy summary
          </button>
        </>
      ) : (
        <p className="muted">Write a few sentences to summarize.</p>
      )}
    </>
  )
}

function History({ drafts, setDrafts, setText, go, say }) {
  const [q, setQ] = useState('')
  const list = drafts.filter((d) => (d.title + d.text).toLowerCase().includes(q.toLowerCase()))
  return (
    <main className="narrow">
      <h1>Saved drafts</h1>
      <input className="box" placeholder="Search drafts" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list.length && (
        <p className="muted">
          {drafts.length ? 'No drafts match that search.' : 'Nothing saved yet. Save a draft from the editor.'}
        </p>
      )}
      <ul className="drafts">
        {list.map((d) => (
          <li key={d.id}>
            <div>
              <h3>{d.title}</h3>
              <p>{d.text.slice(0, 140)}{d.text.length > 140 ? '…' : ''}</p>
              <small>{d.date} · {words(d.text)} words</small>
            </div>
            <div className="row">
              <button className="btn primary" onClick={() => { setText(d.text); go('write') }}>
                Open
              </button>
              <button className="btn" onClick={() => { setDrafts(drafts.filter((x) => x.id !== d.id)); say('Draft deleted') }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}

function Settings({ settings: s, setSettings, say }) {
  const set = (k, v) => setSettings({ ...s, [k]: v })
  const Row = ({ t, d, children }) => (
    <div className="srow">
      <div>
        <b>{t}</b>
        <p>{d}</p>
      </div>
      {children}
    </div>
  )
  const Tog = ({ k }) => (
    <button role="switch" aria-checked={s[k]} className={'sw' + (s[k] ? ' on' : '')} onClick={() => set(k, !s[k])}>
      <i />
    </button>
  )

  return (
    <main className="narrow">
      <h1>Settings</h1>
      <Row t="Grammar autocorrect" d="Underline mistakes while you type."><Tog k="grammar" /></Row>
      <Row t="Sentence autocomplete" d="Show a faint continuation at the end of your text."><Tog k="complete" /></Row>
      <Row t="Default tone" d="Used when generating a paragraph.">
        <div className="seg">
          {['formal', 'concise', 'warm'].map((t) => (
            <button key={t} className={s.tone === t ? 'on' : ''} onClick={() => set('tone', t)}>{t}</button>
          ))}
        </div>
      </Row>
      <Row t="Summary length" d={`${s.sumLen} sentences by default.`}>
        <input type="range" min="1" max="6" value={s.sumLen} onChange={(e) => set('sumLen', +e.target.value)} />
      </Row>
      <Row t="Editor typeface" d="Serif for drafting, sans for editing.">
        <div className="seg">
          {['serif', 'sans'].map((t) => (
            <button key={t} className={s.font === t ? 'on' : ''} onClick={() => set('font', t)}>{t}</button>
          ))}
        </div>
      </Row>
      <Row t="Editor text size" d={`${s.size}px`}>
        <input type="range" min="15" max="24" value={s.size} onChange={(e) => set('size', +e.target.value)} />
      </Row>
      <button
        className="btn"
        onClick={() => {
          localStorage.clear()
          say('Local data cleared — reload to reset')
        }}
      >
        Clear local data
      </button>
    </main>
  )
}
