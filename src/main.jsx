import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './AuthContext'
import { useAuth } from './AuthContext'
import AuthScreen from './AuthScreen'
import WikiApp from './WikiApp'

const FONT_LINK = document.createElement('link')
FONT_LINK.rel = 'stylesheet'
FONT_LINK.href = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,300..900;1,8..60,300..900&family=Cinzel:wght@400;600&display=swap'
document.head.appendChild(FONT_LINK)

const STYLE = document.createElement('style')
STYLE.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Source Serif 4', Georgia, serif; background: #f8f7f4; color: #222; }
  select option { font-family: sans-serif; }
  [contenteditable] { outline: none; }
  [contenteditable] h2 { font-family: 'IM Fell English', serif; font-size: 1.18rem; margin: 1.3rem 0 0.4rem; border-bottom: 1px solid #ccc9c0; padding-bottom: 3px; color: #1a1a1a; }
  [contenteditable] h3 { font-family: 'IM Fell English', serif; font-size: 1.04rem; margin: 1rem 0 0.3rem; }
  [contenteditable] h4 { font-family: 'IM Fell English', serif; font-size: 0.95rem; margin: 0.8rem 0 0.2rem; }
  [contenteditable] p { margin: 0.3rem 0; line-height: 1.75; }
  [contenteditable] blockquote { border-left: 3px solid #1b4f72; padding: 0.4rem 1rem; margin: 0.8rem 0; color: #666; font-style: italic; background: #f4f1ec; }
  [contenteditable] pre { background: #f0eeea; border: 1px solid #ccc9c0; border-radius: 3px; padding: 0.6rem 0.8rem; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; }
  [contenteditable] hr { border: none; border-top: 1px solid #ccc9c0; margin: 1rem 0; }
  [contenteditable] ul, [contenteditable] ol { padding-left: 1.4rem; margin: 0.4rem 0; }
  [contenteditable] li { margin: 0.2rem 0; }
  [contenteditable] table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; }
  [contenteditable] td, [contenteditable] th { border: 1px solid #ccc9c0; padding: 5px 9px; }
  [contenteditable] th { background: #eeecea; }
  [contenteditable] a { color: #1a5276; }
  [contenteditable] figure { margin: 1rem 0; text-align: center; }
  [contenteditable] figcaption { font-style: italic; font-size: 0.82rem; color: #666; margin-top: 4px; }
  .article-body h2 { font-family: 'IM Fell English', serif; font-size: 1.15rem; margin: 1.4rem 0 0.4rem; border-bottom: 1px solid #ccc9c0; padding-bottom: 3px; color: #1a1a1a; }
  .article-body h3 { font-family: 'IM Fell English', serif; font-size: 1.02rem; margin: 1rem 0 0.3rem; }
  .article-body h4 { font-family: 'IM Fell English', serif; font-size: 0.93rem; margin: 0.8rem 0 0.25rem; }
  .article-body p { margin: 0.3rem 0; line-height: 1.75; }
  .article-body blockquote { border-left: 3px solid #1b4f72; padding: 0.4rem 1rem; margin: 0.8rem 0; color: #666; font-style: italic; background: #f4f1ec; }
  .article-body pre { background: #f0eeea; border: 1px solid #ccc9c0; border-radius: 3px; padding: 0.6rem 0.8rem; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; }
  .article-body hr { border: none; border-top: 1px solid #ccc9c0; margin: 1rem 0; }
  .article-body ul, .article-body ol { padding-left: 1.4rem; margin: 0.4rem 0; }
  .article-body li { margin: 0.2rem 0; line-height: 1.7; }
  .article-body table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; font-size: 0.88rem; }
  .article-body td, .article-body th { border: 1px solid #ccc9c0; padding: 5px 9px; }
  .article-body th { background: #eeecea; font-family: 'IM Fell English', serif; }
  .article-body img { max-width: 100%; height: auto; border: 1px solid #ccc9c0; border-radius: 3px; }
  .article-body figure { margin: 1rem 0; text-align: center; }
  .article-body figcaption { font-style: italic; font-size: 0.82rem; color: #666; margin-top: 4px; }
  .article-body a { color: #1a5276; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: #ccc9c0; border-radius: 3px; }
  @keyframes orbit1 { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes orbit2 { from{transform:rotate(40deg)} to{transform:rotate(400deg)} }
  @keyframes orbit3 { from{transform:rotate(220deg)} to{transform:rotate(-140deg)} }
  @keyframes slowspin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
`
document.head.appendChild(STYLE)

function Root() {
  const { user } = useAuth()
  if (user === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: "'Source Serif 4', Georgia, serif" }}>
      Loading…
    </div>
  )
  return user ? <WikiApp /> : <AuthScreen />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
)
