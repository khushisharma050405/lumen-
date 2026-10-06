import React, { useState } from 'react'
import {
  LeafIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, GoogleIcon,
  SparklesIcon, DocIcon, InfinityIcon, LinkIcon, PencilIcon, MenuLinesIcon, CheckCircleIcon
} from './icons'

export const FEATURES = [
  {
    id: 'grammar',
    tab: 'grammar',
    title: 'Grammar Autocorrector',
    desc: 'Fix errors, improve clarity.',
    bgClass: 'tile-peach',
    Icon: SparklesIcon
  },
  {
    id: 'complete',
    tab: 'grammar',
    title: 'Sentence Autocomplete',
    desc: 'Complete your thoughts.',
    bgClass: 'tile-mint',
    Icon: DocIcon
  },
  {
    id: 'paraphrase',
    tab: 'paraphrase',
    title: 'Paraphrase Detection',
    desc: 'Find and rephrase similar content.',
    bgClass: 'tile-lavender',
    Icon: InfinityIcon
  },
  {
    id: 'similar',
    tab: 'similarity',
    title: 'Text Similarity',
    desc: 'Check similarity between texts.',
    bgClass: 'tile-sand',
    Icon: LinkIcon
  },
  {
    id: 'generate',
    tab: 'generate',
    title: 'Text Generation',
    desc: 'Create new content from your ideas.',
    bgClass: 'tile-sky',
    Icon: PencilIcon
  },
  {
    id: 'summarize',
    tab: 'summary',
    title: 'Text Summarization',
    desc: 'Turn long text into key points.',
    bgClass: 'tile-rose',
    Icon: MenuLinesIcon
  }
]

export function Landing({ go, initialMode = 'login', onAuthSuccess, user, onLogout }) {
  const [authMode, setAuthMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setLoading(true)

    try {
      if (onAuthSuccess) {
        await onAuthSuccess({ mode: authMode, email, password, name })
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setLoading(true)
    try {
      if (onAuthSuccess) {
        await onAuthSuccess({
          mode: 'google',
          email: 'writer@lumen.ai',
          name: 'Lumen Writer'
        })
      }
    } catch (err) {
      setAuthError(err.message || 'Google login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="verse-landing">
      {/* Background Arch on Right Side matching screenshot */}
      <div className="arch-backdrop" aria-hidden="true" />

      <main className="verse-hero-container">
        {/* Left & Center Hero Content */}
        <div className="hero-left-column">
          <header className="hero-copy">
            <span className="hero-eyebrow">AI WRITING ASSISTANT</span>
            <h1 className="hero-headline">
              Write <em>smarter</em>,<br />
              not harder.
            </h1>
            <p className="hero-subhead">
              Your all-in-one AI writing companion — to correct, refine and enhance your ideas with ease.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-sage pill-cta"
                onClick={() => go('write')}
                id="get-started-cta"
              >
                Get Started →
              </button>
            </div>
          </header>

          {/* Center Visual Scene with Floating Demo Chips */}
          <div className="hero-visual-scene" aria-label="Lumen writing desk specimen">
            <img
              src="/verse_hero_bg.jpg"
              alt="Lumen aesthetic writing desk with books and plants"
              className="scene-photo"
              loading="eager"
            />

            {/* Floating Demo Chip 1: Grammar Corrected */}
            <div className="floating-chip chip-grammar" style={{ animationDelay: '0s' }}>
              <span className="chip-sparkle"><SparklesIcon size={14} /></span>
              <span className="chip-text">Grammar corrected</span>
              <span className="chip-check"><CheckCircleIcon size={14} /></span>
            </div>

            {/* Floating Demo Chip 2: More Natural Phrasing */}
            <div className="floating-chip chip-phrasing" style={{ animationDelay: '0.8s' }}>
              <span className="chip-icon"><DocIcon size={14} /></span>
              <span className="chip-text">More natural phrasing</span>
            </div>

            {/* Floating Demo Card 3: Live text card */}
            <div className="floating-card-sample" style={{ animationDelay: '1.5s' }}>
              <div className="sample-text">
                The quick brown fox<br />
                jumped over the lazy dog.<span className="blinking-caret">|</span>
              </div>
            </div>

            {/* Subtle decorative sparkles */}
            <div className="sparkle-star star-1" aria-hidden="true">✦</div>
            <div className="sparkle-star star-2" aria-hidden="true">✧</div>
          </div>

          {/* Six Feature Strip along the bottom: Aligned to same baseline with no bracketed numbers */}
          <section className="features-strip" id="features" aria-label="Writing Assistant Features">
            {FEATURES.map((f) => {
              const { Icon } = f
              return (
                <div
                  key={f.id}
                  className="feature-tile"
                  onClick={() => go('write', f.tab)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') go('write', f.tab) }}
                >
                  <div className={`tile-icon-box ${f.bgClass}`}>
                    <Icon size={18} />
                  </div>
                  <div className="tile-content">
                    <div className="tile-title-row">
                      <span className="tile-title">{f.title}</span>
                    </div>
                    <p className="tile-desc">{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </section>
        </div>

        {/* Right Column: 24px-Radius Login / Signup Card */}
        <div className="hero-right-column">
          <div className="auth-card" id="auth-card">
            {user ? (
              <div className="auth-user-signed-in">
                <div className="auth-card-header">
                  <div className="auth-leaf-wrapper">
                    <LeafIcon size={32} />
                  </div>
                  <h2>Welcome back,</h2>
                  <p className="auth-subhead">{user.name || user.email}</p>
                </div>
                <p className="auth-info-text">You are signed in to Lumen. Continue refining your drafts or start a new piece.</p>
                <button className="btn btn-sage pill-cta full-btn" onClick={() => go('write')}>
                  Open Editor →
                </button>
                <button className="btn full-btn" onClick={onLogout} style={{ marginTop: '12px' }}>
                  Log out
                </button>
              </div>
            ) : (
              <>
                <div className="auth-card-header">
                  <div className="auth-leaf-wrapper">
                    <LeafIcon size={32} />
                  </div>
                  <h2>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
                  <p className="auth-subhead">
                    {authMode === 'login' ? 'Continue your writing journey.' : 'Begin your journey with Lumen.'}
                  </p>
                </div>

                {authError && <div className="auth-error-banner" role="alert">{authError}</div>}

                <form onSubmit={handleAuthSubmit} className="auth-form">
                  {authMode === 'signup' && (
                    <div className="input-group">
                      <span className="input-icon"><DocIcon size={16} /></span>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={authMode === 'signup'}
                      />
                    </div>
                  )}

                  <div className="input-group">
                    <span className="input-icon"><MailIcon size={17} /></span>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="input-group password-group">
                    <span className="input-icon"><LockIcon size={17} /></span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
                    </button>
                  </div>

                  <div className="auth-options-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        className="link-btn forgot-link"
                        onClick={() => alert('Password reset link sent to your email address.')}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-sage pill-cta full-btn"
                    disabled={loading}
                  >
                    {loading ? 'Please wait…' : authMode === 'login' ? 'Log in →' : 'Sign up →'}
                  </button>
                </form>

                <div className="auth-divider">
                  <span>or</span>
                </div>

                <button
                  type="button"
                  className="google-btn"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                >
                  <GoogleIcon size={18} />
                  <span>Continue with Google</span>
                </button>

                <div className="auth-footer-toggle">
                  {authMode === 'login' ? (
                    <p>
                      Don’t have an account?{' '}
                      <button
                        type="button"
                        className="link-btn signup-toggle-btn"
                        onClick={() => { setAuthMode('signup'); setAuthError('') }}
                      >
                        Sign up
                      </button>
                    </p>
                  ) : (
                    <p>
                      Already have an account?{' '}
                      <button
                        type="button"
                        className="link-btn signup-toggle-btn"
                        onClick={() => { setAuthMode('login'); setAuthError('') }}
                      >
                        Log in
                      </button>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
