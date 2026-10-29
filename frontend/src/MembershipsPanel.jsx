import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
async function api(path,token,method='GET',body){
 const response=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||data.title||'No se pudo completar la operación');
 return data;
}
export default function MembershipsPanel({token,members}){
 const [plans,setPlans]=useState([]),[subs,setSubs]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 const [plan,setPlan]=useState({name:'',price:'',currency:'CRC',durationDays:'30'});
 const [assign,setAssign]=useState({memberId:'',planId:'',startDate:new Date().toLocaleDateString('en-CA')});
 async function refresh(){try{const [p,s]=await Promise.all([api('/api/admin/plans',token),api('/api/admin/subscriptions',token)]);setPlans(p);setSubs(s)}catch(e){setError(e.message)}}
 useEffect(()=>{refresh()},[token]);
 async function createPlan(e){e.preventDefault();setSaving(true);setError('');setMessage('');try{await api('/api/admin/plans',token,'POST',{...plan,price:Number(plan.price),durationDays:Number(plan.durationDays)});setPlan({name:'',price:'',currency:'CRC',durationDays:'30'});await refresh();setMessage('Plan creado correctamente.')}catch(e){setError(e.message)}finally{setSaving(false)}}
 async function assignPlan(e){e.preventDefault();setSaving(true);setError('');setMessage('');try{await api('/api/admin/subscriptions',token,'POST',assign);await refresh();setMessage('Membresía asignada correctamente.')}catch(e){setError(e.message)}finally{setSaving(false)}}
 return <div className="membershipLayout">
 <section className="panel"><h2>Planes del gimnasio</h2><p>Creá tus planes y definí cuánto duran. La asignación no registra ni confirma un pago.</p>
 <form onSubmit={createPlan} className="membershipForm"><label>Nombre del plan<input required minLength={2} maxLength={100} value={plan.name} onChange={e=>setPlan({...plan,name:e.target.value})} placeholder="Mensual"/></label>
 <label>Precio<input required type="number" min="0" step="0.01" value={plan.price} onChange={e=>setPlan({...plan,price:e.target.value})}/></label>
 <label>Moneda<select value={plan.currency} onChange={e=>setPlan({...plan,currency:e.target.value})}><option value="CRC">Colones (CRC)</option><option value="USD">Dólares (USD)</option></select></label>
 <label>Duración (días)<input required type="number" min="1" max="3660" value={plan.durationDays} onChange={e=>setPlan({...plan,durationDays:e.target.value})}/></label><button disabled={saving} className="primary">Crear plan</button></form>
 <div>{plans.length?plans.map(p=><div className="membershipRow" key={p.id}><strong>{p.name}</strong><span>{new Intl.NumberFormat('es-CR',{style:'currency',currency:p.currency}).format(p.price)} · {p.durationDays} días</span></div>):<p>No hay planes creados.</p>}</div></section>
 <section className="panel"><h2>Asignar una membresía</h2><form className="membershipForm" onSubmit={assignPlan}>
 <label>Miembro<select required value={assign.memberId} onChange={e=>setAssign({...assign,memberId:e.target.value})}><option value="">Seleccioná un miembro</option>{members.map(m=><option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label>
 <label>Plan<select required value={assign.planId} onChange={e=>setAssign({...assign,planId:e.target.value})}><option value="">Seleccioná un plan</option>{plans.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
 <label>Fecha de inicio<input required type="date" value={assign.startDate} onChange={e=>setAssign({...assign,startDate:e.target.value})}/></label>
 <button disabled={saving||!plans.length||!members.length} className="primary">Asignar membresía</button></form>
 {error&&<p role="alert" className="error">{error}</p>}{message&&<p className="membershipMessage" role="status">{message}</p>}
 <h2>Asignaciones recientes</h2>{subs.length?subs.slice(0,30).map(s=><div className="membershipRow" key={s.id}><strong>{s.memberName} · {s.planName}</strong><span>{s.startDate} — {s.endDate}</span></div>):<p>Aún no hay membresías asignadas.</p>}
 </section></div>;
}
