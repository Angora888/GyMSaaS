import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export default function TrainersPanel({token,members}){
 const [accountTrainer,setAccountTrainer]=useState(''),[accountForm,setAccountForm]=useState({email:'',password:''}),[trainers,setTrainers]=useState([]),[assignments,setAssignments]=useState([]),[name,setName]=useState(''),[choice,setChoice]=useState({trainerId:'',memberId:''}),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function call(path,method='GET',body){
  const r=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===204)return null;
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.message||'No se pudo completar la operación');
  return data;
 }
 async function refresh(){const d=await call('/api/admin/trainers');setTrainers(d.trainers);setAssignments(d.assignments)}
 useEffect(()=>{let active=true;fetch(API+'/api/admin/trainers',{headers:{Authorization:'Bearer '+token}})
 .then(r=>{if(!r.ok)throw Error('No se pudieron cargar los entrenadores');return r.json()})
 .then(d=>{if(active){setTrainers(d.trainers);setAssignments(d.assignments)}})
 .catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[token]);
 async function create(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await call('/api/admin/trainers','POST',{name});setName('');await refresh();setNotice('Entrenador registrado.')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function assign(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await call('/api/admin/trainers/'+choice.trainerId+'/members','POST',{memberId:choice.memberId});await refresh();setNotice('Miembro asignado correctamente.')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function unassign(trainerId,memberId){setBusy(true);setError('');setNotice('');try{await call('/api/admin/trainers/'+trainerId+'/members/'+memberId,'DELETE');await refresh();setNotice('Asignación eliminada.')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function createAccount(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await call('/api/admin/trainers/'+accountTrainer+'/account','POST',accountForm);setAccountForm({email:'',password:''});setAccountTrainer('');setNotice('Acceso del entrenador creado. Puede entrar desde la pantalla de inicio con su correo y contraseña.')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="trainerLayout"><section className="panel"><h2>Entrenadores</h2><p>Registrá los profesionales de tu gimnasio y organizá sus clientes.</p>
 <form onSubmit={create} className="trainerForm"><label>Nombre completo<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del entrenador"/></label><button className="primary" disabled={busy}>Agregar entrenador</button></form>
 {trainers.length?trainers.map(t=><div className="trainerCard" key={t.id}><strong>{t.name}</strong><small>{assignments.filter(a=>a.trainerId===t.id).length} miembros asignados</small>{assignments.filter(a=>a.trainerId===t.id).map(a=><div className="trainerMember" key={a.memberId}><span>{a.memberName}</span><button className="secondary" disabled={busy} onClick={()=>unassign(t.id,a.memberId)}>Quitar</button></div>)}</div>):<p>Sin entrenadores registrados.</p>}
 </section><section className="panel"><h2>Asignar miembro</h2><p>El dueño decide qué clientes atiende cada entrenador.</p>
 <form onSubmit={assign} className="trainerForm"><label>Entrenador<select required value={choice.trainerId} onChange={e=>setChoice({...choice,trainerId:e.target.value})}><option value="">Seleccionar</option>{trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <label>Miembro<select required value={choice.memberId} onChange={e=>setChoice({...choice,memberId:e.target.value})}><option value="">Seleccionar</option>{members.map(m=><option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label>
 <button className="primary" disabled={busy||!trainers.length||!members.length}>Asignar miembro</button></form>
 {notice&&<p role="status" className="membershipMessage">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 <h3>Acceso independiente del entrenador</h3><form className="trainerForm" onSubmit={createAccount}><label>Entrenador<select required value={accountTrainer} onChange={e=>setAccountTrainer(e.target.value)}><option value="">Seleccionar entrenador</option>{trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Correo de acceso<input required type="email" autoComplete="off" value={accountForm.email} onChange={e=>setAccountForm(x=>({...x,email:e.target.value}))}/></label><label>Contraseña inicial (mínimo 12 caracteres)<input required type="password" minLength={12} autoComplete="new-password" value={accountForm.password} onChange={e=>setAccountForm(x=>({...x,password:e.target.value}))}/></label><button className="primary" disabled={busy||!accountTrainer}>Crear acceso del entrenador</button></form><p className="trainerNote">Cada entrenador solamente podrá consultar y gestionar sus alumnos asignados; no tendrá permisos de cobros o configuración.</p></section></div>;
}
