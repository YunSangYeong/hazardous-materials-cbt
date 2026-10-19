// Atom conservation only: does NOT verify reaction conditions, kinetics, or safety.
export function atoms(formula) {
  const tokens=formula.match(/[A-Z][a-z]?|\d+|[()]/g);
  if(!tokens||tokens.join('')!==formula)throw new Error('지원하지 않는 화학식');
  let i=0;
  function group(nested=false){const out={};
    while(i<tokens.length){let counts;
      const token=tokens[i++];
      if(token===')'){if(!nested)throw new Error('괄호 오류');return out;}
      if(token==='(')counts=group(true);
      else{if(!/^[A-Z]/.test(token))throw new Error('원소 오류');counts={[token]:1};}
      const multiplier=/^\d+$/.test(tokens[i]||'')?Number(tokens[i++]):1;
      if(multiplier<1)throw new Error('첨자 오류');
      for(const [el,n] of Object.entries(counts))out[el]=(out[el]||0)+n*multiplier;
    }
    if(nested)throw new Error('닫는 괄호 누락');return out;
  }return group();
}
export function total(side){const sum={};for(const [coefficient,formula] of side){if(!Number.isInteger(coefficient)||coefficient<1)throw new Error('계수 오류');for(const [el,n] of Object.entries(atoms(formula)))sum[el]=(sum[el]||0)+n*coefficient;}return Object.fromEntries(Object.entries(sum).sort());}
