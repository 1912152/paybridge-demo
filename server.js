const express  = require('express');
const session  = require('express-session');
const multer   = require('multer');
const XLSX     = require('xlsx');
const path     = require('path');

const app  = express();
const PORT = 3000;

app.use(session({
  secret: 'paybridge-2025-secret',
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: 24*60*60*1000, httpOnly: true, sameSite: 'lax' }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024 } });
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false, lastModified: false,
  setHeaders: (res, fp) => {
    if (fp.endsWith('.js') || fp.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));
app.use((req,res,next)=>{
  if(req.path.startsWith('/api/')) console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path} | ${req.session?.user?.email||'none'}`);
  next();
});

// ── USERS ─────────────────────────────────────────────────────
const USERS = {
  'maker@bank.com':    {password:'maker123',    role:'maker',    name:'Sana Rehman',  corp:'Apex Industries Ltd', portal:'corporate', mustChange:true},
  'checker@bank.com':  {password:'checker123',  role:'checker',  name:'Omar Farooq',  corp:'Apex Industries Ltd', portal:'corporate', mustChange:true},
  'banker@bank.com':   {password:'banker123',   role:'banker',   name:'Tariq Hassan', corp:null, portal:'bank',      mustChange:true},
  'approver@bank.com': {password:'approver123', role:'approver', name:'Nadia Malik',  corp:null, portal:'bank',      mustChange:true},
};

// ── DATABASE ──────────────────────────────────────────────────
const DB = {
  nextBatch: 40,
  nextCorpPending: 1,
  batches: [
    {
      id:'BATCH-2025-038', type:'EWA', corp:'Apex Industries Ltd',
      date:'10 May 2025', month:'May-2025', employees:5,
      amount:187500, charge:5000, status:'forwarded_cbs',
      maker:'Sana Rehman', checker:'Omar Farooq', banker:'Tariq Hassan', approver:'Nadia Malik',
      remarks:'', fileName:'EWA_May2025.xlsx',
      history:[
        {actor:'Sana Rehman',  role:'maker',    action:'uploaded',           time:'10 May 2025 09:00'},
        {actor:'Omar Farooq',  role:'checker',  action:'approved',           time:'10 May 2025 10:30'},
        {actor:'Tariq Hassan', role:'banker',   action:'approved',           time:'10 May 2025 12:00'},
        {actor:'Nadia Malik',  role:'approver', action:'forwarded to CBS',   time:'10 May 2025 14:00'},
      ],
      employeeData:[
        {'Employee Name':'Fatima Noor','Employee ID':'EMP-002','CNIC':'42201-2345678-2','Account Number':'PK36SCBL0002','salary':72000,'days':10,'ewaAmount':24000},
        {'Employee Name':'Bilal Ahmed','Employee ID':'EMP-003','CNIC':'42301-3456789-3','Account Number':'PK36SCBL0003','salary':95000,'days':15,'ewaAmount':47500},
      ]
    },
    {
      id:'BATCH-2025-037', type:'AS', corp:'Apex Industries Ltd',
      date:'05 May 2025', month:'Apr-2025', employees:3,
      amount:252000, charge:7560, status:'rejected_banker',
      maker:'Sana Rehman', checker:'Omar Farooq', banker:'Tariq Hassan', approver:'',
      remarks:'CNIC format invalid on row 2. Please correct and resubmit.',
      fileName:'AS_Apr2025_v1.xlsx',
      history:[
        {actor:'Sana Rehman',  role:'maker',   action:'uploaded',  time:'05 May 2025 10:00'},
        {actor:'Omar Farooq',  role:'checker', action:'approved',  time:'05 May 2025 11:30'},
        {actor:'Tariq Hassan', role:'banker',  action:'rejected',  time:'05 May 2025 14:00', remark:'CNIC format invalid on row 2.'},
      ],
      employeeData:[
        {'Employee Name':'Ali Hassan','Employee ID':'EMP-001','CNIC':'42101-1234567-1','Account Number':'PK36SCBL0001','salary':80000},
        {'Employee Name':'Sara Malik','Employee ID':'EMP-002','CNIC':'INVALID','Account Number':'PK36SCBL0002','salary':90000},
      ]
    },
  ],
  corporates: [
    {id:'CORP-001',name:'Apex Industries Ltd',  account:'0123-4567-8900',services:'both', status:'active',   limit:10000000,since:'Jan 2024',chargeAS:3,  chargeEWA:5000,chargeEWAType:'flat'},
    {id:'CORP-002',name:'Crescent Textiles',    account:'0124-5678-9001',services:'as',   status:'active',   limit:8000000, since:'Mar 2024',chargeAS:2.5,chargeEWA:0,   chargeEWAType:'flat'},
    {id:'CORP-003',name:'Delta Logistics',      account:'0125-6789-0012',services:'ewa',  status:'active',   limit:5000000, since:'Jun 2024',chargeAS:0,  chargeEWA:3000,chargeEWAType:'flat'},
    {id:'CORP-004',name:'Horizon Pharma',       account:'0126-7890-1123',services:'both', status:'active',   limit:12000000,since:'Nov 2023',chargeAS:2,  chargeEWA:4000,chargeEWAType:'flat'},
    {id:'CORP-005',name:'Summit Builders',      account:'0127-8901-2234',services:'as',   status:'inactive', limit:6000000, since:'Feb 2024',chargeAS:3.5,chargeEWA:0,   chargeEWAType:'flat'},
  ],
  // Corporate change requests pending approver review
  corpPending: [],
  notifications: {
    'maker@bank.com':[], 'checker@bank.com':[], 'banker@bank.com':[], 'approver@bank.com':[],
  }
};

// ── HELPERS ───────────────────────────────────────────────────
function requireAuth(req,res,next){
  if(!req.session?.user) return res.status(401).json({error:'Not authenticated'});
  next();
}
function requireRole(...roles){
  return (req,res,next)=>{
    if(!req.session?.user) return res.status(401).json({error:'Not authenticated'});
    if(!roles.includes(req.session.user.role)) return res.status(403).json({error:'Forbidden'});
    next();
  };
}
function fmt(n){return 'PKR '+Number(n).toLocaleString();}
function newBatchId(){return 'BATCH-2025-0'+DB.nextBatch++;}
function newCorpPendingId(){return 'CORPREQ-'+String(DB.nextCorpPending++).padStart(3,'0');}
function addNotif(email,msg,type='info'){
  if(!DB.notifications[email]) DB.notifications[email]=[];
  DB.notifications[email].unshift({msg,type,time:new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})});
  if(DB.notifications[email].length>30) DB.notifications[email].pop();
}
function today(){return new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
function nowTime(){return new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}

// ── AUTH ──────────────────────────────────────────────────────
app.get('/',(req,res)=>{
  if(req.session?.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname,'public','login.html'));
});
app.post('/api/login',(req,res)=>{
  const {email,password}=req.body;
  const u=USERS[email?.toLowerCase()?.trim()];
  if(!u||u.password!==password) return res.json({success:false,error:'Invalid email or password.'});
  req.session.user={email,role:u.role,name:u.name,corp:u.corp,portal:u.portal,mustChange:u.mustChange};
  req.session.save(err=>{
    if(err) return res.json({success:false,error:'Session error'});
    res.json({success:true,role:u.role,mustChange:u.mustChange});
  });
});
app.post('/api/logout',(req,res)=>{ req.session.destroy(()=>res.json({success:true})); });
app.get('/dashboard',requireAuth,(req,res)=>{ res.sendFile(path.join(__dirname,'public','dashboard.html')); });

// ── PROFILE ───────────────────────────────────────────────────
app.get('/api/me',requireAuth,(req,res)=>{ res.json(req.session.user); });
app.post('/api/change-password',requireAuth,(req,res)=>{
  const {currentPassword,newPassword}=req.body;
  const email=req.session.user.email;
  const u=USERS[email];
  if(!u) return res.json({success:false,error:'User not found'});
  if(u.password!==currentPassword) return res.json({success:false,error:'Current password is incorrect'});
  if(!newPassword||newPassword.length<6) return res.json({success:false,error:'New password must be at least 6 characters'});
  if(newPassword===currentPassword) return res.json({success:false,error:'New password must differ from current'});
  USERS[email].password=newPassword; USERS[email].mustChange=false;
  req.session.user.mustChange=false;
  req.session.save(()=>res.json({success:true}));
});
app.post('/api/update-profile',requireAuth,(req,res)=>{
  const {name}=req.body;
  if(!name||name.trim().length<2) return res.json({success:false,error:'Name must be at least 2 characters'});
  const email=req.session.user.email;
  USERS[email].name=name.trim(); req.session.user.name=name.trim();
  req.session.save(()=>res.json({success:true}));
});

// ── NOTIFICATIONS ─────────────────────────────────────────────
app.get('/api/notifications',requireAuth,(req,res)=>{ res.json(DB.notifications[req.session.user.email]||[]); });
app.post('/api/notifications/clear',requireAuth,(req,res)=>{ DB.notifications[req.session.user.email]=[]; res.json({success:true}); });

// ── BATCHES ───────────────────────────────────────────────────
app.get('/api/batches',requireAuth,(req,res)=>{
  const {role,corp}=req.session.user;
  let list=[...DB.batches];
  if(role==='maker'||role==='checker') list=list.filter(b=>b.corp===corp);
  if(req.query.status) list=list.filter(b=>b.status===req.query.status);
  if(req.query.type)   list=list.filter(b=>b.type===req.query.type);
  if(req.query.corp)   list=list.filter(b=>b.corp===req.query.corp);
  res.json(list.map(b=>({...b,employeeData:b.employeeData?.slice(0,3)||[]})));
});
app.get('/api/batches/:id',requireAuth,(req,res)=>{
  const b=DB.batches.find(x=>x.id===req.params.id);
  if(!b) return res.status(404).json({error:'Not found'});
  res.json(b);
});

app.post('/api/batches/upload',requireAuth,requireRole('maker'),upload.single('file'),(req,res)=>{
  try{
    const {type,month}=req.body;
    if(!req.file) return res.json({success:false,error:'No file received.'});
    let rows;
    try{
      const wb=XLSX.read(req.file.buffer,{type:'buffer'});
      rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    }catch(e){return res.json({success:false,error:'Could not read Excel file.'});}
    if(!rows||rows.length===0) return res.json({success:false,error:'Excel file is empty.'});
    const required=type==='AS'
      ?['Employee Name','Employee ID','CNIC','Account Number','Net Salary']
      :['Employee Name','Employee ID','CNIC','Account Number','Monthly Salary','EWA Days'];
    const missing=required.filter(col=>!(col in rows[0]));
    if(missing.length>0) return res.json({success:false,errors:['Missing columns: '+missing.join(', ')]});
    const errors=[];
    rows.forEach((row,i)=>{
      const rn=i+2;
      required.forEach(col=>{ if(!String(row[col]||'').trim()) errors.push('Row '+rn+': "'+col+'" is empty'); });
      if(type==='EWA'){const d=Number(row['EWA Days']);if(d<1||d>15) errors.push('Row '+rn+': EWA Days must be 1-15');}
      if(type==='AS'){const s=Number(row['Net Salary']);if(isNaN(s)||s<=0) errors.push('Row '+rn+': Net Salary must be positive');}
    });
    if(errors.length>0) return res.json({success:false,errors});
    let totalAmount=0;
    const enriched=rows.map(row=>{
      if(type==='AS'){const sal=Number(row['Net Salary'])||0;totalAmount+=sal;return {...row,salary:sal};}
      else{const sal=Number(row['Monthly Salary'])||0;const days=Math.min(Number(row['EWA Days'])||0,15);const ewa=Math.round((sal/30)*days);totalAmount+=ewa;return {...row,salary:sal,days,ewaAmount:ewa};}
    });
    const corpObj=DB.corporates.find(c=>c.name===req.session.user.corp);
    const charge=type==='AS'
      ?Math.round(totalAmount*((corpObj?.chargeAS||3)/100))
      :(corpObj?.chargeEWAType==='pct'?Math.round(totalAmount*((corpObj?.chargeEWA||2)/100)):(corpObj?.chargeEWA||5000));
    const batch={
      id:newBatchId(),type,corp:req.session.user.corp,
      date:today(),month:month||'May-2025',
      employees:rows.length,amount:totalAmount,charge,
      status:'pending_checker',
      maker:req.session.user.name,checker:'',banker:'',approver:'',
      remarks:'',fileName:req.file.originalname,employeeData:enriched,
      history:[{actor:req.session.user.name,role:'maker',action:'uploaded',time:nowTime()}],
    };
    DB.batches.unshift(batch);
    addNotif('checker@bank.com','📤 New '+(type==='AS'?'Advance Salary':'EWA')+' batch '+batch.id+' from '+batch.corp+' — '+fmt(totalAmount)+' for '+rows.length+' employees','warning');
    res.json({success:true,batch});
  }catch(err){console.error(err);res.json({success:false,error:'Server error: '+err.message});}
});

app.delete('/api/batches/:id',requireAuth,requireRole('maker'),(req,res)=>{
  const idx=DB.batches.findIndex(x=>x.id===req.params.id);
  if(idx===-1) return res.status(404).json({error:'Not found'});
  const b=DB.batches[idx];
  if(b.corp!==req.session.user.corp) return res.status(403).json({error:'Forbidden'});
  if(!b.status.startsWith('rejected')) return res.json({success:false,error:'Only rejected batches can be deleted'});
  DB.batches.splice(idx,1);
  res.json({success:true});
});

app.post('/api/batches/:id/checker',requireAuth,requireRole('checker'),(req,res)=>{
  const b=DB.batches.find(x=>x.id===req.params.id);
  if(!b) return res.status(404).json({error:'Not found'});
  if(b.status!=='pending_checker') return res.json({success:false,error:'Not in pending_checker state'});
  const {action,remarks}=req.body;
  b.checker=req.session.user.name;
  if(action==='approve'){
    b.status='pending_banker';
    b.history.push({actor:b.checker,role:'checker',action:'approved',time:nowTime()});
    addNotif('banker@bank.com','✅ Batch '+b.id+' from '+b.corp+' approved by checker — '+fmt(b.amount)+' awaiting bank review','warning');
    addNotif('maker@bank.com','✅ Batch '+b.id+' approved by checker, sent to bank','success');
  }else{
    b.status='rejected_checker';b.remarks=remarks||'Rejected by Corporate Checker';
    b.history.push({actor:b.checker,role:'checker',action:'rejected',time:nowTime(),remark:b.remarks});
    addNotif('maker@bank.com','❌ Batch '+b.id+' rejected by Corporate Checker. Reason: '+b.remarks+'. Please fix and resubmit.','danger');
  }
  res.json({success:true,batch:b});
});

app.post('/api/batches/:id/banker',requireAuth,requireRole('banker'),(req,res)=>{
  const b=DB.batches.find(x=>x.id===req.params.id);
  if(!b) return res.status(404).json({error:'Not found'});
  if(b.status!=='pending_banker') return res.json({success:false,error:'Not in pending_banker state'});
  const {action,remarks}=req.body;
  b.banker=req.session.user.name;
  if(action==='approve'){
    b.status='pending_approver';
    b.history.push({actor:b.banker,role:'banker',action:'approved',time:nowTime()});
    addNotif('approver@bank.com','🏦 Batch '+b.id+' — '+fmt(b.amount)+' — needs your FINAL authorization for '+b.employees+' employees','danger');
    addNotif('checker@bank.com','→ Batch '+b.id+' reviewed by banker, sent for final authorization','info');
    addNotif('maker@bank.com','→ Batch '+b.id+' passed bank review','info');
  }else{
    b.status='rejected_banker';b.remarks=remarks||'Rejected by Bank Reviewer';
    b.history.push({actor:b.banker,role:'banker',action:'rejected',time:nowTime(),remark:b.remarks});
    addNotif('maker@bank.com','❌ Batch '+b.id+' rejected by Bank Reviewer ('+req.session.user.name+'). Reason: '+b.remarks+'. File returned to you.','danger');
    addNotif('checker@bank.com','❌ Batch '+b.id+' from '+b.corp+' rejected by Bank Reviewer. Reason: '+b.remarks,'danger');
  }
  res.json({success:true,batch:b});
});

app.post('/api/batches/:id/approver',requireAuth,requireRole('approver'),(req,res)=>{
  const b=DB.batches.find(x=>x.id===req.params.id);
  if(!b) return res.status(404).json({error:'Not found'});
  if(b.status!=='pending_approver') return res.json({success:false,error:'Not in pending_approver state'});
  const {action,remarks}=req.body;
  b.approver=req.session.user.name;
  if(action==='approve'){
    b.status='forwarded_cbs';
    b.history.push({actor:b.approver,role:'approver',action:'forwarded to CBS',time:nowTime()});
    addNotif('maker@bank.com','✅ Batch '+b.id+' authorized — forwarded to Core Banking System. '+b.employees+' employees will be paid.','success');
    addNotif('checker@bank.com','✅ Batch '+b.id+' forwarded to CBS — '+fmt(b.amount),'success');
    addNotif('banker@bank.com','✅ Batch '+b.id+' authorized and forwarded to CBS by '+req.session.user.name,'success');
  }else{
    b.status='rejected_approver';b.remarks=remarks||'Rejected at final authorization';
    b.history.push({actor:b.approver,role:'approver',action:'rejected',time:nowTime(),remark:b.remarks});
    addNotif('maker@bank.com','❌ Batch '+b.id+' rejected at final authorization by '+req.session.user.name+'. Reason: '+b.remarks+'. File returned to you.','danger');
    addNotif('checker@bank.com','❌ Batch '+b.id+' rejected at final authorization. Reason: '+b.remarks,'danger');
    addNotif('banker@bank.com','❌ Batch '+b.id+' rejected at final authorization. Reason: '+b.remarks,'danger');
  }
  res.json({success:true,batch:b});
});

// ── CORPORATE CHANGE REQUESTS ─────────────────────────────────
// Banker submits add/edit/deactivate/activate → goes to Approver queue
app.get('/api/corp-requests',requireAuth,requireRole('banker','approver'),(req,res)=>{
  res.json(DB.corpPending);
});

app.post('/api/corp-requests',requireAuth,requireRole('banker'),(req,res)=>{
  const {action,corpId,data}=req.body;
  // action: 'add' | 'edit' | 'toggle_status'
  const existing=corpId?DB.corporates.find(c=>c.id===corpId):null;
  const req_obj={
    id:newCorpPendingId(),
    action, // 'add','edit','toggle_status'
    corpId:corpId||null,
    corpName:existing?existing.name:(data.name||'New Corporate'),
    data, // the new values
    existingSnapshot:existing?{...existing}:null, // what it was before
    submittedBy:req.session.user.name,
    submittedAt:nowTime(),
    status:'pending_approver', // pending_approver | approved | rejected
    approverRemark:'',
    history:[{actor:req.session.user.name,role:'banker',action:'submitted for approval',time:nowTime()}],
  };
  DB.corpPending.unshift(req_obj);
  const actionLabel={add:'Add New Corporate',edit:'Edit Corporate',toggle_status:'Change Status'}[action]||action;
  addNotif('approver@bank.com','🏢 Corporate Request: '+actionLabel+' — "'+req_obj.corpName+'" — submitted by '+req.session.user.name+'. Please review.','warning');
  res.json({success:true,request:req_obj});
});

// Approver acts on a corporate request
app.post('/api/corp-requests/:id/approve',requireAuth,requireRole('approver'),(req,res)=>{
  const req_obj=DB.corpPending.find(r=>r.id===req.params.id);
  if(!req_obj) return res.status(404).json({error:'Not found'});
  if(req_obj.status!=='pending_approver') return res.json({success:false,error:'Already processed'});

  req_obj.status='approved';
  req_obj.history.push({actor:req.session.user.name,role:'approver',action:'approved',time:nowTime()});

  // Apply the change to the actual corporates array
  if(req_obj.action==='add'){
    const d=req_obj.data;
    const newCorp={
      id:'CORP-'+String(DB.corporates.length+1).padStart(3,'0'),
      name:d.name,account:d.account,services:d.services||'both',
      status:'active',limit:Number(d.limit)||0,
      since:new Date().toLocaleDateString('en-GB',{month:'short',year:'numeric'}),
      chargeAS:Number(d.chargeAS)||3,chargeEWA:Number(d.chargeEWA)||5000,chargeEWAType:d.chargeEWAType||'flat',
    };
    DB.corporates.push(newCorp);
    req_obj.corpId=newCorp.id;
  } else if(req_obj.action==='edit'){
    const corp=DB.corporates.find(c=>c.id===req_obj.corpId);
    if(corp){
      const d=req_obj.data;
      if(d.name!==undefined)          corp.name=d.name;
      if(d.account!==undefined)       corp.account=d.account;
      if(d.services!==undefined)      corp.services=d.services;
      if(d.limit!==undefined)         corp.limit=Number(d.limit)||0;
      if(d.status!==undefined)        corp.status=d.status;
      if(d.chargeAS!==undefined)      corp.chargeAS=Number(d.chargeAS)||0;
      if(d.chargeEWA!==undefined)     corp.chargeEWA=Number(d.chargeEWA)||0;
      if(d.chargeEWAType!==undefined) corp.chargeEWAType=d.chargeEWAType;
    }
  } else if(req_obj.action==='toggle_status'){
    const corp=DB.corporates.find(c=>c.id===req_obj.corpId);
    if(corp) corp.status=req_obj.data.newStatus;
  }

  addNotif('banker@bank.com','✅ Corporate request '+req_obj.id+' ('+req_obj.corpName+') approved by '+req.session.user.name+' and applied.','success');
  res.json({success:true,request:req_obj});
});

app.post('/api/corp-requests/:id/reject',requireAuth,requireRole('approver'),(req,res)=>{
  const req_obj=DB.corpPending.find(r=>r.id===req.params.id);
  if(!req_obj) return res.status(404).json({error:'Not found'});
  if(req_obj.status!=='pending_approver') return res.json({success:false,error:'Already processed'});
  const {remarks}=req.body;
  req_obj.status='rejected';
  req_obj.approverRemark=remarks||'Rejected by Banker Approver';
  req_obj.history.push({actor:req.session.user.name,role:'approver',action:'rejected',time:nowTime(),remark:req_obj.approverRemark});
  addNotif('banker@bank.com','❌ Corporate request '+req_obj.id+' ('+req_obj.corpName+') rejected. Reason: '+req_obj.approverRemark+'. Please correct and resubmit.','danger');
  res.json({success:true,request:req_obj});
});

// Banker resubmits a rejected corporate request
app.post('/api/corp-requests/:id/resubmit',requireAuth,requireRole('banker'),(req,res)=>{
  const old_req=DB.corpPending.find(r=>r.id===req.params.id);
  if(!old_req) return res.status(404).json({error:'Not found'});
  if(old_req.status!=='rejected') return res.json({success:false,error:'Only rejected requests can be resubmitted'});
  const {data}=req.body;
  const new_req={
    id:newCorpPendingId(),
    action:old_req.action,
    corpId:old_req.corpId,
    corpName:old_req.corpName,
    data:data||old_req.data,
    existingSnapshot:old_req.existingSnapshot,
    submittedBy:req.session.user.name,
    submittedAt:nowTime(),
    status:'pending_approver',
    approverRemark:'',
    history:[
      ...old_req.history,
      {actor:req.session.user.name,role:'banker',action:'resubmitted after correction',time:nowTime()},
    ],
    resubmittedFrom:old_req.id,
  };
  DB.corpPending.unshift(new_req);
  old_req.status='superseded';
  addNotif('approver@bank.com','🔄 Corporate Request resubmitted: "'+new_req.corpName+'" by '+req.session.user.name+'. Please review.','warning');
  res.json({success:true,request:new_req});
});

// ── CORPORATES READ ───────────────────────────────────────────
app.get('/api/corporates',requireAuth,requireRole('banker','approver','maker','checker'),(req,res)=>{
  const u=req.session.user;
  if(u.role==='maker'||u.role==='checker'){
    return res.json(DB.corporates.filter(c=>c.status==='active').map(c=>({id:c.id,name:c.name})));
  }
  res.json(DB.corporates);
});

// ── BATCH DOWNLOAD ────────────────────────────────────────────
app.get('/api/batches/:id/download',requireAuth,(req,res)=>{
  const b=DB.batches.find(x=>x.id===req.params.id);
  if(!b) return res.status(404).json({error:'Not found'});
  const u=req.session.user;
  if((u.role==='maker'||u.role==='checker')&&u.corp!==b.corp) return res.status(403).json({error:'Forbidden'});
  const data=b.employeeData||[];
  let headers,rows;
  if(b.type==='AS'){
    headers=['Employee Name','Employee ID','CNIC','Account Number','Net Salary','Month'];
    rows=data.map(e=>[e['Employee Name'],e['Employee ID'],e['CNIC'],e['Account Number'],e.salary||0,b.month]);
  }else{
    headers=['Employee Name','Employee ID','CNIC','Account Number','Monthly Salary','EWA Days','EWA Amount','Month'];
    rows=data.map(e=>[e['Employee Name'],e['Employee ID'],e['CNIC'],e['Account Number'],e.salary||0,e.days||0,e.ewaAmount||0,b.month]);
  }
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws['!cols']=headers.map(()=>({wch:22}));
  XLSX.utils.book_append_sheet(wb,ws,b.type==='AS'?'Advance Salary':'EWA');
  const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
  res.setHeader('Content-Disposition','attachment; filename="'+b.id+'_'+b.type+'.xlsx"');
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ── EXCEL TEMPLATES ───────────────────────────────────────────
app.get('/api/template/:type',(req,res)=>{
  const type=req.params.type.toUpperCase();
  let headers,rows;
  if(type==='AS'){
    headers=['Employee Name','Employee ID','CNIC','Account Number','Net Salary','Gross Salary','Month','Department'];
    rows=[
      ['Muhammad Asad','EMP-001','42101-1234567-1','PK36SCBL0000001123456702',85000,95000,'May-2025','Engineering'],
      ['Fatima Noor','EMP-002','42201-2345678-2','PK36SCBL0000001123456703',72000,80000,'May-2025','Finance'],
      ['Bilal Ahmed','EMP-003','42301-3456789-3','PK36SCBL0000001123456704',95000,105000,'May-2025','Operations'],
    ];
  }else{
    headers=['Employee Name','Employee ID','CNIC','Account Number','Monthly Salary','EWA Days','Month'];
    rows=[
      ['Fatima Noor','EMP-002','42201-2345678-2','PK36SCBL0000001123456703',72000,10,'May-2025'],
      ['Bilal Ahmed','EMP-003','42301-3456789-3','PK36SCBL0000001123456704',95000,15,'May-2025'],
    ];
  }
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws['!cols']=headers.map(()=>({wch:24}));
  XLSX.utils.book_append_sheet(wb,ws,type==='AS'?'Advance Salary':'EWA Requests');
  const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
  res.setHeader('Content-Disposition','attachment; filename="Template_'+type+'.xlsx"');
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT,()=>{
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Bank Payroll Advance Service — DEMO        ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║   Open:  http://localhost:'+PORT+'                ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║   maker@bank.com      / maker123             ║');
  console.log('║   checker@bank.com    / checker123           ║');
  console.log('║   banker@bank.com     / banker123            ║');
  console.log('║   approver@bank.com   / approver123          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
