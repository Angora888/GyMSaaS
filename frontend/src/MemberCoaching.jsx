import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export default function MemberCoaching({member,token,onClose}){
 const [catalog,setCatalog]=useState([]),[category,setCategory]=useState(''),[selected,setSelected]=useState(''),[assignedDays,setAssignedDays]=useState([{id:crypto.randomUUID(),name:'Día 1',weekdays:[1],exercises:[]}]),[data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState(''),[saving,setSaving]=useState(false);
 async function load(){
  const r=await fetch(API+'/api/admin/members/'+member.id+'/progress',{headers:{Authorization:'Bearer '+token}});
  if(!r.ok)throw Error('No se pudo consultar el seguimiento');
  setData(await r.json());
 }
 useEffect(()=>{fetch(API+'/api/admin/exercise-catalog',{headers:{Authorization:'Bearer '+token}}).then(r=>r.ok?r.json():Promise.reject(Error('No se pudo cargar el catálogo'))).then(setCatalog).catch(e=>setError(e.message))},[token]);
 useEffect(()=>{let active=true;fetch(API+'/api/admin/members/'+member.id+'/progress',{headers:{Authorization:'Bearer '+token}})
 .then(r=>{if(!r.ok)throw Error('No se pudo consultar el seguimiento');return r.json()})
 .then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[member.id,token]);
 const weekdays=['D','L','M','M','J','V','S'];
 function addCatalogExercise(di){const item=catalog.find(x=>x.id===selected);if(!item)return;setAssignedDays(ds=>ds.map((d,i)=>i!==di?d:{...d,exercises:[...d.exercises,{id:crypto.randomUUID(),name:item.name,category:item.category,sets:item.defaultSets,reps:item.defaultReps,restSeconds:item.defaultRestSeconds}]}))}
 function updateAssigned(di,ei,patch){setAssignedDays(ds=>ds.map((d,i)=>i!==di?d:{...d,exercises:d.exercises.map((x,j)=>j===ei?{...x,...patch}:x)}))}
 async function addRoutine(e){e.preventDefault();setSaving(true);setError('');setNotice('');try{
  if(assignedDays.some(d=>!d.exercises.length))throw Error('Agregá al menos un ejercicio en cada día.');
  const r=await fetch(API+'/api/admin/exercise-catalog/members/'+member.id+'/assign',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name,description,isActive:true,days:assignedDays})});
  const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(body.message||'No fue posible asignar la rutina');
  setName('');setDescription('');setAssignedDays([{id:crypto.randomUUID(),name:'Día 1',weekdays:[1],exercises:[]}]);await load();setNotice('Rutina asignada al portal del miembro.');
 }catch(e){setError(e.message)}finally{setSaving(false)}}
 return <section className="panel coachPanel"><div className="memberhead"><h2>Seguimiento: {member.fullName}</h2><button className="secondary" onClick={onClose}>Cerrar</button></div>
 <p>Datos físicos privados, visibles únicamente para el propietario autenticado del gimnasio.</p>
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="membershipMessage">{notice}</p>}
 {data?<><div className="coachMetrics"><div><small>Peso actual</small><strong>{data.member.weightKg!=null?data.member.weightKg+' kg':'—'}</strong></div><div><small>Estatura</small><strong>{data.member.heightCm!=null?data.member.heightCm+' cm':'—'}</strong></div><div><small>Mediciones</small><strong>{data.measurements.length}</strong></div></div>
 <h3>Historial de medidas</h3>{data.measurements.length?<div className="coachHistory">{data.measurements.map(x=><div className="membershipRow" key={x.id}><span>{new Date(x.recordedAt).toLocaleDateString('es-CR')}</span><strong>{x.weightKg} kg · IMC {x.bmi}</strong></div>)}</div>:<p>El miembro todavía no tiene mediciones históricas.</p>}
 <h3>Rutinas asignadas</h3>{data.routines.length?data.routines.map(x=><div className="membershipRow" key={x.id}><strong>{x.name}</strong><span>{x.description||'Sin descripción'}</span></div>):<p>No hay rutinas asignadas.</p>}
 <h3>Asignar rutina desde catálogo</h3><form onSubmit={addRoutine} className="coachForm"><label>Nombre de rutina<input value={name} required minLength={2} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Hipertrofia 4 días"/></label><label>Objetivo<textarea rows={2} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 {assignedDays.map((d,di)=><div className="coachDay" key={d.id}><div className="workoutRow"><input aria-label="Nombre del día" required maxLength={80} value={d.name} onChange={e=>setAssignedDays(ds=>ds.map((x,i)=>di===i?{...x,name:e.target.value}:x))}/><button className="secondary" type="button" disabled={assignedDays.length===1} onClick={()=>setAssignedDays(ds=>ds.filter((_,i)=>i!==di))}>Quitar día</button></div><div className="workoutWeek">{weekdays.map((label,i)=><button key={i} type="button" className={d.weekdays.includes(i)?'selected':''} onClick={()=>setAssignedDays(ds=>ds.map((x,j)=>di!==j?x:{...x,weekdays:x.weekdays.includes(i)?x.weekdays.filter(w=>w!==i):[...x.weekdays,i]}))}>{label}</button>)}</div>
 <label>Categoría<select value={category} onChange={e=>{setCategory(e.target.value);setSelected('')}}><option value="">Elegir categoría</option>{[...new Set(catalog.map(x=>x.category))].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Ejercicio<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleccionar ejercicio</option>{catalog.filter(x=>x.category===category).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button type="button" className="secondary" disabled={!selected} onClick={()=>addCatalogExercise(di)}>＋ Agregar ejercicio</button>
 {d.exercises.map((ex,ei)=><div className="coachExercise" key={ex.id}><strong>{ex.category} · {ex.name}</strong><div className="workoutFields"><label>Series<input type="number" min={1} max={20} value={ex.sets} onChange={e=>updateAssigned(di,ei,{sets:Number(e.target.value)})}/></label><label>Reps<input type="number" min={1} max={1000} value={ex.reps} onChange={e=>updateAssigned(di,ei,{reps:Number(e.target.value)})}/></label><label>Descanso (s)<input type="number" min={0} max={3600} value={ex.restSeconds} onChange={e=>updateAssigned(di,ei,{restSeconds:Number(e.target.value)})}/></label></div><button type="button" className="secondary" onClick={()=>setAssignedDays(ds=>ds.map((x,i)=>i===di?{...x,exercises:x.exercises.filter((_,j)=>j!==ei)}:x))}>Quitar</button></div>)}</div>)}
 <button type="button" className="secondary" onClick={()=>setAssignedDays(ds=>[...ds,{id:crypto.randomUUID(),name:'Día '+(ds.length+1),weekdays:[],exercises:[]}])}>＋ Agregar día</button><button className="primary" disabled={saving||!catalog.length}>{saving?'Guardando…':'Asignar rutina al miembro'}</button></form>
  </>:<p>Cargando seguimiento…</p>}</section>;
}
