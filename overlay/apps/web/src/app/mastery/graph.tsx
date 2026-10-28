"use client";

/** Source-data graph: always render the actual coordinates used by the question. */
export type GraphData={kind:string;points:number[][];x_label:string;y_label:string};
export default function ProblemGraph({data}:{data:GraphData}){
  if (!data.points?.length || data.points.some(p=>p.length!==2 || !p.every(Number.isFinite)))return null;
  const xs=data.points.map(p=>p[0]),ys=data.points.map(p=>p[1]);
  const left=Math.min(0,...xs),right=Math.max(1,...xs),low=Math.min(0,...ys),high=Math.max(1,...ys);
  const dx=Math.max(1,right-left),dy=Math.max(1,high-low);
  const X=(x:number)=>48+480*(x-left)/dx;
  const Y=(y:number)=>220-178*(y-low)/dy;
  const zeroY=Y(0);
  const marks=data.points.map(([x,y])=>`${X(x)},${Y(y)}`).join(' ');
  return <figure aria-label={`${data.y_label} against ${data.x_label}`} className="mt-6 rounded-xl border border-white/10 bg-[#0e1520] p-4">
    <svg viewBox="0 0 570 275" className="w-full max-h-[275px]" role="img" aria-label={`${data.kind} graph showing ${data.points.map(p=>`(${p[0]}, ${p[1]})`).join(' and ')}`}>
      {Array.from({length:5},(_,i)=>{const v=low+i*dy/4;return <g key={i}><line x1={45} x2={535} y1={Y(v)} y2={Y(v)} stroke="#354256" strokeDasharray="4 6"/><text x={38} y={Y(v)+4} fontSize={11} fill="#97abc7" textAnchor="end">{Number(v.toFixed(1))}</text></g>})}
      <line x1={X(0)} x2={X(0)} y1={34} y2={227} stroke="#8ca3c2" strokeWidth="1.1"/>
      <line x1={45} x2={535} y1={zeroY} y2={zeroY} stroke="#8ca3c2" strokeWidth="1.1"/>
      {Array.from({length:5},(_,i)=>{const v=left+i*dx/4;return <text key={i} x={X(v)} y={241} textAnchor="middle" fontSize={11} fill="#97abc7">{Number(v.toFixed(1))}</text>})}
      <polyline points={marks} fill="none" stroke="#c4d7fa" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/>
      {data.points.map(([x,y],i)=><circle key={i} cx={X(x)} cy={Y(y)} r={5.5} fill="#c4d7fa" stroke="#151f2e" strokeWidth={2}/>) }
      <text x={287} y={266} textAnchor="middle" fontSize={12} fill="#cfdbec">{data.x_label}</text>
      <text x={12} y={19} fontSize={12} fill="#cfdbec">{data.y_label}</text>
    </svg>
    <figcaption className="mt-1 text-xs text-slate-500">Graph is plotted from the question’s actual values.</figcaption>
  </figure>
}
