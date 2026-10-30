import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const money=(n,c)=>new Intl.NumberFormat('es-CR',{style:'currency',currency:c||'CRC'}).format(n||0);
const localDate=d=>new Date(d).toLocaleString('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'medium',timeStyle:'short'});
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
 <h3>Membresías y saldos</h3>{data.subscriptions.length?data.subscriptions.map(s=><div key={s.id} className="billingRow"><div><strong>{s.plan}</strong><small>{s.startDate} — {s.endDate} · {s.endDate<today?'Vencida':s.startDate>today?'Programada':'Vigente'}</small></div><div><strong>Pendiente: {money(s.balance,s.currency)}</strong><small>Abonado: {money(s.paid,s.currency)} / {money(s.price,s.currency)}</small></div></div>):<p>Sin membresías registradas.</p>}
 <h3>Últimos pagos</h3>{data.payments.length?data.payments.slice(0,10).map(p=><div className="billingRow" key={p.id}><span>{localDate(p.paidAt)} · {p.method}</span><strong>{money(p.amount,p.currency)}</strong></div>):<p>No hay pagos registrados.</p>}
 <div className="memberProfileGrid"><div><h3>Últimas asistencias</h3>{data.attendances.length?data.attendances.slice(0,10).map((a,i)=><p key={i}>{localDate(a)}</p>):<p>Sin asistencias registradas.</p>}</div><div><h3>Rutinas</h3>{data.workouts.length?data.workouts.map(w=><p key={w.id}>{w.name} · {w.isActive?'Activa':'Inactiva'}</p>):<p>Sin rutinas asignadas.</p>}<button className="secondary" onClick={onCoaching}>Abrir seguimiento y rutinas</button></div></div>
 </>}
 </section>;
}
