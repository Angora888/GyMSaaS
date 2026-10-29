import React,{useEffect,useRef,useState} from 'react';
const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID||'1047168144977-senbr37p0s8n88ir9vcuvg8almtjtomr.apps.googleusercontent.com';
export default function GoogleLoginButton({onCredential}){
 const node=useRef(null),callback=useRef(onCredential),[error,setError]=useState('');
 callback.current=onCredential;
 useEffect(()=>{
  let cancelled=false;
  const render=()=>{
   if(cancelled||!node.current||!window.google?.accounts?.id)return;
   window.google.accounts.id.initialize({client_id:clientId,callback:response=>callback.current(response.credential),auto_select:false});
   window.google.accounts.id.renderButton(node.current,{theme:'outline',size:'large',width:Math.max(200,Math.min(400,Math.floor(node.current.getBoundingClientRect().width||300))),text:'continue_with'});
  };
  if(window.google?.accounts?.id){render();}
  else{
   const script=document.createElement('script');
   script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
   script.onload=render;script.onerror=()=>setError('No se pudo cargar Google.');
   document.head.appendChild(script);
  }
  return ()=>{cancelled=true};
 },[]);
 return <div className="googleLogin"><div ref={node}/>{error&&<small role="alert">{error}</small>}</div>;
}
