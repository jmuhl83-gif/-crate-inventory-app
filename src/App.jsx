import { useEffect, useMemo, useState } from 'react'
import './App.css'

const emptyJob = () => ({
  id: crypto.randomUUID(),
  name: '', client: '', jobNumber: '', cratePrefix: '', nextCrate: 1,
  createdAt: new Date().toISOString(), crates: []
})
const pad = n => String(n).padStart(4,'0')
const today = () => new Date().toLocaleString()
const fileToDataUrl = file => new Promise((res, rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file) })

function App(){
  const [jobs,setJobs]=useState(()=>{try{return JSON.parse(localStorage.getItem('cratepro_jobs'))||[]}catch{return []}})
  const [activeJobId,setActiveJobId]=useState(()=>localStorage.getItem('cratepro_active_job')||'')
  const [activeCrateId,setActiveCrateId]=useState('')
  const [showJob,setShowJob]=useState(false)
  const [jobDraft,setJobDraft]=useState(emptyJob())
  const [itemDraft,setItemDraft]=useState(null)
  const [boxName,setBoxName]=useState('')

  useEffect(()=>localStorage.setItem('cratepro_jobs',JSON.stringify(jobs)),[jobs])
  useEffect(()=>localStorage.setItem('cratepro_active_job',activeJobId||''),[activeJobId])
  const activeJob = jobs.find(j=>j.id===activeJobId) || jobs[0]
  const activeCrate = activeJob?.crates.find(c=>c.id===activeCrateId) || activeJob?.crates[0]

  const totals = useMemo(()=>{
    const crates=activeJob?.crates||[]
    return { crates:crates.length, boxes:crates.reduce((a,c)=>a+c.boxes.length,0), items:crates.reduce((a,c)=>a+c.items.length,0), photos:crates.reduce((a,c)=>a+c.photos.length+c.items.reduce((x,i)=>x+i.photos.length,0),0)}
  },[activeJob])

  function saveJob(){
    if(!jobDraft.name.trim()) return alert('Enter a job name')
    const j={...jobDraft, cratePrefix: jobDraft.cratePrefix || jobDraft.name.split(' ')[0] || 'CRATE'}
    setJobs(prev=>[j,...prev]); setActiveJobId(j.id); setShowJob(false); setJobDraft(emptyJob())
  }
  function newCrate(){
    if(!activeJob) return alert('Create a job first')
    const n=activeJob.nextCrate||1; const id=`${activeJob.cratePrefix||'CRATE'}-${pad(n)}`
    const crate={id,status:'In Progress',createdAt:today(),condition:'Good',location:'',notes:'',photos:[],docs:[],boxes:[],items:[]}
    setJobs(js=>js.map(j=>j.id===activeJob.id?{...j,nextCrate:n+1,crates:[crate,...j.crates]}:j)); setActiveCrateId(id)
  }
  async function addPhotos(type, files){
    if(!activeJob||!activeCrate||!files?.length) return
    const photos=await Promise.all([...files].map(async f=>({id:crypto.randomUUID(),type,name:f.name,at:today(),data:await fileToDataUrl(f)})))
    setJobs(js=>js.map(j=>j.id!==activeJob.id?j:{...j,crates:j.crates.map(c=>c.id!==activeCrate.id?c:{...c,photos:[...photos,...c.photos]})}))
  }
  async function addDocs(type, files){
    if(!activeJob||!activeCrate||!files?.length) return
    const docs=await Promise.all([...files].map(async f=>({id:crypto.randomUUID(),type,name:f.name,at:today(),data:await fileToDataUrl(f)})))
    setJobs(js=>js.map(j=>j.id!==activeJob.id?j:{...j,crates:j.crates.map(c=>c.id!==activeCrate.id?c:{...c,docs:[...docs,...c.docs]})}))
  }
  function addBox(){
    if(!boxName.trim()||!activeJob||!activeCrate) return
    const box={id:`B${pad(activeCrate.boxes.length+1).slice(-2)}`,name:boxName.trim(),createdAt:today(),notes:''}
    setJobs(js=>js.map(j=>j.id!==activeJob.id?j:{...j,crates:j.crates.map(c=>c.id!==activeCrate.id?c:{...c,boxes:[...c.boxes,box]})}))
    setBoxName('')
  }
  function startItem(){
    if(!activeCrate) return alert('Create/open a crate first')
    setItemDraft({id:`I${pad(activeCrate.items.length+1).slice(-3)}`,boxId:activeCrate.boxes[0]?.id||'',description:'',manufacturer:'',model:'',serial:'',qty:1,condition:'New',packingLine:'',notes:'',photos:[]})
  }
  async function addItemPhotos(files){
    if(!files?.length) return
    const photos=await Promise.all([...files].map(async f=>({id:crypto.randomUUID(),name:f.name,at:today(),data:await fileToDataUrl(f)})))
    setItemDraft(d=>({...d,photos:[...photos,...(d.photos||[])]}))
  }
  function saveItem(){
    if(!itemDraft.description.trim()) return alert('Enter a description')
    setJobs(js=>js.map(j=>j.id!==activeJob.id?j:{...j,crates:j.crates.map(c=>c.id!==activeCrate.id?c:{...c,items:[itemDraft,...c.items]})}))
    setItemDraft(null)
  }
  function exportCSV(){
    if(!activeJob) return
    const rows=[['Job','Client','Job Number','Crate','Box','Item','Description','Manufacturer','Model','Serial','Qty','Condition','Packing Line','Notes','Photo Count']]
    activeJob.crates.forEach(c=>c.items.forEach(i=>rows.push([activeJob.name,activeJob.client,activeJob.jobNumber,c.id,i.boxId,i.id,i.description,i.manufacturer,i.model,i.serial,i.qty,i.condition,i.packingLine,i.notes,i.photos.length])))
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')
    download(`${activeJob.name.replace(/\W+/g,'_')}_inventory.csv`,csv,'text/csv')
  }
  function exportJSON(){ if(activeJob) download(`${activeJob.name.replace(/\W+/g,'_')}_backup.json`,JSON.stringify(activeJob,null,2),'application/json') }
  function download(name,content,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href) }
  function report(){ window.print() }

  return <div className="app">
    <header className="header"><div><h1>CratePro</h1><p>Field MVP • Phone-ready crate inventory</p></div><button onClick={()=>setShowJob(true)}>+ New Job</button></header>
    <main className="grid">
      <aside className="sidebar"><h2>Jobs</h2>{jobs.length===0&&<p className="muted">Create your first job.</p>}{jobs.map(j=><button className={`job ${activeJob?.id===j.id?'on':''}`} onClick={()=>{setActiveJobId(j.id);setActiveCrateId(j.crates[0]?.id||'')}} key={j.id}><b>{j.name}</b><span>{j.client||'No client'}</span><small>{j.jobNumber}</small></button>)}</aside>
      <section className="main">
        {!activeJob?<Welcome/>:<>
          <div className="card head"><div><h2>{activeJob.name}</h2><p>{activeJob.client} • Job #{activeJob.jobNumber||'—'}</p></div><button onClick={newCrate}>+ New Crate</button></div>
          <div className="stats"><Stat label="Crates" val={totals.crates}/><Stat label="Boxes" val={totals.boxes}/><Stat label="Items" val={totals.items}/><Stat label="Photos" val={totals.photos}/></div>
          <div className="split"><div className="card"><h3>Crates</h3>{activeJob.crates.map(c=><button key={c.id} onClick={()=>setActiveCrateId(c.id)} className={`crate ${activeCrate?.id===c.id?'on':''}`}><b>{c.id}</b><span>{c.items.length} items • {c.photos.length} crate photos • {c.docs.length} docs</span></button>)}</div>
          <div className="card">{!activeCrate?<p className="muted">Create or select a crate.</p>:<CratePanel c={activeCrate} addPhotos={addPhotos} addDocs={addDocs} boxName={boxName} setBoxName={setBoxName} addBox={addBox} startItem={startItem} exportCSV={exportCSV} exportJSON={exportJSON} report={report}/>}</div></div>
          <Inventory c={activeCrate}/>
        </>}
      </section>
    </main>
    {showJob&&<Modal title="New Job" close={()=>setShowJob(false)}><FormInput label="Job Name" value={jobDraft.name} set={v=>setJobDraft({...jobDraft,name:v})}/><FormInput label="Client" value={jobDraft.client} set={v=>setJobDraft({...jobDraft,client:v})}/><FormInput label="Job Number" value={jobDraft.jobNumber} set={v=>setJobDraft({...jobDraft,jobNumber:v})}/><FormInput label="Crate Prefix" value={jobDraft.cratePrefix} set={v=>setJobDraft({...jobDraft,cratePrefix:v})} placeholder="Example: Edmonton"/><button className="wide" onClick={saveJob}>Create Job</button></Modal>}
    {itemDraft&&<Modal title={`Add Item ${itemDraft.id}`} close={()=>setItemDraft(null)}><label>Photos<input type="file" accept="image/*" capture="environment" multiple onChange={e=>addItemPhotos(e.target.files)}/></label>{itemDraft.photos.length>0&&<div className="thumbs">{itemDraft.photos.map(p=><img key={p.id} src={p.data}/>)}</div>}<label>Box/Sub-container<select value={itemDraft.boxId} onChange={e=>setItemDraft({...itemDraft,boxId:e.target.value})}><option value="">Loose / No Box</option>{activeCrate.boxes.map(b=><option key={b.id} value={b.id}>{b.id} - {b.name}</option>)}</select></label><FormInput label="Description" value={itemDraft.description} set={v=>setItemDraft({...itemDraft,description:v})}/><FormInput label="Manufacturer" value={itemDraft.manufacturer} set={v=>setItemDraft({...itemDraft,manufacturer:v})}/><FormInput label="Model" value={itemDraft.model} set={v=>setItemDraft({...itemDraft,model:v})}/><FormInput label="Serial / Tag" value={itemDraft.serial} set={v=>setItemDraft({...itemDraft,serial:v})}/><FormInput label="Qty" value={itemDraft.qty} set={v=>setItemDraft({...itemDraft,qty:v})} type="number"/><label>Condition<select value={itemDraft.condition} onChange={e=>setItemDraft({...itemDraft,condition:e.target.value})}><option>New</option><option>Good</option><option>Damaged</option><option>Unknown</option></select></label><FormInput label="Packing List Line" value={itemDraft.packingLine} set={v=>setItemDraft({...itemDraft,packingLine:v})}/><label>Notes<textarea value={itemDraft.notes} onChange={e=>setItemDraft({...itemDraft,notes:e.target.value})}/></label><button className="wide" onClick={saveItem}>Save Item</button></Modal>}
  </div>
}
function Welcome(){return <div className="card"><h2>Start here</h2><p>Create a job, add crates, photograph documents and items, then export the inventory.</p></div>}
function Stat({label,val}){return <div className="stat"><b>{val}</b><span>{label}</span></div>}
function FormInput({label,value,set,type='text',placeholder=''}){return <label>{label}<input type={type} value={value} placeholder={placeholder} onChange={e=>set(e.target.value)}/></label>}
function Modal({title,children,close}){return <div className="overlay"><div className="modal"><div className="modalHead"><h2>{title}</h2><button onClick={close}>×</button></div>{children}</div></div>}
function CratePanel({c,addPhotos,addDocs,boxName,setBoxName,addBox,startItem,exportCSV,exportJSON,report}){return <><h2>{c.id}</h2><p className="muted">Created {c.createdAt}</p><div className="workflow"><span>□ Exterior</span><span>□ Packing List</span><span>□ Opened Crate</span><span>□ Box Inventory</span><span>□ Final Report</span></div><div className="buttons"><label className="fileBtn">📷 Crate/Content Photos<input type="file" accept="image/*" capture="environment" multiple onChange={e=>addPhotos('crate',e.target.files)}/></label><label className="fileBtn">📄 Packing List / Docs<input type="file" accept="image/*,.pdf" capture="environment" multiple onChange={e=>addDocs('packing list',e.target.files)}/></label><button onClick={startItem}>+ Add Item</button><button onClick={exportCSV}>Export CSV</button><button onClick={exportJSON}>Backup JSON</button><button onClick={report}>Print Report</button></div><h3>Boxes / Sub-containers</h3><div className="inline"><input value={boxName} onChange={e=>setBoxName(e.target.value)} placeholder="Rosemount box, Thompson Valve box..."/><button onClick={addBox}>Add Box</button></div><div className="chips">{c.boxes.map(b=><span key={b.id}>{b.id}: {b.name}</span>)}</div><h3>Crate Photos</h3><div className="thumbs">{c.photos.map(p=><img key={p.id} src={p.data} title={p.name}/>)}</div><h3>Documents</h3><div className="chips">{c.docs.map(d=><span key={d.id}>📄 {d.type}: {d.name}</span>)}</div></>}
function Inventory({c}){if(!c)return null;return <div className="card printArea"><h2>Inventory</h2>{c.items.length===0?<p className="muted">No items yet.</p>:c.items.map(i=><div className="item" key={i.id}><div><b>{i.id} • {i.description}</b><p>{i.manufacturer} {i.model} • Serial/Tag: {i.serial||'—'} • Qty: {i.qty} • {i.condition}</p><small>Box: {i.boxId||'Loose'} • Packing Line: {i.packingLine||'—'}</small><p>{i.notes}</p></div><div className="thumbs small">{i.photos.map(p=><img key={p.id} src={p.data}/>)}</div></div>)}</div>}
export default App
