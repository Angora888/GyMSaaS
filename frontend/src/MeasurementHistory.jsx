import React,{useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
function MiniChart({items,field,unit}){
 const values=items.map(x=>Number(x[field])).filter(Number.isFinite);
 if(!values.length)return <p className="mhHint">Guardá tu primera medición para empezar a ver la evolución.</p>;
 if(values.length===1)return <p className="mhHint">Primera medición: <strong>{values[0]} {unit}</strong>. Agregá otra para ver la tendencia.</p>;
 const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,0.1);
 const points=values.map((v,i)=>[14+i*292/(values.length-1),104-(v-lo)/span*82]);
 return <div className="mhChart"><svg viewBox="0 0 320 120" role="img" aria-label={`Evolución de ${field==='weightKg'?'peso':'IMC'}: ${values.map(x=>x.toFixed(1)).join(', ')}`}>
 <line x1="14" x2="306" y1="104" y2="104" stroke="#58404a" strokeWidth="1"/>
 <polyline fill="none" stroke="#ff4a62" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points.map(p=>p.join(',')).join(' ')}/>
 {points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3.5" fill="#ff7181"/>)}</svg>
 <div className="mhChartLabels"><span>{new Date(items[0].recordedAt).toLocaleDateString('es-CR')}</span><strong>{values.at(-1).toFixed(1)} {unit}</strong><span>{new Date(items.at(-1).recordedAt).toLocaleDateString('es-CR')}</span></div></div>;
}
export default function MeasurementHistory({token,revision}){
 const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;setLoading(true);fetch(API+'/api/member/measurements',{headers:{Authorization:'Bearer '+token}})
 .then(async r=>{if(!r.ok)throw Error('No fue posible cargar el historial');return r.json()}).then(d=>{if(alive){setItems(d);setError('')}})
 .catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});
 return()=>{alive=false}},[token,revision]);
 return <section className="mhCard"><h2>📈 Mi progreso</h2><p className="mhHint">Mediciones registradas al actualizar tu perfil. Sin estimaciones ni datos simulados.</p>
 {loading?<p>Cargando mediciones…</p>:error?<p role="alert" className="error">{error}</p>:<>
 <h3>Peso (kg)</h3><MiniChart items={items} field="weightKg" unit="kg"/>
 <h3>IMC</h3><MiniChart items={items} field="bmi" unit=""/>
 {items.length>1&&<p className="mhHint">Cambio desde la primera medición: {(Number(items.at(-1).weightKg)-Number(items[0].weightKg)).toFixed(1)} kg.</p>}
 <p className="mhHint">El IMC es orientativo y no distingue masa muscular de grasa corporal.</p>
 </>}</section>;
}
