import { useState, useEffect, useRef } from 'react'
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  addDoc, query, orderBy, limit, serverTimestamp, writeBatch, getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './AuthContext'
import { usePresence, uidColor, initials } from './usePresence'
import { INITIAL_ARTICLES } from './seedData'
import WikiKeeper from './WikiKeeper'
import Tracker from './Tracker'
import BulletinBoard from './BulletinBoard'
import HexMap from './HexMap'
import InitiativeTracker from './InitiativeTracker'
import Downtime from './Downtime'
import Chat from './Chat'

// ─── Constants ────────────────────────────────────────────────────────────────
// Category tree: each entry is { name: string, subcategories: string[] }
const DEFAULT_CATEGORIES = [
  { name: 'Lore & History', subcategories: [] },
  { name: 'Peoples',        subcategories: [] },
  { name: 'Locations',      subcategories: [] },
  { name: 'Factions',       subcategories: [] },
]

// Flatten tree to all fully-qualified category strings (e.g. 'Peoples > Elves')
function flattenCategories(cats) {
  const result = []
  cats.forEach(c => {
    result.push(c.name)
    c.subcategories.forEach(s => result.push(c.name + ' > ' + s))
  })
  return result
}

// ─── Mobile detection hook ────────────────────────────────────────────────────
function useIsMobile(breakpoint = 680) {
  const [mobile, setMobile] = useState(() => window.innerWidth < breakpoint)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return mobile
}

const CONTENT_FONTS = [
  { label: 'Source Serif (Default)', value: 'Source Serif 4, Georgia, serif' },
  { label: 'IM Fell English', value: 'IM Fell English, Georgia, serif' },
  { label: 'Cinzel', value: 'Cinzel, Georgia, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Monospace', value: 'Courier New, monospace' },
]
const FONT_SIZES = ['10','11','12','13','14','16','18','20','24','28','32','36','48']

// ─── Rich Editor ──────────────────────────────────────────────────────────────
function RichEditor({ value, onChange }) {
  const edRef = useRef(null)
  const [fmt, setFmt] = useState({})
  const [linkDlg, setLinkDlg] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imgDlg, setImgDlg] = useState(false)
  const [imgUrl, setImgUrl] = useState('')
  const [imgCaption, setImgCaption] = useState('')
  const [imgWidth, setImgWidth] = useState('100%')
  const savedSel = useRef(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (edRef.current && !initialized.current) {
      edRef.current.innerHTML = value || ''
      initialized.current = true
    }
  }, [])

  const saveSel = () => {
    const s = window.getSelection()
    if (s && s.rangeCount > 0) savedSel.current = s.getRangeAt(0).cloneRange()
  }
  const restSel = () => {
    const s = window.getSelection()
    if (savedSel.current && s) { s.removeAllRanges(); s.addRange(savedSel.current) }
  }
  const exec = (cmd, val = null) => {
    edRef.current.focus(); document.execCommand(cmd, false, val); updateFmt(); emit()
  }
  const emit = () => { if (edRef.current) onChange(edRef.current.innerHTML) }
  const updateFmt = () => setFmt({
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    strike: document.queryCommandState('strikeThrough'),
    ul: document.queryCommandState('insertUnorderedList'),
    ol: document.queryCommandState('insertOrderedList'),
    jl: document.queryCommandState('justifyLeft'),
    jc: document.queryCommandState('justifyCenter'),
    jr: document.queryCommandState('justifyRight'),
  })
  const insertBlock = tag => { edRef.current.focus(); document.execCommand('formatBlock', false, tag); emit() }
  const insertHtml = html => { edRef.current.focus(); document.execCommand('insertHTML', false, html); emit() }
  const applyFontSize = px => {
    edRef.current.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    try { const span = document.createElement('span'); span.style.fontSize = px+'px'; sel.getRangeAt(0).surroundContents(span) }
    catch { document.execCommand('fontSize', false, '3') }
    emit()
  }
  const applyLink = () => { restSel(); if (linkUrl) exec('createLink', linkUrl); setLinkDlg(false); setLinkUrl('') }
  const applyImage = () => {
    restSel()
    insertHtml(`<figure style="margin:1rem 0;text-align:center"><img src="${imgUrl}" alt="${imgCaption}" style="max-width:${imgWidth};height:auto;border:1px solid #ccc9c0;border-radius:3px;"/>${imgCaption?`<figcaption style="font-style:italic;font-size:0.82rem;color:#666;margin-top:4px">${imgCaption}</figcaption>`:''}</figure><p><br/></p>`)
    setImgDlg(false); setImgUrl(''); setImgCaption(''); setImgWidth('100%')
  }
  const insertTable = () => insertHtml(`<table style="border-collapse:collapse;width:100%;margin:1rem 0"><thead><tr><th style="border:1px solid #ccc9c0;padding:6px 10px;background:#eeecea">Header 1</th><th style="border:1px solid #ccc9c0;padding:6px 10px;background:#eeecea">Header 2</th><th style="border:1px solid #ccc9c0;padding:6px 10px;background:#eeecea">Header 3</th></tr></thead><tbody><tr><td style="border:1px solid #ccc9c0;padding:6px 10px">Cell</td><td style="border:1px solid #ccc9c0;padding:6px 10px">Cell</td><td style="border:1px solid #ccc9c0;padding:6px 10px">Cell</td></tr><tr><td style="border:1px solid #ccc9c0;padding:6px 10px">Cell</td><td style="border:1px solid #ccc9c0;padding:6px 10px">Cell</td><td style="border:1px solid #ccc9c0;padding:6px 10px">Cell</td></tr></tbody></table><p><br/></p>`)

  const TB = ({ active, onClick, title, children, danger }) => (
    <button title={title} onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{ padding:'3px 7px',border:'1px solid',borderRadius:3,cursor:'pointer',fontSize:'0.8rem',lineHeight:1.4,userSelect:'none',minWidth:26,display:'flex',alignItems:'center',justifyContent:'center',
        background:danger?'#fff0f0':active?'#1b4f72':'#f8f7f4', color:danger?'#b44':active?'#fff':'#222', borderColor:danger?'#f5c6cb':active?'#1b4f72':'#ccc9c0' }}>{children}</button>
  )
  const Sep = () => <div style={{width:1,background:'#ccc9c0',margin:'0 2px',alignSelf:'stretch'}}/>
  const selSt = { background:'#f8f7f4',color:'#222',border:'1px solid #ccc9c0',borderRadius:3,padding:'2px 4px',fontSize:'0.8rem',cursor:'pointer',fontFamily:'sans-serif' }
  const dlgSt = { padding:'8px 12px',borderBottom:'1px solid #ccc9c0',display:'flex',flexWrap:'wrap',alignItems:'center',gap:6,fontSize:'0.8rem' }
  const dlgInput = (v,ov,ph,w) => <input value={v} onChange={e=>ov(e.target.value)} placeholder={ph} style={{padding:'3px 7px',border:'1px solid #ccc9c0',borderRadius:3,fontSize:'0.8rem',width:w||'auto',fontFamily:'monospace'}}/>
  const dlgBtn = (lbl,onClick,primary) => <button onClick={onClick} style={{padding:'3px 10px',border:'none',borderRadius:3,cursor:'pointer',fontSize:'0.8rem',background:primary?'#1b4f72':'#f0eeea',color:primary?'#fff':'#222'}}>{lbl}</button>

  return (
    <div style={{border:'1px solid #ccc9c0',borderRadius:4,overflow:'hidden',background:'#f8f7f4'}}>
      <div style={{background:'#f0eeea',borderBottom:'1px solid #ccc9c0',padding:'5px 8px',display:'flex',flexWrap:'wrap',gap:3,alignItems:'center'}}>
        <select style={selSt} onChange={e=>{if(e.target.value)insertBlock(e.target.value);e.target.value='';}} defaultValue=''>
          <option value='' disabled>Format</option>
          <option value='p'>Paragraph</option><option value='h2'>Heading 2</option>
          <option value='h3'>Heading 3</option><option value='h4'>Heading 4</option>
          <option value='blockquote'>Blockquote</option><option value='pre'>Code Block</option>
        </select>
        <Sep/>
        <select style={{...selSt,maxWidth:155}} onChange={e=>{if(e.target.value)exec('fontName',e.target.value);e.target.value='';}} defaultValue=''>
          <option value='' disabled>Font</option>
          {CONTENT_FONTS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select style={{...selSt,width:54}} onChange={e=>{if(e.target.value)applyFontSize(e.target.value);e.target.value='';}} defaultValue=''>
          <option value='' disabled>Size</option>
          {FONT_SIZES.map(s=><option key={s} value={s}>{s}px</option>)}
        </select>
        <Sep/>
        <TB active={fmt.bold} onClick={()=>exec('bold')} title='Bold'><b>B</b></TB>
        <TB active={fmt.italic} onClick={()=>exec('italic')} title='Italic'><i>I</i></TB>
        <TB active={fmt.underline} onClick={()=>exec('underline')} title='Underline'><u>U</u></TB>
        <TB active={fmt.strike} onClick={()=>exec('strikeThrough')} title='Strikethrough'><s>S</s></TB>
        <Sep/>
        <TB active={false} onClick={()=>exec('superscript')} title='Superscript'>x²</TB>
        <TB active={false} onClick={()=>exec('subscript')} title='Subscript'>x₂</TB>
        <Sep/>
        <label title='Text Color' style={{display:'flex',alignItems:'center',gap:2,cursor:'pointer',fontSize:'0.8rem',color:'#666'}}>A<input type='color' style={{width:20,height:20,border:'1px solid #ccc9c0',padding:0,cursor:'pointer',borderRadius:2}} onChange={e=>exec('foreColor',e.target.value)}/></label>
        <label title='Highlight' style={{display:'flex',alignItems:'center',gap:2,cursor:'pointer',fontSize:'0.8rem',color:'#666'}}>▌<input type='color' defaultValue='#fff9c4' style={{width:20,height:20,border:'1px solid #ccc9c0',padding:0,cursor:'pointer',borderRadius:2}} onChange={e=>exec('backColor',e.target.value)}/></label>
        <Sep/>
        <TB active={fmt.ul} onClick={()=>exec('insertUnorderedList')} title='Bullet List'>•≡</TB>
        <TB active={fmt.ol} onClick={()=>exec('insertOrderedList')} title='Numbered List'>1≡</TB>
        <Sep/>
        <TB active={fmt.jl} onClick={()=>exec('justifyLeft')} title='Align Left'>⬛▭</TB>
        <TB active={fmt.jc} onClick={()=>exec('justifyCenter')} title='Center'>▭⬛</TB>
        <TB active={fmt.jr} onClick={()=>exec('justifyRight')} title='Align Right'>▭⬛</TB>
        <Sep/>
        <TB active={false} onClick={()=>exec('indent')} title='Indent'>→¶</TB>
        <TB active={false} onClick={()=>exec('outdent')} title='Outdent'>←¶</TB>
        <Sep/>
        <TB active={false} onClick={()=>{saveSel();setLinkDlg(l=>!l)}} title='Insert Link'>🔗</TB>
        <TB active={false} onClick={()=>{saveSel();setImgDlg(d=>!d)}} title='Embed Image'>🖼</TB>
        <TB active={false} onClick={insertTable} title='Insert Table'>⊞</TB>
        <TB active={false} onClick={()=>insertHtml("<hr style='border:none;border-top:1px solid #ccc9c0;margin:1rem 0'/><p><br/></p>")} title='Horizontal Rule'>—</TB>
        <Sep/>
        <TB active={false} onClick={()=>exec('undo')} title='Undo'>↩</TB>
        <TB active={false} onClick={()=>exec('redo')} title='Redo'>↪</TB>
        <Sep/>
        <TB active={false} onClick={()=>exec('removeFormat')} title='Clear Formatting' danger>Tₓ</TB>
      </div>
      {linkDlg && <div style={{...dlgSt,background:'#fffde7'}}><span style={{color:'#666'}}>URL:</span>{dlgInput(linkUrl,setLinkUrl,'https://…','220px')}{dlgBtn('Insert',applyLink,true)}{dlgBtn('✕',()=>setLinkDlg(false))}</div>}
      {imgDlg && <div style={{...dlgSt,background:'#f0f8ff'}}><span style={{color:'#666'}}>Image URL:</span>{dlgInput(imgUrl,setImgUrl,'https://…','180px')}<span style={{color:'#666'}}>Caption:</span>{dlgInput(imgCaption,setImgCaption,'Optional','120px')}<span style={{color:'#666'}}>Width:</span>{dlgInput(imgWidth,setImgWidth,'100%','70px')}{dlgBtn('Insert',applyImage,true)}{dlgBtn('✕',()=>setImgDlg(false))}</div>}
      <div ref={edRef} contentEditable suppressContentEditableWarning onInput={emit} onKeyUp={updateFmt} onMouseUp={updateFmt} onSelect={updateFmt}
        style={{minHeight:360,padding:'1rem 1.2rem',outline:'none',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.92rem',lineHeight:1.75,color:'#222',overflowY:'auto',maxHeight:520}}/>
    </div>
  )
}

// ─── Infobox Editor ───────────────────────────────────────────────────────────
function InfoboxEditor({ infobox, onChange }) {
  const [rows, setRows] = useState(() => Object.entries(infobox || {}))
  const sync = updated => { setRows(updated); onChange(Object.fromEntries(updated.filter(([k])=>k.trim()))) }
  const upd = (i,ki,val) => sync(rows.map((r,ri)=>ri===i?(ki===0?[val,r[1]]:[r[0],val]):r))
  const add = () => sync([...rows,['','']])
  const del = i => sync(rows.filter((_,ri)=>ri!==i))
  const mv = (i,d) => { const j=i+d; if(j<0||j>=rows.length)return; const u=[...rows];[u[i],u[j]]=[u[j],u[i]];sync(u) }
  const ci = (v,ov,ph) => <input value={v} onChange={e=>ov(e.target.value)} placeholder={ph} style={{width:'100%',padding:'4px 6px',border:'1px solid #ccc9c0',borderRadius:3,fontSize:'0.82rem',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f8f7f4',color:'#222'}}/>
  const mb = (lbl,onClick,col) => <button onClick={onClick} style={{padding:'3px 6px',border:'1px solid #ccc9c0',borderRadius:3,background:'#f8f7f4',cursor:'pointer',fontSize:'0.76rem',color:col||'#222',flexShrink:0}}>{lbl}</button>
  return (
    <div style={{border:'1px solid #ccc9c0',borderRadius:4,overflow:'hidden'}}>
      <div style={{background:'#f0eeea',padding:'5px 10px',fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.08em',color:'#666',borderBottom:'1px solid #ccc9c0'}}>Infobox Fields</div>
      <div style={{padding:'8px'}}>
        {rows.length===0&&<div style={{color:'#888',fontSize:'0.8rem',fontStyle:'italic',padding:'4px 2px'}}>No fields yet.</div>}
        {rows.map(([k,v],i)=>(
          <div key={i} style={{display:'flex',gap:4,marginBottom:5,alignItems:'center'}}>
            <div style={{flex:'0 0 150px'}}>{ci(k,val=>upd(i,0,val),'Field name')}</div>
            <div style={{flex:1}}>{ci(v,val=>upd(i,1,val),'Value')}</div>
            {mb('↑',()=>mv(i,-1))}{mb('↓',()=>mv(i,1))}{mb('✕',()=>del(i),'#b44')}
          </div>
        ))}
        <button onClick={add} style={{marginTop:4,padding:'4px 10px',border:'1px dashed #ccc9c0',borderRadius:3,background:'none',cursor:'pointer',fontSize:'0.78rem',color:'#888'}}>+ Add Field</button>
      </div>
    </div>
  )
}

// ─── Article View ─────────────────────────────────────────────────────────────
function linkifyContent(html, articles, currentId, onNavigate) {
  // Build a map of title -> article id, excluding the current article
  const titleMap = {}
  Object.values(articles).forEach(a => {
    if (a.id !== currentId) titleMap[a.title] = a.id
  })
  if (Object.keys(titleMap).length === 0) return html

  // Replace <strong>Title</strong> where title matches an article exactly
  // We sort by length descending so longer titles match before shorter substrings
  const titles = Object.keys(titleMap).sort((a,b) => b.length - a.length)
  let result = html
  titles.forEach(title => {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<strong>(${escaped})<\/strong>`, 'g')
    result = result.replace(re, `<strong><a href="#" data-article-id="${titleMap[title]}" style="color:#1a5276;text-decoration:underline;text-underline-offset:2px;cursor:pointer;">$1</a></strong>`)
  })
  return result
}

// ─── Portrait Slideshow ───────────────────────────────────────────────────────
function PortraitSlideshow({ urls, alt, onOpenLightbox, onIndexChange }) {
  const FADE_MS = 300
  const [curIdx, setCurIdx]   = useState(0)
  const [prevIdx, setPrevIdx] = useState(null)
  const [fading, setFading]   = useState(false)
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const goTo = async (to) => {
    if (fading || to === curIdx) return
    setPrevIdx(curIdx)
    setFading(true)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    if (!alive.current) return
    setCurIdx(to)
    if (onIndexChange) onIndexChange(to)
    await new Promise(r => setTimeout(r, FADE_MS))
    if (!alive.current) return
    setPrevIdx(null)
    setFading(false)
  }

  const prev = (e) => { e.stopPropagation(); goTo((curIdx - 1 + urls.length) % urls.length) }
  const next = (e) => { e.stopPropagation(); goTo((curIdx + 1) % urls.length) }

  if (urls.length === 1) {
    return (
      <img src={urls[0]} alt={alt} onClick={onOpenLightbox}
        style={{width:'100%',height:'auto',display:'block',borderRadius:3,border:'1px solid #ccc9c0',cursor:'zoom-in'}}/>
    )
  }

  return (
    <div style={{position:'relative',width:'100%',borderRadius:3,border:'1px solid #ccc9c0',overflow:'hidden',background:'#d8d4cc'}}>
      {/* Outgoing image — fades out */}
      {prevIdx !== null && (
        <img src={urls[prevIdx]} alt={alt}
          style={{position:'absolute',top:0,left:0,width:'100%',height:'auto',
            opacity: fading ? 0 : 1,
            transition:`opacity ${FADE_MS}ms ease-in-out`}}/>
      )}
      {/* Current image — fades in */}
      <img src={urls[curIdx]} alt={alt} onClick={onOpenLightbox}
        style={{width:'100%',height:'auto',display:'block',cursor:'zoom-in',
          opacity: fading ? 1 : 1,
          transition:`opacity ${FADE_MS}ms ease-in-out`}}/>
      {/* Nav controls */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'3px 6px',background:'rgba(0,0,0,0.35)',
        fontSize:'0.68rem',color:'#fff',fontFamily:"'Source Serif 4',Georgia,serif"}}>
        <button onClick={prev}
          style={{background:'none',border:'none',cursor:'pointer',color:'#fff',fontSize:'0.8rem',padding:'0 4px',lineHeight:1,opacity:0.85}}>‹</button>
        <span style={{opacity:0.8,letterSpacing:'0.04em'}}>{curIdx+1} / {urls.length}</span>
        <button onClick={next}
          style={{background:'none',border:'none',cursor:'pointer',color:'#fff',fontSize:'0.8rem',padding:'0 4px',lineHeight:1,opacity:0.85}}>›</button>
      </div>
    </div>
  )
}

function ArticleView({ article, onEdit, onDelete, onlineUsers, articles, onNavigate }) {
  const portraitUrls = (article.portrait||'').split(',').map(s=>s.trim()).filter(Boolean)
  const hasInfo = (article.infobox && Object.keys(article.infobox).length > 0) || portraitUrls.length > 0
  const readers = Object.entries(onlineUsers).filter(([,u])=>u.articleId===article.id&&!u.editing)
  const editors = Object.entries(onlineUsers).filter(([,u])=>u.articleId===article.id&&u.editing)
  const linkedContent = linkifyContent(article.content||'', articles||{}, article.id, onNavigate)
  const [lightbox, setLightbox] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const isMobile = useIsMobile()

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return
    const handler = e => { if (e.key === 'Escape') setLightbox(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox])

  const handleBodyClick = e => {
    const id = e.target.closest('a[data-article-id]')?.getAttribute('data-article-id')
    if (id) { e.preventDefault(); onNavigate && onNavigate(id) }
  }

  return (
    <div style={{maxWidth:780}}>
      {/* Lightbox */}
      {lightbox && (
        <div onClick={()=>setLightbox(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'}}>
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',maxWidth:'90vw',maxHeight:'90vh',display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <img src={portraitUrls[lightboxIdx]||portraitUrls[0]} alt={article.title}
              style={{maxWidth:'90vw',maxHeight:'82vh',objectFit:'contain',borderRadius:4,boxShadow:'0 8px 48px rgba(0,0,0,0.6)'}}/>
            <div style={{color:'#ccc',fontSize:'0.82rem',fontStyle:'italic',fontFamily:"'Source Serif 4',Georgia,serif"}}>{article.title}</div>
            <button onClick={()=>setLightbox(false)}
              style={{position:'absolute',top:-14,right:-14,width:30,height:30,borderRadius:'50%',background:'#333',border:'1px solid #666',color:'#fff',fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>
              ✕
            </button>
          </div>
        </div>
      )}
      <div style={{borderBottom:'1px solid #ccc9c0',marginBottom:'1rem',paddingBottom:'0.5rem'}}>
        <div style={{fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'#666',marginBottom:2}}>{article.category}</div>
        <h1 style={{fontFamily:"'IM Fell English',serif",fontSize:isMobile?'1.5rem':'1.95rem',color:'#1a1a1a',lineHeight:1.15}}>{article.title}</h1>
        {article.subtitle&&<div style={{fontStyle:'italic',color:'#666',marginTop:3,fontSize:'0.92rem'}}>{article.subtitle}</div>}
        {editors.length>0&&(
          <div style={{marginTop:6,padding:'4px 10px',background:'#fff9e6',border:'1px solid #f5e0a0',borderRadius:4,fontSize:'0.78rem',color:'#a07020',display:'inline-flex',alignItems:'center',gap:6}}>
            ✏ {editors.map(([,u])=>u.displayName).join(', ')} {editors.length===1?'is':'are'} editing this article
          </div>
        )}
        <div style={{marginTop:'0.6rem',display:'flex',gap:6,alignItems:'center'}}>
          {onEdit&&<button onClick={onEdit} style={{padding:'4px 12px',border:'1px solid #ccc9c0',borderRadius:3,background:'#eeecea',cursor:'pointer',fontSize:'0.81rem',fontFamily:"'Source Serif 4',Georgia,serif",color:'#222'}}>✏ Edit</button>}
          {onDelete&&<button onClick={onDelete} style={{padding:'4px 12px',border:'1px solid #e0b0b0',borderRadius:3,background:'none',cursor:'pointer',fontSize:'0.81rem',fontFamily:"'Source Serif 4',Georgia,serif",color:'#b44'}}>🗑 Delete</button>}
          {readers.length>0&&<span style={{fontSize:'0.78rem',color:'#888',marginLeft:4}}>👁 {readers.map(([,u])=>u.displayName).join(', ')} reading</span>}
        </div>
      </div>
      {hasInfo&&(
        <div style={isMobile
          ? {width:'100%',marginBottom:'1rem',background:'#eeecea',border:'1px solid #ccc9c0',borderRadius:4,padding:'0.7rem',fontSize:'0.82rem'}
          : {float:'right',width:244,marginLeft:'1.5rem',marginBottom:'1rem',background:'#eeecea',border:'1px solid #ccc9c0',borderRadius:4,padding:'0.7rem',fontSize:'0.82rem'}
        }>
          <div style={{fontFamily:"'IM Fell English',serif",fontWeight:600,fontSize:'0.88rem',marginBottom:6,borderBottom:'1px solid #ccc9c0',paddingBottom:4,color:'#1b4f72'}}>{article.title}</div>
          {/* Portrait */}
          <div style={{textAlign:'center',marginBottom:8}}>
            {portraitUrls.length > 0
              ? <PortraitSlideshow urls={portraitUrls} alt={article.title}
                  onIndexChange={i=>setLightboxIdx(i)}
                  onOpenLightbox={()=>setLightbox(true)}/>
              : <div style={{width:'100%',height:160,background:'#d8d4cc',borderRadius:3,border:'1px solid #ccc9c0',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:4}}>
                  <span style={{fontSize:'2.8rem',color:'#a09890',lineHeight:1}}>?</span>
                  <span style={{fontSize:'0.68rem',color:'#a09890',letterSpacing:'0.05em'}}>No portrait</span>
                </div>
            }
          </div>
          {Object.entries(article.infobox).map(([k,v])=>(
            <div key={k} style={{display:'flex',gap:6,marginBottom:4,lineHeight:1.4}}>
              <span style={{color:'#666',minWidth:82,fontSize:'0.72rem',textTransform:'uppercase',letterSpacing:'0.04em',paddingTop:1,flexShrink:0}}>{k}</span>
              <span style={{flex:1,fontSize:'0.82rem'}}>{v}</span>
            </div>
          ))}
        </div>
      )}
      <div className='article-body' style={{fontSize:'0.91rem'}} onClick={handleBodyClick} dangerouslySetInnerHTML={{__html:linkedContent}}/>
      <div style={{clear:'both'}}/>
      {(article.subgroups||[]).map(sg=>(
        <div key={sg.id} style={{marginTop:'1.5rem',paddingTop:'1rem',borderTop:'1px solid #e8e5e0'}}>
          <h2 style={{fontFamily:"'IM Fell English',serif",fontSize:'1.25rem',color:'#1a1a1a',marginBottom:'0.5rem'}}>{sg.title}</h2>
          <div className='article-body' style={{fontSize:'0.91rem'}} onClick={handleBodyClick} dangerouslySetInnerHTML={{__html:linkifyContent(sg.content||'',articles||{},article.id,onNavigate)}}/>
        </div>
      ))}
      {article.updatedAt&&(
        <div style={{marginTop:'1.5rem',paddingTop:'0.75rem',borderTop:'1px solid #e8e5e0',fontSize:'0.76rem',color:'#aaa'}}>
          Last edited {new Date(article.updatedAt.seconds*1000).toLocaleString()} {article.updatedBy&&`by ${article.updatedBy}`}
        </div>
      )}
    </div>
  )
}

// ─── Changelog Panel ──────────────────────────────────────────────────────────
function ChangelogPanel({ onClose }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db,'changelog'), orderBy('timestamp','desc'), limit(50))
    const unsub = onSnapshot(q, snap => {
      setEntries(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
    return unsub
  }, [])

  const actionLabel = a => ({ created:'created', edited:'edited', deleted:'deleted' }[a]||a)
  const actionColor = a => ({ created:'#2e7d32', edited:'#1b4f72', deleted:'#b44' }[a]||'#666')

  return (
    <div style={{position:'fixed',top:0,right:0,bottom:0,width:360,background:'#faf9f6',borderLeft:'1px solid #ccc9c0',display:'flex',flexDirection:'column',zIndex:100,boxShadow:'-4px 0 20px rgba(0,0,0,0.08)'}}>
      <div style={{padding:'1rem 1.2rem',borderBottom:'1px solid #ccc9c0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:"'IM Fell English',serif",fontSize:'1.1rem',color:'#1b4f72'}}>Changelog</div>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'#888',lineHeight:1}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'0.75rem 1.2rem'}}>
        {loading&&<div style={{color:'#888',fontStyle:'italic',fontSize:'0.84rem'}}>Loading…</div>}
        {!loading&&entries.length===0&&<div style={{color:'#888',fontStyle:'italic',fontSize:'0.84rem'}}>No changes recorded yet.</div>}
        {entries.map(e=>(
          <div key={e.id} style={{marginBottom:'0.9rem',paddingBottom:'0.9rem',borderBottom:'1px solid #ece9e3'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
              <span style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:actionColor(e.action),background:actionColor(e.action)+'18',padding:'1px 6px',borderRadius:10}}>{actionLabel(e.action)}</span>
              <span style={{fontWeight:600,fontSize:'0.85rem',color:'#222',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.articleTitle}</span>
            </div>
            <div style={{fontSize:'0.78rem',color:'#666'}}>
              by <strong>{e.userName}</strong>
              {e.timestamp&&<span style={{marginLeft:6,color:'#aaa'}}>{new Date(e.timestamp.seconds*1000).toLocaleString()}</span>}
            </div>
            {e.summary&&<div style={{fontSize:'0.78rem',color:'#888',marginTop:3,fontStyle:'italic'}}>{e.summary}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────
function EditForm({ draft, setDraft, onSave, onCancel, onDelete, isNew, categories }) {
  const [preview, setPreview] = useState(false)
  const isMobile = useIsMobile()
  const inp = {width:'100%',background:'#f8f7f4',color:'#222',border:'1px solid #ccc9c0',borderRadius:3,padding:'6px 10px',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.9rem',marginBottom:8,boxSizing:'border-box'}
  const lb = {display:'block',fontSize:'0.69rem',color:'#666',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.07em',marginTop:10}
  const bt = (v='def') => ({padding:'6px 14px',borderRadius:3,border:'1px solid',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.83rem',fontWeight:500,marginRight:6,
    ...(v==='primary'?{background:'#1b4f72',color:'#fff',borderColor:'#1b4f72'}:
       v==='danger'?{background:'#b44',color:'#fff',borderColor:'#b44'}:
       {background:'#eeecea',color:'#222',borderColor:'#ccc9c0'})})

  return (
    <div style={{maxWidth:840}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'1rem',borderBottom:'1px solid #ccc9c0',paddingBottom:'0.75rem'}}>
        <h2 style={{fontFamily:"'IM Fell English',serif",fontSize:'1.3rem',color:'#1b4f72',flex:1}}>{isNew?'New Article':`Editing: ${draft.title}`}</h2>
        {!isNew&&<label style={{fontSize:'0.82rem',color:'#666',display:'flex',alignItems:'center',gap:5,cursor:'pointer',userSelect:'none'}}><input type='checkbox' checked={preview} onChange={e=>setPreview(e.target.checked)}/> Preview</label>}
      </div>
      {preview&&!isNew
        ? <ArticleView article={draft} onlineUsers={{}}/>
        : <>
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:'0 1rem'}}>
              <div><label style={lb}>Title</label><input style={inp} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} placeholder='e.g. The Worldheart'/></div>
              <div><label style={lb}>Category</label><select style={inp} value={draft.category} onChange={e=>setDraft(p=>({...p,category:e.target.value}))}>{(categories||DEFAULT_CATEGORIES).map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <label style={lb}>Subtitle / Tagline</label>
            <input style={inp} value={draft.subtitle||''} onChange={e=>setDraft(p=>({...p,subtitle:e.target.value}))} placeholder='e.g. Mythic Treasure of Dwarvenkind'/>
            <label style={{...lb,marginTop:14}}>Infobox</label>
            <div style={{marginBottom:8}}>
              <label style={lb}>Portrait Image URL(s)</label>
              <div style={{fontSize:'0.72rem',color:'#aaa',marginBottom:4}}>Separate multiple URLs with commas for a crossfade slideshow.</div>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <input style={{...inp,marginBottom:0,flex:1}} value={draft.portrait||''} onChange={e=>setDraft(p=>({...p,portrait:e.target.value}))} placeholder='https://… or url1, url2, url3'/>
                <div style={{display:'flex',gap:4,flexShrink:0}}>
                  {(draft.portrait||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,3).map((url,i)=>(
                    <div key={i} style={{width:44,height:44,borderRadius:3,border:'1px solid #ccc9c0',overflow:'hidden',background:'#d8d4cc',flexShrink:0}}>
                      <img src={url} alt='' style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    </div>
                  ))}
                  {!(draft.portrait||'').trim() && (
                    <div style={{width:44,height:44,borderRadius:3,border:'1px solid #ccc9c0',background:'#d8d4cc',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:'1.2rem',color:'#a09890'}}>?</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <InfoboxEditor infobox={draft.infobox||{}} onChange={ib=>setDraft(p=>({...p,infobox:ib}))}/>
            <label style={{...lb,marginTop:14}}>Article Body</label>
            <RichEditor value={draft.content||''} onChange={html=>setDraft(p=>({...p,content:html}))}/>
            <SubgroupsEditor subgroups={draft.subgroups||[]} onChange={sgs=>setDraft(p=>({...p,subgroups:sgs}))}/>
          </>
      }
      <div style={{marginTop:14,display:'flex',alignItems:'center'}}>
        <button style={bt('primary')} onClick={onSave}>{isNew?'Create Article':'Save Changes'}</button>
        <button style={bt()} onClick={onCancel}>Cancel</button>
        {!isNew&&onDelete&&<button style={{...bt('danger'),marginLeft:'auto'}} onClick={onDelete}>Delete Article</button>}
      </div>
    </div>
  )
}

// ─── Subgroups Editor ─────────────────────────────────────────────────────────
function SubgroupsEditor({ subgroups = [], onChange }) {
  const [editingId, setEditingId] = useState(null)
  const lb = {display:'block',fontSize:'0.69rem',color:'#666',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.07em',marginTop:10}
  const inp = {width:'100%',background:'#f8f7f4',color:'#222',border:'1px solid #ccc9c0',borderRadius:3,padding:'6px 10px',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.9rem',marginBottom:8,boxSizing:'border-box'}

  const add = () => {
    const sg = { id: Date.now().toString(36), title: '', content: '' }
    onChange([...subgroups, sg])
    setEditingId(sg.id)
  }
  const upd = (id, patch) => onChange(subgroups.map(sg => sg.id === id ? { ...sg, ...patch } : sg))
  const del = (id) => { onChange(subgroups.filter(sg => sg.id !== id)); if (editingId === id) setEditingId(null) }
  const mv = (i, d) => { const j = i + d; if (j < 0 || j >= subgroups.length) return; const u = [...subgroups]; [u[i],u[j]]=[u[j],u[i]]; onChange(u) }

  return (
    <div style={{marginTop:14}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <label style={{...lb,marginTop:0,flex:1}}>Sub-groups</label>
        <button onClick={add}
          style={{padding:'3px 10px',border:'1px solid #ccc9c0',borderRadius:3,background:'#eeecea',cursor:'pointer',fontSize:'0.76rem',fontFamily:"'Source Serif 4',Georgia,serif",color:'#444'}}>
          + Add
        </button>
      </div>
      {subgroups.map((sg, i) => (
        <div key={sg.id} style={{border:'1px solid #ccc9c0',borderRadius:4,marginBottom:8,background:'#f8f7f4'}}>
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'6px 8px',borderBottom: editingId===sg.id ? '1px solid #ccc9c0' : 'none',background:'#eeecea',borderRadius: editingId===sg.id ? '4px 4px 0 0' : 4}}>
            <span style={{flex:1,fontSize:'0.85rem',fontFamily:"'IM Fell English',serif",color:'#1b4f72',fontStyle: sg.title ? 'normal' : 'italic',opacity: sg.title ? 1 : 0.5}}>
              {sg.title || 'Untitled sub-group'}
            </span>
            <button onClick={()=>mv(i,-1)} disabled={i===0} title='Move up'
              style={{background:'none',border:'none',cursor:i===0?'default':'pointer',color:i===0?'#ccc':'#888',fontSize:'0.75rem',padding:'0 3px',lineHeight:1}}>↑</button>
            <button onClick={()=>mv(i,1)} disabled={i===subgroups.length-1} title='Move down'
              style={{background:'none',border:'none',cursor:i===subgroups.length-1?'default':'pointer',color:i===subgroups.length-1?'#ccc':'#888',fontSize:'0.75rem',padding:'0 3px',lineHeight:1}}>↓</button>
            <button onClick={()=>setEditingId(editingId===sg.id ? null : sg.id)}
              style={{background:'none',border:'1px solid #ccc9c0',borderRadius:3,cursor:'pointer',fontSize:'0.72rem',color:'#555',padding:'1px 7px',fontFamily:"'Source Serif 4',Georgia,serif"}}>
              {editingId===sg.id ? 'Done' : 'Edit'}
            </button>
            <button onClick={()=>del(sg.id)} title='Delete sub-group'
              style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.78rem',color:'#b44',padding:'0 2px',lineHeight:1}}>✕</button>
          </div>
          {editingId===sg.id && (
            <div style={{padding:'8px 10px'}}>
              <label style={lb}>Sub-group Title</label>
              <input style={inp} value={sg.title} onChange={e=>upd(sg.id,{title:e.target.value})} placeholder='e.g. Notable Members'/>
              <label style={lb}>Content</label>
              <RichEditor value={sg.content} onChange={html=>upd(sg.id,{content:html})}/>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}


function PresenceBubbles({ online, currentUser }) {
  const others = Object.entries(online).filter(([uid])=>uid!==currentUser?.uid)
  if (others.length===0) return null
  return (
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      {others.slice(0,8).map(([uid,u])=>(
        <div key={uid} title={`${u.displayName}${u.editing?' (editing)':' (reading)'}`}
          style={{width:30,height:30,borderRadius:'50%',background:u.color||uidColor(uid),display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'0.7rem',fontWeight:700,color:'#fff',border:u.editing?'2px solid #f5a623':'2px solid transparent',
            cursor:'default',userSelect:'none',flexShrink:0,position:'relative'}}>
          {initials(u.displayName)}
          {u.editing&&<div style={{position:'absolute',bottom:-2,right:-2,width:8,height:8,borderRadius:'50%',background:'#f5a623',border:'1px solid #fff'}}/>}
        </div>
      ))}
      {others.length>8&&<span style={{fontSize:'0.75rem',color:'#888'}}>+{others.length-8}</span>}
    </div>
  )
}

// ─── Seed Button (admin only, first load) ─────────────────────────────────────
function SeedButton({ onSeed }) {
  const [seeding, setSeeding] = useState(false)
  const seed = async () => {
    if (!confirm('Seed the wiki with the default Qærn articles? This will add all starter articles to Firestore.')) return
    setSeeding(true)
    const batch = writeBatch(db)
    for (const [id, article] of Object.entries(INITIAL_ARTICLES)) {
      batch.set(doc(db,'articles',id), { ...article, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    }
    await batch.commit()
    setSeeding(false)
    onSeed()
  }
  return (
    <div style={{padding:'2rem',textAlign:'center'}}>
      <div style={{fontFamily:"'IM Fell English',serif",fontSize:'1.2rem',color:'#1b4f72',marginBottom:'0.5rem'}}>The wiki is empty.</div>
      <div style={{color:'#666',fontSize:'0.88rem',marginBottom:'1rem'}}>Seed it with the default Qærn articles to get started.</div>
      <button onClick={seed} disabled={seeding} style={{padding:'8px 20px',background:'#1b4f72',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.9rem'}}>
        {seeding?'Seeding…':'Seed Default Articles'}
      </button>
    </div>
  )
}

// ─── User settings panel ─────────────────────────────────────────────────────
function UserSettings({ user, updateUser, currentColor, onClose }) {
  const PRESET_COLORS = [
    '#e05c5c','#e0895c','#c8b44a','#5ca85c','#5c8ae0',
    '#8e5ce0','#c45cb4','#5cb4c4','#7ab85c','#c45c7a',
    '#1b4f72','#2e7d32','#6d4c41','#37474f','#ad1457',
  ]
  const [name, setName] = useState(user?.displayName || '')
  const [color, setColor] = useState(currentColor || null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateUser({ displayName: name.trim() || user.displayName, color })
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 800)
    } catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  const preview = color || currentColor
  const lb = { display:'block', fontSize:'0.67rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'#888', marginBottom:4 }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:400,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fdf8f0', borderRadius:8, padding:'1.5rem', width:'100%', maxWidth:340,
        boxShadow:'0 8px 40px rgba(0,0,0,0.25)', fontFamily:"'Source Serif 4',Georgia,serif" }}>
        <div style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.1rem', color:'#1b4f72', marginBottom:'1.2rem' }}>
          Account Settings
        </div>

        {/* Preview bubble */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'1.2rem',
          padding:'10px 12px', background:'#f0eeea', borderRadius:6 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background: preview,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'0.82rem', fontWeight:700, color:'#fff', flexShrink:0,
            boxShadow:'0 2px 6px rgba(0,0,0,0.15)' }}>
            {(name||user?.displayName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight:600, fontSize:'0.88rem', color:'#222' }}>{name || user?.displayName}</div>
            <div style={{ fontSize:'0.72rem', color:'#aaa' }}>{user?.email}</div>
          </div>
        </div>

        {/* Display name */}
        <label style={lb}>Display Name</label>
        <input value={name} onChange={e=>setName(e.target.value)}
          style={{ width:'100%', padding:'6px 8px', border:'1px solid #ccc9c0', borderRadius:3,
            fontSize:'0.85rem', fontFamily:"'Source Serif 4',Georgia,serif",
            background:'#f8f7f4', color:'#222', boxSizing:'border-box', marginBottom:14 }}/>

        {/* Color picker */}
        <label style={lb}>Bubble Color</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {PRESET_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)}
              style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer',
                border: color===c ? '3px solid #1b4f72' : '2px solid transparent',
                boxShadow: color===c ? '0 0 0 1px #1b4f72' : '0 1px 3px rgba(0,0,0,0.2)',
                transition:'transform 0.1s', transform: color===c ? 'scale(1.2)':'scale(1)' }}/>
          ))}
          {/* Custom color */}
          <label title='Custom color' style={{ width:28, height:28, borderRadius:'50%',
            background: color && !PRESET_COLORS.includes(color) ? color : '#f0eeea',
            border:'1px dashed #ccc', cursor:'pointer', display:'flex',
            alignItems:'center', justifyContent:'center', fontSize:'0.7rem', color:'#aaa',
            overflow:'hidden', position:'relative' }}>
            <span style={{ pointerEvents:'none' }}>🎨</span>
            <input type='color' value={color||'#888888'} onChange={e=>setColor(e.target.value)}
              style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}/>
          </label>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'6px 14px', border:'1px solid #ccc9c0', borderRadius:3,
              background:'#f0eeea', cursor:'pointer', fontSize:'0.8rem',
              fontFamily:"'Source Serif 4',Georgia,serif" }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ padding:'6px 16px', border:'none', borderRadius:3,
              background: saved ? '#3a7a3a' : '#1b4f72', color:'#fff',
              cursor:'pointer', fontSize:'0.8rem',
              fontFamily:"'Source Serif 4',Georgia,serif" }}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile toolbar with overflow drawer ─────────────────────────────────────
function MobileToolbar({ onArticles, onBulletin, onInitiative, onTracker, onMap, onDowntime, onForum, onChangelog }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const primary = [
    {icon:'📑', label:'Articles',   action: onArticles},
    {icon:'📌', label:'Bulletin',   action: onBulletin},
    {icon:'⚔',  label:'Initiative', action: onInitiative},
    {icon:'📊', label:'Tracker',    action: onTracker},
  ]
  const overflow = [
    {icon:'🗺',  label:'Map',       action: onMap},
    {icon:'🌙',  label:'Downtime',  action: onDowntime},
    {icon:'💬',  label:'Forum',     action: onForum},
    {icon:'📋',  label:'Changelog', action: onChangelog},
  ]
  const btn = {border:'none',background:'none',cursor:'pointer',
    fontFamily:"'Source Serif 4',Georgia,serif",color:'#555',
    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}

  return (
    <>
      {moreOpen && (
        <div onClick={()=>setMoreOpen(false)}
          style={{position:'fixed',inset:0,zIndex:198,background:'rgba(0,0,0,0.25)'}}/>
      )}
      {moreOpen && (
        <div style={{position:'fixed',bottom:52,left:0,right:0,zIndex:199,
          background:'#f8f7f4',borderTop:'1px solid #ccc9c0',
          display:'grid',gridTemplateColumns:'repeat(4,1fr)',
          boxShadow:'0 -6px 24px rgba(0,0,0,0.12)'}}>
          {overflow.map(({icon,label,action},i)=>(
            <button key={label} onClick={()=>{action();setMoreOpen(false)}}
              style={{...btn,padding:'14px 4px',borderRight:i<overflow.length-1?'1px solid #e8e5e0':'none'}}>
              <span style={{fontSize:'1.3rem'}}>{icon}</span>
              <span style={{fontSize:'0.58rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{borderTop:'1px solid #ccc9c0',background:'#f8f7f4',
        display:'flex',height:52,flexShrink:0,zIndex:200,position:'relative'}}>
        {primary.map(({icon,label,action})=>(
          <button key={label} onClick={action}
            style={{...btn,flex:1,borderRight:'1px solid #e8e5e0'}}>
            <span style={{fontSize:'1.2rem'}}>{icon}</span>
            <span style={{fontSize:'0.58rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</span>
          </button>
        ))}
        <button onClick={()=>setMoreOpen(o=>!o)}
          style={{...btn,width:52,flexShrink:0,borderLeft:'1px solid #e8e5e0',
            background:moreOpen?'#f0eeea':'none'}}>
          <span style={{fontSize:'1.1rem',letterSpacing:'-1px',color: moreOpen?'#1b4f72':'#555'}}>•••</span>
          <span style={{fontSize:'0.58rem',textTransform:'uppercase',letterSpacing:'0.05em',color:moreOpen?'#1b4f72':'#555'}}>More</span>
        </button>
      </div>
    </>
  )
}

// ─── Main Wiki App ────────────────────────────────────────────────────────────
export default function WikiApp() {
  const { user, logout, updateUser } = useAuth()
  const [articles, setArticles] = useState({})
  const [articlesLoaded, setArticlesLoaded] = useState(false)
  const [currentId, setCurrentId] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newArt, setNewArt] = useState({ title:'',category:'Lore & History',subtitle:'',content:'',infobox:{} })
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 680)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showTracker, setShowTracker] = useState(false)
  const [showBulletin, setShowBulletin] = useState(false)
  const [showInitiative, setShowInitiative] = useState(false)
  const [showHexMap, setShowHexMap] = useState(false)
  const [showDowntime, setShowDowntime] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [collapsedCats, setCollapsedCats] = useState({})
  const [newCatInput, setNewCatInput] = useState('')
  const [showNewCatInput, setShowNewCatInput] = useState(false)
  const [editingCat, setEditingCat] = useState(null)   // { type:'cat'|'sub', catIdx, subIdx?, value }
  const [newSubInput, setNewSubInput] = useState(null)  // catIdx or null
  // Drag state
  const [dragArticle, setDragArticle] = useState(null)  // { id, fromCategory }
  const [dragOverCat, setDragOverCat] = useState(null)  // category key being hovered
  const [dragOverArticle, setDragOverArticle] = useState(null) // article id being hovered
  const [dragCatIdx, setDragCatIdx] = useState(null)    // category index being dragged
  const [dragOverCatIdx, setDragOverCatIdx] = useState(null)

  const isMobile = useIsMobile()
  const [userColor, setUserColor] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const online = usePresence(user, currentId, editing)

  // Load user's custom color from Firestore
  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setUserColor(snap.data().color || null)
    })
    return unsub
  }, [user?.uid])

  const effectiveColor = userColor || uidColor(user?.uid || '')

  // Read initial URL hash — open the matching tool or treat as article id
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if      (hash === 'bulletin')   setShowBulletin(true)
    else if (hash === 'initiative') setShowInitiative(true)
    else if (hash === 'tracker')    setShowTracker(true)
    else if (hash === 'map')        setShowHexMap(true)
    else if (hash === 'downtime')   setShowDowntime(true)
    else if (hash === 'forum')      setShowChat(true)
    else if (hash)                  setCurrentId(hash)
  }, [])

  // Keep URL hash in sync with current article; clear it on landing page
  useEffect(() => {
    if (currentId) window.location.hash = currentId
    else history.replaceState(null, '', window.location.pathname)
  }, [currentId])

  // Real-time articles subscription
  useEffect(() => {
    const unsub = onSnapshot(collection(db,'articles'), snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.id] = { id:d.id, ...d.data() } })
      setArticles(map)
      setArticlesLoaded(true)
      // Never force a default — let the hash or landing page decide
    })
    return unsub
  }, [])

  const article = articles[currentId]

  const logChange = async (action, articleTitle, summary='') => {
    await addDoc(collection(db,'changelog'), {
      action, articleTitle, summary,
      userName: user.displayName || user.email,
      userId: user.uid,
      timestamp: serverTimestamp(),
    })
  }

  const slugify = t => t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')

  const saveNew = async () => {
    if (!newArt.title.trim()) return
    const id = slugify(newArt.title)
    await setDoc(doc(db,'articles',id), {
      ...newArt, id,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      updatedBy: user.displayName || user.email,
    })
    await logChange('created', newArt.title)
    setCurrentId(id); setCreating(false)
    setNewArt({ title:'',category:'Lore & History',subtitle:'',content:'',infobox:{} })
  }

  const saveEdit = async () => {
    await setDoc(doc(db,'articles',editDraft.id), {
      ...editDraft,
      updatedAt: serverTimestamp(),
      updatedBy: user.displayName || user.email,
    })
    await logChange('edited', editDraft.title)
    setCurrentId(editDraft.id)
    setEditing(false)
    setEditDraft(null)
  }

  const deleteArticle = async id => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    const title = articles[id]?.title || id
    await deleteDoc(doc(db,'articles',id))
    await logChange('deleted', title)
    const remaining = Object.keys(articles).filter(k=>k!==id)
    setCurrentId(remaining[0]||null); setEditing(false)
  }

  const filtered = Object.values(articles).filter(a =>
    search==='' || a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.content||'').replace(/<[^>]*>/g,'').toLowerCase().includes(search.toLowerCase())
  )

  // Build full category tree, merging in any categories from articles not yet in tree
  const allFlat = flattenCategories(categories)
  const catTree = [...categories.map(c => ({...c, subcategories:[...c.subcategories]}))]
  Object.values(articles).forEach(a => {
    if (!a.category) return
    if (a.category.includes(' > ')) {
      const [parent, sub] = a.category.split(' > ')
      let node = catTree.find(c => c.name === parent)
      if (!node) { node = { name: parent, subcategories: [] }; catTree.push(node) }
      if (!node.subcategories.includes(sub)) node.subcategories.push(sub)
    } else if (!catTree.find(c => c.name === a.category)) {
      catTree.push({ name: a.category, subcategories: [] })
    }
  })

  const byCategory = {}
  catTree.forEach(c => {
    byCategory[c.name] = filtered.filter(a => a.category === c.name)
    c.subcategories.forEach(s => {
      byCategory[`${c.name} > ${s}`] = filtered.filter(a => a.category === `${c.name} > ${s}`)
    })
  })

  const addCategory = () => {
    const name = newCatInput.trim()
    if (!name || categories.find(c=>c.name===name)) return
    setCategories(c => [...c, { name, subcategories: [] }])
    setNewCatInput('')
    setShowNewCatInput(false)
  }

  const addSubcategory = (catIdx, subName) => {
    const name = subName.trim()
    if (!name) return
    setCategories(cats => cats.map((c,i) =>
      i === catIdx && !c.subcategories.includes(name)
        ? { ...c, subcategories: [...c.subcategories, name] }
        : c
    ))
  }

  const renameCategory = (catIdx, newName) => {
    const old = categories[catIdx].name
    const trimmed = newName.trim()
    if (!trimmed || trimmed === old) return
    // Update articles that use this category
    Object.values(articles).forEach(async a => {
      if (a.category === old) {
        await setDoc(doc(db,'articles',a.id), {...a, category: trimmed}, {merge:true})
      }
      if (a.category && a.category.startsWith(old + ' > ')) {
        const newCat = trimmed + ' > ' + a.category.slice(old.length + 3)
        await setDoc(doc(db,'articles',a.id), {...a, category: newCat}, {merge:true})
      }
    })
    setCategories(cats => cats.map((c,i) => i === catIdx ? { ...c, name: trimmed } : c))
  }

  const renameSubcategory = (catIdx, subIdx, newName) => {
    const parentName = categories[catIdx].name
    const oldSub = categories[catIdx].subcategories[subIdx]
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldSub) return
    Object.values(articles).forEach(async a => {
      if (a.category === `${parentName} > ${oldSub}`) {
        await setDoc(doc(db,'articles',a.id), {...a, category: `${parentName} > ${trimmed}`}, {merge:true})
      }
    })
    setCategories(cats => cats.map((c,i) =>
      i === catIdx
        ? { ...c, subcategories: c.subcategories.map((s,si) => si === subIdx ? trimmed : s) }
        : c
    ))
  }

  const toggleCat = key => setCollapsedCats(p => ({...p, [key]: !p[key]}))
  const navTo = id => { setCurrentId(id); setEditing(false); setCreating(false); if (isMobile) setSidebarOpen(false) }
  const allFlatCategories = flattenCategories(catTree)

  // Sort articles within each category by their order field
  Object.keys(byCategory).forEach(key => {
    byCategory[key].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
  })

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onArticleDragStart = (e, articleId, fromCategory) => {
    setDragArticle({ id: articleId, fromCategory })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', articleId)
  }

  const onArticleDragEnd = () => {
    setDragArticle(null); setDragOverCat(null); setDragOverArticle(null)
  }

  const onCatDragOver = (e, catKey) => {
    e.preventDefault(); e.stopPropagation()
    setDragOverCat(catKey); setDragOverArticle(null)
  }

  const onArticleDragOver = (e, articleId) => {
    e.preventDefault(); e.stopPropagation()
    setDragOverArticle(articleId); setDragOverCat(null)
  }

  const onDropOnCategory = async (e, targetCategory) => {
    e.preventDefault()
    if (!dragArticle) return
    const { id, fromCategory } = dragArticle
    setDragArticle(null); setDragOverCat(null); setDragOverArticle(null)
    if (targetCategory === fromCategory) return
    // Move article to new category, place at end
    const articlesInTarget = byCategory[targetCategory] || []
    const maxOrder = articlesInTarget.reduce((m, a) => Math.max(m, a.order ?? 0), 0)
    await setDoc(doc(db, 'articles', id), { category: targetCategory, order: maxOrder + 1 }, { merge: true })
  }

  const onDropOnArticle = async (e, targetArticleId, targetCategory) => {
    e.preventDefault()
    if (!dragArticle) return
    const { id: dragId } = dragArticle
    setDragArticle(null); setDragOverCat(null); setDragOverArticle(null)
    if (dragId === targetArticleId) return
    // Reorder: insert dragId before targetArticleId in targetCategory
    const list = [...(byCategory[targetCategory] || [])]
    const filtered = list.filter(a => a.id !== dragId)
    const targetIdx = filtered.findIndex(a => a.id === targetArticleId)
    filtered.splice(targetIdx, 0, articles[dragId] || { id: dragId })
    // Write new order values
    const batch = []
    filtered.forEach((a, i) => {
      batch.push(setDoc(doc(db, 'articles', a.id), { category: targetCategory, order: i }, { merge: true }))
    })
    await Promise.all(batch)
  }

  // Category drag-to-reorder
  const onCatHeaderDragStart = (e, catIdx) => {
    setDragCatIdx(catIdx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', 'cat:' + catIdx)
  }

  const onCatHeaderDragOver = (e, catIdx) => {
    e.preventDefault(); setDragOverCatIdx(catIdx)
  }

  const onCatHeaderDrop = (e, targetIdx) => {
    e.preventDefault()
    if (dragCatIdx === null || dragCatIdx === targetIdx) { setDragCatIdx(null); setDragOverCatIdx(null); return }
    setCategories(cats => {
      const next = [...cats]
      const [moved] = next.splice(dragCatIdx, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
    setDragCatIdx(null); setDragOverCatIdx(null)
  }

  const onCatHeaderDragEnd = () => { setDragCatIdx(null); setDragOverCatIdx(null) }

  const closeSidebarOnMobile = () => { if (isMobile) setSidebarOpen(false) }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f8f7f4',color:'#222'}}>
      {/* Header */}
      <header style={{background:'#f8f7f4',borderBottom:'1px solid #ccc9c0',padding:'0 0.75rem',display:'flex',alignItems:'center',gap:'0.5rem',height:50,flexShrink:0}}>
        <button onClick={()=>setSidebarOpen(s=>!s)} style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:'1.1rem',padding:'4px 6px',flexShrink:0}}>☰</button>
        <span onClick={()=>{setCurrentId(null);setEditing(false);setCreating(false)}} style={{fontFamily:"'IM Fell English',serif",fontSize:'1.3rem',color:'#1b4f72',flexShrink:0,cursor:'pointer'}} title='Return to home'>Qærn</span>
        {!isMobile && <span style={{fontSize:'0.67rem',color:'#888',textTransform:'uppercase',letterSpacing:'0.1em'}}>The Living Wiki</span>}
        <div style={{flex:1}}/>
        {!isMobile && <PresenceBubbles online={online} currentUser={user}/>}
        {!isMobile && (
          <input placeholder='Search…' value={search} onChange={e=>setSearch(e.target.value)}
            style={{padding:'4px 10px',border:'1px solid #ccc9c0',borderRadius:3,fontSize:'0.82rem',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f0eeea',color:'#222',width:160}}/>
        )}
        {!isMobile && (
          <button onClick={()=>setShowChangelog(s=>!s)}
            style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555',flexShrink:0}}>📋 Changelog</button>
        )}
        {!isMobile && (
          <button onClick={()=>{ setShowTracker(true); history.replaceState(null,'','#tracker') }}
            style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555',flexShrink:0}}>📊 Tracker</button>
        )}
        {!isMobile && (
          <button onClick={()=>{ setShowBulletin(true); history.replaceState(null,'','#bulletin') }}
            style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555',flexShrink:0}}>📋 Bulletin</button>
        )}
        {!isMobile && (
          <button onClick={()=>{ setShowInitiative(true); history.replaceState(null,'','#initiative') }}
            style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555',flexShrink:0}}>⚔ Initiative</button>
        )}
        {!isMobile && (
          <button onClick={()=>{ setShowHexMap(true); history.replaceState(null,'','#map') }}
            style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555',flexShrink:0}}>🗺 Map</button>
        )}
        {!isMobile && (
          <button onClick={()=>{ setShowDowntime(true); history.replaceState(null,'','#downtime') }}
            style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555',flexShrink:0}}>🌙 Downtime</button>
        )}
        {!isMobile && (
          <button onClick={()=>{ setShowChat(true); history.replaceState(null,'','#forum') }}
            style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555',flexShrink:0}}>💬 Forum</button>
        )}
        {!isMobile && (
          <button onClick={()=>{setCreating(true);setEditing(false)}}
            style={{padding:'5px 14px',borderRadius:3,border:'none',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.83rem',background:'#1b4f72',color:'#fff',flexShrink:0}}>+ New Article</button>
        )}
        <div style={{display:'flex',alignItems:'center',gap:isMobile?4:6,borderLeft:'1px solid #ccc9c0',paddingLeft:isMobile?'0.5rem':'0.75rem',marginLeft:isMobile?0:4}}>
          <div onClick={()=>setShowSettings(true)}
            style={{width:28,height:28,borderRadius:'50%',background:effectiveColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.68rem',fontWeight:700,color:'#fff',flexShrink:0,cursor:'pointer',title:'Settings'}}>{initials(user.displayName||user.email)}</div>
          {!isMobile && <span style={{fontSize:'0.8rem',color:'#555',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.displayName||user.email}</span>}
          {!isMobile && <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.85rem',color:'#aaa',padding:'0 2px'}} title='Settings'>⚙</button>}
          <button onClick={logout} style={{padding:'3px 8px',border:'1px solid #ccc9c0',borderRadius:3,background:'none',cursor:'pointer',fontSize:'0.75rem',color:'#888'}}>Sign out</button>
        </div>
      </header>

      {/* Mobile search bar */}
      {isMobile && (
        <div style={{padding:'6px 10px',borderBottom:'1px solid #e8e5e0',background:'#f8f7f4',display:'flex',gap:6}}>
          <input placeholder='Search articles…' value={search} onChange={e=>setSearch(e.target.value)}
            style={{flex:1,padding:'6px 10px',border:'1px solid #ccc9c0',borderRadius:4,fontSize:'0.88rem',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f0eeea',color:'#222'}}/>
        </div>
      )}

      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>
        {/* Sidebar — slide-over on mobile, fixed panel on desktop */}
        {isMobile && sidebarOpen && (
          <div onClick={()=>setSidebarOpen(false)}
            style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.35)',zIndex:50}}/>
        )}
        {sidebarOpen&&(
          <aside style={{
            ...(isMobile ? {
              position:'absolute',top:0,left:0,bottom:0,zIndex:51,
              width:'80vw',maxWidth:300,boxShadow:'4px 0 20px rgba(0,0,0,0.15)',
            } : {
              width:230,flexShrink:0,
            }),
            background:'#f0eeea',borderRight:'1px solid #ccc9c0',
            overflowY:'auto',padding:'0.6rem 0',display:'flex',flexDirection:'column',
          }}>
            <div style={{flex:1}}>
              {catTree.map((cat, catIdx) => {
                const catCollapsed = !!collapsedCats[cat.name]
                const isEditingCatName = editingCat?.type==='cat' && editingCat.catIdx===catIdx
                const isCatDropTarget = dragArticle && dragOverCat === cat.name
                const isCatBeingDragged = dragCatIdx === catIdx
                const isCatDragOver = dragOverCatIdx === catIdx && dragCatIdx !== null && dragCatIdx !== catIdx

                const renderArticle = (a, indent, targetCat) => {
                  const isActive = currentId===a.id&&!creating
                  const editingUsers = Object.values(online).filter(u=>u.articleId===a.id&&u.editing)
                  const isDropTarget = dragArticle && dragOverArticle === a.id
                  return (
                    <div key={a.id}
                      draggable
                      onDragStart={e=>onArticleDragStart(e, a.id, targetCat)}
                      onDragEnd={onArticleDragEnd}
                      onDragOver={e=>onArticleDragOver(e, a.id)}
                      onDrop={e=>onDropOnArticle(e, a.id, targetCat)}
                      onClick={()=>navTo(a.id)}
                      style={{padding:`3px 10px 3px ${indent}px`,cursor:'grab',fontSize:'0.84rem',lineHeight:1.45,
                        display:'flex',alignItems:'center',gap:4,userSelect:'none',
                        background:isDropTarget?'#d4e8f0':isActive?'#e2dfd8':'transparent',
                        color:isActive?'#1b4f72':'#222',
                        fontWeight:isActive?600:400,
                        borderLeft:isDropTarget?'3px solid #1b9bc8':isActive?'3px solid #1b4f72':'3px solid transparent',
                        borderTop:isDropTarget?'2px solid #1b9bc8':'none',
                        opacity:dragArticle?.id===a.id?0.4:1,
                        transition:'background 0.1s,border-color 0.1s'}}>
                      <span style={{color:'#ccc',fontSize:'0.65rem',cursor:'grab',flexShrink:0,marginRight:2}}>⠿</span>
                      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</span>
                      {editingUsers.length>0&&<span style={{width:7,height:7,borderRadius:'50%',background:'#f5a623',flexShrink:0}}/>}
                    </div>
                  )
                }

                return (
                  <div key={cat.name}
                    style={{marginBottom:'0.15rem',opacity:isCatBeingDragged?0.4:1,
                      borderTop:isCatDragOver?'2px solid #1b4f72':'2px solid transparent',
                      transition:'border-color 0.1s'}}
                    onDragOver={e=>onCatHeaderDragOver(e, catIdx)}
                    onDrop={e=>onCatHeaderDrop(e, catIdx)}>

                    {/* Category header */}
                    <div
                      onDragOver={e=>onCatDragOver(e, cat.name)}
                      onDrop={e=>onDropOnCategory(e, cat.name)}
                      style={{display:'flex',alignItems:'center',padding:'5px 6px 2px 8px',gap:2,
                        background:isCatDropTarget?'#ddeeff':'transparent',
                        borderRadius:isCatDropTarget?3:0,transition:'background 0.1s'}}>
                      {/* Category drag handle */}
                      <span
                        draggable
                        onDragStart={e=>onCatHeaderDragStart(e,catIdx)}
                        onDragEnd={onCatHeaderDragEnd}
                        title='Drag to reorder category'
                        style={{color:'#ccc',fontSize:'0.65rem',cursor:'grab',flexShrink:0,padding:'0 2px',userSelect:'none'}}>⠿</span>
                      <button onClick={()=>toggleCat(cat.name)} title={catCollapsed?'Expand':'Collapse'}
                        style={{background:'none',border:'none',cursor:'pointer',color:'#aaa',fontSize:'0.58rem',padding:'0 2px',lineHeight:1,flexShrink:0}}>
                        {catCollapsed?'▶':'▼'}
                      </button>
                      {isEditingCatName
                        ? <input autoFocus value={editingCat.value}
                            onChange={e=>setEditingCat(p=>({...p,value:e.target.value}))}
                            onBlur={()=>{ renameCategory(catIdx, editingCat.value); setEditingCat(null) }}
                            onKeyDown={e=>{ if(e.key==='Enter'){renameCategory(catIdx,editingCat.value);setEditingCat(null)} if(e.key==='Escape')setEditingCat(null) }}
                            style={{flex:1,fontSize:'0.63rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',padding:'1px 4px',border:'1px solid #1b4f72',borderRadius:2,background:'#fff',color:'#222',minWidth:0}}/>
                        : <span style={{fontSize:'0.63rem',textTransform:'uppercase',letterSpacing:'0.08em',color:'#888',fontWeight:700,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat.name}</span>
                      }
                      {!isEditingCatName && <button onClick={()=>setEditingCat({type:'cat',catIdx,value:cat.name})} title='Rename category'
                        style={{background:'none',border:'none',cursor:'pointer',color:'#bbb',fontSize:'0.6rem',padding:'0 1px',lineHeight:1,flexShrink:0,opacity:0.7}}>✎</button>}
                      <button onClick={()=>setNewSubInput(newSubInput===catIdx?null:catIdx)} title='Add subcategory'
                        style={{background:'none',border:'none',cursor:'pointer',color:'#bbb',fontSize:'0.72rem',padding:'0 1px',lineHeight:1,flexShrink:0,opacity:0.7}}>⊕</button>
                    </div>

                    {newSubInput===catIdx && (
                      <div style={{display:'flex',gap:3,padding:'3px 8px 3px 22px'}}>
                        <input autoFocus placeholder='Subcategory name…'
                          onKeyDown={e=>{
                            if(e.key==='Enter'){ addSubcategory(catIdx,e.target.value); setNewSubInput(null) }
                            if(e.key==='Escape') setNewSubInput(null)
                          }}
                          style={{flex:1,padding:'2px 5px',border:'1px solid #ccc9c0',borderRadius:3,fontSize:'0.75rem',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f8f7f4',color:'#222',minWidth:0}}/>
                        <button onClick={e=>{ const inp=e.target.previousSibling; addSubcategory(catIdx,inp.value); setNewSubInput(null) }}
                          style={{padding:'2px 6px',border:'none',borderRadius:3,background:'#1b4f72',color:'#fff',cursor:'pointer',fontSize:'0.72rem'}}>+</button>
                      </div>
                    )}

                    {!catCollapsed && (
                      <>
                        {byCategory[cat.name]?.length===0 && cat.subcategories.length===0 && !isCatDropTarget &&
                          <div style={{fontSize:'0.78rem',color:'#aaa',padding:'2px 12px 2px 28px',fontStyle:'italic'}}>—</div>}
                        {byCategory[cat.name]?.map(a => renderArticle(a, 28, cat.name))}

                        {cat.subcategories.map((sub, subIdx) => {
                          const subKey = cat.name + ' > ' + sub
                          const subCollapsed = !!collapsedCats[subKey]
                          const isEditingSub = editingCat?.type==='sub' && editingCat.catIdx===catIdx && editingCat.subIdx===subIdx
                          const isSubDropTarget = dragArticle && dragOverCat === subKey
                          return (
                            <div key={subKey}>
                              <div
                                onDragOver={e=>onCatDragOver(e, subKey)}
                                onDrop={e=>onDropOnCategory(e, subKey)}
                                style={{display:'flex',alignItems:'center',padding:'3px 6px 2px 22px',gap:2,
                                  background:isSubDropTarget?'#ddeeff':'transparent',
                                  borderRadius:isSubDropTarget?3:0,transition:'background 0.1s'}}>
                                <button onClick={()=>toggleCat(subKey)}
                                  style={{background:'none',border:'none',cursor:'pointer',color:'#bbb',fontSize:'0.55rem',padding:'0 2px',lineHeight:1,flexShrink:0}}>
                                  {subCollapsed?'▶':'▼'}
                                </button>
                                {isEditingSub
                                  ? <input autoFocus value={editingCat.value}
                                      onChange={e=>setEditingCat(p=>({...p,value:e.target.value}))}
                                      onBlur={()=>{ renameSubcategory(catIdx,subIdx,editingCat.value); setEditingCat(null) }}
                                      onKeyDown={e=>{ if(e.key==='Enter'){renameSubcategory(catIdx,subIdx,editingCat.value);setEditingCat(null)} if(e.key==='Escape')setEditingCat(null) }}
                                      style={{flex:1,fontSize:'0.6rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',padding:'1px 4px',border:'1px solid #1b4f72',borderRadius:2,background:'#fff',color:'#222',minWidth:0}}/>
                                  : <span style={{fontSize:'0.6rem',textTransform:'uppercase',letterSpacing:'0.07em',color:'#999',fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>↳ {sub}</span>
                                }
                                {!isEditingSub && <button onClick={()=>setEditingCat({type:'sub',catIdx,subIdx,value:sub})} title='Rename subcategory'
                                  style={{background:'none',border:'none',cursor:'pointer',color:'#ccc',fontSize:'0.58rem',padding:'0 1px',lineHeight:1,flexShrink:0,opacity:0.7}}>✎</button>}
                              </div>
                              {!subCollapsed && (
                                <>
                                  {byCategory[subKey]?.length===0 && !isSubDropTarget &&
                                    <div style={{fontSize:'0.78rem',color:'#aaa',padding:'2px 12px 2px 34px',fontStyle:'italic'}}>—</div>}
                                  {byCategory[subKey]?.map(a => renderArticle(a, 34, subKey))}
                                </>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {/* New top-level category */}
            <div style={{borderTop:'1px solid #ccc9c0',padding:'6px 8px'}}>
              {showNewCatInput
                ? <div style={{display:'flex',gap:4}}>
                    <input autoFocus value={newCatInput} onChange={e=>setNewCatInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')addCategory();if(e.key==='Escape'){setShowNewCatInput(false);setNewCatInput('')}}}
                      placeholder='Category name…'
                      style={{flex:1,padding:'3px 6px',border:'1px solid #ccc9c0',borderRadius:3,fontSize:'0.78rem',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f8f7f4',color:'#222',minWidth:0}}/>
                    <button onClick={addCategory} style={{padding:'3px 7px',border:'none',borderRadius:3,background:'#1b4f72',color:'#fff',cursor:'pointer',fontSize:'0.75rem'}}>+</button>
                    <button onClick={()=>{setShowNewCatInput(false);setNewCatInput('')}} style={{padding:'3px 6px',border:'1px solid #ccc9c0',borderRadius:3,background:'none',cursor:'pointer',fontSize:'0.75rem',color:'#888'}}>✕</button>
                  </div>
                : <button onClick={()=>setShowNewCatInput(true)}
                    style={{width:'100%',padding:'4px 8px',border:'1px dashed #ccc9c0',borderRadius:3,background:'none',cursor:'pointer',fontSize:'0.75rem',color:'#888',textAlign:'left',fontFamily:"'Source Serif 4',Georgia,serif"}}>
                    + New Category
                  </button>
              }
            </div>
            {/* Sidebar action buttons */}
            <div style={{borderTop:'1px solid #ccc9c0',padding:'6px 8px',display:'flex',flexDirection:'column',gap:4}}>
              <button onClick={()=>{setCreating(true);setEditing(false);if(isMobile)setSidebarOpen(false)}}
                style={{width:'100%',padding:'6px 8px',border:'none',borderRadius:3,background:'#1b4f72',color:'#fff',cursor:'pointer',fontSize:'0.8rem',fontFamily:"'Source Serif 4',Georgia,serif",textAlign:'left'}}>
                ✍ New Article
              </button>
              <button onClick={()=>setShowChangelog(s=>!s)}
                style={{width:'100%',padding:'5px 8px',border:'1px solid #ccc9c0',borderRadius:3,background:'none',cursor:'pointer',fontSize:'0.78rem',fontFamily:"'Source Serif 4',Georgia,serif",color:'#666',textAlign:'left'}}>
                📋 Changelog
              </button>
            </div>
          </aside>
        )}

        {/* Main */}
        <main style={{flex:1,overflowY:'auto',padding:isMobile?'1rem':'1.5rem 2rem'}}>
          {articlesLoaded && Object.keys(articles).length===0 && !creating && (
            <SeedButton onSeed={()=>{}}/>
          )}
          {creating&&<EditForm draft={newArt} setDraft={setNewArt} onSave={saveNew} onCancel={()=>setCreating(false)} isNew categories={allFlatCategories}/>}
          {!creating&&editing&&editDraft&&(
            <EditForm draft={editDraft} setDraft={setEditDraft} onSave={saveEdit} onCancel={()=>{setEditing(false);setEditDraft(null)}} onDelete={()=>deleteArticle(editDraft.id)} categories={allFlatCategories}/>
          )}
          {!creating&&!editing&&article&&(
            <ArticleView article={article} onlineUsers={online} articles={articles} onNavigate={navTo}
              onEdit={()=>{setEditDraft(JSON.parse(JSON.stringify(article)));setEditing(true)}}
              onDelete={()=>deleteArticle(article.id)}/>
          )}
          {!creating&&!editing&&!article&&articlesLoaded&&Object.keys(articles).length>0&&(
            <div style={{position:'relative',minHeight:'100%',background:'#000',overflow:'hidden',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start'}}>
              {/* Starfield — seeded LCG scatter */}
              <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0}}>
                <svg width='100%' height='100%' style={{position:'absolute',inset:0}}>
                  {(()=>{
                    const stars=[]
                    let s=42
                    const rnd=()=>{ s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/0xffffffff }
                    for(let i=0;i<220;i++){
                      const x=rnd()*100, y=rnd()*100
                      const r=rnd()<0.08?1.5:rnd()<0.3?1:0.55
                      const op=0.25+rnd()*0.7
                      stars.push(<circle key={i} cx={x+'%'} cy={y+'%'} r={r} fill='#fff' opacity={op}/>)
                    }
                    return stars
                  })()}
                </svg>
              </div>
              {/* Planet + moons */}
              <div style={{position:'relative',width:isMobile?260:360,height:isMobile?260:360,margin:'3rem auto 1.5rem',flexShrink:0,zIndex:1}}>
                <div style={{position:'absolute',inset:0,animation:'orbit1 8s linear infinite',transformOrigin:'50% 50%'}}>
                  <div style={{position:'absolute',top:'50%',left:'50%',transform:`translate(-50%,-50%) translateX(${isMobile?148:200}px)`}}>
                    <div style={{width:isMobile?12:16,height:isMobile?12:16,borderRadius:'50%',background:'#c8b87a',boxShadow:'0 0 8px rgba(200,184,122,0.5)'}}/>
                  </div>
                </div>
                <div style={{position:'absolute',inset:0,animation:'orbit2 18s linear infinite',transformOrigin:'50% 50%'}}>
                  <div style={{position:'absolute',top:'50%',left:'50%',transform:`translate(-50%,-50%) translateX(${isMobile?170:230}px)`}}>
                    <div style={{width:isMobile?7:10,height:isMobile?7:10,borderRadius:'50%',background:'#8899aa',boxShadow:'0 0 6px rgba(136,153,170,0.4)'}}/>
                  </div>
                </div>
                <div style={{position:'absolute',inset:0,animation:'orbit3 12s linear infinite reverse',transformOrigin:'50% 50%'}}>
                  <div style={{position:'absolute',top:'50%',left:'50%',transform:`translate(-50%,-50%) translateX(${isMobile?130:175}px) translateY(${isMobile?20:28}px)`}}>
                    <div style={{width:isMobile?5:7,height:isMobile?5:7,borderRadius:'50%',background:'#cc9966',boxShadow:'0 0 5px rgba(204,153,102,0.4)'}}/>
                  </div>
                </div>
                <img src='/qaern-planet.png' alt='Qærn'
                  style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',
                    filter:'drop-shadow(0 0 32px rgba(80,180,80,0.25))',
                    animation:'slowspin 120s linear infinite'}}/>
              </div>

              <div style={{textAlign:'center',zIndex:1,padding:'0 1rem 2rem'}}>
                <div style={{fontFamily:"'IM Fell English',serif",fontSize:isMobile?'2.6rem':'3.5rem',color:'#d4eed4',lineHeight:1,marginBottom:'0.35rem',textShadow:'0 0 30px rgba(80,200,80,0.3)'}}>Qærn</div>
                <div style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.2em',color:'#4a7a4a',marginBottom:'1.5rem'}}>The Living Wiki</div>
                <p style={{fontFamily:"'IM Fell English',serif",fontSize:'0.95rem',color:'#556655',lineHeight:1.8,fontStyle:'italic',margin:'0 auto',maxWidth:400}}>
                  "Three stars. Dig to crack the heart. Peace above all else."
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {showChangelog&&<ChangelogPanel onClose={()=>setShowChangelog(false)}/>}

      {/* Mobile bottom toolbar */}
      {isMobile && (
        <MobileToolbar
          onArticles={()=>setSidebarOpen(s=>!s)}
          onBulletin={()=>{ setShowBulletin(true);   history.replaceState(null,'','#bulletin') }}
          onInitiative={()=>{ setShowInitiative(true); history.replaceState(null,'','#initiative') }}
          onTracker={()=>{ setShowTracker(true);    history.replaceState(null,'','#tracker') }}
          onMap={()=>{ setShowHexMap(true);         history.replaceState(null,'','#map') }}
          onDowntime={()=>{ setShowDowntime(true);  history.replaceState(null,'','#downtime') }}
          onForum={()=>{ setShowChat(true);         history.replaceState(null,'','#forum') }}
          onChangelog={()=>setShowChangelog(s=>!s)}
        />
      )}

      {showTracker    && <Tracker         user={user} onClose={()=>{ setShowTracker(false);    history.replaceState(null,'',window.location.pathname) }}/>}
      {showBulletin   && <BulletinBoard   user={user} onClose={()=>{ setShowBulletin(false);   history.replaceState(null,'',window.location.pathname) }}/>}
      {showInitiative && <InitiativeTracker user={user} onClose={()=>{ setShowInitiative(false); history.replaceState(null,'',window.location.pathname) }}/>}
      {showHexMap     && <HexMap          user={user} onClose={()=>{ setShowHexMap(false);     history.replaceState(null,'',window.location.pathname) }}/>}
      {showDowntime   && <Downtime        user={user} onClose={()=>{ setShowDowntime(false);   history.replaceState(null,'',window.location.pathname) }}/>}
      {showChat       && <Chat            user={user} onClose={()=>{ setShowChat(false);       history.replaceState(null,'',window.location.pathname) }}/>}

      {showSettings && <UserSettings user={user} updateUser={updateUser} currentColor={effectiveColor} onClose={()=>setShowSettings(false)}/>}

      <WikiKeeper
        articles={articles}
        user={user}
        onArticleChanged={id => { setCurrentId(id); setEditing(false); setCreating(false) }}
      />
    </div>
  )
}
