import React, { useState } from 'react';

interface Det { label:string; bbox:[number,number,number,number]; confidence:number; region:string; }
interface DetData { detections:Det[]; counts:Record<string,number>; summary:string[]; annotated_image_base64?:string; image_size:{ width:number; height:number }; }
interface Props { data:DetData; originalImage?:string; }

const META:Record<string,{color:string;title:string}>={
  acne_spot:{color:'#e74c3c',title:'Acne spot'},
  dark_spot:{color:'#8e44ad',title:'Dark spot'},
  mole_mark:{color:'#2c3e50',title:'Mole/mark'},
  tanning_region:{color:'#f39c12',title:'Tanning'},
};
const REGIONS:Record<string,string>={ forehead:'Forehead', left_cheek:'Left cheek', right_cheek:'Right cheek', nose:'Nose', chin:'Chin', general:'General' };

export default function DetectionResult({ data, originalImage }: Props) {
  const [filter,setFilter] = useState<string|null>(null);
  const [ann,setAnn]       = useState(true);
  const shown = filter ? data.detections.filter(d=>d.label===filter) : data.detections;
  const cnts:Record<string,number>={};
  data.detections.forEach(d=>{ cnts[d.label]=(cnts[d.label]||0)+1; });

  const b = (bg:string,active:boolean,color?:string):React.CSSProperties=>({ padding:'4px 11px', borderRadius:20, fontSize:11, border:'1.5px solid '+(active?(color||'#1a3a2a'):'#e8e0d4'), background:active?(color||'#1a3a2a'):'#fff', color:active?'#fff':(color||'#6b7b72'), cursor:'pointer', fontFamily:'inherit' });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <strong style={{ fontSize:14 }}>Skin mark detection</strong>
        <span style={{ fontSize:11, color:'#9ab0a0', background:'#f6f0e6', padding:'2px 10px', borderRadius:20 }}>{data.counts.total||0} marks</span>
      </div>

      {data.summary.length>0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {data.summary.map((s,i)=><div key={i} style={{ fontSize:12, color:'#4a5e52', padding:'5px 10px', background:'#f6f0e6', borderRadius:8 }}>{s}</div>)}
        </div>
      )}

      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        <button style={b('#fff',!filter)} onClick={()=>setFilter(null)}>All ({data.counts.total||0})</button>
        {Object.entries(cnts).map(([l,c])=>{
          const m=META[l]||{color:'#888',title:l};
          return <button key={l} style={b(m.color,filter===l,m.color)} onClick={()=>setFilter(filter===l?null:l)}>{m.title} ({c})</button>;
        })}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {data.annotated_image_base64 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ display:'flex', gap:4 }}>
              <button style={b('#1a3a2a',ann)} onClick={()=>setAnn(true)}>Annotated</button>
              {originalImage && <button style={b('#1a3a2a',!ann)} onClick={()=>setAnn(false)}>Original</button>}
            </div>
            <img src={ann?'data:image/jpeg;base64,'+data.annotated_image_base64:(originalImage||'')} alt="detection" style={{ width:'100%', borderRadius:8, border:'1px solid #e8e0d4', display:'block' }} />
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:280, overflowY:'auto' }}>
          {shown.length===0
            ? <div style={{ color:'#9ab0a0', fontSize:12, textAlign:'center', paddingTop:20 }}>No marks in this category</div>
            : shown.map((d,i)=>{
                const m=META[d.label]||{color:'#888',title:d.label};
                return (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 10px', background:'#f6f0e6', borderLeft:'3px solid '+m.color, borderRadius:'0 8px 8px 0' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:m.color }}>{m.title}</div>
                      <div style={{ fontSize:11, color:'#9ab0a0', margin:'2px 0' }}>{REGIONS[d.region]||d.region}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#9ab0a0', marginTop:3 }}>
                        <div style={{ flex:1, height:4, background:'#e8e0d4', borderRadius:10, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:(d.confidence*100)+'%', background:m.color, borderRadius:10 }} />
                        </div>
                        {(d.confidence*100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}
