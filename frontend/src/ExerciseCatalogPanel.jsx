import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export default function ExerciseCatalogPanel({token}){
 const [items,setItems]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const r=await fetch(API+'/api/admin/exercise-catalog',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('No se pudo cargar el catálogo');setItems(await r.json())}
 useEffect(()=>{load().catch(e=>setError(e.message))},[token]);
 async function importFile(e){
  const f=e.target.files?.[0];e.target.value='';if(!f)return;setError('');setNotice('');
  setBusy(true);try{
   if(f.size>250000)throw Error('El archivo debe pesar menos de 250 KB.');
   const parsed=JSON.parse(await f.text());
   if(!Array.isArray(parsed.exercises))throw Error('El archivo debe contener un arreglo exercises.');
   const r=await fetch(API+'/api/admin/exercise-catalog/import',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({exercises:parsed.exercises})});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'No se pudo importar');
   await load();setNotice(`Catálogo actualizado: ${d.added} agregados y ${d.updated} actualizados.`);
  }catch(ex){setError(ex.message)}finally{setBusy(false)}
 }
 const categories=[...new Set(items.map(x=>x.category))];
 return <section className="catalogPanel"><h2>Catálogo de ejercicios</h2><p>Importá un JSON con los ejercicios de tu gimnasio. Los nombres repetidos dentro de la misma categoría se actualizan, no se duplican.</p>
 <label className="secondary catalogUpload">📄 {busy?'Importando…':'Importar catálogo JSON'}<input type="file" accept=".json,application/json" disabled={busy} onChange={importFile}/></label>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="membershipMessage" role="status">{notice}</p>}
 <p>{items.length} ejercicios · {categories.length} categorías</p>{categories.map(category=><details key={category} className="catalogGroup"><summary>{category} ({items.filter(x=>x.category===category).length})</summary>{items.filter(x=>x.category===category).map(x=><div key={x.id} className="catalogItem"><strong>{x.name}</strong><small>{x.defaultSets} series × {x.defaultReps} reps · {x.defaultRestSeconds} s descanso</small></div>)}</details>)}
 </section>;
}
