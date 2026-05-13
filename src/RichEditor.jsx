import { useState, useEffect, useRef } from 'react'

const CONTENT_FONTS = [
  { label: 'Source Serif (Default)', value: 'Source Serif 4, Georgia, serif' },
  { label: 'IM Fell English', value: 'IM Fell English, Georgia, serif' },
  { label: 'Cinzel', value: 'Cinzel, Georgia, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Monospace', value: 'Courier New, monospace' },
]
const FONT_SIZES = ['10','11','12','13','14','16','18','20','24','28','32','36','48']

export function RichEditor({ value, onChange, minHeight = 360, maxHeight = 520 }) {
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
        style={{minHeight,padding:'1rem 1.2rem',outline:'none',fontFamily:"'Source Serif 4',Georgia,serif",fontSize:'0.92rem',lineHeight:1.75,color:'#222',overflowY:'auto',maxHeight}}/>
    </div>
  )
}

export function InfoboxEditor({ infobox, onChange }) {
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
