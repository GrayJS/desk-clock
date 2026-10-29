import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = ts.transpileModule(await readFile(new URL("../src/lib/persistence.ts", import.meta.url), "utf8"), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {readPersistentValue,writePersistentValue,seedPersistentRecovery}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const key="morrow.sessions";
const records=Array.from({length:21},(_,i)=>({id:String(i),title:"Legacy focus",note:"",mode:"focus",durationMinutes:15,completedAt:new Date(2026,8,1+i).toISOString()}));
function memory(entries={}) {const map=new Map(Object.entries(entries));return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}
test("upgrade creates a recovery copy without changing original history",()=>{
 const raw=JSON.stringify(records),store=memory({[key]:raw});seedPersistentRecovery(store,key);assert.equal(store.getItem(key),raw);assert.equal(store.getItem(key+".backup"),raw);
});
test("0.6.12 history loads all 21 legacy records without rewriting startup data",()=>{
 const raw=JSON.stringify(records),store=memory({[key]:raw});const loaded=readPersistentValue(store,key,[]);
 assert.deepEqual(loaded.value,records);writePersistentValue(store,key,loaded.value,false);assert.equal(store.map.size,1);assert.equal(store.getItem(key),raw);
});
test("unreadable JSON is never replaced by an empty startup default",()=>{
 const store=memory({[key]:"[incomplete"});const loaded=readPersistentValue(store,key,[]);
 assert.equal(loaded.readFailed,true);writePersistentValue(store,key,loaded.value,false);assert.equal(store.getItem(key),"[incomplete");
});
test("temporary storage read errors do not cause startup writes",()=>{
 let writes=0;const store={getItem(){throw Error("temporarily unavailable");},setItem(){writes++;},removeItem(){}};
 const loaded=readPersistentValue(store,key,[]);assert.equal(loaded.readFailed,true);writePersistentValue(store,key,loaded.value,false);assert.equal(writes,0);
});
test("valid backup recovers unreadable history and preserves the damaged source on save",()=>{
 const store=memory({[key]:"broken",[key+".backup"]:JSON.stringify(records)});const loaded=readPersistentValue(store,key,[]);
 assert.equal(loaded.recovered,true);assert.equal(loaded.value.length,21);writePersistentValue(store,key,loaded.value);
 assert.equal(store.getItem(key+".unreadable"),"broken");assert.deepEqual(JSON.parse(store.getItem(key)),records);
});
test("missing primary history can recover from the local copy",()=>{
 const store=memory({[key+".backup"]:JSON.stringify(records)});assert.equal(readPersistentValue(store,key,[]).value.length,21);
});
test("explicit clear does not resurrect the recovery copy",()=>{
 const store=memory({[key]:JSON.stringify(records),[key+".backup"]:JSON.stringify(records),[key+".unreadable"]:"old"});
 writePersistentValue(store,key,[]);assert.deepEqual(readPersistentValue(store,key,records).value,[]);assert.equal(store.getItem(key+".backup"),"[]");assert.equal(store.getItem(key+".unreadable"),null);
});
test("a failed primary write leaves the previous history intact",()=>{
 const store=memory({[key]:JSON.stringify(records)});store.setItem=()=>{throw Error("quota");};
 assert.throws(()=>writePersistentValue(store,key,[]),/quota/);assert.equal(JSON.parse(store.getItem(key)).length,21);
});
