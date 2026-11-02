import React,{useEffect,useState} from 'react';
import CatalogExerciseImage from './CatalogExerciseImage';
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
 async function saveImage(item,imageUrl){setBusy(true);setError('');try{const r=await fetch(API+'/api/admin/exercise-catalog/'+item.id+'/image',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({imageUrl})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'No se pudo guardar');await load();setNotice('Imagen actualizada: '+item.name)}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function uploadImage(event,item){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Elegí JPG, PNG o WebP');
   const bitmap=await createImageBitmap(file);
   const canvas=document.createElement('canvas');
   const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   let url='';
   for(const quality of [.82,.7,.55,.42]){
    url=canvas.toDataURL('image/webp',quality);
    if(url.length<290000)break;
   }
   if(!url.startsWith('data:image/webp;base64,')||url.length>290000)throw Error('La imagen no se pudo optimizar a 220 KB');
   const response=await fetch(API+'/api/admin/exercise-catalog/'+item.id+'/image-file',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({imageUrl:url})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.detail||result.message||'No se pudo subir al repositorio');
   await load();
   setNotice('Imagen enviada a GitHub: '+item.name+'. Se verá cuando Vercel complete el despliegue.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 const categories=[...new Set(items.map(x=>x.category))];
 return <section className="catalogPanel"><h2>Catálogo de ejercicios</h2><p>Importá un JSON con los ejercicios de tu gimnasio. Los nombres repetidos dentro de la misma categoría se actualizan, no se duplican.</p><p>Las imágenes nuevas se guardan en la carpeta pública del repositorio GitHub y aparecen después del despliegue de Vercel, no se almacenan como Base64 en Neon.</p>
 <label className="secondary catalogUpload">📄 {busy?'Importando…':'Importar catálogo JSON'}<input type="file" accept=".json,application/json" disabled={busy} onChange={importFile}/></label>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="membershipMessage" role="status">{notice}</p>}
 <p>{items.length} ejercicios · {categories.length} categorías</p>{categories.map(category=><details key={category} className="catalogGroup"><summary>{category} ({items.filter(x=>x.category===category).length})</summary>{items.filter(x=>x.category===category).map(x=><div key={x.id} className="catalogItem catalogImageItem"><div className="catalogImagePreview"><CatalogExerciseImage name={x.name} category={x.category} imageUrl={x.imageUrl}/></div><div className="catalogImageInfo"><strong>{x.name}</strong><small>{x.defaultSets} series × {x.defaultReps} reps · {x.defaultRestSeconds} s descanso</small><div className="catalogImageActions"><label className="secondary">📷 Subir imagen<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>uploadImage(e,x)}/></label><label>URL HTTPS<input key={x.id+'-'+(x.imageUrl||'')} type="url" defaultValue={x.imageUrl?.startsWith('https://')?x.imageUrl:''} placeholder="https://..." onBlur={e=>{const url=e.target.value.trim();if(url&&url!==x.imageUrl)saveImage(x,url)}}/></label>{x.imageUrl&&<button className="secondary" type="button" disabled={busy} onClick={()=>saveImage(x,null)}>Quitar</button>}</div></div></div>)}</details>)}
 </section>;
}
