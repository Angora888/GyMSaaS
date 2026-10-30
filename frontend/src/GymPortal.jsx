import MemberHome from './MemberHome.jsx';
import GoogleLoginButton from './GoogleLoginButton.jsx';
import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const memberKey=slug=>'gymsaas.member.session.'+slug;
function readMemberToken(slug){
 try{
  const key=memberKey(slug),token=sessionStorage.getItem(key);
  if(!token)return null;
  const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  if(!payload.exp||payload.exp*1000<=Date.now()){sessionStorage.removeItem(key);return null}
  return token;
 }catch{sessionStorage.removeItem(memberKey(slug));return null}
}
export default function GymPortal({slug}){
 const [gym,setGym]=useState(null),[mode,setMode]=useState('signup'),[form,setForm]=useState({fullName:'',email:'',password:''}),[token,setToken]=useState(()=>readMemberToken(slug)),[profile,setProfile]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch(API+'/api/public/gyms/'+encodeURIComponent(slug)).then(r=>{if(!r.ok)throw Error('Gimnasio no disponible');return r.json()}).then(setGym).catch(e=>setError(e.message))},[slug]);
 useEffect(()=>{
  const saved=readMemberToken(slug);
  setToken(saved);setProfile(null);setError('');
 },[slug]);
 useEffect(()=>{
  if(!token)return;
  let active=true;
  fetch(API+'/api/member/me',{headers:{Authorization:'Bearer '+token}})
   .then(r=>{if(!r.ok)throw Error(r.status===401?'Tu sesión venció. Ingresá nuevamente.':'No se pudo consultar tu perfil');return r.json()})
   .then(data=>{if(active)setProfile(data)})
   .catch(e=>{if(active){setError(e.message);sessionStorage.removeItem(memberKey(slug));setToken(null);setProfile(null)}});
  return()=>{active=false};
 },[token,slug]);
 function signedIn(nextToken){sessionStorage.setItem(memberKey(slug),nextToken);setToken(nextToken)}
 function logout(){sessionStorage.removeItem(memberKey(slug));setToken(null);setProfile(null);setError('')}

 async function googleLogin(credential){setBusy(true);setError('');try{const r=await fetch(API+'/api/public/gyms/'+encodeURIComponent(slug)+'/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential})});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||data.title||'Google login failed');signedIn(data.token.accessToken)}catch(e){setError(e.message||'No fue posible ingresar con Google')}finally{setBusy(false)}}
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{const r=await fetch(API+'/api/public/gyms/'+encodeURIComponent(slug)+'/'+(mode==='signup'?'signup':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||data.title||'No fue posible iniciar sesión');signedIn(data.token.accessToken);if(data.member)setProfile(data.member)}catch(e){setError(e.message||'No se pudo conectar con el servidor')}finally{setBusy(false)}}
 if(token&&!profile)return <div className="portalShell"><div className="portalBox"><div className="brand">◆ GYM<span>SAAS</span></div><p role="status" className="portalSub">Restaurando tu sesión…</p></div></div>;
 if(profile&&token)return <MemberHome token={token} onLogout={logout}/>;
 return <div className="portalShell"><div className="portalBox"><a href="/" className="portalBack">GYM<span>SAAS</span></a><div className="portalMark">◆</div><h1>{gym?.name||'Tu gimnasio'}</h1><p className="portalSub">Entrená con nosotros. Tu progreso comienza aquí.</p>{profile?<div className="portalSuccess"><h2>¡Bienvenido, {profile.fullName}!</h2><p>Tu perfil de miembro está activo.</p><p>Tu membresía y asistencia estarán disponibles cuando el gimnasio las habilite.</p><button className="primary" onClick={logout}>Cerrar sesión</button></div>:<><div className="switch"><button className={mode==='signup'?'selected':''} onClick={()=>{setMode('signup');setError('')}}>Crear cuenta</button><button className={mode==='login'?'selected':''} onClick={()=>{setMode('login');setError('')}}>Ingresar</button></div><form onSubmit={submit}>{mode==='signup'&&<label>Nombre completo<input required minLength="2" maxLength="150" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))}/></label>}<label>Correo electrónico<input type="email" required autoComplete="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></label><label>Contraseña<input type="password" required minLength={mode==='signup'?12:1} autoComplete={mode==='signup'?'new-password':'current-password'} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy||!gym}>{busy?'Procesando...':mode==='signup'?'Crear mi cuenta':'Ingresar a mi cuenta'}</button></form><div className="socialSoon"><div className="authDivider"><span>o continuar con</span></div><GoogleLoginButton onCredential={googleLogin}/></div></>}</div></div>
}
