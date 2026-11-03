import WorkoutCelebration from './WorkoutCelebration.jsx';
import React,{useEffect,useState} from 'react';
import CatalogExerciseImage from './CatalogExerciseImage';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const KG_TO_LB=2.2046226218;
const lb=kg=>Math.round(Number(kg)*KG_TO_LB*10)/10;
const kg=lbs=>Math.round(Number(lbs)/KG_TO_LB*1000)/1000;
const id=()=>crypto.randomUUID();
const blankExercise=()=>({id:id(),name:'',sets:4,reps:10,restSeconds:120});
const blankDay=()=>({id:id(),name:'Día 1',weekdays:[1],exercises:[blankExercise()]});
const weekdays=['D','L','M','M','J','V','S'];
export default function MemberWorkouts({token}){
 const [celebration,setCelebration]=useState(null);
 const [exerciseTimer,setExerciseTimer]=useState(null),[timerNow,setTimerNow]=useState(Date.now());
 const [defaults,setDefaults]=useState({sets:4,reps:10,restSeconds:120});
 const [catalog,setCatalog]=useState([]),[catalogCategory,setCatalogCategory]=useState(''),[catalogChoice,setCatalogChoice]=useState(''),[catalogError,setCatalogError]=useState(''),[selectedExercise,setSelectedExercise]=useState(''),[restEnd,setRestEnd]=useState(null),[restNow,setRestNow]=useState(Date.now()),[weightsDraft,setWeightsDraft]=useState({}),[editingId,setEditingId]=useState(null),[data,setData]=useState({programs:[],sessions:[]}),[view,setView]=useState('list'),[draft,setDraft]=useState({name:'',description:'',isActive:true,days:[blankDay()]}),[program,setProgram]=useState(null),[day,setDay]=useState(null),[session,setSession]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!exerciseTimer)return;const tick=setInterval(()=>setTimerNow(Date.now()),250);return()=>clearInterval(tick)},[exerciseTimer]);
 useEffect(()=>{if(!restEnd)return;const timer=setInterval(()=>setRestNow(Date.now()),1000);return()=>clearInterval(timer)},[restEnd]);
 useEffect(()=>{if(restEnd&&restNow>=restEnd)setRestEnd(null)},[restNow,restEnd]);
 async function api(path,method='GET',payload){const r=await fetch(API+'/api/member/workouts'+path,{method,headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(v.message||'No se pudo completar la operación');return v}
 async function reload(){setData(await api(''))}
 useEffect(()=>{reload().catch(e=>setError(e.message))},[token]);
 useEffect(()=>{
  let active=true;
  fetch(API+'/api/member/exercise-catalog',{headers:{Authorization:'Bearer '+token}})
   .then(async r=>{if(!r.ok)throw Error('No se pudo cargar el catálogo del gimnasio.');return r.json()})
   .then(items=>{if(active)setCatalog(items)})
   .catch(e=>{if(active)setCatalogError(e.message)});
  return()=>{active=false};
 },[token]);
 function addFromCatalog(di){
  const selected=catalog.find(item=>item.id===catalogChoice&&item.category===catalogCategory);
  if(!selected)return;
  const exercise={id:id(),name:selected.name,category:selected.category,sets:defaults.sets,reps:defaults.reps,restSeconds:defaults.restSeconds,imageUrl:selected.imageUrl||null,exerciseType:selected.exerciseType||'reps',durationSeconds:selected.durationSeconds||0,instructions:selected.instructions||''};
  setDraft(previous=>({...previous,days:previous.days.map((d,i)=>i===di?{...d,exercises:[...d.exercises.filter(e=>e.name.trim()),exercise]}:d)}));
 }

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
       id:id(),name:String(e.name||'').trim(),category:String(e.category||'').slice(0,80),
       sets:Number(e.sets),reps:Number(e.reps),restSeconds:Number(e.restSeconds??120),exerciseType:e.exerciseType||e.exercise_type||(e.duration_seconds?'isometric':'reps'),durationSeconds:Number(e.durationSeconds??e.duration_seconds??0),instructions:String(e.instructions||'').slice(0,2000)
     })):[]
    }))
   };
   if(!normalized.name||normalized.name.length>120||
    normalized.days.some(d=>!d.name||d.name.length>80||d.exercises.length<1||d.exercises.length>30||
     d.weekdays.some(w=>!Number.isInteger(w)||w<0||w>6)||
     d.exercises.some(e=>!e.name||e.name.length>120||!Number.isInteger(e.sets)||e.sets<1||e.sets>20||
      !Number.isInteger(e.reps)||e.reps<1||e.reps>1000||!Number.isInteger(e.restSeconds)||e.restSeconds<0||e.restSeconds>3600)))
    throw Error('Revisá el nombre y los ejercicios: series (1-20), repeticiones (1-1000) y descanso (0-3600 s).');
   setEditingId(null);
   setDraft(normalized);
   setView('create');
  }catch(e){setError('No se pudo importar: '+(e instanceof SyntaxError?'JSON no válido':e.message))}
 }
 function createNew(){setDefaults({sets:4,reps:10,restSeconds:120});setEditingId(null);setDraft({name:'',description:'',isActive:true,days:[blankDay()]});setError('');setView('create')}
 function editProgram(p){setDefaults({sets:4,reps:10,restSeconds:120});setEditingId(p.id);setDraft({name:p.name,description:p.description||'',isActive:p.isActive,days:structuredClone(p.days||[])});setError('');setView('create')}
 async function save(e){e.preventDefault();setBusy(true);setError('');try{await api(editingId?'/'+editingId:'',editingId?'PUT':'POST',draft);await reload();setView('list');setEditingId(null);setDraft({name:'',description:'',isActive:true,days:[blankDay()]});}catch(ex){setError(ex.message)}finally{setBusy(false)}}
 function preview(p,d){setProgram(p);setDay(d);const open=data.sessions.find(x=>x.programId===p.id&&x.dayId===d.id&&!x.finishedAt);setSession(open||null);setWeightsDraft(open?Object.fromEntries(Object.entries(open.weights||{}).map(([key,value])=>[key,String(lb(value))])):{});setRestEnd(null);setExerciseTimer(null);setError('');setView('workout')}
 async function start(p,d){setBusy(true);setError('');try{const s=await api('/'+p.id+'/days/'+d.id+'/start','POST');setProgram(p);setDay(d);setSession(s);setWeightsDraft(Object.fromEntries(Object.entries(s.weights||{}).map(([key,value])=>[key,String(lb(value))])));setRestEnd(null);setExerciseTimer(null);setView('workout')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function mark(exercise,n){
  if(busy||!session)return;
  const key=exercise.id+':'+n;
  const completed=session.completed||[];
  const nextCompleted=!completed.includes(key);
  const weightText=weightsDraft[key];
  const weight=weightText===''||weightText==null?null:Number(weightText);
  if(weight!==null&&(!Number.isFinite(weight)||weight<0||weight>4409)){setError('Ingresá un peso entre 0 y 4409 lb.');return}
  setBusy(true);setError('');
  try{
   const s=await api('/sessions/'+session.id+'/progress','PUT',{exerciseId:exercise.id,setNumber:n,completed:nextCompleted,weightKg:weight===null?null:kg(weight)});
   setSession(old=>({...old,completed:s.completed,weights:s.weights}));
   if(nextCompleted){setRestNow(Date.now());setRestEnd(Date.now()+exercise.restSeconds*1000)}
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function discardEmptySession(sessionId){if(!window.confirm('¿Descartar esta sesión sin series completadas?'))return;setBusy(true);setError('');try{await api('/sessions/'+sessionId,'DELETE');await reload()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function finish(){if(!session)return;setBusy(true);try{const result=await api('/sessions/'+session.id+'/finish','POST');setCelebration({session:{...session,finishedAt:result.finishedAt,completed:result.completed||session.completed},program,day});await reload();setView('celebration');setSession(null);setRestEnd(null);setError('')}catch(e){setError(e.message)}finally{setBusy(false)}}
 const exerciseOptions=[...new Map(data.programs.flatMap(p=>(p.days||[]).flatMap(d=>(d.exercises||[]).map(e=>[e.id,{id:e.id,name:e.name}])))).values()];
 const chosen=exerciseOptions.find(e=>e.id===selectedExercise)||exerciseOptions[0];
 const strengthHistory=chosen?data.sessions.filter(s=>s.finishedAt&&s.weights).map(s=>{
  const values=Object.entries(s.weights||{}).filter(([k,v])=>k.startsWith(chosen.id+':')&&(s.completed||[]).includes(k)&&Number(v)>0).map(([,v])=>Number(v));
  return values.length?{date:s.finishedAt,weight:Math.max(...values),sessionId:s.id}:null;
 }).filter(Boolean).reverse():[];
 const strengthPoints=strengthHistory.slice(-20);
 const maxWeight=Math.max(1,...strengthPoints.map(x=>x.weight));
 const bestWeight=Math.max(0,...strengthHistory.map(x=>x.weight));
 const firstWeight=strengthHistory[0]?.weight||0;
 const normalizeExerciseName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const exerciseAliases={
  'press con maquina plano o inclinado':'press en maquina',
  'jalon con polea agarre abierto':'jalon al pecho agarre abierto',
  'jalon con polea agarre cerrado':'jalon al pecho agarre cerrado',
  'remo con polea sentado':'remo sentado en polea',
  'aperturas en crossover':'aperturas en cross over',
  'curl de biceps martillo':'curl martillo',
  'curl de biceps agarre invertido':'curl invertido',
  'extension de codo en polea':'extension de triceps en polea',
  'flexion de muneca con barra o mancuernas':'flexion de muneca con barra',
  'extension de muneca con barra o mancuernas':'extension de muneca con barra',
  'press plano con barra o mancuernas':'press plano con barra',
  'flexion de piernas acostado':'curl femoral acostado',
  'flexion de piernas sentado':'curl femoral sentado',
  'flexion plantar sentado':'elevacion de talones sentado',
  'flexion plantar en smith':'elevacion de talones en smith',
  'flexion plantar en prensa':'pantorrillas en prensa',
  'elevacion frontal con disco o mancuernas':'elevacion frontal con disco',
  'deltoides posterior en polea':'deltoide posterior en polea',
  'encogimientos de trapecio con mancuernas':'encogimiento con mancuernas',
 };
 const catalogExercise=ex=>{
  const original=normalizeExerciseName(ex.name);
  const matchedName=exerciseAliases[original]||original;
  const category=normalizeExerciseName(ex.category);
  return catalog.find(x=>normalizeExerciseName(x.name)===matchedName&&(!category||normalizeExerciseName(x.category)===category))
    ||catalog.find(x=>normalizeExerciseName(x.name)===matchedName);
 };
 const exerciseImage=ex=>catalogExercise(ex)?.imageUrl||ex.imageUrl;
 const exerciseConfig=ex=>{const item=catalogExercise(ex);const exerciseType=ex.exerciseType&&ex.exerciseType!=='reps'?ex.exerciseType:item?.exerciseType||ex.exerciseType||'reps';return {exerciseType,durationSeconds:ex.durationSeconds||item?.durationSeconds||0,instructions:ex.instructions||item?.instructions||''}};
 function startExerciseTimer(ex,n){const config=exerciseConfig(ex);if(config.exerciseType==='reps'||!config.durationSeconds)return;const now=Date.now();setTimerNow(now);setExerciseTimer({key:ex.id+':'+n,endsAt:now+config.durationSeconds*1000})}

 const total=day?.exercises.reduce((n,e)=>n+Number(e.sets),0)||0;
 const done=session?.completed?.length||0;
 return <div className={`workoutPage ${view==='workout'&&restEnd?'workoutRestActive':''}`}>
 {error&&<p className="error" role="alert">{error}</p>}
 {view==='celebration'&&celebration&&<WorkoutCelebration session={celebration.session} program={celebration.program} day={celebration.day} onClose={()=>{setCelebration(null);setView('list')}}/>}
 {view==='list'&&<><div className="workoutHeading"><h2>⚡ Mis Rutinas</h2><button className="primary" onClick={createNew}>＋ Crear rutina</button><label className="secondary workoutImportLabel">📄 Importar JSON<input type="file" accept=".json,application/json" onChange={importJson} aria-label="Importar rutina desde JSON"/></label><small>Se abrirá el editor para revisar la rutina antes de guardarla.</small></div><button className="secondary workoutProgressButton" type="button" onClick={()=>setView('strength')}>📈 Mi progreso de fuerza</button>{data.programs.map(p=><div className="mhCard workoutProgram" key={p.id}><small>{p.isActive?'EN PROGRESO':'PROGRAMA'}</small><h2>{p.name}</h2><p>{p.description||'Tu entrenamiento personalizado'}</p><strong>{p.days?.length||0} días de entrenamiento</strong><button className="secondary workoutEdit" type="button" onClick={()=>editProgram(p)}>✎ Editar rutina</button><div className="workoutDays">{p.days?.map(d=><button key={d.id} onClick={()=>preview(p,d)} disabled={busy}>{d.name}<small>{d.weekdays?.map(w=>weekdays[w]).join(', ')}</small></button>)}</div></div>)}{data.sessions.some(s=>!s.finishedAt&&!(s.completed||[]).length&&!Object.keys(s.weights||{}).length)&&<section className="mhCard"><h3>Sesiones pendientes sin progreso</h3><p>Estas sesiones no contienen series ni pesos. Podés descartarlas sin afectar tus entrenamientos finalizados.</p>{data.sessions.filter(s=>!s.finishedAt&&!(s.completed||[]).length&&!Object.keys(s.weights||{}).length).map(s=><div key={s.id} className="workoutRow"><span>{new Date(s.startedAt).toLocaleString('es-CR')} · {data.programs.find(p=>p.id===s.programId)?.name||'Rutina'}</span><button type="button" className="secondary" disabled={busy} onClick={()=>discardEmptySession(s.id)}>Descartar vacía</button></div>)}</section>}{!data.programs.length&&<div className="mhCard"><p>Aún no tenés rutinas. Creá la primera con tus días y ejercicios.</p></div>}{data.sessions.some(s=>s.finishedAt)&&<div className="mhCard"><h3>Historial reciente</h3>{data.sessions.filter(s=>s.finishedAt).slice(0,8).map(s=><div key={s.id} className="workoutRow"><span>✓ {new Date(s.finishedAt).toLocaleDateString('es-CR')} · {s.completed?.length||0} series terminadas</span><button type="button" className="secondary" onClick={()=>{const p=data.programs.find(x=>x.id===s.programId);const d=p?.days?.find(x=>x.id===s.dayId);setCelebration({session:s,program:p,day:d});setView('celebration')}}>Ver logro 🏆</button></div>)}</div>}</>}
 {view==='strength'&&<section className="mhCard workoutStrength"><div className="workoutRow"><h2>📈 Progreso de fuerza</h2><button className="secondary" onClick={()=>setView('list')}>Volver</button></div><p>Tu mejor peso registrado por sesión finalizada, solo en series completadas.</p>{exerciseOptions.length?<><label>Ejercicio<select value={chosen?.id||''} onChange={e=>setSelectedExercise(e.target.value)}>{exerciseOptions.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>{strengthPoints.length?<><div className="strengthMetrics"><div><small>Mejor marca</small><strong>{lb(bestWeight)} lb</strong></div><div><small>Cambio desde el primer registro</small><strong>{bestWeight-firstWeight>=0?'+':''}{lb(bestWeight-firstWeight).toFixed(1)} lb</strong></div><div><small>Sesiones con peso</small><strong>{strengthHistory.length}</strong></div></div><svg className="strengthChart" viewBox="0 0 340 180" role="img" aria-label="Evolución del peso máximo por sesión">{[40,90,140].map(y=><line key={y} x1="28" x2="326" y1={y} y2={y} stroke="#493440" strokeDasharray="4 5"/>)}<polyline fill="none" stroke="#ff5169" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={strengthPoints.map((p,i)=>`${28+i*298/Math.max(1,strengthPoints.length-1)},${155-p.weight/maxWeight*125}`).join(' ')}/>{strengthPoints.map((p,i)=><circle key={p.sessionId} cx={28+i*298/Math.max(1,strengthPoints.length-1)} cy={155-p.weight/maxWeight*125} r="4" fill="#ff8798"/>)}<text x="4" y="25" fill="#bcb1ba" fontSize="11">{lb(maxWeight)} lb</text><text x="8" y="160" fill="#bcb1ba" fontSize="11">0</text></svg><div className="strengthHistory">{[...strengthHistory].reverse().slice(0,10).map(p=><div key={p.sessionId}><span>{new Date(p.date).toLocaleDateString('es-CR')}</span><strong>{lb(p.weight)} lb</strong></div>)}</div></>:<p className="strengthEmpty">Todavía no hay datos para este ejercicio. Completá una sesión registrando el peso y finalizá el entrenamiento para ver tu progreso.</p>}</>:<p>Creá una rutina con ejercicios para comenzar.</p>}</section>}
 {view==='create'&&<form className="workoutBuilder" onSubmit={save}><div className="workoutRow"><h2>{editingId?'Editar rutina':'Nueva rutina'}</h2><button type="button" className="secondary" onClick={()=>setView('list')}>Cerrar</button></div><label>Nombre de la rutina<input required maxLength={120} placeholder="Día de brazos / Fuerza" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label><label>Objetivo<textarea maxLength={1000} rows={3} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></label><label className="workoutCheck"><input type="checkbox" checked={draft.isActive} onChange={e=>setDraft(d=>({...d,isActive:e.target.checked}))}/> Marcar como rutina activa</label><div className="routineDefaults"><strong>⚙️ Valores para ejercicios nuevos</strong><div className="workoutFields"><label>Series<input type="number" min="1" max="20" value={defaults.sets} onChange={e=>setDefaults(v=>({...v,sets:Number(e.target.value)}))}/></label><label>Tipo<select value={ex.exerciseType||'reps'} onChange={e=>changeExercise(di,ei,{exerciseType:e.target.value,durationSeconds:e.target.value==='reps'?0:Math.max(30,ex.durationSeconds||0)})}><option value="reps">Repeticiones</option><option value="timed">Por tiempo</option><option value="isometric">Isométrico</option></select></label>{(ex.exerciseType||'reps')!=='reps'&&<label>Segundos por serie<input type="number" min={1} max={3600} value={ex.durationSeconds||60} onChange={e=>changeExercise(di,ei,{durationSeconds:Number(e.target.value)})}/></label>}<label>Repeticiones<input type="number" min="1" max="1000" value={defaults.reps} onChange={e=>setDefaults(v=>({...v,reps:Number(e.target.value)}))}/></label><label>Descanso (seg)<input type="number" min="0" max="3600" value={defaults.restSeconds} onChange={e=>setDefaults(v=>({...v,restSeconds:Number(e.target.value)}))}/></label></div><small>Se aplican a los ejercicios nuevos. Podés modificar cada uno individualmente.</small></div><div className="workoutRow"><h3>Estructura de días</h3><button type="button" className="secondary" onClick={()=>setDraft(d=>({...d,days:[...d.days,{...blankDay(),name:'Día '+(d.days.length+1)}]}))}>＋ Día</button></div>
 {draft.days.map((d,di)=><section className="mhCard workoutDayEditor" key={d.id}><div className="workoutRow"><input aria-label="Nombre del día" required maxLength={80} value={d.name} onChange={e=>changeDay(di,{name:e.target.value})}/><span className="workoutDayExerciseCount" aria-live="polite">{d.exercises.filter(ex=>ex.name?.trim()).length} {d.exercises.filter(ex=>ex.name?.trim()).length===1?"ejercicio":"ejercicios"}</span><button type="button" className="secondary" disabled={draft.days.length===1} onClick={()=>setDraft(x=>({...x,days:x.days.filter((_,i)=>i!==di)}))}>✕</button></div><p>Días de la semana</p><div className="workoutWeek">{weekdays.map((label,w)=><button type="button" key={w} className={d.weekdays.includes(w)?'selected':''} onClick={()=>changeDay(di,{weekdays:d.weekdays.includes(w)?d.weekdays.filter(x=>x!==w):[...d.weekdays,w]})}>{label}</button>)}</div>
 <div className="workoutCatalogPicker"><h4>Agregar desde el catálogo del gimnasio</h4>{catalogError&&<p className="error">{catalogError}</p>}{catalog.length?<><label>Categoría<select value={catalogCategory} onChange={e=>{setCatalogCategory(e.target.value);setCatalogChoice('')}}><option value="">Elegir categoría</option>{[...new Set(catalog.map(x=>x.category))].map(cat=><option key={cat} value={cat}>{cat}</option>)}</select></label><label>Ejercicio<select value={catalogChoice} onChange={e=>setCatalogChoice(e.target.value)}><option value="">Elegir ejercicio</option>{catalog.filter(x=>x.category===catalogCategory).map(x=><option key={x.id} value={x.id}>{x.name} · {x.defaultSets} × {x.defaultReps}</option>)}</select></label><button type="button" className="secondary" disabled={!catalogChoice} onClick={()=>addFromCatalog(di)}>＋ Agregar ejercicio seleccionado</button></>:<p>El administrador todavía no ha cargado ejercicios. Podés seguir agregándolos manualmente o importar una rutina JSON.</p>}</div>
 {d.exercises.map((ex,ei)=><div className="workoutExerciseEditor" key={ex.id}><div className="workoutRow"><input required maxLength={120} placeholder="Ejercicio" value={ex.name} onChange={e=>changeExercise(di,ei,{name:e.target.value})}/><button type="button" className="secondary" disabled={d.exercises.length===1} onClick={()=>changeDay(di,{exercises:d.exercises.filter((_,i)=>i!==ei)})}>✕</button></div><label className="workoutCategoryInput">Categoría<input maxLength={80} placeholder="Grupo muscular (opcional)" value={ex.category||''} onChange={e=>changeExercise(di,ei,{category:e.target.value})}/></label><div className="workoutFields"><label>Series<input type="number" min={1} max={20} value={ex.sets} onChange={e=>changeExercise(di,ei,{sets:Number(e.target.value)})}/></label><label>Repeticiones<input type="number" min={1} max={1000} value={ex.reps} onChange={e=>changeExercise(di,ei,{reps:Number(e.target.value)})}/></label><label>Descanso (seg)<input type="number" min={0} max={3600} value={ex.restSeconds} onChange={e=>changeExercise(di,ei,{restSeconds:Number(e.target.value)})}/></label></div></div>)}<button className="secondary workoutAdd" type="button" onClick={()=>changeDay(di,{exercises:[...d.exercises,{...blankExercise(),sets:defaults.sets,reps:defaults.reps,restSeconds:defaults.restSeconds}]})}>＋ Añadir ejercicio</button></section>)}
 <div className="workoutActions"><button type="button" className="secondary" onClick={()=>setView('list')}>Cancelar</button><button className="primary" disabled={busy}>{editingId?'Guardar cambios':'Guardar rutina'}</button></div></form>}
 {view==='workout'&&day&&<><button className="secondary" onClick={()=>setView('list')}>← Rutinas</button><h2>{program.name} · {day.name}</h2>{!session?<div className="mhCard workoutStartPrompt"><h3>👀 Vista previa del día</h3><p>Podés revisar todos los ejercicios sin registrar un entrenamiento. Tocá «Empezar entrenamiento» cuando realmente vayás a entrenar.</p><button className="primary" type="button" disabled={busy} onClick={()=>start(program,day)}>▶ Empezar entrenamiento</button></div>:<p className="membershipMessage">● Entrenamiento iniciado · Tus series se guardarán en tu cuenta.</p>}{restEnd&&<div className="mhCard workoutRest workoutRestDock" role="timer" aria-live="off"><strong>⏱ Descanso</strong><span>{Math.ceil(Math.max(0,restEnd-restNow)/1000)} segundos</span><button type="button" className="secondary" onClick={()=>setRestEnd(null)}>Omitir descanso</button></div>}<div className="mhCard workoutSummary"><h3>🔥 Progreso del entrenamiento</h3><p>{done} de {total} series · {Math.round(done/Math.max(1,total)*100)}% completado</p><div className="workoutTrack"><div style={{width:done/Math.max(1,total)*100+'%'}}/></div></div>{day.exercises.map(ex=><div className="mhCard workoutExercise" key={ex.id}>{ex.category&&<span className="workoutExerciseCategory">{ex.category}</span>}<h3>{ex.name}</h3><CatalogExerciseImage className="workoutExerciseImage" name={catalogExercise(ex)?.name||ex.name} category={catalogExercise(ex)?.category||ex.category} imageUrl={exerciseImage(ex)}/><p>{ex.sets} series · {exerciseConfig(ex).exerciseType==='reps'?ex.reps+' repeticiones':exerciseConfig(ex).durationSeconds+' s por serie ('+(exerciseConfig(ex).exerciseType==='isometric'?'isométrico':'por tiempo')+')'} · descanso {ex.restSeconds} s</p>{exerciseConfig(ex).instructions&&<p className="workoutInstructions">💡 {exerciseConfig(ex).instructions}</p>}{session&&<div className="workoutSetButtons">{Array.from({length:ex.sets},(_,i)=>i+1).map(n=><div className="workoutSetRow" key={n}>{exerciseConfig(ex).exerciseType!=='reps'&&<div className="workoutExerciseTimer"><button className="secondary" type="button" disabled={!session||busy} onClick={()=>startExerciseTimer(ex,n)}>{exerciseTimer?.key===ex.id+':'+n?'Reiniciar tiempo':'⏱ Iniciar '+exerciseConfig(ex).durationSeconds+' s'}</button>{exerciseTimer?.key===ex.id+':'+n&&<strong role="timer">{timerNow>=exerciseTimer.endsAt?'✓ Tiempo cumplido':Math.ceil((exerciseTimer.endsAt-timerNow)/1000)+' s'}</strong>}</div>}<label>Serie {n} · lb<input type="number" min="0" max="4409" step="0.5" inputMode="decimal" placeholder="Peso" value={weightsDraft[ex.id+':'+n]??''} onChange={e=>setWeightsDraft(w=>({...w,[ex.id+':'+n]:e.target.value}))}/></label><button className={(session?.completed||[]).includes(ex.id+':'+n)?'done':''} disabled={busy} onClick={()=>mark(ex,n)}>{(session?.completed||[]).includes(ex.id+':'+n)?'✓ Hecha':'Completar'}</button></div>)}</div>}</div>)}{session&&<button className="primary workoutFinish" onClick={finish} disabled={busy}>✓ Finalizar entrenamiento</button>}{session&&<p className="mhHint">Podés salir y continuar más tarde. El avance se guarda en tu cuenta.</p>}</>}
 </div>;
}
