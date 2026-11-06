import GoogleLoginButton from './GoogleLoginButton.jsx';
import React,{useEffect,useState} from 'react';
import MemberHome from './MemberHome.jsx';

const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
const KEY='gymsaas.personal.session';
function readToken(){
 try{
  const token=sessionStorage.getItem(KEY);
  if(!token)return null;
  const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  if(!payload.exp||payload.exp*1000<=Date.now()){sessionStorage.removeItem(KEY);return null}
  return token;
 }catch{sessionStorage.removeItem(KEY);return null}
}
export default function PersonalPortal(){
 const [token,setToken]=useState(readToken),[profile,setProfile]=useState(null),[migrationNotice,setMigrationNotice]=useState('');
 const [mode,setMode]=useState('register'),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[form,setForm]=useState({fullName:'',email:'',password:''});
 useEffect(()=>{
  if(!token){setProfile(null);return}
  let active=true;
  fetch(API+'/api/personal/me',{headers:{Authorization:'Bearer '+token}})
   .then(async r=>{if(!r.ok)throw Error('Tu sesión terminó. Ingresá nuevamente.');return r.json()})
   .then(data=>{if(active)setProfile(data)})
   .catch(e=>{if(active){setError(e.message);sessionStorage.removeItem(KEY);setToken(null);setProfile(null)}});
  return()=>{active=false};
 },[token]);
 async function googleLogin(credential){
  if(busy)return;setBusy(true);setError('');
  try{
   const r=await fetch(API+'/api/personal/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.message||data.detail||'No se pudo ingresar con Google.');
   if(!data.token?.accessToken)throw Error('No se recibió una sesión válida.');
   sessionStorage.setItem(KEY,data.token.accessToken);
   if(data.migrated)setMigrationNotice('¡Tus rutinas anteriores están aquí! Migramos '+data.migratedPrograms+' rutina(s) y '+data.migratedSessions+' entrenamiento(s) de GyM Demo. El original se conservó intacto.');
   setToken(data.token.accessToken);
  }catch(e){setError(e.message||'No se pudo ingresar con Google.')}finally{setBusy(false)}
 }
 function logout(){sessionStorage.removeItem(KEY);setToken(null);setProfile(null);setMigrationNotice('');setError('');setMode('login')}
 async function submit(e){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   const r=await fetch(API+'/api/personal/'+(mode==='register'?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.message||(r.status===401?'Correo o contraseña incorrectos.':'No fue posible ingresar.'));
   if(!data.token?.accessToken)throw Error('No se recibió una sesión válida.');
   sessionStorage.setItem(KEY,data.token.accessToken);
   if(data.migrated)setMigrationNotice('¡Bienvenida a Mi Rutina! Se copiaron '+data.migratedPrograms+' rutina(s) y '+data.migratedSessions+' entrenamiento(s) de tu cuenta anterior. Los originales siguen intactos.');
   setToken(data.token.accessToken);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(token&&profile)return <div className="personalMode">{migrationNotice&&<div className="personalMigrationNotice" role="status">{migrationNotice}</div>}<MemberHome token={token} personal onLogout={logout}/></div>;
 if(token)return <div className="personalPortal"><div className="personalAuth"><p>Cargando tu espacio personal…</p></div></div>;
 return <div className="personalPortal"><header className="personalHeader"><a href="/" className="personalLogo">◆ GYM<span>SAAS</span></a><a className="personalHeaderLink" href="/">Inicio</a></header>
  <div className="personalIntro"><span className="personalEyebrow">MI RUTINA · BETA GRATIS</span><h1>Entrená a <em>tu manera.</em></h1><p>No necesitás un gimnasio. Creá tus rutinas, registrá tus series, seguí tu progreso y compartí cada logro.</p>
   <div className="personalHighlights"><span>✓ Rutinas personalizadas</span><span>✓ Ejercicios y temporizadores</span><span>✓ Logros para compartir</span></div>
  </div>
  <div className="personalAuth"><h2>{mode==='register'?'Empezá gratis':'¡Qué bueno verte de nuevo!'}</h2><p>{mode==='register'?'Creá tu cuenta personal y empezá a entrenar.':'Ingresá para continuar con tus entrenamientos.'}</p>
   <div className="personalSwitch"><button type="button" className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>Crear cuenta</button><button type="button" className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>Ingresar</button></div>
   <form onSubmit={submit}>{mode==='register'&&<label>Tu nombre<input required minLength={2} maxLength={150} autoComplete="name" value={form.fullName} onChange={e=>setForm(x=>({...x,fullName:e.target.value}))} placeholder="¿Cómo te llamás?"/></label>}
   <label>Correo electrónico<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))} placeholder="tu@correo.com"/></label>
   <label>Contraseña<input required type="password" minLength={mode==='register'?12:1} autoComplete={mode==='register'?'new-password':'current-password'} value={form.password} onChange={e=>setForm(x=>({...x,password:e.target.value}))} placeholder={mode==='register'?'Mínimo 12 caracteres':'Tu contraseña'}/></label>
   {error&&<p className="error" role="alert">{error}</p>}
   <button type="submit" disabled={busy} className="primary">{busy?'Procesando…':mode==='register'?'Crear cuenta gratuita →':'Entrar a Mi Rutina →'}</button></form>
   <div className="personalGoogleAuth"><div className="authDivider"><span>o continuá con</span></div><GoogleLoginButton onCredential={googleLogin}/></div>
   <small>Tu cuenta personal y tus rutinas están separadas de las cuentas administradas por gimnasios. Durante la beta aún no hay vinculación automática con un gym.</small>
  </div><footer className="personalFooter">MI RUTINA · GYM SAAS · Beta gratuita</footer>
 </div>;
}
