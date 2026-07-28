export type CalculatorState={visible:boolean;width:number;expressionState:string;openedAt?:number;accumulatedMs:number};
export const defaultCalculatorState:CalculatorState={visible:false,width:420,expressionState:"",accumulatedMs:0};
export function toggleCalculator(state:CalculatorState,now=Date.now()):CalculatorState{return state.visible?{...state,visible:false,accumulatedMs:state.accumulatedMs+(state.openedAt?Math.max(0,now-state.openedAt):0),openedAt:undefined}:{...state,visible:true,openedAt:now};}
export function resizeCalculator(state:CalculatorState,width:number):CalculatorState{return {...state,width:Math.round(Math.min(720,Math.max(300,width)))};}
export function finalizeCalculatorUsage(state:CalculatorState,now=Date.now()){return {opened:state.accumulatedMs>0||state.visible,elapsedMs:state.accumulatedMs+(state.visible&&state.openedAt?Math.max(0,now-state.openedAt):0)};}
export function serializeCalculatorState(state:CalculatorState){return JSON.stringify({...state,openedAt:undefined});}
export function parseCalculatorState(raw:string|null):CalculatorState{try{const value=JSON.parse(raw??"") as Partial<CalculatorState>;return {...defaultCalculatorState,...value,visible:false,openedAt:undefined,width:Math.min(720,Math.max(300,Number(value.width)||420))};}catch{return defaultCalculatorState;}}
