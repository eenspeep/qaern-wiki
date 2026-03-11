import { useState, useEffect, useRef } from 'react'
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  addDoc, query, orderBy, limit, serverTimestamp, writeBatch, getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './AuthContext'
import { usePresence, uidColor, initials } from './usePresence'
import { INITIAL_ARTICLES } from './seedData'

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = ['Lore & History', 'Peoples', 'Locations', 'Factions']
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
function ArticleView({ article, onEdit, onDelete, onlineUsers }) {
  const hasInfo = (article.infobox && Object.keys(article.infobox).length > 0) || article.portrait
  // Who else is reading this article?
  const readers = Object.entries(onlineUsers).filter(([,u])=>u.articleId===article.id&&!u.editing)
  const editors = Object.entries(onlineUsers).filter(([,u])=>u.articleId===article.id&&u.editing)

  return (
    <div style={{maxWidth:780}}>
      <div style={{borderBottom:'1px solid #ccc9c0',marginBottom:'1rem',paddingBottom:'0.5rem'}}>
        <div style={{fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'#666',marginBottom:2}}>{article.category}</div>
        <h1 style={{fontFamily:"'IM Fell English',serif",fontSize:'1.95rem',color:'#1a1a1a',lineHeight:1.15}}>{article.title}</h1>
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
        <div style={{float:'right',width:244,marginLeft:'1.5rem',marginBottom:'1rem',background:'#eeecea',border:'1px solid #ccc9c0',borderRadius:4,padding:'0.7rem',fontSize:'0.82rem'}}>
          <div style={{fontFamily:"'IM Fell English',serif",fontWeight:600,fontSize:'0.88rem',marginBottom:6,borderBottom:'1px solid #ccc9c0',paddingBottom:4,color:'#1b4f72'}}>{article.title}</div>
          {/* Portrait */}
          <div style={{textAlign:'center',marginBottom:8}}>
            {article.portrait
              ? <img src={article.portrait} alt={article.title} style={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:3,border:'1px solid #ccc9c0',display:'block'}}/>
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
      <div className='article-body' style={{fontSize:'0.91rem'}} dangerouslySetInnerHTML={{__html:article.content}}/>
      <div style={{clear:'both'}}/>
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
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 1rem'}}>
              <div><label style={lb}>Title</label><input style={inp} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} placeholder='e.g. The Worldheart'/></div>
              <div><label style={lb}>Category</label><select style={inp} value={draft.category} onChange={e=>setDraft(p=>({...p,category:e.target.value}))}>{(categories||DEFAULT_CATEGORIES).map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <label style={lb}>Subtitle / Tagline</label>
            <input style={inp} value={draft.subtitle||''} onChange={e=>setDraft(p=>({...p,subtitle:e.target.value}))} placeholder='e.g. Mythic Treasure of Dwarvenkind'/>
            <label style={{...lb,marginTop:14}}>Infobox</label>
            <div style={{marginBottom:8}}>
              <label style={lb}>Portrait Image URL</label>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <input style={{...inp,marginBottom:0,flex:1}} value={draft.portrait||''} onChange={e=>setDraft(p=>({...p,portrait:e.target.value}))} placeholder='https://… (leave blank for grey placeholder)'/>
                <div style={{width:56,height:56,flexShrink:0,borderRadius:3,border:'1px solid #ccc9c0',overflow:'hidden',background:'#d8d4cc',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {draft.portrait
                    ? <img src={draft.portrait} alt='' style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <span style={{fontSize:'1.5rem',color:'#a09890'}}>?</span>
                  }
                </div>
              </div>
            </div>
            <InfoboxEditor infobox={draft.infobox||{}} onChange={ib=>setDraft(p=>({...p,infobox:ib}))}/>
            <label style={{...lb,marginTop:14}}>Article Body</label>
            <RichEditor value={draft.content||''} onChange={html=>setDraft(p=>({...p,content:html}))}/>
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

// ─── Presence Bubbles ─────────────────────────────────────────────────────────
function PresenceBubbles({ online, currentUser }) {
  const others = Object.entries(online).filter(([uid])=>uid!==currentUser?.uid)
  if (others.length===0) return null
  return (
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      {others.slice(0,8).map(([uid,u])=>(
        <div key={uid} title={`${u.displayName}${u.editing?' (editing)':' (reading)'}`}
          style={{width:30,height:30,borderRadius:'50%',background:u.color,display:'flex',alignItems:'center',justifyContent:'center',
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

// ─── Main Wiki App ────────────────────────────────────────────────────────────
export default function WikiApp() {
  const { user, logout } = useAuth()
  const [articles, setArticles] = useState({})
  const [articlesLoaded, setArticlesLoaded] = useState(false)
  const [currentId, setCurrentId] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newArt, setNewArt] = useState({ title:'',category:'Lore & History',subtitle:'',content:'',infobox:{} })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showChangelog, setShowChangelog] = useState(false)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [collapsedCats, setCollapsedCats] = useState({})
  const [newCatInput, setNewCatInput] = useState('')
  const [showNewCatInput, setShowNewCatInput] = useState(false)

  const online = usePresence(user, currentId, editing)

  // Real-time articles subscription
  useEffect(() => {
    const unsub = onSnapshot(collection(db,'articles'), snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.id] = { id:d.id, ...d.data() } })
      setArticles(map)
      setArticlesLoaded(true)
      if (!currentId && snap.docs.length > 0) setCurrentId(snap.docs[0].id)
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
    setEditing(false); setEditDraft(null)
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
  // Merge in any categories from articles that aren't in our list yet
  const allCategories = [...categories]
  Object.values(articles).forEach(a => { if (a.category && !allCategories.includes(a.category)) allCategories.push(a.category) })
  const byCategory = allCategories.reduce((acc,cat) => {
    acc[cat] = filtered.filter(a=>a.category===cat); return acc
  }, {})

  const addCategory = () => {
    const name = newCatInput.trim()
    if (!name || categories.includes(name)) return
    setCategories(c => [...c, name])
    setNewCatInput('')
    setShowNewCatInput(false)
  }
  const toggleCat = cat => setCollapsedCats(p => ({...p, [cat]: !p[cat]}))
  const navTo = id => { setCurrentId(id); setEditing(false); setCreating(false) }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f8f7f4',color:'#222'}}>
      {/* Header */}
      <header style={{background:'#f8f7f4',borderBottom:'1px solid #ccc9c0',padding:'0 1rem',display:'flex',alignItems:'center',gap:'0.75rem',height:50,flexShrink:0}}>
        <button onClick={()=>setSidebarOpen(s=>!s)} style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:'1rem',padding:'4px 5px'}}>☰</button>
        <span style={{fontFamily:"'IM Fell English',serif",fontSize:'1.3rem',color:'#1b4f72'}}>Qærn</span>
        <span style={{fontSize:'0.67rem',color:'#888',textTransform:'uppercase',letterSpacing:'0.1em'}}>The Living Wiki</span>
        <div style={{flex:1}}/>
        <PresenceBubbles online={online} currentUser={user}/>
        <input placeholder='Search…' value={search} onChange={e=>setSearch(e.target.value)}
          style={{padding:'4px 10px',border:'1px solid #ccc9c0',borderRadius:3,fontSize:'0.82rem',fontFamily:"'Source Serif 4',Georgia,serif",background:'#f0eeea',color:'#222',width:180}}/>
        <button onClick={()=>setShowChangelog(s=>!s)}
          style={{padding:'5px 10px',borderRadius:3,border:'1px solid #ccc9c0',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.8rem',background:'#f0eeea',color:'#555'}}>📋 Changelog</button>
        <button onClick={()=>{setCreating(true);setEditing(false)}}
          style={{padding:'5px 14px',borderRadius:3,border:'none',cursor:'pointer',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.83rem',background:'#1b4f72',color:'#fff'}}>+ New Article</button>
        <div style={{display:'flex',alignItems:'center',gap:6,borderLeft:'1px solid #ccc9c0',paddingLeft:'0.75rem',marginLeft:4}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:uidColor(user.uid),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.68rem',fontWeight:700,color:'#fff',flexShrink:0}}>{initials(user.displayName||user.email)}</div>
          <span style={{fontSize:'0.8rem',color:'#555',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.displayName||user.email}</span>
          <button onClick={logout} style={{padding:'3px 8px',border:'1px solid #ccc9c0',borderRadius:3,background:'none',cursor:'pointer',fontSize:'0.75rem',color:'#888'}}>Sign out</button>
        </div>
      </header>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Sidebar */}
        {sidebarOpen&&(
          <aside style={{width:220,background:'#f0eeea',borderRight:'1px solid #ccc9c0',overflowY:'auto',padding:'0.6rem 0',flexShrink:0,display:'flex',flexDirection:'column'}}>
            <div style={{flex:1}}>
              {allCategories.map(cat=>{
                const collapsed = !!collapsedCats[cat]
                return (
                  <div key={cat} style={{marginBottom:'0.2rem'}}>
                    <div style={{display:'flex',alignItems:'center',padding:'5px 8px 2px 12px',gap:4}}>
                      <button onClick={()=>toggleCat(cat)} title={collapsed?'Expand':'Collapse'}
                        style={{background:'none',border:'none',cursor:'pointer',color:'#aaa',fontSize:'0.6rem',padding:'0 2px',lineHeight:1,flexShrink:0}}>
                        {collapsed?'▶':'▼'}
                      </button>
                      <span style={{fontSize:'0.63rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'#888',fontWeight:700,flex:1}}>{cat}</span>
                    </div>
                    {!collapsed&&(
                      <>
                        {byCategory[cat].length===0&&<div style={{fontSize:'0.78rem',color:'#aaa',padding:'2px 12px 2px 22px',fontStyle:'italic'}}>—</div>}
                        {byCategory[cat].map(a=>{
                          const isActive = currentId===a.id&&!creating
                          const editingUsers = Object.values(online).filter(u=>u.articleId===a.id&&u.editing)
                          return (
                            <div key={a.id} onClick={()=>navTo(a.id)}
                              style={{padding:'3px 12px 3px 22px',cursor:'pointer',fontSize:'0.85rem',lineHeight:1.45,display:'flex',alignItems:'center',gap:4,
                                background:isActive?'#e2dfd8':'transparent', color:isActive?'#1b4f72':'#222',
                                fontWeight:isActive?600:400, borderLeft:isActive?'3px solid #1b4f72':'3px solid transparent'}}>
                              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</span>
                              {editingUsers.length>0&&<span title={editingUsers.map(u=>u.displayName).join(', ')+' editing'} style={{width:7,height:7,borderRadius:'50%',background:'#f5a623',flexShrink:0}}/>}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {/* New category */}
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
          </aside>
        )}

        {/* Main */}
        <main style={{flex:1,overflowY:'auto',padding:'1.5rem 2rem'}}>
          {articlesLoaded && Object.keys(articles).length===0 && !creating && (
            <SeedButton onSeed={()=>{}}/>
          )}
          {creating&&<EditForm draft={newArt} setDraft={setNewArt} onSave={saveNew} onCancel={()=>setCreating(false)} isNew categories={allCategories}/>}
          {!creating&&editing&&editDraft&&(
            <EditForm draft={editDraft} setDraft={setEditDraft} onSave={saveEdit} onCancel={()=>{setEditing(false);setEditDraft(null)}} onDelete={()=>deleteArticle(editDraft.id)} categories={allCategories}/>
          )}
          {!creating&&!editing&&article&&(
            <ArticleView article={article} onlineUsers={online}
              onEdit={()=>{setEditDraft(JSON.parse(JSON.stringify(article)));setEditing(true)}}
              onDelete={()=>deleteArticle(article.id)}/>
          )}
          {!creating&&!editing&&!article&&articlesLoaded&&Object.keys(articles).length>0&&(
            <div style={{color:'#888',fontStyle:'italic'}}>Select an article from the sidebar.</div>
          )}
        </main>
      </div>

      {showChangelog&&<ChangelogPanel onClose={()=>setShowChangelog(false)}/>}
    </div>
  )
}
