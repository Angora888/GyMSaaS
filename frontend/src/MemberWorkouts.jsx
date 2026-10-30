import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const id=()=>crypto.randomUUID();
const blankExercise=()=>({id:id(),name:'',sets:4,reps:10,restSeconds:120});
const blankDay=()=>({id:id(),name:'Día 1',weekdays:[1],exercises:[blankExercise()]});
const weekdays=['D','L','M','M','J','V','S'];
export default function MemberWorkouts({token}){
 const [data,setData]=useState({programs:[],sessions:[]}),[view,setView]=useState('list'),[draft,setDraft]=useState({name:'',description:'',isActive:true,days:[blankDay()]}),[program,setProgram]=useState(null),[day,setDay]=useState(null),[session,setSession]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function api(path,method='GET',payload){const r=await fetch(API+'/api/member/workouts'+path,{method,headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(v.message||'No se pudo completar la operación');return v}
 async function reload(){setData(await api(''))}
 useEffect(()=>{reload().catch(e=>setError(e.message))},[token]);
 function changeDay(di,patch){setDraft(d=>({...d,days:d.days.map((x,i)=>i===di?{...x,...patch}:x)}))}
 function changeExercise(di,ei,patch){changeDay(di,{exercises:draft.days[di].exercises.map((e,i)=>i===ei?{...e,...patch}:e)})}
 async function importJson(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  setError('');
  try{
   if(file.size>300000)throw Error('El archivo supera el máximo de 300 KB.');
   if(!file.name.toLowerCase().endsWith('.json'))throw Error('Seleccioná un archivo .json.');
   const parsed=JSON.parse(await file.text());
   if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.days)||parsed.days.length<1||parsed.days.length>14)
    throw Error('El JSON debe incluir days con entre 1 y 14 días.');
   const normalized={
    name:String(parsed.name||'').trim(),
    description:String(parsed.description||'').slice(0,1000),
    isActive:parsed.isActive!==false,
    days:parsed.days.map((d,di)=>({
     id:id(), name:String(d.name||'Día '+(di+1)).trim(),
     weekdays:Array.isArray(d.weekdays)?[...new Set(d.weekdays.map(Number))]:[],
     exercises:Array.isArray(d.exercises)?d.exercises.map(e=>({
       id:id(),name:String(e.name||'').trim(),
       sets:Number(e.sets),reps:Number(e.reps),restSeconds:Number(e.restSeconds??120)
     })):[]
    }))
   };
   if(!normalized.name||normalized.name.length>120||
    normalized.days.some(d=>!d.name||d.name.length>80||d.exercises.length<1||d.exercises.length>30||
     d.weekdays.some(w=>!Number.isInteger(w)||w<0||w>6)||
     d.exercises.some(e=>!e.name||e.name.length>120||!Number.isInteger(e.sets)||e.sets<1||e.sets>20||
      !Number.isInteger(e.reps)||e.reps<1||e.reps>1000||!Number.isInteger(e.restSeconds)||e.restSeconds<0||e.restSeconds>3600)))
    throw Error('Revisá el nombre y los ejercicios: series (1-20), repeticiones (1-1000) y descanso (0-3600 s).');
   setDraft(normalized);
   setView('create');
  }catch(e){setError('No se pudo importar: '+(e instanceof SyntaxError?'JSON no válido':e.message))}
 }
 async function save(e){e.preventDefault();setBusy(true);setError('');try{await api('','POST',draft);await reload();setView('list');setDraft({name:'',description:'',isActive:true,days:[blankDay()]})}catch(ex){setError(ex.message)}finally{setBusy(false)}}
 async function start(p,d){setBusy(true);setError('');try{const s=await api('/'+p.id+'/days/'+d.id+'/start','POST');setProgram(p);setDay(d);setSession(s);setView('workout')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function mark(exercise,n){if(busy)return;const key=exercise.id+':'+n;const completed=session.completed||[];const next=completed.includes(key)?completed.filter(x=>x!==key):[...completed,key];setSession(s=>({...s,completed:next}));setBusy(true);try{const s=await api('/sessions/'+session.id+'/progress','PUT',{exerciseId:exercise.id,setNumber:n,completed:!completed.includes(key)});setSession(old=>({...old,completed:s.completed}))}catch(e){setSession(old=>({...old,completed}));setError(e.message)}finally{setBusy(false)}}
 async function finish(){setBusy(true);try{await api('/sessions/'+session.id+'/finish','POST');await reload();setView('list');setSession(null);setError('')}catch(e){setError(e.message)}finally{setBusy(false)}}
 const total=day?.exercises.reduce((n,e)=>n+Number(e.sets),0)||0;
 const done=session?.completed?.length||0;
 return <div className="workoutPage">
 {error&&<p className="error" role="alert">{error}</p>}
 {view==='list'&&<><div className="workoutHeading"><h2>⚡ Mis Rutinas</h2><button className="primary" onClick={()=>setView('create')}>＋ Crear rutina</button><label className="secondary workoutImportLabel">📄 Importar JSON<input type="file" accept=".json,application/json" onChange={importJson} aria-label="Importar rutina desde JSON"/></label><small>Se abrirá el editor para revisar la rutina antes de guardarla.</small></div>{data.programs.map(p=><div className="mhCard workoutProgram" key={p.id}><small>{p.isActive?'EN PROGRESO':'PROGRAMA'}</small><h2>{p.name}</h2><p>{p.description||'Tu entrenamiento personalizado'}</p><strong>{p.days?.length||0} días de entrenamiento</strong><div className="workoutDays">{p.days?.map(d=><button key={d.id} onClick={()=>start(p,d)} disabled={busy}>{d.name}<small>{d.weekdays?.map(w=>weekdays[w]).join(', ')}</small></button>)}</div></div>)}{!data.programs.length&&<div className="mhCard"><p>Aún no tenés rutinas. Creá la primera con tus días y ejercicios.</p></div>}{data.sessions.some(s=>s.finishedAt)&&<div className="mhCard"><h3>Historial reciente</h3>{data.sessions.filter(s=>s.finishedAt).slice(0,8).map(s=><p key={s.id}>✓ {new Date(s.finishedAt).toLocaleDateString('es-CR')} · {s.completed?.length||0} series terminadas</p>)}</div>}</>}
 {view==='create'&&<form className="workoutBuilder" onSubmit={save}><div className="workoutRow"><h2>Nueva rutina</h2><button type="button" className="secondary" onClick={()=>setView('list')}>Cerrar</button></div><label>Nombre de la rutina<input required maxLength={120} placeholder="Día de brazos / Fuerza" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label><label>Objetivo<textarea maxLength={1000} rows={3} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></label><label className="workoutCheck"><input type="checkbox" checked={draft.isActive} onChange={e=>setDraft(d=>({...d,isActive:e.target.checked}))}/> Marcar como rutina activa</label><div className="workoutRow"><h3>Estructura de días</h3><button type="button" className="secondary" onClick={()=>setDraft(d=>({...d,days:[...d.days,{...blankDay(),name:'Día '+(d.days.length+1)}]}))}>＋ Día</button></div>
 {draft.days.map((d,di)=><section className="mhCard workoutDayEditor" key={d.id}><div className="workoutRow"><input aria-label="Nombre del día" required maxLength={80} value={d.name} onChange={e=>changeDay(di,{name:e.target.value})}/><button type="button" className="secondary" disabled={draft.days.length===1} onClick={()=>setDraft(x=>({...x,days:x.days.filter((_,i)=>i!==di)}))}>✕</button></div><p>Días de la semana</p><div className="workoutWeek">{weekdays.map((label,w)=><button type="button" key={w} className={d.weekdays.includes(w)?'selected':''} onClick={()=>changeDay(di,{weekdays:d.weekdays.includes(w)?d.weekdays.filter(x=>x!==w):[...d.weekdays,w]})}>{label}</button>)}</div>
 {d.exercises.map((ex,ei)=><div className="workoutExerciseEditor" key={ex.id}><div className="workoutRow"><input required maxLength={120} placeholder="Ejercicio" value={ex.name} onChange={e=>changeExercise(di,ei,{name:e.target.value})}/><button type="button" className="secondary" disabled={d.exercises.length===1} onClick={()=>changeDay(di,{exercises:d.exercises.filter((_,i)=>i!==ei)})}>✕</button></div><div className="workoutFields"><label>Series<input type="number" min={1} max={20} value={ex.sets} onChange={e=>changeExercise(di,ei,{sets:Number(e.target.value)})}/></label><label>Repeticiones<input type="number" min={1} max={1000} value={ex.reps} onChange={e=>changeExercise(di,ei,{reps:Number(e.target.value)})}/></label><label>Descanso (seg)<input type="number" min={0} max={3600} value={ex.restSeconds} onChange={e=>changeExercise(di,ei,{restSeconds:Number(e.target.value)})}/></label></div></div>)}<button className="secondary workoutAdd" type="button" onClick={()=>changeDay(di,{exercises:[...d.exercises,blankExercise()]})}>＋ Añadir ejercicio</button></section>)}
 <div className="workoutActions"><button type="button" className="secondary" onClick={()=>setView('list')}>Cancelar</button><button className="primary" disabled={busy}>Guardar rutina</button></div></form>}
 {view==='workout'&&day&&<><button className="secondary" onClick={()=>setView('list')}>← Rutinas</button><h2>{program.name} · {day.name}</h2><div className="mhCard workoutSummary"><h3>🔥 Progreso del entrenamiento</h3><p>{done} de {total} series · {Math.round(done/Math.max(1,total)*100)}% completado</p><div className="workoutTrack"><div style={{width:done/Math.max(1,total)*100+'%'}}/></div></div>{day.exercises.map(ex=><div className="mhCard workoutExercise" key={ex.id}><h3>{ex.name}</h3><p>{ex.sets} series · {ex.reps} repeticiones · ⏱ {Math.floor(ex.restSeconds/60)} min {ex.restSeconds%60} seg</p><div className="workoutSetButtons">{Array.from({length:ex.sets},(_,i)=>i+1).map(n=><button className={(session?.completed||[]).includes(ex.id+':'+n)?'done':''} disabled={busy} key={n} onClick={()=>mark(ex,n)}>{(session?.completed||[]).includes(ex.id+':'+n)?'✓':'Serie '+n}</button>)}</div></div>)}<button className="primary workoutFinish" onClick={finish} disabled={busy}>✓ Finalizar entrenamiento</button><p className="mhHint">Podés salir y continuar más tarde. El avance se guarda en tu cuenta.</p></>}
 </div>;
}
