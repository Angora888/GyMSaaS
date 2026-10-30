import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
async function api(path,token,method='GET',body){
 const response=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||data.title||'No se pudo completar la operación');
 return data;
}
export default function MembershipsPanel({token,members}){
 const [billingFilter,setBillingFilter]=useState('all'),[billingSearch,setBillingSearch]=useState(''),[billing,setBilling]=useState({subscriptions:[],payments:[],monthTotals:[]}),[payment,setPayment]=useState({subscriptionId:'',amount:'',method:'SINPE',note:''}),[plans,setPlans]=useState([]),[subs,setSubs]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 const [plan,setPlan]=useState({name:'',price:'',currency:'CRC',durationDays:'30'});
 const [assign,setAssign]=useState({memberId:'',planId:'',startDate:new Date().toLocaleDateString('en-CA')});
 async function refresh(){try{const [p,s,b]=await Promise.all([api('/api/admin/plans',token),api('/api/admin/subscriptions',token),api('/api/admin/billing',token)]);setPlans(p);setSubs(s);setBilling(b)}catch(e){setError(e.message)}}
 useEffect(()=>{refresh()},[token]);
 async function createPlan(e){e.preventDefault();setSaving(true);setError('');setMessage('');try{await api('/api/admin/plans',token,'POST',{...plan,price:Number(plan.price),durationDays:Number(plan.durationDays)});setPlan({name:'',price:'',currency:'CRC',durationDays:'30'});await refresh();setMessage('Plan creado correctamente.')}catch(e){setError(e.message)}finally{setSaving(false)}}
 async function assignPlan(e){e.preventDefault();setSaving(true);setError('');setMessage('');try{await api('/api/admin/subscriptions',token,'POST',assign);await refresh();setMessage('Membresía asignada correctamente.')}catch(e){setError(e.message)}finally{setSaving(false)}}
 async function recordPayment(e){e.preventDefault();setSaving(true);setError('');setMessage('');try{
  await api('/api/admin/billing/payments',token,'POST',{...payment,amount:Number(payment.amount)});
  setPayment({subscriptionId:'',amount:'',method:'SINPE',note:''});await refresh();setMessage('Pago registrado correctamente.');
 }catch(e){setError(e.message)}finally{setSaving(false)}}
 const fmt=(n,currency)=>new Intl.NumberFormat('es-CR',{style:'currency',currency}).format(n);
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Costa_Rica'});
 const plusDays=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
 const status=s=>s.endDate<today?'expired':s.endDate<=plusDays(today,7)?'expiring':'current';
 const visibleSubs=billing.subscriptions.filter(s=>{
  const matched=(s.memberName+' '+s.planName).toLowerCase().includes(billingSearch.toLowerCase().trim());
  return matched&&(billingFilter==='all'||billingFilter==='due'&&s.balance>0||billingFilter==='expired'&&status(s)==='expired'||billingFilter==='expiring'&&status(s)==='expiring'||billingFilter==='paid'&&s.balance===0);
 });
 function renew(s){
  const original=subs.find(x=>x.id===s.id);if(!original)return;
  const latest=subs.filter(x=>x.memberId===original.memberId).map(x=>x.endDate).sort().at(-1);
  const start=latest&&latest>=today?plusDays(latest,1):today;
  setAssign({memberId:original.memberId,planId:original.planId,startDate:start});
  setMessage('Renovación preparada para '+s.memberName+'. Revisá la fecha y confirmá en Asignar una membresía.');
  setError('');
  document.querySelector('.membershipAssignSection')?.scrollIntoView({behavior:'smooth',block:'start'});
 }

 return <div className="membershipLayout">
 <section className="panel"><h2>Planes del gimnasio</h2><p>Creá tus planes y definí cuánto duran. La asignación no registra ni confirma un pago.</p>
 <form onSubmit={createPlan} className="membershipForm"><label>Nombre del plan<input required minLength={2} maxLength={100} value={plan.name} onChange={e=>setPlan({...plan,name:e.target.value})} placeholder="Mensual"/></label>
 <label>Precio<input required type="number" min="0" step="0.01" value={plan.price} onChange={e=>setPlan({...plan,price:e.target.value})}/></label>
 <label>Moneda<select value={plan.currency} onChange={e=>setPlan({...plan,currency:e.target.value})}><option value="CRC">Colones (CRC)</option><option value="USD">Dólares (USD)</option></select></label>
 <label>Duración (días)<input required type="number" min="1" max="3660" value={plan.durationDays} onChange={e=>setPlan({...plan,durationDays:e.target.value})}/></label><button disabled={saving} className="primary">Crear plan</button></form>
 <div>{plans.length?plans.map(p=><div className="membershipRow" key={p.id}><strong>{p.name}</strong><span>{new Intl.NumberFormat('es-CR',{style:'currency',currency:p.currency}).format(p.price)} · {p.durationDays} días</span></div>):<p>No hay planes creados.</p>}</div></section>
 <section className="panel membershipAssignSection"><h2>Asignar una membresía</h2><form className="membershipForm" onSubmit={assignPlan}>
 <label>Miembro<select required value={assign.memberId} onChange={e=>setAssign({...assign,memberId:e.target.value})}><option value="">Seleccioná un miembro</option>{members.map(m=><option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label>
 <label>Plan<select required value={assign.planId} onChange={e=>setAssign({...assign,planId:e.target.value})}><option value="">Seleccioná un plan</option>{plans.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
 <label>Fecha de inicio<input required type="date" value={assign.startDate} onChange={e=>setAssign({...assign,startDate:e.target.value})}/></label>
 <button disabled={saving||!plans.length||!members.length} className="primary">Asignar membresía</button></form>
 {error&&<p role="alert" className="error">{error}</p>}{message&&<p className="membershipMessage" role="status">{message}</p>}
 <h2>Asignaciones recientes</h2>{subs.length?subs.slice(0,30).map(s=><div className="membershipRow" key={s.id}><strong>{s.memberName} · {s.planName}</strong><span>{s.startDate} — {s.endDate}</span></div>):<p>Aún no hay membresías asignadas.</p>}
 </section>
 <section className="panel billingPanel"><h2>Control de cobros</h2><p>Registrá pagos de membresías. Los ingresos se calculan únicamente con pagos registrados, no con planes asignados.</p>
 <div className="billingSummary">{billing.monthTotals.map(t=><div key={t.currency}><small>Ingresos del mes · {t.currency}</small><strong>{fmt(t.total,t.currency)}</strong></div>)}{!billing.monthTotals.length&&<p>Sin pagos registrados este mes.</p>}</div>
 <form onSubmit={recordPayment} className="membershipForm">
 <label>Membresía<select required value={payment.subscriptionId} onChange={e=>{const s=billing.subscriptions.find(x=>x.id===e.target.value);setPayment(p=>({...p,subscriptionId:e.target.value,amount:s?String(s.balance):''}))}}><option value="">Seleccionar membresía pendiente</option>{billing.subscriptions.filter(x=>x.balance>0).map(s=><option key={s.id} value={s.id}>{s.memberName} · {s.planName} · {fmt(s.balance,s.currency)}</option>)}</select></label>
 <label>Monto<input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={e=>setPayment(p=>({...p,amount:e.target.value}))}/></label>
 <label>Método<select value={payment.method} onChange={e=>setPayment(p=>({...p,method:e.target.value}))}>{['SINPE','Efectivo','Transferencia','Tarjeta','Otro'].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Nota (opcional)<input maxLength={300} value={payment.note} onChange={e=>setPayment(p=>({...p,note:e.target.value}))}/></label>
 <button className="primary" disabled={saving||!payment.subscriptionId}>Registrar pago</button></form>
 <h3>Cuentas por cobrar y vencimientos</h3>
 <div className="billingFilters"><input type="search" aria-label="Buscar membresías" placeholder="Buscar miembro o plan" value={billingSearch} onChange={e=>setBillingSearch(e.target.value)}/><select aria-label="Filtrar membresías" value={billingFilter} onChange={e=>setBillingFilter(e.target.value)}><option value="all">Todas</option><option value="due">Con saldo pendiente</option><option value="expired">Vencidas</option><option value="expiring">Vencen en 7 días</option><option value="paid">Pagadas</option></select></div>
 <small>{visibleSubs.length} membresías en este filtro · Los saldos y vencimientos se muestran por separado.</small>
 {visibleSubs.length?visibleSubs.map(s=><div className="billingRow" key={s.id}><div><strong>{s.memberName} · {s.planName}</strong><small>{s.startDate} — {s.endDate} · {status(s)==='expired'?'Vencida':status(s)==='expiring'?'Próxima a vencer':'Vigente'}</small></div><div className="billingRowActions"><strong>{fmt(s.balance,s.currency)} pendiente</strong><small>{s.balance===0?'Pagada':s.paid>0?'Pago parcial':'Sin pagos'} · Abonado {fmt(s.paid,s.currency)}</small><button className="secondary" type="button" onClick={()=>renew(s)}>Renovar</button>{s.balance>0&&<button className="secondary" type="button" onClick={()=>{setPayment(p=>({...p,subscriptionId:s.id,amount:String(s.balance)}));setMessage('Seleccionaste el saldo de '+s.memberName+'. Revisá los datos y confirmá el pago.')}}>Cobrar saldo</button>}</div></div>):<p>No hay membresías que coincidan con los filtros.</p>}
 <h3>Últimos pagos</h3>{billing.payments.slice(0,20).map(x=><div className="billingRow" key={x.id}><span>{new Date(x.paidAt).toLocaleDateString('es-CR')} · {x.method}</span><strong>{fmt(x.amount,x.currency)}</strong></div>)}
 </section></div>;
}
