// A creative numerical signature, never used for authentication or security.
export const SEPHIROT_COUNT = 10;
export const PATH_COUNT = 22;
export const CREATIVE_SEED = 1022;
export function makePaths(seed = CREATIVE_SEED) {
  let state = seed >>> 0;
  const random = () => {state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
  const pairs=[];
  for(let a=0;a<SEPHIROT_COUNT;a++)for(let b=a+1;b<SEPHIROT_COUNT;b++)pairs.push({a,b,order:random()});
  return pairs.sort((a,b)=>a.order-b.order).slice(0,PATH_COUNT).map(({a,b})=>[a,b]);
}
