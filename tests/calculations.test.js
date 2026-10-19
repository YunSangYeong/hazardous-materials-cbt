import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {total} from '../scripts/check-chemistry.js';
const manuscripts=JSON.parse(fs.readFileSync(new URL('../data/calculation-manuscripts.json',import.meta.url)));
const bank=JSON.parse(fs.readFileSync(new URL('../data/questions.json',import.meta.url)));
// An implementation independent of the authoring helper and its written solutions.
const solve={
 'mass-fraction':x=>100*x.solute/(x.solute+x.solvent),
 'volume-fraction':x=>100*x.solute/x.solution,
 density:x=>x.mass/x.volume,
 'amount-from-mass':x=>x.mass/x.molarMass,
 molarity:x=>x.amount/x.volume,
 dilution:x=>x.initialConcentration*x.initialVolume/x.finalVolume,
 neutralization:x=>x.acidConcentration*x.acidVolumeMl/x.baseConcentration,
 'partial-pressure':x=>x.totalPressure*x.moleFraction,
 boyle:x=>x.p1*x.v1/x.v2,
 charles:x=>x.v1*x.t2/x.t1,
 'rigid-vessel':x=>x.p1*x.t2/x.t1,
 'combined-gas':x=>x.p1*x.v1*x.t2/(x.t1*x.p2),
 'ideal-gas-amount':x=>x.pressure*x.volume/(x.R*x.temperature),
 'ideal-gas-density':x=>x.pressure*x.molarMass/(x.R*x.temperature),
 graham:x=>Math.sqrt(x.heavyMass/x.lightMass),
 'sensible-heat':x=>x.mass*x.specificHeat*x.deltaT,
 'latent-heat':x=>x.mass*x.latentHeat/1000,
 hess:x=>x.first+x.second*x.secondMultiplier,
 'combustion-oxygen':x=>x.fuelVolume*x.oxygenRatio,
 'limiting-reagent':x=>Math.min(x.n2*2,x.h2*2/3),
 'percent-yield':x=>x.actual/x.theoretical*100,
 'empirical-formula':x=>{const a=[x.carbon/12,x.hydrogen,x.oxygen/16];const ratios=a.map(v=>v/Math.min(...a));assert.ok(ratios.every((v,i)=>Math.abs(v-[1,2,1][i])<0.01));return 'CH2O';},
 'oxidation-number':x=>2*x.oxygenCount-x.hydrogenCount,
 'strong-acid-ph':x=>-Math.log10(x.concentration),
 'ph-poh':x=>x.pKw-x.pOH,
 'pressure-conversion':x=>x.atm*x.factor,
 'absolute-temperature':x=>x.celsius+273.15,
 'freezing-point-depression':x=>x.i*x.Kf*x.molality,
 'isotopic-average':x=>x.mass1*x.fraction1+x.mass2*x.fraction2,
 'adiabatic-mixing':x=>(x.m1*x.t1+x.m2*x.t2)/(x.m1+x.m2)
};
for(const c of manuscripts)test(`independent calculation: ${c.key}`,()=>{
 assert.ok(solve[c.key],c.key);const actual=solve[c.key](c.inputs);
 if(typeof c.expected==='string')assert.equal(actual,c.expected);
 else assert.ok(Math.abs(actual-c.expected)<=(c.tolerance??1e-9),`${actual} vs ${c.expected}`);
 const q=bank.find(q=>q.calculation?.key===c.key);assert.ok(q);assert.equal(q.options[q.answer-1],c.answer);
 if(c.reaction)assert.deepEqual(total(c.reaction.left),total(c.reaction.right),c.key);
});
test('law-specific demand uses manufacturing wall criterion, not storage criterion',()=>{
 const q=bank.find(q=>q.conceptKey==='hazard-fire-demand-area');assert.ok(q);
 const area=Number(q.question.match(/(\d+) m²/)[1]);const result=area/100;
 assert.equal(result,3);assert.equal(q.options[q.answer-1],`${result}소요단위`);
 assert.notEqual(area/150,result);assert.notEqual(area/50,result);
});
test('CS2 molar mass is recomputed from atom counts',()=>{
 const q=bank.find(q=>q.calculation?.key==='cs2-molar-mass');assert.ok(q);
 const mass=12+2*32;assert.equal(q.options[q.answer-1],`${mass}g/mol`);
});
