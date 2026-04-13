import { useState, useEffect } from 'react'
import "prismjs/themes/prism-tomorrow.css"
import Editor from "react-simple-code-editor"
import prism from "prismjs"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import axios from 'axios'
import './App.css'

function App() {
  const [ code, setCode ] = useState(` function sum() {
  return 1 + 1
}`)

  const [ review, setReview ] = useState(``)
  const [ isLoading, setIsLoading ] = useState(false)

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

  useEffect(() => {
    prism.highlightAll()
  }, [])

  async function reviewCode() {
    try {
      setIsLoading(true)
      const response = await axios.post(`${API_BASE_URL}/ai/get-review`, { code })
      setReview(response.data)
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Unable to connect to backend.'
      setReview(`Error: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <main>
        <div className="left">
          <div className="code">
            <Editor
              value={code}
              onValueChange={code => setCode(code)}
              highlight={code => prism.highlight(code, prism.languages.javascript, "javascript")}
              padding={10}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 16,
                border: "1px solid #ddd",
                borderRadius: "5px",
                height: "100%",
                width: "100%"
              }}
            />
          </div>
          <div
            role="button"
            aria-disabled={isLoading}
            onClick={reviewCode}
            className="review">{isLoading ? 'Reviewing...' : 'Review'}</div>
        </div>
        <div className="right">
          <Markdown

            rehypePlugins={[ rehypeHighlight ]}

          >{review}</Markdown>
        </div>
      </main>
    </>
  )
}



export default App
