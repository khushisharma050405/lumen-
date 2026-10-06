import * as offlineNLP from './nlp'

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || ''

// Simple helper to check if backend is reachable
let isBackendAvailable = true

async function safeFetch(endpoint, options = {}, timeoutMs = 2500) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })
    clearTimeout(id)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    isBackendAvailable = true
    return await res.json()
  } catch (err) {
    clearTimeout(id)
    isBackendAvailable = false
    return null
  }
}

// Debounce map for cancelable debounced promises
const timers = new Map()

export function debouncePromise(key, fn, delay = 300) {
  return (...args) => {
    return new Promise((resolve) => {
      if (timers.has(key)) {
        clearTimeout(timers.get(key))
      }
      const timer = setTimeout(async () => {
        timers.delete(key)
        const result = await fn(...args)
        resolve(result)
      }, delay)
      timers.set(key, timer)
    })
  }
}

// ----------------------------------------------------------------------
// NLP API Methods with Silent Offline Fallback to src/nlp.js
// ----------------------------------------------------------------------

export async function checkGrammar(text) {
  try {
    const data = await safeFetch('/api/grammar', {
      method: 'POST',
      body: JSON.stringify({ text })
    })
    if (data && Array.isArray(data.issues)) {
      return data.issues
    }
  } catch {
    // Silent fallback
  }
  return offlineNLP.findIssues(text)
}

export const checkGrammarDebounced = debouncePromise('grammar', checkGrammar, 250)

export async function autocomplete(text) {
  try {
    const data = await safeFetch('/api/autocomplete', {
      method: 'POST',
      body: JSON.stringify({ text })
    })
    if (data && typeof data.suggestion === 'string') {
      return data.suggestion
    }
  } catch {
    // Silent fallback
  }
  return offlineNLP.suggest(text)
}

export const autocompleteDebounced = debouncePromise('autocomplete', autocomplete, 200)

export async function checkSimilarity(text, reference) {
  try {
    const data = await safeFetch('/api/similarity', {
      method: 'POST',
      body: JSON.stringify({ text, reference })
    })
    if (data && typeof data.score === 'number') {
      return data
    }
  } catch {
    // Silent fallback
  }
  return offlineNLP.similarity(text, reference)
}

export async function checkParaphrase(text, reference) {
  try {
    const data = await safeFetch('/api/paraphrase', {
      method: 'POST',
      body: JSON.stringify({ text, reference })
    })
    if (data && typeof data.score === 'number') {
      return data
    }
  } catch {
    // Silent fallback
  }
  const sim = offlineNLP.similarity(text, reference)
  return {
    is_paraphrase: sim.verdict === 'Near-duplicate' || sim.verdict === 'Likely paraphrase',
    score: sim.score,
    verdict: sim.verdict,
    reason: sim.reason,
    shared_phrases: sim.shared,
    sharedWords: sim.sharedWords,
    sem: sim.sem,
    lex: sim.lex
  }
}

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function generateContent(topic, tone = 'Warm', length = 'Medium', existing_text = '') {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 40000)

  try {
    const res = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, tone, length, existing_text }),
      signal: controller.signal
    })
    clearTimeout(id)

    if (!res.ok) {
      let detailMsg = `HTTP ${res.status}`
      try {
        const errJson = await res.json()
        if (errJson && errJson.detail) {
          detailMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail)
        }
      } catch {}
      return { ok: false, status: res.status, message: detailMsg, unreachable: false }
    }

    const data = await res.json()
    if (data && typeof data.text === 'string' && data.text.trim()) {
      return { ok: true, text: data.text.trim() }
    }
    return { ok: false, status: 502, message: 'Invalid response from model', unreachable: false }
  } catch (err) {
    clearTimeout(id)
    const health = await checkBackendHealth()
    if (!health) {
      return { ok: false, status: 0, message: 'Generation needs the backend running.', unreachable: true }
    }
    return { ok: false, status: 500, message: err?.message || 'Request failed', unreachable: false }
  }
}

export async function improveContent(text, mode = 'tighten') {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 40000)

  try {
    const res = await fetch(`${API_BASE_URL}/api/improve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode }),
      signal: controller.signal
    })
    clearTimeout(id)

    if (!res.ok) {
      let detailMsg = `HTTP ${res.status}`
      try {
        const errJson = await res.json()
        if (errJson && errJson.detail) {
          detailMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail)
        }
      } catch {}
      return { ok: false, status: res.status, message: detailMsg, unreachable: false }
    }

    const data = await res.json()
    if (data && typeof data.text === 'string' && data.text.trim()) {
      return { ok: true, text: data.text.trim() }
    }
    return { ok: false, status: 502, message: 'Invalid response from model', unreachable: false }
  } catch (err) {
    clearTimeout(id)
    const health = await checkBackendHealth()
    if (!health) {
      return { ok: false, status: 0, message: 'Generation needs the backend running.', unreachable: true }
    }
    return { ok: false, status: 500, message: err?.message || 'Request failed', unreachable: false }
  }
}

export async function summarizeContent(text, sentences = 3) {
  try {
    const data = await safeFetch('/api/summarize', {
      method: 'POST',
      body: JSON.stringify({ text, sentences })
    })
    if (data && Array.isArray(data.summary)) {
      return data.summary
    }
  } catch {
    // Silent fallback
  }
  return offlineNLP.summarize(text, sentences)
}

// ----------------------------------------------------------------------
// Auth & Drafts API Methods
// ----------------------------------------------------------------------

export async function loginUser(email, password) {
  const data = await safeFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
  if (data && data.token) {
    return data
  }
  // Offline simulation fallback
  return {
    token: 'mock-offline-token-' + Date.now(),
    user: { email, name: email.split('@')[0] }
  }
}

export async function signupUser(email, password, name) {
  const data = await safeFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name })
  })
  if (data && data.token) {
    return data
  }
  // Offline simulation fallback
  return {
    token: 'mock-offline-token-' + Date.now(),
    user: { email, name: name || email.split('@')[0] }
  }
}

export async function fetchDrafts(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const data = await safeFetch('/api/drafts', { headers })
  return Array.isArray(data) ? data : null
}

export async function createDraft(title, text, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  return await safeFetch('/api/drafts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, text })
  })
}

export async function deleteDraft(draftId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  return await safeFetch(`/api/drafts/${draftId}`, {
    method: 'DELETE',
    headers
  })
}

export function getBackendStatus() {
  return isBackendAvailable
}
