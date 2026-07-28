"use client";
import katex from "katex";

export function MathText({text,className=""}:{text:string;className?:string}){
  const parts=text.split(/(\$[^$]+\$)/g);
  return <span className={className}>{parts.map((part,index)=>{
    const key=`${index}:${part}`;
    if(!(part.startsWith("$")&&part.endsWith("$")))return <span key={key}>{part}</span>;
    const html=katex.renderToString(part.slice(1,-1),{throwOnError:false,strict:false,trust:false});
    // KaTeX escapes input and trust:false disables unsafe commands; HTML insertion is its documented React rendering path.
    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized KaTeX output
    return <span key={key} dangerouslySetInnerHTML={{__html:html}}/>;
  })}</span>
}
