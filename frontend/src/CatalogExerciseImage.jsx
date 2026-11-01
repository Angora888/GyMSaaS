import React,{useState} from 'react';
import ExerciseIllustration from './ExerciseIllustration';

// Static illustrations live in frontend/public/ejercicios/<category>/<exercise>.webp.
// Custom images saved in the catalog always take priority.
export function exerciseAssetPath(category,name){
 const slug=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 return '/ejercicios/'+slug(category||'general')+'/'+slug(name)+'.webp';
}
export default function CatalogExerciseImage({name,category,imageUrl,className}){
 const src=imageUrl||exerciseAssetPath(category,name);
 const [failed,setFailed]=useState(false);
 React.useEffect(()=>setFailed(false),[src]);
 if(failed)return <ExerciseIllustration name={name}/>;
 return <img className={className} src={src} alt={'Demostración de '+name} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>;
}
