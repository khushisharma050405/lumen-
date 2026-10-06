import { useState, useMemo, useEffect, useRef } from 'react'
import { findIssues, suggest, similarity, summarize, improve, generate } from './nlp'
import {
  checkGrammarDebounced,
  autocompleteDebounced,
  checkSimilarity,
  checkParaphrase,
  generateContent,
  improveContent,
  summarizeContent,
  checkBackendHealth,
  loginUser,
  signupUser,
  createDraft,
  deleteDraft
} from './api'
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

  const save = async () => {
    const title = text.trim().split(/[.!?\n]/)[0].slice(0, 40) || 'Untitled draft'
    const newDraft = {
      id: Date.now(),
      title,
      text,
      date: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })
    }
    setDrafts([newDraft, ...drafts])
    say('Draft saved')

    // Silently sync to backend if online
    try {
      await createDraft(title, text, token)
    } catch {
      // Offline fallback silent
    }
  }

  const handleDeleteDraft = async (id) => {
    setDrafts(drafts.filter((x) => x.id !== id))
    say('Draft deleted')
    try {
      await deleteDraft(id, token)
    } catch {
      // Offline fallback silent
    }
  }

  const handleAuthSuccess = async ({ mode, email, password, name }) => {
    try {
      let res
      if (mode === 'signup') {
        res = await signupUser(email, password, name)
      } else {
        res = await loginUser(email, password)
      }

      if (res && res.user) {
        setUser(res.user)
        if (res.token) setToken(res.token)
        say(`Welcome to Lumen, ${res.user.name || 'Writer'}!`)
        nav('write')
      }
    } catch {
      // Fallback
      const fallbackUser = { email, name: name || email.split('@')[0] }
      setUser(fallbackUser)
      say(`Welcome to Lumen, ${fallbackUser.name}!`)
      nav('write')
    }
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
        <button className="brand" onClick={() => nav('landing')} aria-label="Lumen Home">
          <LeafIcon size={24} />
          <span>L U M E N</span>
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
          onDeleteDraft={handleDeleteDraft}
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
            <h2>About Lumen</h2>
            <p>
              Lumen is a calm, intelligent writing sanctuary designed to elevate your craft without distraction.
              Combining gentle real-time assistance with deep stylistic refinement, Lumen helps you write with precision and resonance.
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
  const [selectedIssueId, setSelectedIssueId] = useState(null)
  const [atEnd, setAtEnd] = useState(true)
  const [focus, setFocus] = useState(false)
  const [issues, setIssues] = useState(() => (settings.grammar ? findIssues(text) : []))
  const [ghost, setGhost] = useState(() => (settings.complete && focus && atEnd ? suggest(text) : ''))
  const ta = useRef()

  // Generate and Big Output Board state
  const [topic, setTopic] = useState('mother')
  const [tone, setTone] = useState('Warm')
  const [length, setLength] = useState('Medium')
  const [generatedText, setGeneratedText] = useState('')
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [boardMeta, setBoardMeta] = useState({ topic: 'Mother', tone: 'Warm', length: 'Medium' })
  const [hasGenerated, setHasGenerated] = useState(false)
  const [undoText, setUndoText] = useState(null)
  const [genLoading, setGenLoading] = useState(false)
  const typingTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  // Real-time grammar checking with debounced API call + instant heuristic fallback
  useEffect(() => {
    let active = true
    if (!settings.grammar) {
      setIssues([])
      return
    }
    // Instant heuristic fallback
    setIssues(findIssues(text))
    // Debounced API call
    checkGrammarDebounced(text).then((apiIssues) => {
      if (active && apiIssues) {
        setIssues(apiIssues)
      }
    })
    return () => { active = false }
  }, [text, settings.grammar])

  // Real-time autocomplete with debounced API call + instant heuristic fallback
  useEffect(() => {
    let active = true
    if (!settings.complete || !focus || !atEnd) {
      setGhost('')
      return
    }
    setGhost(suggest(text))
    autocompleteDebounced(text).then((s) => {
      if (active && typeof s === 'string') {
        setGhost(s)
      }
    })
    return () => { active = false }
  }, [text, settings.complete, focus, atEnd])

  const fix = (x) => {
    setText(text.slice(0, x.start) + x.fix + text.slice(x.end))
    setSelectedIssueId(null)
  }

  const fixAll = () => {
    let t = text
    ;[...issues].reverse().forEach((x) => (t = t.slice(0, x.start) + x.fix + t.slice(x.end)))
    setText(t)
    setSelectedIssueId(null)
    say(`${issues.length} fixes applied`)
  }

  const highlightIssue = (x) => {
    setSelectedIssueId(x.id)
    if (ta.current) {
      ta.current.focus()
      ta.current.setSelectionRange(x.start, x.end)
    }
  }

  const startTyping = (fullText, meta) => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current)
      typingTimerRef.current = null
    }
    setHasGenerated(true)
    setGeneratedText(fullText)
    setBoardMeta(meta)
    setDisplayedText('')
    setIsTyping(true)
    setGenLoading(true)

    const wordsList = fullText.split(' ')
    let index = 0

    typingTimerRef.current = setInterval(() => {
      index++
      if (index <= wordsList.length) {
        setDisplayedText(wordsList.slice(0, index).join(' '))
      }
      if (index >= wordsList.length) {
        clearInterval(typingTimerRef.current)
        typingTimerRef.current = null
        setIsTyping(false)
        setGenLoading(false)
      }
    }, 16)
  }

  const handleGenerate = async (genTopic, genTone, genLength) => {
    const t = (genTopic !== undefined ? genTopic : topic).trim()
    const tn = genTone || tone || 'Warm'
    const ln = genLength || length || 'Medium'

    setGenLoading(true)
    try {
      const res = await generateContent(t || 'A thoughtful observation', tn, ln, text.slice(-500))
      if (!res || !res.ok) {
        if (res?.unreachable) {
          say('Generation needs the backend running.')
        } else {
          say(res?.message || 'Generation failed.')
        }
        setGenLoading(false)
        return
      }
      const capTopic = t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Original'
      startTyping(res.text, { topic: capTopic, tone: tn, length: ln })
    } catch (err) {
      const health = await checkBackendHealth()
      if (!health) {
        say('Generation needs the backend running.')
      } else {
        say(err?.message || 'Generation failed.')
      }
      setGenLoading(false)
    }
  }

  const handleImprove = async (mode) => {
    setGenLoading(true)
    const modeLabels = {
      tighten: 'Tighten',
      formalize: 'Formalize',
      soften: 'Soften',
      'split long': 'Split long'
    }
    const label = modeLabels[mode.toLowerCase()] || mode
    try {
      const res = await improveContent(text, mode)
      if (!res || !res.ok) {
        if (res?.unreachable) {
          say('Generation needs the backend running.')
        } else {
          say(res?.message || 'Refinement failed.')
        }
        setGenLoading(false)
        return
      }
      startTyping(res.text, { topic: 'Refine', tone: label, length: 'Draft' })
    } catch (err) {
      const health = await checkBackendHealth()
      if (!health) {
        say('Generation needs the backend running.')
      } else {
        say(err?.message || 'Refinement failed.')
      }
      setGenLoading(false)
    }
  }

  const handleInsert = () => {
    if (!generatedText) return
    setUndoText(text)
    const addition = generatedText.trim()
    const newText = text.trim() ? text.replace(/\s*$/, '') + '\n\n' + addition : addition
    setText(newText)
    say('Inserted into draft')
  }

  const handleReplace = () => {
    if (!generatedText) return
    setUndoText(text)
    setText(generatedText.trim())
    say('Draft replaced')
  }

  const handleUndo = () => {
    if (undoText === null) return
    setText(undoText)
    setUndoText(null)
    say('Draft restored')
  }

  const handleCopy = () => {
    if (!generatedText) return
    navigator.clipboard?.writeText(generatedText)
    say('Copied to clipboard')
  }

  const handleRegenerate = () => {
    if (genLoading) return
    if (boardMeta.topic === 'Refine') {
      handleImprove(boardMeta.tone)
    } else {
      handleGenerate(topic, tone, length)
    }
  }

  const parts = []
  let i = 0
  issues.forEach((x) => {
    parts.push(
      text.slice(i, x.start),
      <mark
        key={x.id}
        className={selectedIssueId === x.id ? 'active-highlight' : ''}
      >
        {text.slice(x.start, x.end) || ' '}
      </mark>
    )
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
          {undoText !== null && (
            <button onClick={handleUndo} className="btn-undo">
              Undo generation
            </button>
          )}
          <button onClick={() => { setText(''); setSelectedIssueId(null); ta.current?.focus() }}>
            Clear
          </button>
          <button onClick={() => { setText(SAMPLE); setSelectedIssueId(null) }}>
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

        {/* Big Output Board below Editor */}
        {hasGenerated && (
          <div className="generated-board" id="generated-board">
            <div className="board-header">
              <div className="board-header-left">
                <span className="board-title">Generated paragraph</span>
                {boardMeta.topic && (
                  <span className="board-chip chip-topic">{boardMeta.topic}</span>
                )}
                {boardMeta.tone && (
                  <span className="board-chip chip-tone">{boardMeta.tone}</span>
                )}
                {boardMeta.length && (
                  <span className="board-chip chip-length">{boardMeta.length}</span>
                )}
              </div>
              <span className="board-word-count">{words(displayedText)} words</span>
            </div>

            <div className="board-body">
              <p className="board-text">
                {displayedText}
                {isTyping && <span className="blinking-caret">|</span>}
              </p>
            </div>

            <div className="board-footer">
              <button className="btn btn-sage pill-cta" onClick={handleInsert}>
                Insert into draft
              </button>
              <button className="btn pill-btn" onClick={handleReplace}>
                Replace draft
              </button>
              <button className="btn pill-btn" onClick={handleRegenerate} disabled={genLoading}>
                Regenerate
              </button>
              <button className="btn pill-btn" onClick={handleCopy}>
                Copy
              </button>
            </div>
          </div>
        )}
      </section>

      <aside className="side">
        <div className="tabs" role="tablist">
          {[
            ['grammar', 'Grammar'],
            ['paraphrase', 'Paraphrase'],
            ['similarity', 'Similarity'],
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
          {tab === 'grammar' && (
            <Grammar
              issues={issues}
              fix={fix}
              settings={settings}
              text={text}
              onHighlight={highlightIssue}
              selectedIssueId={selectedIssueId}
            />
          )}
          {tab === 'paraphrase' && <Paraphrase text={text} />}
          {tab === 'similarity' && <Similarity text={text} />}
          {tab === 'generate' && (
            <GenerateControls
              topic={topic}
              setTopic={setTopic}
              tone={tone}
              setTone={setTone}
              length={length}
              setLength={setLength}
              onGenerate={handleGenerate}
              onImprove={handleImprove}
              loading={genLoading}
            />
          )}
          {tab === 'summary' && <Summary {...{ text, settings, say }} />}
        </div>
      </aside>
    </main>
  )
}

function Grammar({ issues, fix, settings, text, onHighlight, selectedIssueId }) {
  if (!settings.grammar) return <p className="muted">Grammar autocorrect is off. Turn it on in Settings.</p>
  if (!issues.length) return <p className="muted">No issues found. Your draft reads clean and sharp.</p>
  return (
    <ul className="issues">
      {issues.map((x) => {
        const orig = text.slice(x.start, x.end) || ' '
        const isSel = selectedIssueId === x.id
        return (
          <li
            key={x.id}
            className={'issue-item' + (isSel ? ' selected' : '')}
            onClick={() => onHighlight && onHighlight(x)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' && onHighlight) onHighlight(x) }}
          >
            <div className="issue-info">
              <div className="grammar-change">
                <span className="grammar-orig">{orig}</span>
                <span className="grammar-arrow">→</span>
                <span className="grammar-fix">{x.fix.trim() || 'space'}</span>
              </div>
              <small className="grammar-cat">{x.msg}</small>
            </div>
            <button
              className="btn-apply-fix"
              onClick={(e) => {
                e.stopPropagation()
                fix(x)
              }}
              title="Apply correction"
            >
              Apply
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Paraphrase({ text }) {
  const [source, setSource] = useState(text)
  const [compare, setCompare] = useState('')
  const [r, setR] = useState(null)

  useEffect(() => {
    setSource(text)
  }, [text])

  useEffect(() => {
    if (!compare.trim() || !source.trim()) {
      setR(null)
      return
    }
    let active = true
    setR(similarity(source, compare))
    checkParaphrase(source, compare).then((res) => {
      if (active && res) setR(res)
    })
    return () => { active = false }
  }, [source, compare])

  return (
    <>
      <label className="lbl">Your text</label>
      <textarea
        className="box"
        rows={4}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Enter your text"
      />

      <label className="lbl" style={{ marginTop: '14px' }}>Compare with</label>
      <textarea
        className="box"
        rows={4}
        value={compare}
        onChange={(e) => setCompare(e.target.value)}
        placeholder="Paste the passage to compare"
      />

      {!compare.trim() ? (
        <div className="empty-state-box">
          <p className="muted">Paste the passage to compare above to detect paraphrasing.</p>
        </div>
      ) : r ? (
        <div className="paraphrase-result-card">
          <div className="paraphrase-header-row">
            <span className={`verdict-badge verdict-${(r.verdict || '').toLowerCase().replace(/\s+/g, '-')}`}>
              {r.verdict}
            </span>
            <span className="confidence-pill">{r.score}% confidence</span>
          </div>
          <p className="verdict-reason">{r.reason}</p>
        </div>
      ) : null}
    </>
  )
}

function Similarity({ text }) {
  const [source, setSource] = useState(text)
  const [compare, setCompare] = useState('')
  const [r, setR] = useState(null)

  useEffect(() => {
    setSource(text)
  }, [text])

  useEffect(() => {
    if (!compare.trim() || !source.trim()) {
      setR(null)
      return
    }
    let active = true
    setR(similarity(source, compare))
    checkSimilarity(source, compare).then((res) => {
      if (active && res) setR(res)
    })
    return () => { active = false }
  }, [source, compare])

  return (
    <>
      <label className="lbl">Your text</label>
      <textarea
        className="box"
        rows={4}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Enter your text"
      />

      <label className="lbl" style={{ marginTop: '14px' }}>Compare with</label>
      <textarea
        className="box"
        rows={4}
        value={compare}
        onChange={(e) => setCompare(e.target.value)}
        placeholder="Paste the passage to compare"
      />

      {!compare.trim() ? (
        <div className="empty-state-box">
          <p className="muted">Paste the passage to compare above to view similarity metrics.</p>
        </div>
      ) : r ? (
        <div className="similarity-results-card">
          <div className="similarity-overall-row">
            <span className="similarity-score-num">{r.score}%</span>
            <span className="similarity-score-label">overall match</span>
          </div>
          {[
            ['Meaning overlap', r.sem],
            ['Exact phrasing', r.lex],
          ].map(([l, v]) => (
            <div className="meter" key={l}>
              <span>{l}</span>
              <i><u style={{ width: (v || 0) + '%' }} /></i>
              <em>{v || 0}%</em>
            </div>
          ))}
          <label className="lbl" style={{ marginTop: '14px' }}>Phrases both passages share</label>
          {r.shared && r.shared.length ? (
            <p className="chips">
              {r.shared.map((s) => <span key={s}>{s}</span>)}
            </p>
          ) : (
            <p className="muted">No shared phrases.</p>
          )}
          {r.sharedWords && r.sharedWords.length ? (
            <>
              <label className="lbl" style={{ marginTop: '14px' }}>Shared key words</label>
              <p className="chips">
                {r.sharedWords.map((w) => <span key={w} className="chip-word">{w}</span>)}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function GenerateControls({
  topic,
  setTopic,
  tone,
  setTone,
  length,
  setLength,
  onGenerate,
  onImprove,
  loading
}) {
  const tones = ['Warm', 'Formal', 'Concise']
  const lengths = [
    { id: 'Short', label: 'Short', desc: 'Short (2-3 sentences)' },
    { id: 'Medium', label: 'Medium', desc: 'Medium (4-5 sentences)' },
    { id: 'Long', label: 'Long', desc: 'Long (6-8 sentences)' }
  ]
  const refines = [
    { id: 'tighten', label: 'Tighten' },
    { id: 'formalize', label: 'Formalize' },
    { id: 'soften', label: 'Soften' },
    { id: 'split long', label: 'Split long' }
  ]

  return (
    <div className="generate-panel">
      <label className="lbl">What should it be about?</label>
      <input
        className="box pill-input"
        value={topic}
        placeholder="e.g. mother, black holes..."
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !loading) {
            onGenerate(topic, tone, length)
          }
        }}
      />

      <label className="lbl">Tone</label>
      <div className="pill-group">
        {tones.map((t) => (
          <button
            key={t}
            type="button"
            className={'pill-choice' + (tone === t ? ' selected' : '')}
            onClick={() => setTone(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="lbl">Length</label>
      <div className="pill-group">
        {lengths.map((l) => (
          <button
            key={l.id}
            type="button"
            title={l.desc}
            className={'pill-choice' + (length === l.id ? ' selected' : '')}
            onClick={() => setLength(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn-generate-main"
        onClick={() => onGenerate(topic, tone, length)}
        disabled={loading}
      >
        {loading ? 'Generating…' : 'Generate paragraph'}
      </button>

      <label className="lbl" style={{ marginTop: '22px' }}>Refine your draft</label>
      <div className="refine-chips-grid">
        {refines.map((r) => (
          <button
            key={r.id}
            type="button"
            className="refine-chip"
            onClick={() => onImprove(r.id)}
            disabled={loading}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Summary({ text, settings, say }) {
  const [n, setN] = useState(settings.sumLen)
  const [s, setS] = useState(() => summarize(text, n))

  useEffect(() => {
    let active = true
    setS(summarize(text, n))
    summarizeContent(text, n).then((res) => {
      if (active && Array.isArray(res)) setS(res)
    })
    return () => { active = false }
  }, [text, n])

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

function History({ drafts, setDrafts, setText, onDeleteDraft, go, say }) {
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
              <button
                className="btn"
                onClick={() => {
                  if (onDeleteDraft) {
                    onDeleteDraft(d.id)
                  } else {
                    setDrafts(drafts.filter((x) => x.id !== d.id))
                    say('Draft deleted')
                  }
                }}
              >
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
