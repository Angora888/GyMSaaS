import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export default function MemberHome({token,onLogout}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('inicio'),[checkinStatus,setCheckinStatus]=useState('');
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
   <div className="mhCard"><h2>🔥 Rutina activa</h2>{data.routine?<><strong>{data.routine.name}</strong><p>{data.routine.description||'Tu rutina está asignada.'}</p></>:<p>No tenés una rutina asignada.</p>}</div></>:tab==='rutinas'?<div className="mhCard"><h2>Rutinas</h2>{data.routine?<><strong>{data.routine.name}</strong><p>{data.routine.description}</p></>:<p>Próximamente tu entrenador podrá asignarte una rutina.</p>}</div>:<div className="mhCard"><h2>Mi perfil</h2><p><strong>{data.member.fullName}</strong></p><p>{data.member.email}</p><p>{data.gym.name}</p><button className="secondary" onClick={onLogout}>Cerrar sesión</button></div>}
  <nav className="mhNav"><button className={tab==='inicio'?'active':''} onClick={()=>setTab('inicio')}>⌂ Inicio</button><button className={tab==='rutinas'?'active':''} onClick={()=>setTab('rutinas')}>▤ Rutinas</button><button className={tab==='perfil'?'active':''} onClick={()=>setTab('perfil')}>◉ Perfil</button></nav>
 </div></div>;
}
