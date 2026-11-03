import React,{useState} from 'react';

const FACTOR=2.2046226218;
const pounds=kg=>Math.round(Number(kg)*FACTOR);
const stamp=date=>new Date(date).toLocaleDateString('es-CR',{day:'numeric',month:'long',year:'numeric'});
export const durationLabel=minutes=>minutes>=60?Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0')+' min':minutes+' min';

export function workoutStats(session,day){
 const completed=new Set(session.completed||[]);
 const exercises=day?.exercises||[];
 const exerciseDone=exercises.filter(ex=>Number(ex.sets)>0&&Array.from({length:Number(ex.sets)},(_,i)=>ex.id+':'+(i+1)).every(key=>completed.has(key))).length;
 let totalVolumeKg=0,weightSets=0,maxKg=0;
 for(const ex of exercises)for(let i=1;i<=Number(ex.sets||0);i++){
  const key=ex.id+':'+i;
  if(!completed.has(key))continue;
  const value=Number(session.weights?.[key]);
  if(session.weights?.[key]!=null&&Number.isFinite(value)&&value>0){
   weightSets++;maxKg=Math.max(maxKg,value);
   // Uses planned repetitions; actual repetitions are not tracked by the app yet.
   totalVolumeKg+=value*Number(ex.reps||0);
  }
 }
 const end=session.finishedAt?new Date(session.finishedAt):new Date();
 const start=new Date(session.startedAt);
 const minutes=Number.isFinite(start.getTime())?Math.max(0,Math.round((end-start)/60000)):0;
 return {minutes,exercises:exerciseDone,plannedExercises:exercises.length,sets:completed.size,plannedSets:exercises.reduce((a,e)=>a+Number(e.sets||0),0),volumeLb:pounds(totalVolumeKg),maxLb:pounds(maxKg),weightSets};
}
const textFor=(s,program,day)=>'🏋️ ¡Entrenamiento completado!\n'+(program?.name||'Mi rutina')+' · '+(day?.name||'')+'\n⏱ '+durationLabel(s.minutes)+' · 💪 '+s.exercises+' ejercicios · ✅ '+s.sets+' series\n🏋️ '+s.volumeLb.toLocaleString('es-CR')+' lb de volumen estimado ('+s.weightSets+' series con peso)\nHecho con Gym SaaS';
function paint(ctx,w,h,s,program,day,date){
 const background=ctx.createLinearGradient(0,0,w,h);background.addColorStop(0,'#0d1320');background.addColorStop(1,'#2d1422');
 ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#fa587a';ctx.fillRect(75,104,15,65);
 ctx.font='bold 48px system-ui, Arial';ctx.fillStyle='#fff';ctx.fillText('GYM',106,152);ctx.fillStyle='#fa587a';ctx.fillText('SAAS',230,152);
 ctx.font='bold 78px system-ui, Arial';ctx.fillStyle='#fff';ctx.fillText('¡LO LOGRASTE!',76,335);
 ctx.font='34px system-ui, Arial';ctx.fillStyle='#c3cbd9';ctx.fillText('ENTRENAMIENTO COMPLETADO',78,401);
 ctx.fillStyle='#1e293b';ctx.beginPath();ctx.roundRect(65,477,w-130,580,36);ctx.fill();
 const metric=(x,y,value,label)=>{ctx.fillStyle='#fff';ctx.font='bold 78px system-ui, Arial';ctx.fillText(String(value),x,y);ctx.fillStyle='#bac7da';ctx.font='30px system-ui, Arial';ctx.fillText(label,x,y+48)};
 metric(115,617,durationLabel(s.minutes),'TIEMPO ENTRENADO');
 metric(115,803,s.exercises,'EJERCICIOS');metric(590,803,s.sets,'SERIES');
 metric(115,983,s.volumeLb.toLocaleString('es-CR')+' lb','VOLUMEN ESTIMADO');
 ctx.fillStyle='#fff';ctx.font='bold 40px system-ui, Arial';ctx.fillText((program?.name||'Mi rutina').slice(0,38),78,1161);
 ctx.fillStyle='#c5ccdb';ctx.font='30px system-ui, Arial';ctx.fillText((day?.name||'')+' · '+stamp(date),78,1212);
 ctx.font='25px system-ui, Arial';ctx.fillStyle='#8c9bae';ctx.fillText('Volumen basado en repeticiones planificadas',78,1278);
}
export default function WorkoutCelebration({session,program,day,onClose}){
 const [sharing,setSharing]=useState(false),[notice,setNotice]=useState('');
 if(!session)return null;
 const stats=workoutStats(session,day);
 const message=textFor(stats,program,day);
 const downloadImage=async()=>{
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  paint(canvas.getContext('2d'),canvas.width,canvas.height,stats,program,day,session.finishedAt||new Date().toISOString());
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('No se pudo crear la imagen.');
  return blob;
 };
 async function share(){
  setSharing(true);setNotice('');
  try{
   const blob=await downloadImage();
   const file=new File([blob],'mi-entrenamiento-gymsaas.png',{type:'image/png'});
   if(navigator.share&&navigator.canShare?.({files:[file]})){
    await navigator.share({files:[file],title:'Mi entrenamiento · Gym SaaS',text:message});
    setNotice('¡Listo para compartir!');
   }else{
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    setNotice('Imagen guardada. Podés subirla a tus historias o redes sociales.');
   }
  }catch(e){if(e.name!=='AbortError')setNotice(e.message||'No se pudo compartir la imagen.')}finally{setSharing(false)}
 }
 async function copy(){try{await navigator.clipboard.writeText(message);setNotice('Resumen copiado. ¡Compartilo donde querás!')}catch{setNotice('No fue posible copiar el texto. Probá compartir la imagen.')}}
 return <section className="mhCard workoutCelebration" aria-live="polite">
  <div className="celebrationFire">🏆 ✨ 💪</div>
  <span className="celebrationTag">ENTRENAMIENTO FINALIZADO</span>
  <h2>¡Lo lograste!</h2>
  <p>Una sesión más construyendo tu mejor versión.</p>
  <div className="celebrationTitle"><strong>{program?.name||'Mi rutina'}</strong><small>{day?.name||''} · {stamp(session.finishedAt||new Date())}</small></div>
  <div className="celebrationMetrics">
   <div><span>⏱</span><strong>{durationLabel(stats.minutes)}</strong><small>Tiempo entrenado</small></div>
   <div><span>💪</span><strong>{stats.exercises} / {stats.plannedExercises}</strong><small>Ejercicios completados</small></div>
   <div><span>✅</span><strong>{stats.sets} / {stats.plannedSets}</strong><small>Series completadas</small></div>
   <div><span>🏋️</span><strong>{stats.volumeLb.toLocaleString('es-CR')} lb</strong><small>Volumen estimado</small></div>
  </div>
  <p className="celebrationNote">Un ejercicio cuenta cuando se completan todas sus series. El volumen se estima multiplicando cada peso registrado por las repeticiones planificadas. No se incluyen series sin peso registrado.</p>
  {stats.maxLb>0&&<p className="celebrationBest">🔥 Mayor peso registrado en una serie: <strong>{stats.maxLb.toLocaleString('es-CR')} lb</strong></p>}
  <div className="celebrationActions">
   <button type="button" className="primary" onClick={share} disabled={sharing}>{sharing?'Preparando imagen…':'📲 Compartir mi logro'}</button>
   <button type="button" className="secondary" onClick={copy}>Copiar resumen</button>
   <button type="button" className="secondary" onClick={onClose}>Volver a mis rutinas</button>
  </div>
  {notice&&<p role="status" className="membershipMessage">{notice}</p>}
 </section>;
}
