import React,{useEffect,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export default function AttendancePanel({token}){
 const [history,setHistory]=useState([]),[historyError,setHistoryError]=useState(''),[search,setSearch]=useState(''),[from,setFrom]=useState(()=>{const d=new Date(Date.now()-6*86400000);return d.toLocaleDateString('sv-SE',{timeZone:'America/Costa_Rica'})}),[to,setTo]=useState(()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Costa_Rica'})),[qr,setQr]=useState(null),[entries,setEntries]=useState([]),[count,setCount]=useState(0),[error,setError]=useState(''),[seconds,setSeconds]=useState(0);
 useEffect(()=>{
  let alive=true;
  async function load(){
   try{
    const [a,b]=await Promise.all(['/api/admin/attendance/qr','/api/admin/attendance/today'].map(path=>fetch(API+path,{headers:{Authorization:'Bearer '+token}})));
    if(!a.ok||!b.ok)throw Error('No fue posible cargar asistencia');
    const [code,history]=await Promise.all([a.json(),b.json()]);
    if(alive){setQr(code);setEntries(history.entries);setCount(history.count);setError('')}
   }catch(e){if(alive)setError(e.message)}
  }
  load();const refresh=setInterval(load,10000);const tick=setInterval(()=>{if(alive)setSeconds(Date.now())},1000);
  return()=>{alive=false;clearInterval(refresh);clearInterval(tick)};
 },[token]);
 useEffect(()=>{
  let active=true;
  fetch(API+'/api/admin/attendance/history?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),{headers:{Authorization:'Bearer '+token}})
   .then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'No se pudo cargar el historial');return data})
   .then(data=>{if(active){setHistory(data.entries||[]);setHistoryError('')}})
   .catch(e=>{if(active){setHistory([]);setHistoryError(e.message)}});
  return()=>{active=false};
 },[token,from,to]);
 const visibleHistory=history.filter(x=>x.fullName.toLowerCase().includes(search.toLowerCase().trim()));
 const expires=qr?Math.max(0,Math.ceil((Date.parse(qr.expiresAt)-Date.now())/1000)):0;
 const link=qr?window.location.origin+'/g/'+encodeURIComponent(qr.slug)+'?checkin='+encodeURIComponent(qr.code):'';
 return <div className="panel receptionPanel"><h2>QR de asistencia en recepción</h2>
 <p>Mostrá esta pantalla en la recepción del gimnasio. El código cambia cada 30 segundos y no es el QR permanente de registro.</p>
 {error&&<p className="error" role="alert">{error}</p>}
 {qr&&<div className="receptionQr"><div className="qrWhite"><QRCodeSVG value={link} size={230} includeMargin/></div><strong>{qr.name}</strong><p>Se renueva en {expires} segundos</p></div>}
 <h2>Entradas de hoy: {count}</h2>
 {entries.length?entries.map((item,i)=><div className="membershipRow" key={i}><strong>{item.fullName}</strong><span>{new Date(item.checkedInAt).toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'})}</span></div>):<p>Sin asistencias registradas hoy.</p>}
 <section className="attendanceHistory"><h2>Historial de asistencias</h2><div className="attendanceFilters"><label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Buscar miembro<input type="search" value={search} placeholder="Nombre del miembro" onChange={e=>setSearch(e.target.value)}/></label></div>{historyError&&<p className="error" role="alert">{historyError}</p>}<p>{visibleHistory.length} registros encontrados</p>{visibleHistory.slice(0,200).map((item,i)=><div className="membershipRow" key={item.id+'-'+item.checkedInAt+'-'+i}><strong>{item.fullName}</strong><span>{new Date(item.checkedInAt).toLocaleString('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'medium',timeStyle:'short'})}</span></div>)}{!visibleHistory.length&&!historyError&&<p>No hay entradas para este filtro.</p>}{visibleHistory.length>200&&<small>Mostrando los primeros 200 resultados. Reducí el rango para ver los demás.</small>}</section>
 <small>El QR rotativo reduce reutilizaciones, pero una fotografía transmitida en tiempo real todavía podría utilizarse remotamente. Para control físico estricto se requerirá un dispositivo o validación en recepción.</small>
 </div>;
}
