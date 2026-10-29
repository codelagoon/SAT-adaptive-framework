/**
 * Debate primitives adapted from two production open-source debate projects:
 *
 * - Argdown core (MIT), Copyright Christian Voigt and contributors
 *   https://github.com/argdown/argdown
 *   Relation types and premise/conclusion graph semantics.
 * - ArguMentor debate-core (MIT), Copyright (c) 2026 Arshia Keshvari
 *   https://github.com/TeslaNeuro/ArguMentor
 *   Debate phases, skill dimensions, phase sequencing, and skill averaging.
 *
 * Adaptations: dependency-free TypeScript, Public Forum format, and graph
 * derivation from Mastery Engine argument cards. Full notices are retained in
 * THIRD_PARTY_NOTICES.md.
 */

export enum RelationType {
  ATTACK = "attack",
  SUPPORT = "support",
  ENTAILS = "entails",
  CONTRARY = "contrary",
  CONTRADICTORY = "contradictory",
  UNDERCUT = "undercut",
}

export type DebatePhase =
  | "opening"
  | "constructive"
  | "rebuttal"
  | "cross"
  | "closing"
  | "evaluation"
  | "completed";

export type DebateFormat = "public_forum" | "lincoln_douglas" | "freeform";

export type SkillDimensions = {
  clarity:number;
  evidence:number;
  logic:number;
  persuasiveness:number;
  responsiveness:number;
  fallacyAvoidance:number;
};

export const DEBATE_SKILLS:(keyof SkillDimensions)[] = [
  "clarity", "evidence", "logic", "persuasiveness", "responsiveness", "fallacyAvoidance",
];

export function averageSkill(dimensions:SkillDimensions):number {
  const values=DEBATE_SKILLS.map(key=>dimensions[key]);
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}

/** Condensed practice order based on ArguMentor's phaseForRound. */
export function phaseForRound(format:DebateFormat,round:number,maxRounds:number):DebatePhase {
  if(format==="public_forum"){
    const sequence:DebatePhase[]=["opening","constructive","cross","rebuttal","cross","closing","evaluation","completed"];
    if(round>maxRounds)return "completed";
    return sequence[Math.min(Math.max(round-1,0),sequence.length-2)]??"constructive";
  }
  if(format==="freeform"){
    if(round<=1)return "opening";
    if(round>=maxRounds)return "closing";
    if(round===maxRounds-1)return "rebuttal";
    return "constructive";
  }
  const sequence:DebatePhase[]=["opening","constructive","rebuttal","cross","closing","evaluation","completed"];
  return sequence[Math.min(Math.max(round-1,0),sequence.length-1)]??"constructive";
}

type DebateCardLike={id:string;claim:string;warrant:string;counter:string;response:string};
export type ArgumentNode={id:string;label:string;kind:"claim"|"premise"|"counter"|"response"};
export type ArgumentEdge={from:string;to:string;relationType:RelationType};
export type ArgumentGraph={nodes:ArgumentNode[];edges:ArgumentEdge[]};

/**
 * Convert research cards into an Argdown-style dialectical graph.
 * Warrant supports claim; counter attacks claim; response undercuts counter.
 */
export function buildArgumentGraph(cards:DebateCardLike[]):ArgumentGraph {
  const nodes:ArgumentNode[]=[];
  const edges:ArgumentEdge[]=[];
  for(const card of cards){
    const claimId=`${card.id}:claim`;
    nodes.push({id:claimId,label:card.claim,kind:"claim"});
    if(card.warrant.trim()){
      const id=`${card.id}:warrant`;
      nodes.push({id,label:card.warrant,kind:"premise"});
      edges.push({from:id,to:claimId,relationType:RelationType.SUPPORT});
    }
    if(card.counter.trim()){
      const id=`${card.id}:counter`;
      nodes.push({id,label:card.counter,kind:"counter"});
      edges.push({from:id,to:claimId,relationType:RelationType.ATTACK});
      if(card.response.trim()){
        const responseId=`${card.id}:response`;
        nodes.push({id:responseId,label:card.response,kind:"response"});
        edges.push({from:responseId,to:id,relationType:RelationType.UNDERCUT});
      }
    }
  }
  return {nodes,edges};
}

export function relationCounts(graph:ArgumentGraph):Record<"support"|"attack"|"undercut",number>{
  return {
    support:graph.edges.filter(edge=>edge.relationType===RelationType.SUPPORT).length,
    attack:graph.edges.filter(edge=>edge.relationType===RelationType.ATTACK).length,
    undercut:graph.edges.filter(edge=>edge.relationType===RelationType.UNDERCUT).length,
  };
}
