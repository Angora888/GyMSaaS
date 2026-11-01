import React from 'react';

// Original schematic illustrations supplied with GyMSaaS. These are movement cues,
// not clinical anatomical drawings. Custom catalog images always override them.
const rules=[
 [/extensi[oó]n de piernas|leg extension/, 'extension'],
 [/flexi[oó]n de piernas|curl femoral|leg curl/, 'curl'],
 [/prensa de piernas|leg press/, 'press'],
 [/sentadilla|squat/, 'squat'],
 [/peso muerto|deadlift|rumano/, 'deadlift'],
 [/elevaci[oó]n de talones|pantorrilla|calf raise/, 'calf'],
 [/press de pecho|press banca|bench press|press inclinado/, 'bench'],
 [/aperturas|pec deck|contractora/, 'fly'],
 [/jal[oó]n al pecho|lat pulldown|polea alta|dominada/, 'pulldown'],
 [/remo|row/, 'row'],
 [/press militar|press hombro|shoulder press/, 'shoulder'],
 [/elevaciones laterales|lateral raise/, 'lateral'],
 [/curl de b[ií]ceps|curl martillo|biceps curl/, 'biceps'],
 [/tr[ií]ceps|pushdown|extensi[oó]n de codo/, 'triceps'],
 [/plancha|plank/, 'plank'],
 [/abdominal|crunch/, 'crunch'],
 [/zancada|desplante|lunge/, 'lunge'],
 [/hip thrust|puente de gl[uú]teos/, 'bridge'],
];
export function illustrationKind(name=''){
 const normalized=String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 return rules.find(([re])=>re.test(normalized))?.[1]||null;
}
const configs={
 extension:{angle:0,seat:true,limb:'leg',label:'Extender rodillas'},
 curl:{angle:30,seat:true,limb:'leg',label:'Flexionar rodillas'},
 press:{angle:40,seat:false,limb:'leg',label:'Empujar plataforma'},
 squat:{angle:20,seat:false,limb:'stand',label:'Extender caderas'},
 deadlift:{angle:40,seat:false,limb:'stand',label:'Elevar carga'},
 calf:{angle:0,seat:false,limb:'stand',label:'Elevar talones'},
 bench:{angle:0,seat:true,limb:'arm',label:'Empujar carga'},
 fly:{angle:35,seat:true,limb:'arm',label:'Cerrar brazos'},
 pulldown:{angle:70,seat:true,limb:'arm',label:'Bajar barra'},
 row:{angle:35,seat:true,limb:'arm',label:'Tirar hacia el cuerpo'},
 shoulder:{angle:70,seat:true,limb:'arm',label:'Empujar arriba'},
 lateral:{angle:45,seat:false,limb:'arm',label:'Elevar brazos'},
 biceps:{angle:25,seat:false,limb:'arm',label:'Flexionar codos'},
 triceps:{angle:55,seat:false,limb:'arm',label:'Extender codos'},
 plank:{angle:0,seat:false,limb:'floor',label:'Mantener postura'},
 crunch:{angle:25,seat:false,limb:'floor',label:'Flexionar abdomen'},
 lunge:{angle:35,seat:false,limb:'stand',label:'Impulsar subida'},
 bridge:{angle:30,seat:false,limb:'floor',label:'Elevar cadera'}
};
function Pose({kind,finish=false}){
 const c=configs[kind];const leg=c.limb==='leg',arm=c.limb==='arm',floor=c.limb==='floor',stand=c.limb==='stand';
 const active=finish?'#e85471':'#a8bac9';
 const x=finish?17:-17;
 return <g transform="translate(0 1)" fill="none" strokeLinecap="round" strokeLinejoin="round">
  <path d="M16 130H144" stroke="#586170" strokeWidth="2"/>
  {c.seat&&<g stroke="#677482" strokeWidth="4"><path d="M56 90H110M61 90L50 129M105 90L113 129M56 90L39 62"/></g>}
  {leg&&<path d="M123 50V125M113 50H135M109 65H140" stroke="#5e6978" strokeWidth="5"/>}
  {arm&&<path d="M120 26V130M93 26H143" stroke="#5e6978" strokeWidth="4"/>}
  {stand&&<path d="M100 125V135M84 135H116" stroke="#5e6978" strokeWidth="5"/>}
  <g stroke={active} strokeWidth="9">
   <circle cx={floor?49:leg?57:stand?73:66} cy={floor?82:leg?51:stand?33:46} r="9" fill="#253241" strokeWidth="3"/>
   {floor?<><path d={finish?'M58 85L97 79L127 91':'M58 85L89 102L127 103'}/><path d="M78 92L62 125M123 94L140 127" strokeWidth="6"/></>:
   <><path d={stand?(finish?'M74 47L80 81':'M74 47L92 91'):'M66 57L79 87'}/>
   {leg?<><path d={finish?'M79 86L111 83L125 48':'M79 86L106 88L119 119'}/><path d="M79 87L66 116" strokeWidth="6"/></>:
   stand?<><path d={finish?'M80 82L73 120M80 82L98 121':'M92 90L66 124M92 90L120 124'}/><path d={finish?'M77 58L103 71':'M79 58L106 91'} strokeWidth="6"/></>:
   <><path d="M79 87L57 115M79 87L94 114"/><path d={finish?'M70 67L108 38':'M70 67L106 80'} strokeWidth="6"/></>}
   </>}
  </g>
  {arm&&<path d={finish?'M103 35L127 35':'M102 79L127 79'} stroke="#efaa58" strokeWidth="7"/>}
  {leg&&<circle cx={finish?125:119} cy={finish?48:119} r="5" fill="#efaa58"/>}
  {stand&&<path d={finish?'M99 115H120':'M112 119H133'} stroke="#efaa58" strokeWidth="6"/>}
  </g>;
}
export default function ExerciseIllustration({name,kind:providedKind,className=''}) {
 const kind=providedKind||illustrationKind(name);
 if(!kind||!configs[kind])return null;
 return <div className={'exerciseSchematic '+className} role="img" aria-label={'Guía esquemática del movimiento: '+configs[kind].label+'. Inicio y final.'}>
 <svg viewBox="0 0 340 195" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
 <rect x="1" y="1" width="338" height="193" rx="15" fill="#171c24" stroke="#3b4653"/>
 <path d="M170 12V155" stroke="#36414c" strokeDasharray="4 5"/>
 <g transform="translate(6 19)"><Pose kind={kind}/></g>
 <g transform="translate(174 19)"><Pose kind={kind} finish/></g>
 <path d="M143 95Q170 79 193 95" fill="none" stroke="#ee7188" strokeWidth="2" strokeDasharray="4 5"/>
 <text x="85" y="172" fill="#cad4de" fontSize="13" fontWeight="700" textAnchor="middle">INICIO</text>
 <text x="256" y="172" fill="#f68fa0" fontSize="13" fontWeight="700" textAnchor="middle">FINAL</text>
 </svg>
 <small>{configs[kind].label} · Esquema orientativo</small>
 </div>;
}