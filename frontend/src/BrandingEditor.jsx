import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const presets=[['Energía','#e64b6a','#f0b45b','#12141b'],['Azul eléctrico','#328cff','#38dbc8','#101927'],['Verde neón','#91df4c','#f5d56b','#121a15'],['Dorado','#d2a75a','#ead8ab','#141316'],['Minimalista','#2563eb','#08b6d7','#192334']];
export const themeStyle=(b)=>({'--gym-primary':b?.brandPrimary||'#e64b6a','--gym-accent':b?.brandAccent||'#f0b45b','--gym-bg':b?.brandBackground||'#12141b'});
export default function BrandingEditor({token,onSaved}){
 const [v,setV]=useState({primary:'#e64b6a',accent:'#f0b45b',background:'#12141b',tagline:'Entrená con nosotros. Tu progreso comienza aquí.',logoUrl:''});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{fetch(API+'/api/admin/branding',{headers:{Authorization:'Bearer '+token}}).then(r=>r.ok?r.json():Promise.reject(Error('No se pudo cargar el diseño'))).then(x=>setV({primary:x.brandPrimary,accent:x.brandAccent,background:x.brandBackground,tagline:x.brandTagline,logoUrl:x.brandLogoUrl||''})).catch(e=>setError(e.message))},[token]);
 async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{const r=await fetch(API+'/api/admin/branding',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(v)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'Error guardando el diseño');onSaved?.({brandPrimary:v.primary,brandAccent:v.accent,brandBackground:v.background,brandTagline:v.tagline,brandLogoUrl:v.logoUrl});setMessage('Diseño guardado para tu gimnasio.')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="brandingEditor"><h2>Diseño de mi gimnasio</h2><p>Personalizá los colores del administrador y del portal de miembros.</p>
 <div className="brandingPresets">{presets.map(([name,primary,accent,background])=><button key={name} type="button" className="secondary" onClick={()=>setV(s=>({...s,primary,accent,background}))}><span style={{background:primary}} className="brandingSwatch"/> {name}</button>)}</div>
 <form onSubmit={save} className="brandingForm">
 {[[ 'primary','Color principal'],['accent','Color de acento'],['background','Fondo']].map(([key,label])=><label key={key}>{label}<input type="color" value={v[key]} onChange={e=>setV(s=>({...s,[key]:e.target.value}))}/></label>)}
 <label>Frase pública<input maxLength={180} value={v.tagline} onChange={e=>setV(s=>({...s,tagline:e.target.value}))}/></label>
 <label>URL HTTPS del logo (opcional)<input type="url" placeholder="https://..." value={v.logoUrl} onChange={e=>setV(s=>({...s,logoUrl:e.target.value}))}/></label>
 <div className="brandingPreview" style={{background:v.background,borderColor:v.primary}}>{v.logoUrl&&<img src={v.logoUrl} alt="Vista previa del logo"/>}<h3 style={{color:v.primary}}>Tu gimnasio, tu identidad</h3><p>{v.tagline}</p><span style={{background:v.primary,color:'#fff'}}>Entrar al gimnasio</span><small style={{color:v.accent}}>Vista previa</small></div>
 <button className="primary" disabled={busy}>{busy?'Guardando…':'Guardar diseño'}</button></form>
 {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
