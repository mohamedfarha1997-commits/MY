import * as u from './util.mjs';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1;}else console.log('ok',m);};
assert(u.r3(1.23456)===1.235,'r3 rounds to 3 decimals');
assert(u.num('٣٫٥')===3.5,'num parses Arabic digits and decimal comma');
assert(u.esc('<a>&"')==='&lt;a&gt;&amp;&quot;','esc escapes');
assert(u.unesc(u.esc("it's"))==="it's",'unesc inverts esc');
assert(u.unitGrams('كجم')===1000 && u.unitGrams('جرام')===1,'unitGrams');
assert(u.convK('كجم','جرام')===1000,'convK kg->g factor');
assert(u.parseTolerant('{"a":1}{"b":2}').a===1,'parseTolerant takes first object');
assert(u.canon({b:1,a:2})===u.canon({a:2,b:1}),'canon ignores key order');
// mergeStates: newer record wins per id, tombstone beats older record
const a={savedAt:1,orders:[{id:'O1',_u:5,v:'a'},{id:'O2',_u:5,v:'x'}],batches:[],done:[],products:[],materials:[],tomb:{orders:{}},stock:{},ready:{},stockT:{},readyT:{},prefs:{},prefsK:{},plog:{}};
const b={savedAt:2,orders:[{id:'O1',_u:9,v:'b'}],batches:[],done:[],products:[],materials:[],tomb:{orders:{O2:9}},stock:{m1:3},ready:{},stockT:{m1:7},readyT:{},prefs:{},prefsK:{},plog:{}};
const m=u.mergeStates(a,b);
assert(m.orders.length===1 && m.orders[0].v==='b','newer _u wins; O2 removed by tombstone');
assert(m.stock.m1===3,'stock keeps item from remote');
assert(m.savedAt===2,'savedAt is max');
console.log(process.exitCode?'FAILURES':'ALL PASSED');
