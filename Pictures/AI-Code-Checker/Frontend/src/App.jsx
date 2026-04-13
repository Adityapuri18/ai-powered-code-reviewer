import { useEffect, useMemo, useState } from 'react'
import "prismjs/themes/prism-tomorrow.css"
import Editor from "react-simple-code-editor"
import prism from "prismjs"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import axios from 'axios'
import './App.css'

const DEFAULT_CODE = `function sum(a, b) {
  return a + b;
}`

const SNIPPETS_STORAGE_KEY = 'ai-code-checker-snippets'
const THEME_STORAGE_KEY = 'ai-code-checker-theme'
const HISTORY_STORAGE_KEY = 'ai-code-checker-review-history'

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function createSnippet(title, code) {
  return {
    id: `snippet-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    code,
    updatedAt: Date.now(),
  }
}

function App() {
  const [ code, setCode ] = useState(DEFAULT_CODE)
  const [ review, setReview ] = useState('')
  const [ isLoading, setIsLoading ] = useState(false)
  const [ query, setQuery ] = useState('')
  const [ theme, setTheme ] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'night')
  const [ snippets, setSnippets ] = useState(() => {
    const stored = localStorage.getItem(SNIPPETS_STORAGE_KEY)

    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch {
        return [ createSnippet('Starter snippet', DEFAULT_CODE) ]
      }
    }

    return [ createSnippet('Starter snippet', DEFAULT_CODE) ]
  })
  const [ activeSnippetId, setActiveSnippetId ] = useState(() => snippets[0]?.id || null)
  const [ snippetTitle, setSnippetTitle ] = useState(() => snippets[0]?.title || 'Untitled snippet')
  const [ reviewHistory, setReviewHistory ] = useState(() => {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!stored) return []

    try {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

  const activeSnippet = useMemo(
    () => snippets.find((snippet) => snippet.id === activeSnippetId),
    [ snippets, activeSnippetId ]
  )

  const filteredSnippets = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) {
      return snippets
    }

    return snippets.filter((snippet) => {
      return snippet.title.toLowerCase().includes(search) || snippet.code.toLowerCase().includes(search)
    })
  }, [ snippets, query ])

  const stats = useMemo(() => {
    const lines = code ? code.split('\n').length : 0
    const chars = code.length
    const words = code.trim() ? code.trim().split(/\s+/).length : 0

    return { lines, chars, words }
  }, [ code ])

  useEffect(() => {
    prism.highlightAll()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [ theme ])

  useEffect(() => {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets))
  }, [ snippets ])

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(reviewHistory))
  }, [ reviewHistory ])

  useEffect(() => {
    if (!activeSnippet) {
      return
    }

    setCode(activeSnippet.code)
    setSnippetTitle(activeSnippet.title)
  }, [ activeSnippet ])

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === 'night' ? 'day' : 'night'))
  }

  function createNewSnippet() {
    setActiveSnippetId(null)
    setSnippetTitle('Untitled snippet')
    setCode(DEFAULT_CODE)
  }

  function saveSnippet() {
    const normalizedTitle = snippetTitle.trim() || 'Untitled snippet'

    if (!activeSnippetId) {
      const newSnippet = createSnippet(normalizedTitle, code)
      setSnippets((prev) => [ newSnippet, ...prev ])
      setActiveSnippetId(newSnippet.id)
      return
    }

    setSnippets((prev) => prev.map((snippet) => {
      if (snippet.id !== activeSnippetId) {
        return snippet
      }

      return {
        ...snippet,
        title: normalizedTitle,
        code,
        updatedAt: Date.now(),
      }
    }))
  }

  function loadSnippet(snippet) {
    setActiveSnippetId(snippet.id)
    setSnippetTitle(snippet.title)
    setCode(snippet.code)
  }

  function removeSnippet(snippetId) {
    const hasConfirmed = window.confirm('Delete this snippet? This action cannot be undone.')
    if (!hasConfirmed) {
      return
    }

    setSnippets((prev) => {
      const next = prev.filter((snippet) => snippet.id !== snippetId)

      if (snippetId === activeSnippetId) {
        const fallback = next[0]
        setActiveSnippetId(fallback?.id || null)
        setSnippetTitle(fallback?.title || 'Untitled snippet')
        setCode(fallback?.code || DEFAULT_CODE)
      }

      return next.length > 0 ? next : [ createSnippet('Starter snippet', DEFAULT_CODE) ]
    })
  }

  function addTemplate() {
    const template = `\n\nasync function fetchData() {
  try {
    const response = await fetch('/api/data')
    if (!response.ok) {
      throw new Error(\`Request failed: \${response.status}\`)
    }
    return await response.json()
  } catch (error) {
    console.error(error)
    return null
  }
}`

    setCode((prev) => `${prev}${template}`)
  }

  async function reviewCode() {
    try {
      setIsLoading(true)
      const response = await axios.post(`${API_BASE_URL}/ai/get-review`, { code })
      const payload = response.data
      const nextReview = typeof payload === 'string'
        ? payload
        : payload?.review || JSON.stringify(payload, null, 2)

      setReview(nextReview)
      setReviewHistory((prev) => [
        {
          id: Date.now(),
          title: snippetTitle.trim() || 'Untitled snippet',
          createdAt: Date.now(),
          preview: nextReview.slice(0, 120),
        },
        ...prev,
      ].slice(0, 8))
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Unable to connect to backend.'
      setReview(`Error: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function copyReview() {
    if (!review) {
      return
    }

    try {
      await navigator.clipboard.writeText(review)
    } catch {
      setReview((prev) => `${prev}\n\nUnable to copy review using clipboard API.`)
    }
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI Code Checker</p>
            <h1>Review faster with saved snippets</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost" onClick={createNewSnippet}>New Draft</button>
            <button type="button" className="ghost" onClick={saveSnippet}>Save Changes</button>
            <button type="button" className="ghost" onClick={toggleTheme}>
              {theme === 'night' ? 'Switch to Day' : 'Switch to Night'}
            </button>
            <button type="button" className="primary" disabled={isLoading} onClick={reviewCode}>
              {isLoading ? 'Reviewing...' : 'Review Code'}
            </button>
          </div>
        </header>

        <section className="content-grid">
          <aside className="sidebar">
            <div className="sidebar-heading">
              <h2>Your snippets</h2>
              <input
                type="text"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="snippet-list">
              {filteredSnippets.map((snippet) => (
                <article
                  key={snippet.id}
                  className={`snippet-card ${snippet.id === activeSnippetId ? 'active' : ''}`}
                  onClick={() => loadSnippet(snippet)}
                >
                  <div>
                    <h3>{snippet.title}</h3>
                    <p>Updated {formatTime(snippet.updatedAt)}</p>
                  </div>
                  <button
                    type="button"
                    className="danger"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeSnippet(snippet.id)
                    }}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </aside>

          <section className="editor-panel">
            <div className="editor-meta">
              <input
                type="text"
                value={snippetTitle}
                onChange={(event) => setSnippetTitle(event.target.value)}
                aria-label="Snippet title"
              />
              <div className="stats">
                <span>{stats.lines} lines</span>
                <span>{stats.words} words</span>
                <span>{stats.chars} chars</span>
              </div>
            </div>

            <div className="code">
              <Editor
                value={code}
                onValueChange={(nextCode) => setCode(nextCode)}
                highlight={(source) => prism.highlight(source, prism.languages.javascript, 'javascript')}
                padding={16}
                style={{
                  fontFamily: '"IBM Plex Mono", "Fira Code", monospace',
                  fontSize: 15,
                  minHeight: '100%',
                  width: '100%',
                }}
              />
            </div>

            <div className="editor-actions">
              <button type="button" className="ghost" onClick={addTemplate}>Insert Async Template</button>
              <button type="button" className="ghost" onClick={() => setCode('')}>Clear Code</button>
            </div>
          </section>

          <section className="review-panel">
            <div className="review-header">
              <h2>AI review result</h2>
              <button type="button" className="ghost" onClick={copyReview}>Copy</button>
            </div>

            <div className="review-content">
              {review ? (
                <Markdown rehypePlugins={[ rehypeHighlight ]}>{review}</Markdown>
              ) : (
                <p className="placeholder">Run a review to see detailed feedback and suggestions here.</p>
              )}
            </div>

            <div className="history-block">
              <h3>Recent reviews</h3>
              {reviewHistory.length === 0 ? (
                <p className="placeholder">No reviews saved yet.</p>
              ) : (
                <ul>
                  {reviewHistory.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.title}</strong>
                      <span>{formatTime(entry.createdAt)}</span>
                      <p>{entry.preview}...</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}

export default App
