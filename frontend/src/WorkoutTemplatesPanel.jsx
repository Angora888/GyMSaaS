import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const uid=()=>crypto.randomUUID();
const normalize=(source)=>{
 const native=Array.isArray(source.days);
 const days=native?source.days:source.workouts;
 if(!Array.isArray(days)||!days.length)throw Error('El JSON debe contener days o workouts.');
 const weekdayPresets=[[1],[3],[5],[2],[4],[6],[0]];
 return {name:String(source.name||'').trim(),description:String(source.description||'').slice(0,1000),isActive:true,
  days:days.map((day,i)=>({id:uid(),name:String(day.name||'Día '+(i+1)),weekdays:Array.isArray(day.weekdays)?day.weekdays:weekdayPresets[i%7],
   exercises:(day.exercises||[]).map(ex=>({id:uid(),name:String(ex.name||'').trim(),category:String(ex.category||'Calistenia').slice(0,80),sets:Number(ex.sets||source.default_sets||4),
    reps:Number(ex.reps||source.default_reps||(ex.duration_seconds?1:12)),restSeconds:Number(ex.restSeconds??ex.rest_seconds??120)}))}))};
};
export default function WorkoutTemplatesPanel({token,members}){
 const [catalog,setCatalog]=useState([]),[templates,setTemplates]=useState([]),[selected,setSelected]=useState(''),[member,setMember]=useState(''),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function api(path,method='GET',body){const r=await fetch(API+'/api/admin/workout-templates'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'No se pudo completar la operación');return data}
 async function load(){const result=await api('');setTemplates(result);return result}
 useEffect(()=>{let alive=true;api('').then(x=>{if(alive)setTemplates(x)}).catch(e=>{if(alive)setError(e.message)});fetch(API+'/api/admin/exercise-catalog',{headers:{Authorization:'Bearer '+token}}).then(r=>r.ok?r.json():[]).then(x=>{if(alive)setCatalog(x)}).catch(()=>{});return()=>{alive=false}},[token]);
 async function importFile(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');setNotice('');
  try{if(file.size>300000)throw Error('Máximo 300 KB');const data=normalize(JSON.parse(await file.text()));setEditing({id:null,...data});setNotice('Revisá la plantilla y guardala para poder asignarla.')}catch(e){setError(e.message)}
 }
 function newTemplate(){setEditing({id:null,name:'',description:'',isActive:true,days:[{id:uid(),name:'Día 1',weekdays:[1],exercises:[{id:uid(),name:'',category:'',sets:4,reps:12,restSeconds:120}]}]});setError('');setNotice('')}
 function setDay(i,patch){setEditing(old=>({...old,days:old.days.map((d,j)=>j===i?{...d,...patch}:d)}))}
 function setExercise(i,j,patch){setEditing(old=>({...old,days:old.days.map((d,di)=>di===i?{...d,exercises:d.exercises.map((e,ei)=>ei===j?{...e,...patch}:e)}:d)}))}
 async function save(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  if(!editing.days.length||editing.days.some(d=>!d.exercises.length||d.exercises.some(e=>!e.name.trim())))throw Error('Cada día debe tener ejercicios con nombre.');
  const result=await api(editing.id?'/'+editing.id:'',editing.id?'PUT':'POST',editing);await load();setSelected(result.id);setEditing(null);setNotice('Plantilla guardada y lista para asignar.');
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 async function assign(){if(!selected||!member)return;setBusy(true);setError('');setNotice('');try{
  const result=await api('/'+selected+'/assign','POST',{memberId:member});setNotice(result.message||'Rutina asignada.');
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 const chosen=templates.find(t=>t.id===selected);
 return <div className="panel workoutTemplatePanel">
  <div className="memberhead"><div><h2>📚 Biblioteca de rutinas</h2><p>Guardá plantillas por gimnasio y asigná copias independientes a tus miembros. Las imágenes se gestionan en el catálogo de ejercicios.</p></div><button className="secondary" type="button" onClick={newTemplate}>＋ Nueva plantilla</button></div>
  <label className="secondary catalogUpload">📄 Importar rutina JSON<input type="file" accept=".json,application/json" onChange={importFile}/></label>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="membershipMessage" role="status">{notice}</p>}
  {editing?<form className="templateForm" onSubmit={save}>
   <h3>{editing.id?'Editar plantilla':'Nueva plantilla'}</h3>
   <label>Nombre<input required minLength={2} maxLength={120} value={editing.name} onChange={e=>setEditing(x=>({...x,name:e.target.value}))}/></label>
   <label>Descripción<textarea rows={2} maxLength={1000} value={editing.description||''} onChange={e=>setEditing(x=>({...x,description:e.target.value}))}/></label>
   {editing.days.map((d,i)=><div className="mhCard templateDay" key={d.id}>
    <div className="workoutRow"><input aria-label="Nombre del día" value={d.name} required onChange={e=>setDay(i,{name:e.target.value})}/><button type="button" className="secondary" disabled={editing.days.length===1} onClick={()=>setEditing(x=>({...x,days:x.days.filter((_,j)=>j!==i)}))}>Quitar día</button></div>
    <label>Agregar ejercicio desde el catálogo<select value="" onChange={e=>{const item=catalog.find(x=>x.id===e.target.value);if(item)setDay(i,{exercises:[...d.exercises.filter(ex=>ex.name.trim()),{id:uid(),name:item.name,category:item.category,sets:item.defaultSets,reps:item.defaultReps,restSeconds:item.defaultRestSeconds}]})}}><option value="">Elegí un ejercicio del catálogo…</option>{catalog.map(item=><option key={item.id} value={item.id}>{item.category} · {item.name}</option>)}</select></label>
    <label>Días de la semana (0=domingo, 1=lunes, ...)<input value={(d.weekdays||[]).join(',')} onChange={e=>setDay(i,{weekdays:e.target.value.split(',').map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<=6)})}/></label>
    {d.exercises.map((ex,j)=><div key={ex.id} className="templateExercise">
     <div className="workoutRow"><input required aria-label="Ejercicio" value={ex.name} onChange={e=>setExercise(i,j,{name:e.target.value})}/><button type="button" className="secondary" disabled={d.exercises.length===1} onClick={()=>setDay(i,{exercises:d.exercises.filter((_,k)=>k!==j)})}>✕</button></div>
     <div className="workoutFields"><label>Grupo<input value={ex.category||''} onChange={e=>setExercise(i,j,{category:e.target.value})}/></label><label>Series<input type="number" min={1} max={20} value={ex.sets} onChange={e=>setExercise(i,j,{sets:Number(e.target.value)})}/></label><label>Reps<input type="number" min={1} max={1000} value={ex.reps} onChange={e=>setExercise(i,j,{reps:Number(e.target.value)})}/></label><label>Descanso (s)<input type="number" min={0} max={3600} value={ex.restSeconds} onChange={e=>setExercise(i,j,{restSeconds:Number(e.target.value)})}/></label></div>
    </div>)}
    <button type="button" className="secondary" onClick={()=>setDay(i,{exercises:[...d.exercises,{id:uid(),name:'',category:'',sets:4,reps:12,restSeconds:120}]})}>＋ Ejercicio</button>
   </div>)}
   <button type="button" className="secondary" onClick={()=>setEditing(x=>({...x,days:[...x.days,{id:uid(),name:'Día '+(x.days.length+1),weekdays:[],exercises:[{id:uid(),name:'',category:'',sets:4,reps:12,restSeconds:120}]}]}))}>＋ Agregar día</button>
   <div className="actions"><button className="primary" disabled={busy}>{busy?'Guardando…':'Guardar plantilla'}</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancelar</button></div>
  </form>:<>
  <div className="templateGrid">{templates.map(t=><button key={t.id} type="button" className={'templateCard '+(selected===t.id?'selected':'')} onClick={()=>setSelected(t.id)}><strong>{t.name}</strong><small>{t.days?.length||0} días · {(t.days||[]).reduce((n,d)=>n+(d.exercises?.length||0),0)} ejercicios</small></button>)}</div>
  {chosen&&<section className="templateDetails"><div className="memberhead"><h3>{chosen.name}</h3><button type="button" className="secondary" onClick={()=>setEditing({id:chosen.id,name:chosen.name,description:chosen.description||'',isActive:true,days:structuredClone(chosen.days||[])})}>Editar plantilla</button></div>
   {chosen.description&&<p>{chosen.description}</p>}
   {chosen.days?.map(d=><details key={d.id} className="catalogGroup"><summary>{d.name} · {d.exercises?.length||0} ejercicios</summary>{d.exercises?.map(e=><p key={e.id}>{e.name} — {e.sets} × {e.reps} · {e.restSeconds} s descanso</p>)}</details>)}
   <div className="templateAssign"><label>Asignar a miembro<select value={member} onChange={e=>setMember(e.target.value)}><option value="">Seleccioná un miembro</option>{members.map(m=><option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label><button className="primary" disabled={busy||!member} type="button" onClick={assign}>Asignar copia de plantilla</button></div>
   <small>La asignación no modifica las rutinas que ya tiene el miembro. La copia se guarda inicialmente como inactiva.</small>
  </section>}
  {!templates.length&&<p>Sin plantillas todavía. Importá un JSON o creá una nueva.</p>}
  </>}
 </div>;
}
