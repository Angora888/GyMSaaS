import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export default function MemberHome({token,onLogout}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('inicio'),[checkinStatus,setCheckinStatus]=useState(''),[editingProfile,setEditingProfile]=useState(false),[profileForm,setProfileForm]=useState({phone:'',emergencyPhone:'',weightKg:'',heightCm:''}),[profileNotice,setProfileNotice]=useState(''),[savingProfile,setSavingProfile]=useState(false);
 useEffect(()=>{let active=true;fetch(API+'/api/member/dashboard',{headers:{Authorization:'Bearer '+token}})
  .then(async r=>{if(!r.ok)throw Error(r.status===401?'Tu sesión venció. Ingresá de nuevo.':'No se pudo cargar tu información.');return r.json()})
  .then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[token]);
 useEffect(()=>{
  const code=new URLSearchParams(window.location.search).get('checkin');
  if(!code)return;
  let cancelled=false;
  async function checkin(){
   try{
    const r=await fetch(API+'/api/member/checkin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({code})});
    const result=await r.json().catch(()=>({}));
    if(cancelled)return;
    if(!r.ok)throw Error(result.message||'No se pudo registrar la asistencia.');
    setCheckinStatus(result.message||'¡Asistencia registrada!');
    const dashboard=await fetch(API+'/api/member/dashboard',{headers:{Authorization:'Bearer '+token}});
    if(dashboard.ok&&!cancelled)setData(await dashboard.json());
   }catch(e){if(!cancelled)setCheckinStatus(e.message||'Escaneá el QR de recepción nuevamente.')}
   finally{if(!cancelled)window.history.replaceState({},'',window.location.pathname);}
  }
  checkin();return()=>{cancelled=true};
 },[token]);
 function editProfile(){setProfileForm({phone:data.member.phone||'',emergencyPhone:data.member.emergencyPhone||'',weightKg:data.member.weightKg??'',heightCm:data.member.heightCm??''});setProfileNotice('');setEditingProfile(true)}
 async function saveProfile(e){e.preventDefault();setSavingProfile(true);setProfileNotice('');try{
  const payload={phone:profileForm.phone,emergencyPhone:profileForm.emergencyPhone,weightKg:profileForm.weightKg===''?null:Number(profileForm.weightKg),heightCm:profileForm.heightCm===''?null:Number(profileForm.heightCm)};
  const r=await fetch(API+'/api/member/profile',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await r.json().catch(()=>({}));if(!r.ok)throw Error(result.message||'No se pudo guardar el perfil.');
  setData(old=>({...old,member:{...old.member,...result}}));setEditingProfile(false);setProfileNotice('¡Perfil actualizado!');
 }catch(e){setProfileNotice(e.message)}finally{setSavingProfile(false)}}
 if(error)return <div className="memberHome"><div className="mhCard"><p role="alert">{error}</p><button className="secondary" onClick={onLogout}>Volver al login</button></div></div>;
 if(!data)return <div className="memberHome"><div className="mhCard">Cargando tu gimnasio…</div></div>;
 const current=data.membership;
 const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay()+i);return d});
 const attended=new Set(data.attendance.map(x=>new Date(x).toLocaleDateString('en-CA')));
 return <div className="memberHome"><div className="mhLayout">
  <div className="mhTop"><div><small>{data.gym.name}</small><h1>¡Hola, <span>{data.member.fullName.split(' ')[0]}</span>!</h1><p>¡Seguí entrenando con fuerza!</p></div><button className="mhLogout" onClick={onLogout}>Salir ↗</button></div>
  {checkinStatus&&<div className="mhCard" role="status"><strong>{checkinStatus}</strong></div>}
  {tab==='inicio'?<><div className="mhHero"><span className="mhHeroIcon">▦</span><div><strong>Tu asistencia</strong><p>Para registrar tu entrada, escaneá el QR temporal de recepción con la cámara de tu celular.</p></div></div>
   <div className="mhCard"><h2>✓ Asistencia semanal</h2><div className="mhDays">{days.map((d,i)=>{const key=d.toLocaleDateString('en-CA');return <div key={i}><small>{['D','L','M','M','J','V','S'][i]}</small><span className={attended.has(key)?'mhAttended':''}>{attended.has(key)?'✓':d.getDate()}</span></div>})}</div><p className="mhHint">Asistencias registradas en el sistema durante los últimos 14 días.</p></div>
   <div className="mhCard"><h2>▤ Membresía</h2>{current?<><strong className="mhBig">{current.plan}</strong><p>{current.status==='active'?'Activa':current.status==='expired'?'Vencida':'Próxima'} · Hasta {current.endDate}</p></>:<><strong className="mhStatus">Sin plan</strong><p>Tu gimnasio todavía no te ha asignado una membresía.</p></>}</div>
   <div className="mhCard"><h2>🔥 Rutina activa</h2>{data.routine?<><strong>{data.routine.name}</strong><p>{data.routine.description||'Tu rutina está asignada.'}</p></>:<p>No tenés una rutina asignada.</p>}</div></>:tab==='rutinas'?<div className="mhCard"><h2>Rutinas</h2>{data.routine?<><strong>{data.routine.name}</strong><p>{data.routine.description}</p></>:<p>Próximamente tu entrenador podrá asignarte una rutina.</p>}</div>:<div className="mhCard"><h2>Mi perfil</h2><p><strong>{data.member.fullName}</strong></p><p>{data.member.email}</p><p>{data.gym.name}</p>
 {profileNotice&&<p role="status">{profileNotice}</p>}
 {editingProfile?<form className="mhProfileForm" onSubmit={saveProfile}>
 <label>Teléfono personal<input type="tel" maxLength={40} value={profileForm.phone} onChange={e=>setProfileForm(f=>({...f,phone:e.target.value}))}/></label>
 <label>Teléfono de emergencia<input type="tel" maxLength={40} value={profileForm.emergencyPhone} onChange={e=>setProfileForm(f=>({...f,emergencyPhone:e.target.value}))}/></label>
 <label>Peso (kg)<input type="number" min="10" max="500" step="0.1" value={profileForm.weightKg} onChange={e=>setProfileForm(f=>({...f,weightKg:e.target.value}))}/></label>
 <label>Estatura (cm)<input type="number" min="50" max="260" step="0.1" value={profileForm.heightCm} onChange={e=>setProfileForm(f=>({...f,heightCm:e.target.value}))}/></label>
 <div className="mhProfileActions"><button className="primary" disabled={savingProfile}>{savingProfile?'Guardando…':'Guardar cambios'}</button><button type="button" className="secondary" onClick={()=>setEditingProfile(false)}>Cancelar</button></div></form>:<>
 <div className="mhProfileGrid"><div><small>Teléfono</small><strong>{data.member.phone||'Sin registrar'}</strong></div><div><small>Emergencias</small><strong>{data.member.emergencyPhone||'Sin registrar'}</strong></div><div><small>Peso</small><strong>{data.member.weightKg!=null?data.member.weightKg+' kg':'Sin registrar'}</strong></div><div><small>Estatura</small><strong>{data.member.heightCm!=null?data.member.heightCm+' cm':'Sin registrar'}</strong></div></div>
 <div className="mhBmi"><span>Índice de masa corporal (IMC)</span><strong>{data.member.weightKg>0&&data.member.heightCm>0?(data.member.weightKg/Math.pow(data.member.heightCm/100,2)).toFixed(1):'—'}</strong><small>Es una medida orientativa, no un diagnóstico ni una valoración de salud individual.</small></div>
 <button className="primary" onClick={editProfile}>Editar mi perfil</button></>}
 <button className="secondary mhSignout" onClick={onLogout}>Cerrar sesión</button></div>}
  <nav className="mhNav"><button className={tab==='inicio'?'active':''} onClick={()=>setTab('inicio')}>⌂ Inicio</button><button className={tab==='rutinas'?'active':''} onClick={()=>setTab('rutinas')}>▤ Rutinas</button><button className={tab==='perfil'?'active':''} onClick={()=>setTab('perfil')}>◉ Perfil</button></nav>
 </div></div>;
}
