import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export default function MemberCoaching({member,token,onClose}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState(''),[saving,setSaving]=useState(false);
 async function load(){
  const r=await fetch(API+'/api/admin/members/'+member.id+'/progress',{headers:{Authorization:'Bearer '+token}});
  if(!r.ok)throw Error('No se pudo consultar el seguimiento');
  setData(await r.json());
 }
 useEffect(()=>{let active=true;fetch(API+'/api/admin/members/'+member.id+'/progress',{headers:{Authorization:'Bearer '+token}})
 .then(r=>{if(!r.ok)throw Error('No se pudo consultar el seguimiento');return r.json()})
 .then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[member.id,token]);
 async function addRoutine(e){e.preventDefault();setSaving(true);setError('');setNotice('');try{
  const r=await fetch(API+'/api/admin/members/'+member.id+'/routines',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name,description})});
  const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(body.message||'No fue posible guardar la rutina');
  setName('');setDescription('');await load();setNotice('Rutina asignada correctamente.');
 }catch(e){setError(e.message)}finally{setSaving(false)}}
 return <section className="panel coachPanel"><div className="memberhead"><h2>Seguimiento: {member.fullName}</h2><button className="secondary" onClick={onClose}>Cerrar</button></div>
 <p>Datos físicos privados, visibles únicamente para el propietario autenticado del gimnasio.</p>
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="membershipMessage">{notice}</p>}
 {data?<><div className="coachMetrics"><div><small>Peso actual</small><strong>{data.member.weightKg!=null?data.member.weightKg+' kg':'—'}</strong></div><div><small>Estatura</small><strong>{data.member.heightCm!=null?data.member.heightCm+' cm':'—'}</strong></div><div><small>Mediciones</small><strong>{data.measurements.length}</strong></div></div>
 <h3>Historial de medidas</h3>{data.measurements.length?<div className="coachHistory">{data.measurements.map(x=><div className="membershipRow" key={x.id}><span>{new Date(x.recordedAt).toLocaleDateString('es-CR')}</span><strong>{x.weightKg} kg · IMC {x.bmi}</strong></div>)}</div>:<p>El miembro todavía no tiene mediciones históricas.</p>}
 <h3>Rutinas asignadas</h3>{data.routines.length?data.routines.map(x=><div className="membershipRow" key={x.id}><strong>{x.name}</strong><span>{x.description||'Sin descripción'}</span></div>):<p>No hay rutinas asignadas.</p>}
 <h3>Asignar nueva rutina</h3><form onSubmit={addRoutine} className="coachForm"><label>Nombre de rutina<input value={name} required minLength={2} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Fuerza: semana 1"/></label><label>Ejercicios e instrucciones<textarea rows={5} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Lunes: sentadilla, press de banca…"/></label><button className="primary" disabled={saving}>{saving?'Guardando…':'Asignar rutina'}</button></form>
 </>:<p>Cargando seguimiento…</p>}</section>;
}
