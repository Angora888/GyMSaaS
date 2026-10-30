import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const money=(n,c)=>new Intl.NumberFormat('es-CR',{style:'currency',currency:c||'CRC'}).format(n||0);
const localDate=d=>new Date(d).toLocaleString('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'medium',timeStyle:'short'});
function Trend({items}){if(!items?.length)return <p>Sin mediciones registradas.</p>;const values=items.map(x=>Number(x.weightKg));const lo=Math.min(...values)-1,hi=Math.max(...values)+1;const points=values.map((v,i)=>[10+(values.length===1?0:i*290/(values.length-1)),100-(v-lo)/(hi-lo)*85].join(',')).join(' ');return <div className="memberTrend"><svg viewBox="0 0 310 115" role="img" aria-label="Evolución del peso"><polyline points={points} fill="none" stroke="#ed859f" strokeWidth="3"/></svg><p>Inicial: {values[0]} kg · Último: {values.at(-1)} kg</p></div>}
function Weekly({items,title}){const now=new Date();const counts=Array.from({length:8},(_,i)=>{const start=new Date(now.getTime()-(8-i)*7*86400000);const end=new Date(start.getTime()+7*86400000);return items.filter(x=>{const d=new Date(x);return d>=start&&d<end}).length});const max=Math.max(1,...counts);return <div className="memberTrend"><h4>{title}</h4><div className="memberWeekly">{counts.map((n,i)=><div key={i} title={n+' registros'}><span>{n}</span><div style={{height:Math.max(4,n/max*100)+'%'}}/></div>)}</div><small>Últimas 8 semanas (períodos de siete días)</small></div>}
export default function MemberProfile({member,token,onClose,onCoaching}){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setData(null);setError('');fetch(API+'/api/admin/members/'+member.id+'/profile',{headers:{Authorization:'Bearer '+token}}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'No se pudo cargar la ficha');return d}).then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[member.id,token]);
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Costa_Rica'});
 return <section className="panel memberProfile"><div className="memberhead"><div><small>FICHA DEL MIEMBRO</small><h2>{member.fullName}</h2></div><button className="secondary" onClick={onClose}>Cerrar ficha</button></div>
 {error&&<p className="error" role="alert">{error}</p>}
 {!data&&!error&&<p>Cargando información del miembro…</p>}
 {data&&<>
 <div className="memberProfileGrid"><div><h3>Contacto y medidas</h3><p>Correo: {data.member.email||'Sin registrar'}</p><p>Teléfono: {data.member.phone||'Sin registrar'}</p><p>Peso: {data.member.weightKg??'—'} kg · Estatura: {data.member.heightCm??'—'} cm</p></div>
 <div><h3>Entrenadores</h3>{data.trainers.length?data.trainers.map(t=><p key={t.id}>{t.name}</p>):<p>Sin entrenador asignado.</p>}</div></div>
 <h3>Progreso del miembro</h3><div className="memberProfileGrid"><Trend items={data.measurements||[]}/><div><Weekly items={data.attendances||[]} title="Asistencias"/><Weekly items={data.completedSessions||[]} title="Entrenamientos completados"/></div></div>
 <h3>Membresías y saldos</h3>{data.subscriptions.length?data.subscriptions.map(s=><div key={s.id} className="billingRow"><div><strong>{s.plan}</strong><small>{s.startDate} — {s.endDate} · {s.endDate<today?'Vencida':s.startDate>today?'Programada':'Vigente'}</small></div><div><strong>Pendiente: {money(s.balance,s.currency)}</strong><small>Abonado: {money(s.paid,s.currency)} / {money(s.price,s.currency)}</small></div></div>):<p>Sin membresías registradas.</p>}
 <h3>Últimos pagos</h3>{data.payments.length?data.payments.slice(0,10).map(p=><div className="billingRow" key={p.id}><span>{localDate(p.paidAt)} · {p.method}</span><strong>{money(p.amount,p.currency)}</strong></div>):<p>No hay pagos registrados.</p>}
 <div className="memberProfileGrid"><div><h3>Últimas asistencias</h3>{data.attendances.length?data.attendances.slice(0,10).map((a,i)=><p key={i}>{localDate(a)}</p>):<p>Sin asistencias registradas.</p>}</div><div><h3>Rutinas</h3>{data.workouts.length?data.workouts.map(w=><p key={w.id}>{w.name} · {w.isActive?'Activa':'Inactiva'}</p>):<p>Sin rutinas asignadas.</p>}<button className="secondary" onClick={onCoaching}>Abrir seguimiento y rutinas</button></div></div>
 </>}
 </section>;
}
