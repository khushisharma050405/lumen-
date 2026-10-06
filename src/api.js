import * as offlineNLP from './nlp'

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000'

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
    shared_phrases: sim.shared,
    sem: sim.sem,
    lex: sim.lex
  }
}

export async function generateContent(prompt, tone) {
  try {
    const data = await safeFetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, tone })
    })
    if (data && typeof data.text === 'string') {
      return data.text
    }
  } catch {
    // Silent fallback
  }
  return offlineNLP.generate(prompt, tone)
}

export async function improveContent(text, mode) {
  try {
    const data = await safeFetch('/api/improve', {
      method: 'POST',
      body: JSON.stringify({ text, mode })
    })
    if (data && typeof data.text === 'string') {
      return data.text
    }
  } catch {
    // Silent fallback
  }
  return offlineNLP.improve(text, mode)
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
