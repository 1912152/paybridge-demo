// PayBridge Dashboard — Complete Rewrite (safe JS, no template literal ternaries)
var ME=null, CURRENT_PAGE='dashboard', CORP_FILTER='', REJECT_STAGE_FILTER='all';

var STATUS_META={
  pending_checker:  {label:'Pending Checker Review',   cls:'badge-amber'},
  pending_banker:   {label:'Pending Bank Review',      cls:'badge-amber'},
  pending_approver: {label:'Pending Final Authorization', cls:'badge-amber'},
  forwarded_cbs:    {label:'✓ Forwarded to CBS',        cls:'badge-green'},
  rejected_checker: {label:'Rejected by Checker',      cls:'badge-red'},
  rejected_banker:  {label:'Rejected by Bank',         cls:'badge-red'},
  rejected_approver:{label:'Rejected by Approver',     cls:'badge-red'},
};
var ROLE_LABELS={maker:'Corporate Maker',checker:'Corporate Checker',banker:'Banker — Reviewer',approver:'Banker Approver'};
var ACTION_ICONS={uploaded:'📤',approved:'✅',rejected:'❌','forwarded to CBS':'✅','resubmitted after correction':'🔄','submitted for approval':'📋'};

function fmt(n){return 'PKR '+Number(n).toLocaleString();}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function statusBadge(s){
  var m=STATUS_META[s]||{label:s,cls:'badge-gray'};
  return '<span class="badge '+m.cls+'">'+m.label+'</span>';
}
function typeBadge(t){
  return t==='AS'?'<span class="tag tag-as">Advance Salary</span>':'<span class="tag tag-ewa">EWA</span>';
}
function typePill(t){
  if(t==='AS') return '<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(30,95,216,0.18);border:1px solid rgba(30,95,216,0.35);border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;color:#6DA3FF">&#128202; Advance Salary</span>';
  return '<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(0,194,168,0.12);border:1px solid rgba(0,194,168,0.3);border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;color:#00C2A8">&#128176; Earned Wage Access (EWA)</span>';
}

function safeDateParse(str){
  if(!str) return new Date();
  var d=new Date(str);
  if(!isNaN(d.getTime())) return d;
  var parts=String(str).split(' ');
  if(parts.length===3){var months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};var m=months[parts[1]];if(m!==undefined)return new Date(parseInt(parts[2]),m,parseInt(parts[0]));}
  return new Date();
}

// ── INIT ──────────────────────────────────────────────────────
async function init(){
  var area=document.getElementById('content-area');
  try{
    var r=await fetch('/api/me',{credentials:'same-origin'});
    if(!r.ok){window.location.href='/';return;}
    ME=await r.json();
    if(!ME||!ME.role){area.innerHTML='<div style="padding:40px;text-align:center;color:#FF7575">Session error. <a href="/" style="color:#6DA3FF">Sign in again</a>.</div>';return;}
    setupUI();
    await loadPage('dashboard');
    if(ME.mustChange) showMustChangeModal();
    pollNotifications();
  }catch(e){
    console.error('Init error:',e);
    area.innerHTML='<div style="padding:40px;text-align:center;color:#FF7575"><strong>Dashboard Error: '+esc(e.message)+'</strong><br><br><button onclick="location.href=\'/\'" style="padding:8px 16px;background:#185FA5;color:#fff;border:none;border-radius:6px;cursor:pointer">Return to Login</button></div>';
  }
}

function setupUI(){
  var ini=ME.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  document.getElementById('user-avatar').textContent=ini;
  document.getElementById('user-name').textContent=ME.name;
  document.getElementById('user-role').textContent=ROLE_LABELS[ME.role]||ME.role;
  var pb=document.getElementById('portal-badge');
  pb.textContent=ME.portal==='bank'?'Bank Portal':'Corporate Portal';
  pb.className='portal-badge '+ME.portal;
  renderNav();
}

function renderNav(){
  var nm={
    maker:[{id:'dashboard',icon:'&#9135;',label:'Dashboard'},{id:'new_as',icon:'&#128228;',label:'New Advance Salary'},{id:'new_ewa',icon:'&#128176;',label:'New EWA Request'},{id:'my_batches',icon:'&#128203;',label:'My Batches'},{id:'rejected_batches',icon:'&#9888;&#65039;',label:'Rejected Batches'}],
    checker:[{id:'dashboard',icon:'&#9135;',label:'Dashboard'},{id:'pending_review',icon:'&#128065;',label:'Pending Review'},{id:'all_batches',icon:'&#128203;',label:'Batch History'}],
    banker:[{id:'dashboard',icon:'&#9135;',label:'Dashboard'},{id:'corp_mgmt',icon:'&#127970;',label:'Corporate Accounts'},{id:'corp_requests',icon:'&#128203;',label:'My Submitted Requests'},{id:'pending_review',icon:'&#128229;',label:'Incoming Batches'},{id:'as_logs',icon:'&#128202;',label:'Advance Salary Logs'},{id:'ewa_logs',icon:'&#128202;',label:'EWA Logs'}],
    approver:[{id:'dashboard',icon:'&#9135;',label:'Dashboard'},{id:'corp_approvals',icon:'&#127970;',label:'Corporate Approvals'},{id:'final_queue',icon:'&#128737;',label:'Final Authorization Queue'},{id:'all_batches',icon:'&#128203;',label:'Complete History'}],
  };
  var items=nm[ME.role]||[];
  var html=items.map(function(i){
    return '<div class="nav-item'+(CURRENT_PAGE===i.id?' active':'')+'" onclick="loadPage(\''+i.id+'\')"><span class="nav-icon">'+i.icon+'</span>'+i.label+'</div>';
  }).join('');
  html+='<div class="nav-item'+(CURRENT_PAGE==='profile'?' active':'')+'" onclick="loadPage(\'profile\')" style="margin-top:auto"><span class="nav-icon">&#9881;&#65039;</span>Profile &amp; Settings</div>';
  document.getElementById('sidebar-nav').innerHTML=html;
}

var PAGE_TITLES={dashboard:'Dashboard',new_as:'New Advance Salary Batch',new_ewa:'New EWA Request Batch',my_batches:'My Batches',all_batches:'Batch History',pending_review:'Pending Review',corp_mgmt:'Corporate Accounts',corp_requests:'My Submitted Requests',corp_approvals:'Corporate Approval Queue',as_logs:'Advance Salary Logs',ewa_logs:'EWA Logs',final_queue:'Final Authorization Queue',profile:'Profile & Settings',rejected_batches:'Rejected Batches'};

function getPageFn(role, page){
  if(role==='maker'){
    if(page==='dashboard') return makerDashboard;
    if(page==='new_as') return pageNewAS;
    if(page==='new_ewa') return pageNewEWA;
    if(page==='my_batches') return pageBatchList;
    if(page==='rejected_batches') return makerRejected;
    if(page==='profile') return profilePage;
  }
  if(role==='checker'){
    if(page==='dashboard') return checkerDashboard;
    if(page==='pending_review') return checkerPending;
    if(page==='all_batches') return pageBatchList;
    if(page==='profile') return profilePage;
  }
  if(role==='banker'){
    if(page==='dashboard') return bankerDashboard;
    if(page==='corp_mgmt') return pageCorporates;
    if(page==='corp_requests') return bankerCorpRequests;
    if(page==='pending_review') return bankerIncoming;
    if(page==='as_logs') return function(){return pageLogsTyped('AS');};
    if(page==='ewa_logs') return function(){return pageLogsTyped('EWA');};
    if(page==='profile') return profilePage;
  }
  if(role==='approver'){
    if(page==='dashboard') return approverDashboard;
    if(page==='corp_approvals') return approverCorpQueue;
    if(page==='final_queue') return approverQueue;
    if(page==='all_batches') return pageBatchList;
    if(page==='profile') return profilePage;
  }
  return null;
}

async function loadPage(page){
  var changed=(CURRENT_PAGE!==page);
  CURRENT_PAGE=page;
  if(changed){CORP_FILTER='';REJECT_STAGE_FILTER='all';}
  renderNav();
  document.getElementById('page-title').textContent=PAGE_TITLES[page]||page;
  document.getElementById('page-crumb').textContent=(ROLE_LABELS[ME.role]||'')+(ME.corp?' · '+ME.corp:'');
  await renderCurrentPage();
}

async function renderCurrentPage(){
  var area=document.getElementById('content-area');
  area.innerHTML='<div class="loading-state">Loading...</div>';
  var fn=getPageFn(ME.role,CURRENT_PAGE);
  try{
    if(fn) area.innerHTML=await fn();
    else area.innerHTML='<div class="empty-state"><div class="empty-icon">&#128295;</div><p>Page not available.</p></div>';
  }catch(e){
    console.error('Page error:',e);
    area.innerHTML='<div style="padding:30px;text-align:center"><div style="color:#FF7575;font-weight:600;margin-bottom:8px">&#9888; Page Error</div><div style="font-size:12px;color:var(--text-muted);font-family:monospace">'+esc(e.message)+'</div><br><button class="btn btn-sm" onclick="renderCurrentPage()">Retry</button></div>';
  }
}

function applyCorpFilter(){
  var sel=document.getElementById('corp-filter-sel');
  if(sel) CORP_FILTER=sel.value||'';
  renderCurrentPage();
}
function clearCorpFilter(){CORP_FILTER='';renderCurrentPage();}
function setRejectFilter(stage){REJECT_STAGE_FILTER=stage;renderCurrentPage();}

async function corpFilterWidget(currentFilter){
  var corps=[];
  try{corps=await apiFetch('/api/corporates');}catch(e){}
  var names=[...new Set(corps.map(function(c){return c.name;}))];
  var opts='<option value="">- All Corporates -</option>';
  names.forEach(function(n){opts+='<option value="'+esc(n)+'"'+(currentFilter===n?' selected':'')+'>'+esc(n)+'</option>';});
  var clearBtn=currentFilter?'<span class="badge badge-blue">'+esc(currentFilter)+'</span><button class="btn btn-sm" onclick="clearCorpFilter()">x Clear</button>':'';
  return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px">'
    +'<span style="font-size:13px;color:var(--text-muted);white-space:nowrap">Filter by Corporate:</span>'
    +'<select class="form-select" id="corp-filter-sel" onchange="applyCorpFilter()" style="flex:1;max-width:260px">'+opts+'</select>'
    +clearBtn+'</div>';
}

function corpStatsBar(batches,corpName){
  if(!batches||!batches.length) return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--text-muted)">No data found for <strong style="color:var(--text)">'+esc(corpName)+'</strong>.</div>';
  var disbursed=batches.filter(function(b){return b.status==='forwarded_cbs';});
  var totalDisbursed=disbursed.reduce(function(s,b){return s+b.amount;},0);
  var totalCharge=disbursed.reduce(function(s,b){return s+b.charge;},0);
  var asDisbAmt=disbursed.filter(function(b){return b.type==='AS';}).reduce(function(s,b){return s+b.amount;},0);
  var ewaDisbAmt=disbursed.filter(function(b){return b.type==='EWA';}).reduce(function(s,b){return s+b.amount;},0);
  var now=new Date(); var tm=now.getMonth(); var ty=now.getFullYear();
  var thisMonthAS=disbursed.filter(function(b){return b.type==='AS'&&safeDateParse(b.date).getMonth()===tm&&safeDateParse(b.date).getFullYear()===ty;}).reduce(function(s,b){return s+b.amount;},0);
  var thisMonthEWA=disbursed.filter(function(b){return b.type==='EWA'&&safeDateParse(b.date).getMonth()===tm&&safeDateParse(b.date).getFullYear()===ty;}).reduce(function(s,b){return s+b.amount;},0);
  var pending=batches.filter(function(b){return b.status.startsWith('pending');}).length;
  var monthRow=(thisMonthAS>0||thisMonthEWA>0)?'<div style="border-top:1px solid rgba(255,255,255,0.07);margin-top:10px;padding-top:10px;display:flex;gap:20px"><span style="font-size:12px;color:var(--text-muted)">This Month:</span><span style="font-size:12px;color:#6DA3FF">AS: '+fmt(thisMonthAS)+'</span><span style="font-size:12px;color:#00C2A8">EWA: '+fmt(thisMonthEWA)+'</span></div>':'';
  return '<div style="background:linear-gradient(135deg,rgba(30,95,216,0.08) 0%,rgba(0,194,168,0.06) 100%);border:1px solid rgba(30,95,216,0.2);border-radius:12px;padding:14px 18px;margin-bottom:16px">'
    +'<div style="font-size:11px;font-weight:600;color:#6DA3FF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Summary for: '+esc(corpName)+'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">'
    +'<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#4DD890">'+fmt(totalDisbursed)+'</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px">Total Forwarded</div></div>'
    +'<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#6DA3FF">'+fmt(asDisbAmt)+'</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px">Advance Salary</div></div>'
    +'<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#00C2A8">'+fmt(ewaDisbAmt)+'</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px">EWA Forwarded</div></div>'
    +'<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#F0B843">'+fmt(totalCharge)+'</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px">Service Revenue</div></div>'
    +'<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#FF7575">'+pending+'</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px">Pending</div></div>'
    +'</div>'+monthRow+'</div>';
}

// ── APPROVAL CHAIN ────────────────────────────────────────────
function approvalChainHTML(b){
  var steps=[{label:'Corp. Maker',icon:'&#128100;'},{label:'Corp. Checker',icon:'&#9989;'},{label:'Banker',icon:'&#127974;'},{label:'Authorizer',icon:'&#128737;&#65039;'}];
  var doneMap={pending_checker:[0],rejected_checker:[0],pending_banker:[0,1],rejected_banker:[0,1],pending_approver:[0,1,2],rejected_approver:[0,1,2],forwarded_cbs:[0,1,2,3]};
  var activeMap={pending_checker:1,rejected_checker:1,pending_banker:2,rejected_banker:2,pending_approver:3,rejected_approver:3,forwarded_cbs:-1};
  var done=doneMap[b.status]||[0]; var active=activeMap[b.status]; if(active===undefined)active=1;
  var rej=b.status.startsWith('rejected');
  var html='<div class="approval-chain">';
  steps.forEach(function(s,i){
    var isDone=done.indexOf(i)>=0; var isActive=i===active&&!rej; var isRej=rej&&i===active;
    var cls=isRej?'rejected':isDone?'done':isActive?'active':'pending';
    var txt=isRej?'Rejected':isDone?'Done':isActive?'In Review':'Pending';
    if(i>0) html+='<div class="chain-arrow">›</div>';
    html+='<div class="chain-step '+cls+'">'
      +'<div class="chain-step-icon">'+s.icon+'</div>'
      +'<div class="chain-step-label">'+s.label+'</div>'
      +'<div class="chain-step-status">'+txt+'</div>'
      +'</div>';
  });
  return html+'</div>';
}

function historyTimelineHTML(b){
  var history=b.history||[];
  if(!history.length) return '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No history recorded.</div>';
  var roleColors={maker:'#6DA3FF',checker:'#4DD890',banker:'#F0B843',approver:'#00C2A8'};
  var roleBg={maker:'rgba(30,95,216,0.12)',checker:'rgba(29,179,104,0.12)',banker:'rgba(240,184,67,0.12)',approver:'rgba(0,194,168,0.12)'};
  var html='<div class="timeline">';
  history.forEach(function(s){
    var isRej=s.action==='rejected'; var isFwd=s.action==='forwarded to CBS';
    var cls=isRej?'rejected':isFwd?'success':'done';
    var icon=ACTION_ICONS[s.action]||'📋';
    html+='<div class="tl-item '+cls+'">'
      +'<div style="flex:1">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
      +'<span style="font-size:13px;font-weight:500">'+icon+' '+s.action.charAt(0).toUpperCase()+s.action.slice(1)+' by '+esc(s.actor)+'</span>'
      +'<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;background:'+(roleBg[s.role]||'var(--surface)')+';color:'+(roleColors[s.role]||'var(--text-muted)')+'">'+((ROLE_LABELS[s.role]||s.role).toUpperCase())+'</span>'
      +'</div>'
      +(s.remark?'<div style="font-size:12px;color:#FF7575;margin-top:4px;padding:6px 10px;background:rgba(224,62,62,0.08);border-radius:6px;border-left:2px solid #E03E3E">Reason: '+esc(s.remark)+'</div>':'')
      +'</div>'
      +(s.time?'<div class="tl-time">'+esc(s.time)+'</div>':'')
      +'</div>';
  });
  return html+'</div>';
}

// ── PROFILE ───────────────────────────────────────────────────
async function profilePage(){
  return '<div style="max-width:560px">'
    +'<div class="card" style="margin-bottom:20px">'
    +'<div class="card-header"><span class="card-title">Profile Information</span></div>'
    +'<div class="card-body">'
    +'<div class="form-group" style="margin-bottom:14px"><label class="form-label">Display Name</label><input class="form-input" id="prof-name" value="'+esc(ME.name)+'"></div>'
    +'<div class="form-group" style="margin-bottom:14px"><label class="form-label">Email Address</label><input class="form-input" value="'+esc(ME.email)+'" disabled style="opacity:0.5"></div>'
    +'<div class="form-group" style="margin-bottom:16px"><label class="form-label">Role</label><input class="form-input" value="'+(ROLE_LABELS[ME.role]||ME.role)+'" disabled style="opacity:0.5"></div>'
    +'<div id="prof-msg"></div><button class="btn btn-primary" onclick="saveProfile()">Save Profile</button>'
    +'</div></div>'
    +'<div class="card">'
    +'<div class="card-header"><span class="card-title">Change Password</span>'+(ME.mustChange?'<span class="badge badge-red">First-time change required</span>':'')+'</div>'
    +'<div class="card-body">'
    +(ME.mustChange?'<div class="alert alert-warning" style="margin-bottom:16px"><span class="alert-icon">&#9888;&#65039;</span><div>Please change your default password for security.</div></div>':'')
    +'<div class="form-group" style="margin-bottom:14px"><label class="form-label">Current Password</label><div style="position:relative"><input class="form-input" type="password" id="pw-current" placeholder="Current password" style="padding-right:44px"><button onclick="togglePw(\'pw-current\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px">&#128065;</button></div></div>'
    +'<div class="form-group" style="margin-bottom:14px"><label class="form-label">New Password</label><div style="position:relative"><input class="form-input" type="password" id="pw-new" placeholder="At least 6 characters" style="padding-right:44px" oninput="checkPwStrength()"><button onclick="togglePw(\'pw-new\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px">&#128065;</button></div><div id="pw-strength-bar" style="display:none;margin-top:6px"><div class="progress"><div class="progress-fill" id="pw-strength-fill" style="width:0%"></div></div><div id="pw-strength-label" style="font-size:11px;margin-top:3px"></div></div></div>'
    +'<div class="form-group" style="margin-bottom:16px"><label class="form-label">Confirm New Password</label><div style="position:relative"><input class="form-input" type="password" id="pw-confirm" placeholder="Repeat new password" style="padding-right:44px"><button onclick="togglePw(\'pw-confirm\')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px">&#128065;</button></div></div>'
    +'<div id="pw-msg"></div><button class="btn btn-primary" onclick="changePassword()">Change Password</button>'
    +'</div></div></div>';
}

function togglePw(id){var el=document.getElementById(id);if(el)el.type=el.type==='password'?'text':'password';}
function checkPwStrength(){
  var pw=document.getElementById('pw-new').value;
  var bar=document.getElementById('pw-strength-bar');
  if(!pw){bar.style.display='none';return;}
  bar.style.display='block';
  var s=0;if(pw.length>=6)s++;if(pw.length>=10)s++;if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
  var lvls=[{p:'20%',c:'#E03E3E',t:'Very weak'},{p:'40%',c:'#E8A020',t:'Weak'},{p:'60%',c:'#F0C040',t:'Fair'},{p:'80%',c:'#1DB368',t:'Strong'},{p:'100%',c:'#00C2A8',t:'Very strong'}];
  var lvl=lvls[Math.min(s-1,4)]||lvls[0];
  var fill=document.getElementById('pw-strength-fill'); fill.style.width=lvl.p; fill.style.background=lvl.c;
  var lbl=document.getElementById('pw-strength-label'); lbl.textContent=lvl.t; lbl.style.color=lvl.c;
}
async function saveProfile(){
  var name=document.getElementById('prof-name').value.trim();
  var res=await apiFetch('/api/update-profile','POST',{name:name});
  if(res.success){ME.name=name;document.getElementById('user-name').textContent=name;document.getElementById('user-avatar').textContent=name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();showToast('Profile updated','success');document.getElementById('prof-msg').innerHTML='';}
  else document.getElementById('prof-msg').innerHTML='<div class="alert alert-danger" style="margin-bottom:12px"><span class="alert-icon">&#9888;&#65039;</span><div>'+esc(res.error)+'</div></div>';
}
async function changePassword(){
  var cur=document.getElementById('pw-current').value;
  var nw=document.getElementById('pw-new').value;
  var cf=document.getElementById('pw-confirm').value;
  var msg=document.getElementById('pw-msg');
  if(!cur||!nw||!cf){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:12px"><span class="alert-icon">&#9888;&#65039;</span><div>All fields required.</div></div>';return;}
  if(nw!==cf){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:12px"><span class="alert-icon">&#9888;&#65039;</span><div>Passwords do not match.</div></div>';return;}
  if(nw.length<6){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:12px"><span class="alert-icon">&#9888;&#65039;</span><div>Minimum 6 characters.</div></div>';return;}
  var res=await apiFetch('/api/change-password','POST',{currentPassword:cur,newPassword:nw});
  if(res.success){
    ME.mustChange=false;msg.innerHTML='';
    ['pw-current','pw-new','pw-confirm'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('pw-strength-bar').style.display='none';
    renderNav();showToast('Password changed successfully!','success');
    showModal('<div class="modal-title" style="color:#4DD890">Password Updated!</div><div class="alert alert-success"><span class="alert-icon">&#9989;</span><div><strong>Password changed successfully.</strong><br>Use your new password next time you log in.</div></div><button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="closeModal()">OK</button>');
  }else msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:12px"><span class="alert-icon">&#9888;&#65039;</span><div>'+esc(res.error)+'</div></div>';
}
function showMustChangeModal(){
  showModal('<div class="modal-title">Set Your Password</div><div class="alert alert-warning" style="margin-bottom:16px"><span class="alert-icon">&#9888;&#65039;</span><div>First login — please set a personal password.</div></div><div class="form-group" style="margin-bottom:12px"><label class="form-label">Current Password</label><input class="form-input" type="password" id="mc-cur"></div><div class="form-group" style="margin-bottom:12px"><label class="form-label">New Password</label><input class="form-input" type="password" id="mc-new"></div><div class="form-group" style="margin-bottom:16px"><label class="form-label">Confirm New Password</label><input class="form-input" type="password" id="mc-cf"></div><div id="mc-msg"></div><div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="mustChangeSubmit()">Set Password</button><button class="btn" onclick="closeModal()">Skip for now</button></div>');
}
async function mustChangeSubmit(){
  var cur=document.getElementById('mc-cur').value,nw=document.getElementById('mc-new').value,cf=document.getElementById('mc-cf').value;
  var msg=document.getElementById('mc-msg');
  if(!cur||!nw||!cf){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>All fields required.</span></div>';return;}
  if(nw!==cf){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>Passwords do not match.</span></div>';return;}
  if(nw.length<6){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>Min 6 characters.</span></div>';return;}
  var res=await apiFetch('/api/change-password','POST',{currentPassword:cur,newPassword:nw});
  if(res.success){ME.mustChange=false;closeModal();showToast('Password set successfully!','success');}
  else msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>'+esc(res.error)+'</span></div>';
}

// ── MAKER ─────────────────────────────────────────────────────
async function makerDashboard(){
  var b=await apiFetch('/api/batches');
  var pending=b.filter(function(x){return x.status==='pending_checker';}).length;
  var rejected=b.filter(function(x){return x.status.startsWith('rejected');}).length;
  var disbursed=b.filter(function(x){return x.status==='forwarded_cbs';}).reduce(function(s,x){return s+x.amount;},0);
  var asDisbursed=b.filter(function(x){return x.status==='forwarded_cbs'&&x.type==='AS';});
  var ewaDisbursed=b.filter(function(x){return x.status==='forwarded_cbs'&&x.type==='EWA';});
  var asDue=asDisbursed.reduce(function(s,x){return s+(x.amount+x.charge);},0);
  var ewaDue=ewaDisbursed.reduce(function(s,x){return s+x.charge;},0);
  var now=new Date(); var tm=now.getMonth(); var ty=now.getFullYear();
  var asDueM=asDisbursed.filter(function(x){var d=safeDateParse(x.date);return d.getMonth()===tm&&d.getFullYear()===ty;}).reduce(function(s,x){return s+(x.amount+x.charge);},0);
  var ewaDueM=ewaDisbursed.filter(function(x){var d=safeDateParse(x.date);return d.getMonth()===tm&&d.getFullYear()===ty;}).reduce(function(s,x){return s+x.charge;},0);

  var rows='';
  b.slice(0,5).forEach(function(x){
    rows+='<tr><td class="mono">'+esc(x.id)+'</td><td>'+typeBadge(x.type)+'</td><td>'+esc(x.month)+'</td><td>'+x.employees+'</td><td style="font-weight:500">'+fmt(x.amount)+'</td><td>'+statusBadge(x.status)+'</td><td><button class="btn btn-sm" data-bid="'+esc(x.id)+'" onclick="showBatchDetail(this.dataset.bid)">View</button></td></tr>';
  });
  if(!rows) rows='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">No batches yet.</td></tr>';

  return '<div class="metrics-row">'
    +'<div class="metric-card"><div class="metric-label">Total Batches</div><div class="metric-value blue">'+b.length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Pending Review</div><div class="metric-value amber">'+pending+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Forwarded to CBS</div><div class="metric-value green">PKR '+(disbursed/1000).toFixed(0)+'K</div></div>'
    +'<div class="metric-card"><div class="metric-label">Rejected Batches</div><div class="metric-value red">'+rejected+'</div></div>'
    +'</div>'
    +(rejected>0?'<div class="alert alert-warning"><span class="alert-icon">&#9888;&#65039;</span><div>'+rejected+' batch(es) rejected. Go to <strong>Rejected Batches</strong> in the sidebar.</div></div>':'')
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">'
    +'<div style="background:rgba(30,95,216,0.08);border:1px solid rgba(30,95,216,0.25);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:#6DA3FF;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Advance Salary — Bank Dues</div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;color:var(--text-muted)">Total Outstanding</span><span style="font-size:13px;font-weight:600;color:#6DA3FF">'+fmt(asDue)+'</span></div><div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text-muted)">This Month</span><span style="font-size:13px;font-weight:600;color:#F0B843">'+fmt(asDueM)+'</span></div></div>'
    +'<div style="background:rgba(0,194,168,0.08);border:1px solid rgba(0,194,168,0.25);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:#00C2A8;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">EWA — Bank Dues</div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;color:var(--text-muted)">Total Service Charges</span><span style="font-size:13px;font-weight:600;color:#00C2A8">'+fmt(ewaDue)+'</span></div><div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text-muted)">This Month</span><span style="font-size:13px;font-weight:600;color:#F0B843">'+fmt(ewaDueM)+'</span></div></div>'
    +'</div>'
    +'<div class="card"><div class="card-header"><span class="card-title">Recent Batches</span><button class="btn btn-sm" onclick="loadPage(\'my_batches\')">View All</button></div>'
    +'<div class="table-wrap"><table><thead><tr><th>Batch ID</th><th>Type</th><th>Month</th><th>Employees</th><th>Amount</th><th>Status</th><th></th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div></div>';
}

async function makerRejected(){
  var all=await apiFetch('/api/batches');
  var allRejected=all.filter(function(b){return b.status.startsWith('rejected');});
  if(!allRejected.length) return '<div class="empty-state"><div class="empty-icon">&#9989;</div><p>No rejected batches.</p></div>';
  var rejected=allRejected;
  if(REJECT_STAGE_FILTER==='bank') rejected=allRejected.filter(function(b){return b.status==='rejected_banker'||b.status==='rejected_approver';});
  if(REJECT_STAGE_FILTER==='checker') rejected=allRejected.filter(function(b){return b.status==='rejected_checker';});
  var stageMap={rejected_checker:'Rejected by Corporate Checker',rejected_banker:'Rejected by Bank Reviewer',rejected_approver:'Rejected at Final Authorization'};
  var bankCount=allRejected.filter(function(b){return b.status==='rejected_banker'||b.status==='rejected_approver';}).length;
  var checkerCount=allRejected.filter(function(b){return b.status==='rejected_checker';}).length;
  var filterBar='<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;flex-wrap:wrap">'
    +'<span style="font-size:13px;color:var(--text-muted);font-weight:500">Filter by Stage:</span>'
    +'<button class="btn btn-sm'+(REJECT_STAGE_FILTER==='all'?' btn-primary':'')+'" onclick="setRejectFilter(\'all\')">All ('+allRejected.length+')</button>'
    +'<button class="btn btn-sm'+(REJECT_STAGE_FILTER==='checker'?' btn-primary':'')+'" style="'+(REJECT_STAGE_FILTER!=='checker'?'border-color:#F0B843;color:#F0B843':'')+'" onclick="setRejectFilter(\'checker\')">Rejected by Checker ('+checkerCount+')</button>'
    +'<button class="btn btn-sm'+(REJECT_STAGE_FILTER==='bank'?' btn-primary':'')+'" style="'+(REJECT_STAGE_FILTER!=='bank'?'border-color:#FF7575;color:#FF7575':'')+'" onclick="setRejectFilter(\'bank\')">Rejected by Banker / Approver ('+bankCount+')</button>'
    +'</div>';
  if(!rejected.length) return filterBar+'<div class="empty-state"><div class="empty-icon">&#128269;</div><p>No batches match this filter.</p></div>';
  var asCards='',ewaCards='';
  rejected.forEach(function(b){
    var isBankRej=b.status==='rejected_banker'||b.status==='rejected_approver';
    var card='<div class="card" style="margin-bottom:16px;border-left:3px solid '+(isBankRej?'var(--red)':'#F0B843')+'">'
      +'<div class="card-header" style="background:rgba(224,62,62,0.06)">'
      +'<div style="display:flex;align-items:center;gap:10px">'+typePill(b.type)+'<span class="card-title">'+esc(b.id)+' — '+esc(b.month)+'</span></div>'
      +'<span class="badge '+(isBankRej?'badge-red':'badge-amber')+'">'+(stageMap[b.status]||b.status)+'</span>'
      +'</div><div class="card-body">'
      +'<div class="split-3" style="margin-bottom:14px">'
      +'<div class="metric-card"><div class="metric-label">Employees</div><div class="metric-value blue">'+b.employees+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Amount</div><div style="font-weight:600;font-size:15px;margin-top:4px">'+fmt(b.amount)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Submitted</div><div style="margin-top:4px;font-size:13px">'+esc(b.date)+'</div></div>'
      +'</div>'
      +'<div style="background:rgba(224,62,62,0.08);border:1px solid rgba(224,62,62,0.25);border-radius:8px;padding:12px 14px;margin-bottom:14px">'
      +'<div style="font-size:11px;font-weight:600;color:#FF7575;text-transform:uppercase;margin-bottom:6px">Rejection Reason</div>'
      +'<div style="font-size:13px;color:var(--text)">'+esc(b.remarks||'No reason provided.')+'</div>'
      +'</div>'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
      +'<button class="btn btn-primary" data-bid="'+esc(b.id)+'" data-btype="'+esc(b.type)+'" onclick="openResubmitModal(this.dataset.bid,this.dataset.btype)">Fix &amp; Resubmit</button>'
      +'<a href="/api/batches/'+esc(b.id)+'/download" class="btn btn-sm">Download Original</a>'
      +'<button class="btn btn-sm" data-bid="'+esc(b.id)+'" onclick="showBatchDetail(this.dataset.bid)">Full Timeline</button>'
      +'<button class="btn btn-sm btn-danger" data-bid="'+esc(b.id)+'" onclick="confirmDeleteBatch(this.dataset.bid)">Delete</button>'
      +'</div></div></div>';
    if(b.type==='AS') asCards+=card; else ewaCards+=card;
  });
  return filterBar
    +(asCards?'<div style="margin-bottom:8px;font-size:14px;font-weight:600">Advance Salary — Rejected</div>'+asCards:'')
    +(ewaCards?'<div style="margin-bottom:8px;font-size:14px;font-weight:600;margin-top:'+(asCards?'20px':'0')+'">EWA — Rejected</div>'+ewaCards:'');
}

function confirmDeleteBatch(id){
  showModal('<div class="modal-title">Delete Batch</div><div class="alert alert-danger"><span class="alert-icon">&#9888;&#65039;</span><div>This will permanently remove the rejected batch. Cannot be undone.</div></div><div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-danger" onclick="deleteBatch(\''+esc(id)+'\')">Yes, Delete</button><button class="btn" onclick="closeModal()">Cancel</button></div>');
}
async function deleteBatch(id){
  var res=await apiFetch('/api/batches/'+id,'DELETE');
  if(res.success){closeModal();showToast('Batch deleted','danger');renderCurrentPage();}
  else{closeModal();showToast('Error: '+(res.error||'Delete failed'),'danger');}
}

function openResubmitModal(id,type){
  showModal('<div class="modal-title">Resubmit Batch — '+esc(id)+'</div>'
    +'<div class="alert alert-info" style="margin-bottom:14px"><span class="alert-icon">&#8505;&#65039;</span><div>Download the original file, fix the issues, then upload the corrected file.</div></div>'
    +'<div style="margin-bottom:14px"><a href="/api/batches/'+esc(id)+'/download" class="btn btn-sm">Download Original File</a></div>'
    +'<div class="form-group" style="margin-bottom:12px"><label class="form-label">Salary Month</label><select class="form-select" id="resub-month"><option>May-2025</option><option>Apr-2025</option><option>Mar-2025</option></select></div>'
    +'<div class="upload-zone" id="resub-zone" onclick="document.getElementById(\'resub-file\').click()" style="margin-bottom:12px"><div class="upload-icon">&#128202;</div><div class="upload-text">Click to select corrected Excel file</div></div>'
    +'<input type="file" id="resub-file" accept=".xlsx,.xls" style="display:none" onchange="onResubFileSelected(event,\''+type+'\')">'
    +'<div id="resub-msg"></div>'
    +'<div style="display:flex;gap:10px;margin-top:8px"><button class="btn btn-primary" id="resub-btn" onclick="doResubmit(\'\'+type+\'\')" disabled>Submit to Checker</button><button class="btn" onclick="closeModal()">Cancel</button></div>');
}
function onResubFileSelected(event,type){
  var file=event.target.files[0]; if(!file) return;
  var zone=document.getElementById('resub-zone');
  zone.classList.add('has-file');
  zone.innerHTML='<div class="upload-icon">&#9989;</div><div class="upload-text" style="color:var(--accent)">'+esc(file.name)+'</div>';
  document.getElementById('resub-btn').disabled=false;
}
async function doResubmit(type){
  var fi=document.getElementById('resub-file');
  var month=document.getElementById('resub-month').value;
  var btn=document.getElementById('resub-btn');
  var msg=document.getElementById('resub-msg');
  if(!fi||!fi.files||!fi.files[0]){msg.innerHTML='<div class="alert alert-danger"><span>Please select a file.</span></div>';return;}
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Submitting...';
  var fd=new FormData(); fd.append('file',fi.files[0]); fd.append('type',type); fd.append('month',month);
  try{
    var res=await fetch('/api/batches/upload',{method:'POST',body:fd,credentials:'same-origin'});
    var data=await res.json();
    if(data.success){closeModal();showToast('Resubmitted to checker','success');renderCurrentPage();}
    else{var e=data.errors?data.errors.join('<br>'):(data.error||'Failed');msg.innerHTML='<div class="alert alert-danger" style="margin-top:10px"><span>'+e+'</span></div>';btn.disabled=false;btn.innerHTML='Submit to Checker';}
  }catch(e){msg.innerHTML='<div class="alert alert-danger" style="margin-top:10px"><span>Network error.</span></div>';btn.disabled=false;btn.innerHTML='Submit to Checker';}
}

function uploadFormHTML(type){
  var isAS=type==='AS';
  return '<div class="alert alert-info"><span class="alert-icon">&#8505;&#65039;</span><div>'+(isAS?'Upload employee salary data. The bank pays salaries on behalf of the corporate.':'EWA: employees access up to <strong>15 days</strong> of earned wages early.')+'</div></div>'
    +'<div class="card"><div class="card-header"><span class="card-title">'+(isAS?'Advance Salary':'EWA')+' Batch Upload</span></div><div class="card-body">'
    +'<div class="form-row" style="margin-bottom:16px">'
    +'<div class="form-group"><label class="form-label">Service Type</label><input class="form-input" value="'+(isAS?'Advance Salary':'Earned Wage Access (EWA)')+'" disabled style="opacity:0.6"></div>'
    +'<div class="form-group"><label class="form-label">Salary Month</label><select class="form-select" id="svc-month"><option>May-2025</option><option>Apr-2025</option><option>Mar-2025</option><option>Feb-2025</option></select></div>'
    +'</div>'
    +'<div class="upload-zone" id="upload-zone" onclick="document.getElementById(\'file-input\').click()">'
    +'<div class="upload-icon">'+(isAS?'&#128202;':'&#128176;')+'</div><div class="upload-text">Click to select Excel file</div>'
    +'<div class="upload-sub">Required: '+(isAS?'Employee Name, Employee ID, CNIC, Account Number, Net Salary':'Employee Name, Employee ID, CNIC, Account Number, Monthly Salary, EWA Days')+'</div>'
    +'</div>'
    +'<input type="file" id="file-input" accept=".xlsx,.xls" style="display:none" onchange="onFileSelected(event,\''+type+'\')">'
    +'<div style="margin-top:10px;display:flex;gap:10px;align-items:center"><a href="/api/template/'+type+'" class="btn btn-sm">Download '+(isAS?'AS':'EWA')+' Template</a></div>'
    +'<div id="upload-preview" style="display:none;margin-top:16px"></div>'
    +'<div id="upload-error" style="display:none;margin-top:12px"></div>'
    +'</div></div>';
}
async function pageNewAS(){return uploadFormHTML('AS');}
async function pageNewEWA(){return uploadFormHTML('EWA');}

function onFileSelected(event,type){
  var file=event.target.files[0]; if(!file) return;
  var zone=document.getElementById('upload-zone');
  zone.classList.add('has-file');
  zone.innerHTML='<div class="upload-icon">&#9989;</div><div class="upload-text" style="color:var(--accent)">'+esc(file.name)+'</div><div class="upload-sub">'+(file.size/1024).toFixed(1)+' KB</div>';
  document.getElementById('upload-preview').style.display='block';
  document.getElementById('upload-preview').innerHTML='<div class="alert alert-success"><span class="alert-icon">&#9989;</span><div>File ready: <strong>'+esc(file.name)+'</strong>.</div></div>'
    +'<div style="display:flex;gap:10px;margin-top:10px"><button class="btn btn-primary" id="submit-btn" onclick="submitBatch(\'\'+type+\'\')">Validate &amp; Submit to Checker</button><button class="btn" onclick="loadPage(\'&quot;+(type===&quot;AS&quot;?&quot;new_as&quot;:&quot;new_ewa&quot;)+&quot;\')">Cancel</button></div>';
  document.getElementById('upload-error').style.display='none';
}
async function submitBatch(type){
  var fi=document.getElementById('file-input');
  var month=document.getElementById('svc-month').value||'May-2025';
  var errEl=document.getElementById('upload-error');
  var btn=document.getElementById('submit-btn');
  if(!fi||!fi.files||!fi.files[0]){errEl.style.display='block';errEl.innerHTML='<div class="alert alert-danger"><span>Please select a file first.</span></div>';return;}
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Validating...'; errEl.style.display='none';
  var fd=new FormData(); fd.append('file',fi.files[0]); fd.append('type',type); fd.append('month',month);
  try{
    var res=await fetch('/api/batches/upload',{method:'POST',body:fd,credentials:'same-origin'});
    if(res.status===401){errEl.style.display='block';errEl.innerHTML='<div class="alert alert-danger"><span>Session expired.</span></div>';btn.disabled=false;btn.innerHTML='Validate &amp; Submit';return;}
    var data=await res.json();
    if(data.success){
      document.getElementById('upload-preview').innerHTML='<div class="alert alert-success"><span class="alert-icon">&#127881;</span><div><strong>Batch '+esc(data.batch.id)+' submitted!</strong><br>'+data.batch.employees+' employees &nbsp;|&nbsp; '+fmt(data.batch.amount)+' &nbsp;|&nbsp; Charge: '+fmt(data.batch.charge)+'</div></div>'
        +'<div style="margin-top:12px;display:flex;gap:10px"><button class="btn btn-primary" onclick="loadPage(\'my_batches\')">View My Batches</button><button class="btn" onclick="loadPage(\'&quot;+(type===&quot;AS&quot;?&quot;new_as&quot;:&quot;new_ewa&quot;)+&quot;\')">Upload Another</button></div>';
    }else{
      var msgs=data.errors?data.errors.join('<br>'):(data.error||'Upload failed');
      errEl.style.display='block'; errEl.innerHTML='<div class="alert alert-danger"><span class="alert-icon">&#9888;&#65039;</span><div>'+msgs+'</div></div>';
      btn.disabled=false; btn.innerHTML='Validate &amp; Submit to Checker';
    }
  }catch(e){errEl.style.display='block';errEl.innerHTML='<div class="alert alert-danger"><span>Network error.</span></div>';btn.disabled=false;btn.innerHTML='Validate &amp; Submit to Checker';}
}

// ── CHECKER ───────────────────────────────────────────────────
async function checkerDashboard(){
  var b=await apiFetch('/api/batches');
  var pending=b.filter(function(x){return x.status==='pending_checker';});
  var rows='';
  pending.slice(0,5).forEach(function(b){
    rows+='<tr><td class="mono">'+esc(b.id)+'</td><td>'+typeBadge(b.type)+'</td><td>'+esc(b.maker)+'</td><td style="font-weight:500">'+fmt(b.amount)+'</td><td>'+esc(b.date)+'</td><td><button class="btn btn-sm btn-primary" onclick="loadPage(\'pending_review\')">Review</button></td></tr>';
  });
  if(!rows) rows='<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">No pending batches</td></tr>';
  return '<div class="metrics-row">'
    +'<div class="metric-card"><div class="metric-label">Awaiting My Review</div><div class="metric-value amber">'+pending.length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Forwarded to Bank</div><div class="metric-value green">'+b.filter(function(x){return !['pending_checker','rejected_checker'].includes(x.status);}).length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Rejected by Me</div><div class="metric-value red">'+b.filter(function(x){return x.status==='rejected_checker';}).length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Total Seen</div><div class="metric-value blue">'+b.length+'</div></div>'
    +'</div>'
    +(pending.length>0?'<div class="alert alert-warning"><span class="alert-icon">&#9203;</span><div><strong>'+pending.length+' batch(es) pending your review.</strong></div></div>':'<div class="alert alert-success"><span class="alert-icon">&#9989;</span><div>Queue is clear.</div></div>')
    +'<div class="card"><div class="card-header"><span class="card-title">Pending My Action</span><button class="btn btn-sm" onclick="loadPage(\'pending_review\')">Review All</button></div>'
    +'<div class="table-wrap"><table><thead><tr><th>Batch ID</th><th>Type</th><th>Submitted By</th><th>Amount</th><th>Date</th><th></th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div></div>';
}

async function checkerPending(){
  var batches=await apiFetch('/api/batches?status=pending_checker');
  if(!batches.length) return '<div class="empty-state"><div class="empty-icon">&#9989;</div><p>No batches pending review.<br>Once the Maker uploads a batch it appears here.</p></div>';
  var html='';
  batches.forEach(function(b){
    var empRows='';
    if(b.employeeData&&b.employeeData.length){
      b.employeeData.forEach(function(e,i){
        empRows+='<tr><td>'+(i+1)+'</td><td>'+esc(e['Employee Name'])+'</td><td class="mono">'+esc(e['Employee ID'])+'</td><td class="mono">'+esc(e['CNIC'])+'</td><td>'+fmt(e.salary||e.ewaAmount||0)+'</td></tr>';
      });
    }
    html+='<div class="card" style="margin-bottom:20px">'
      +'<div class="card-header"><div style="display:flex;align-items:center;gap:10px">'+typePill(b.type)+'<span class="card-title">'+esc(b.id)+' — '+esc(b.corp)+'</span></div><span class="badge badge-amber">Awaiting Your Review</span></div>'
      +'<div class="card-body">'+approvalChainHTML(b)
      +'<div class="split-3" style="margin-bottom:14px">'
      +'<div class="metric-card"><div class="metric-label">Employees</div><div class="metric-value blue">'+b.employees+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Total Amount</div><div style="font-weight:600;font-size:16px;margin-top:4px">'+fmt(b.amount)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Month</div><div style="margin-top:4px">'+esc(b.month)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Service Charge</div><div class="metric-value amber" style="font-size:16px">'+fmt(b.charge)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Uploaded By</div><div style="margin-top:4px;font-size:13px">'+esc(b.maker)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">File</div><div style="margin-top:6px"><a href="/api/batches/'+esc(b.id)+'/download" class="btn btn-sm">Download</a></div></div>'
      +'</div>'
      +(empRows?'<div style="margin-bottom:14px"><div class="section-title" style="margin-bottom:8px">Employee Sample</div><div class="table-wrap"><table><thead><tr><th>#</th><th>Name</th><th>Emp ID</th><th>CNIC</th><th>Amount</th></tr></thead><tbody>'+empRows+'</tbody></table></div></div>':'')
      +'<div style="display:flex;gap:10px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap">'
      +'<button class="btn btn-success" data-bid="'+esc(b.id)+'" onclick="checkerAction(this.dataset.bid,\'approve\')">Approve — Forward to Bank</button>'
      +'<button class="btn btn-danger" data-bid="'+esc(b.id)+'" data-bstage="checker" onclick="showRejectModal(this.dataset.bid,this.dataset.bstage)">Reject with Reason</button>'
      +'<button class="btn btn-sm" data-bid="'+esc(b.id)+'" onclick="showBatchDetail(this.dataset.bid)">Full Detail</button>'
      +'<a href="/api/batches/'+esc(b.id)+'/download" class="btn btn-sm">Download File</a>'
      +'</div></div></div>';
  });
  return html;
}
async function checkerAction(id,action){
  var res=await apiFetch('/api/batches/'+id+'/checker','POST',{action:action});
  if(res.success){showToast(action==='approve'?'Approved & sent to bank':'Batch rejected',action==='approve'?'success':'danger');renderCurrentPage();}
  else showToast('Error: '+(res.error||'Unknown'),'danger');
}

// ── BANKER ────────────────────────────────────────────────────
async function bankerDashboard(){
  var batches=await apiFetch('/api/batches');
  var corps=await apiFetch('/api/corporates');
  var corpReqs=await apiFetch('/api/corp-requests');
  var inbox=batches.filter(function(b){return b.status==='pending_banker';});
  var pendingCorpReqs=corpReqs.filter(function(r){return r.status==='pending_approver';}).length;
  var rejectedCorpReqs=corpReqs.filter(function(r){return r.status==='rejected';}).length;
  var fwded=batches.filter(function(b){return b.status==='forwarded_cbs';});
  var total=fwded.reduce(function(s,b){return s+b.amount;},0);
  var inboxRows='';
  batches.filter(function(b){return ['pending_banker','pending_approver'].includes(b.status);}).slice(0,6).forEach(function(b){
    inboxRows+='<tr><td class="mono" style="font-size:11px">'+esc(b.id)+'</td><td>'+typeBadge(b.type)+'</td><td style="font-size:12px">'+esc(b.corp)+'</td><td>'+fmt(b.amount)+'</td><td>'+statusBadge(b.status)+'</td></tr>';
  });
  if(!inboxRows) inboxRows='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Inbox clear</td></tr>';
  var corpRows='';
  corps.forEach(function(c){
    corpRows+='<tr><td style="font-size:12px;font-weight:500">'+esc(c.name)+'</td><td><span class="tag '+(c.services==='both'?'tag-both':c.services==='as'?'tag-as':'tag-ewa')+'">'+(c.services==='both'?'AS+EWA':c.services==='as'?'AS':'EWA')+'</span></td><td><span class="badge '+(c.status==='active'?'badge-green':'badge-gray')+'">'+c.status+'</span></td></tr>';
  });
  return '<div class="metrics-row">'
    +'<div class="metric-card"><div class="metric-label">Active Corporates</div><div class="metric-value blue">'+corps.filter(function(c){return c.status==='active';}).length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">In My Inbox</div><div class="metric-value amber">'+inbox.length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Total Forwarded to CBS</div><div class="metric-value green">PKR '+(total/1000000).toFixed(1)+'M</div></div>'
    +'<div class="metric-card"><div class="metric-label">Corp Requests Pending</div><div class="metric-value amber">'+pendingCorpReqs+'</div></div>'
    +'</div>'
    +(inbox.length>0?'<div class="alert alert-warning"><span class="alert-icon">&#128229;</span><div>'+inbox.length+' batch(es) need your bank-side review.</div></div>':'')
    +(rejectedCorpReqs>0?'<div class="alert alert-danger"><span class="alert-icon">&#10060;</span><div>'+rejectedCorpReqs+' corporate request(s) rejected by approver. <button class="btn btn-sm" onclick="loadPage(\'corp_requests\')" style="margin-left:8px">View &amp; Resubmit</button></div></div>':'')
    +'<div class="split-2">'
    +'<div><div class="section-hdr"><span class="section-title">Incoming Batches</span><button class="btn btn-sm" onclick="loadPage(\'pending_review\')">Review</button></div>'
    +'<div class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Type</th><th>Corp</th><th>Amount</th><th>Status</th></tr></thead><tbody>'+inboxRows+'</tbody></table></div></div></div>'
    +'<div><div class="section-hdr"><span class="section-title">Corporate Portfolio</span><button class="btn btn-sm" onclick="loadPage(\'corp_mgmt\')">Manage</button></div>'
    +'<div class="card"><div class="table-wrap"><table><thead><tr><th>Corporate</th><th>Services</th><th>Status</th></tr></thead><tbody>'+corpRows+'</tbody></table></div></div></div>'
    +'</div>';
}

async function pageCorporates(){
  var corps=await apiFetch('/api/corporates');
  window._corpRegistry={};
  corps.forEach(function(c){window._corpRegistry[c.id]=c;});
  var rows='';
  corps.forEach(function(c){
    rows+='<tr>'
      +'<td class="mono" style="font-size:11px">'+esc(c.id)+'</td>'
      +'<td style="font-weight:500">'+esc(c.name)+'</td>'
      +'<td class="mono" style="font-size:11px">'+esc(c.account)+'</td>'
      +'<td><span class="tag '+(c.services==='both'?'tag-both':c.services==='as'?'tag-as':'tag-ewa')+'">'+(c.services==='both'?'AS+EWA':c.services==='as'?'AS':'EWA')+'</span></td>'
      +'<td style="font-size:12px">'+(c.services!=='ewa'?c.chargeAS+'%':'—')+'</td>'
      +'<td style="font-size:12px">'+(c.services!=='as'?(c.chargeEWAType==='pct'?c.chargeEWA+'%':'PKR '+(c.chargeEWA||0).toLocaleString()):'—')+'</td>'
      +'<td>PKR '+(c.limit/1000000).toFixed(0)+'M</td>'
      +'<td><span class="badge '+(c.status==='active'?'badge-green':'badge-gray')+'">'+c.status+'</span></td>'
      +'<td><div style="display:flex;gap:5px;flex-wrap:wrap">'
      +'<button class="btn btn-sm" data-cid="'+esc(c.id)+'" onclick="showCorpById(this.dataset.cid)">View</button>'
      +'<button class="btn btn-sm" data-cid="'+esc(c.id)+'" onclick="showEditCorpModal(this.dataset.cid)">Edit</button>'
      +'<button class="btn btn-sm" style="'+(c.status==='active'?'color:#F0B843':'color:#4DD890')+'" data-cid="'+esc(c.id)+'" data-cstat="'+esc(c.status)+'" onclick="submitToggleStatus(this.dataset.cid,this.dataset.cstat)">'+(c.status==='active'?'Deactivate':'Activate')+'</button>'
      +'</div></td></tr>';
  });
  if(!rows) rows='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">No corporates found.</td></tr>';
  return '<div class="section-hdr"><span class="section-title">All Corporate Accounts ('+corps.length+')</span><button class="btn btn-primary" onclick="showAddCorpModal()">+ Add New Corporate</button></div>'
    +'<div class="alert alert-info"><span class="alert-icon">&#8505;&#65039;</span><div>All changes (Add, Edit, Activate/Deactivate) are sent to Banker Approver for authorization before being applied.</div></div>'
    +'<div class="card"><div class="table-wrap"><table>'
    +'<thead><tr><th>ID</th><th>Name</th><th>Account</th><th>Services</th><th>AS Charge</th><th>EWA Charge</th><th>Limit</th><th>Status</th><th>Actions</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div></div>';
}

function showCorpById(id){var c=window._corpRegistry&&window._corpRegistry[id];if(c)showCorpDetail(c);}
function showEditCorpModal(id){var c=window._corpRegistry&&window._corpRegistry[id];if(c)showEditCorpModalData(c);}

function submitToggleStatus(id,currentStatus){
  var newStatus=currentStatus==='active'?'inactive':'active';
  var action=currentStatus==='active'?'Deactivate':'Activate';
  showModal('<div class="modal-title">'+action+' Corporate</div>'
    +'<div class="alert alert-warning"><span class="alert-icon">&#9888;&#65039;</span><div>This request will be sent to Banker Approver for authorization. '+(currentStatus==='active'?'Deactivating will prevent new batch submissions.':'Activating will allow new batch submissions.')+'</div></div>'
    +'<div style="display:flex;gap:10px;margin-top:14px">'
    +'<button class="btn btn-primary" onclick="doToggleStatus(\''+esc(id)+'\',\''+esc(newStatus)+'\')">Submit for Approval</button>'
    +'<button class="btn" onclick="closeModal()">Cancel</button>'
    +'</div>');
}
async function doToggleStatus(id,newStatus){
  var corp=window._corpRegistry&&window._corpRegistry[id];
  var res=await apiFetch('/api/corp-requests','POST',{action:'toggle_status',corpId:id,data:{newStatus:newStatus}});
  if(res.success){closeModal();showToast('Request submitted to Banker Approver for authorization','success');loadPage('corp_mgmt');}
  else showToast('Error: '+(res.error||'Failed'),'danger');
}

async function bankerCorpRequests(){
  var reqs=await apiFetch('/api/corp-requests');
  // Show only pending and rejected (actionable) — approved ones go to history
  var myReqs=reqs.filter(function(r){return (r.status==='pending_approver'||r.status==='rejected')&&r.status!=='superseded';});
  var myHistory=reqs.filter(function(r){return r.status==='approved'&&r.status!=='superseded';});
  if(!myReqs.length&&!myHistory.length) return '<div class="empty-state"><div class="empty-icon">&#128203;</div><p>No corporate change requests submitted yet.</p></div>';
  var actionLabel={add:'Add New Corporate',edit:'Edit Corporate',toggle_status:'Change Status'};
  var html='<div class="alert alert-info"><span class="alert-icon">&#8505;&#65039;</span><div>All corporate change requests you submit go to the Banker Approver for authorization. Pending and rejected requests appear here. Approved requests move to History below.</div></div>';
  if(!myReqs.length) html+='<div style="padding:24px;text-align:center;color:var(--text-muted);background:var(--surface);border-radius:10px;margin-bottom:16px">No active requests — all clear.</div>';
  myReqs.forEach(function(r){
    var statusBadgeStr=r.status==='pending_approver'?'<span class="badge badge-amber">Pending Approver Authorization</span>':r.status==='approved'?'<span class="badge badge-green">Approved & Applied</span>':r.status==='rejected'?'<span class="badge badge-red">Rejected by Approver</span>':'<span class="badge badge-gray">'+r.status+'</span>';
    html+='<div class="card" style="margin-bottom:16px;border-left:3px solid '+(r.status==='rejected'?'var(--red)':r.status==='approved'?'#4DD890':'#F0B843')+'">'
      +'<div class="card-header"><div style="display:flex;align-items:center;gap:8px"><span class="card-title">'+esc(r.id)+' — '+(actionLabel[r.action]||r.action)+': '+esc(r.corpName)+'</span></div>'+statusBadgeStr+'</div>'
      +'<div class="card-body">'
      +'<div class="split-3" style="margin-bottom:14px">'
      +'<div class="metric-card"><div class="metric-label">Action</div><div style="margin-top:4px;font-size:13px">'+(actionLabel[r.action]||r.action)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Submitted By</div><div style="margin-top:4px;font-size:13px">'+esc(r.submittedBy)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Submitted At</div><div style="margin-top:4px;font-size:13px">'+esc(r.submittedAt)+'</div></div>'
      +'</div>'
      +(r.approverRemark?'<div style="background:rgba(224,62,62,0.08);border:1px solid rgba(224,62,62,0.25);border-radius:8px;padding:12px 14px;margin-bottom:14px"><div style="font-size:11px;font-weight:600;color:#FF7575;margin-bottom:4px">Rejection Reason</div><div style="font-size:13px">'+esc(r.approverRemark)+'</div></div>':'')
      +'<div class="section-title" style="margin-bottom:8px">Request History</div>'
      +historyTimelineHTML(r)
      +(r.status==='rejected'?'<div style="margin-top:12px"><button class="btn btn-primary" data-rid="'+esc(r.id)+'" onclick="showResubmitCorpModal(this.dataset.rid)">Correct &amp; Resubmit</button></div>':'')
      +'</div></div>';
  });
  // History section — approved requests
  if(myHistory.length){
    html+='<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">';
    html+='<div class="section-title" style="margin-bottom:12px">Approved Requests — History ('+myHistory.length+')</div>';
    var histRows='';
    myHistory.forEach(function(r){
      var actionLabel={add:'Add New Corporate',edit:'Edit Corporate',toggle_status:'Change Status'};
      histRows+='<tr>'
        +'<td class="mono" style="font-size:11px">'+esc(r.id)+'</td>'
        +'<td>'+(actionLabel[r.action]||r.action)+'</td>'
        +'<td>'+esc(r.corpName)+'</td>'
        +'<td>'+esc(r.submittedAt)+'</td>'
        +'<td><span class="badge badge-green">Approved &amp; Applied</span></td>'
        +'<td><button class="btn btn-sm" data-rid="'+esc(r.id)+'" onclick="showCorpReqDetail(this.dataset.rid)">View</button></td>'
        +'</tr>';
    });
    html+='<div class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Action</th><th>Corporate</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>'+histRows+'</tbody></table></div></div>';
    html+='</div>';
  }
  return html;
}

function showResubmitCorpModal(reqId){
  apiFetch('/api/corp-requests').then(function(reqs){
    var r=reqs.find(function(x){return x.id===reqId;});
    if(!r){showToast('Request not found','danger');return;}
    var d=r.data||{};
    var svc=d.services||'both';
    showModal('<div class="modal-title">Correct &amp; Resubmit</div>'
      +'<div class="alert alert-danger" style="margin-bottom:14px"><span class="alert-icon">&#10060;</span><div><strong>Rejection reason:</strong> '+esc(r.approverRemark||'See request history')+'</div></div>'
      +'<div class="alert alert-info" style="margin-bottom:14px"><span class="alert-icon">&#8505;&#65039;</span><div>Correct the details below and resubmit. The Banker Approver will see the updated information.</div></div>'
      +'<div style="max-height:50vh;overflow-y:auto;padding-right:4px">'
      +'<div class="form-row"><div class="form-group"><label class="form-label">Legal Name</label><input class="form-input" id="rc-name" value="'+esc(d.name||'')+'"></div>'
      +'<div class="form-group"><label class="form-label">Account Number</label><input class="form-input" id="rc-account" value="'+esc(d.account||'')+'"></div></div>'
      +'<div class="form-row"><div class="form-group"><label class="form-label">Services</label>'
      +'<select class="form-select" id="rc-svc" onchange="document.getElementById(&quot;rc-charges&quot;).innerHTML=chargeFieldsHTML(this.value,3,5000,&quot;flat&quot;)">'
      +'<option value="both" '+(svc==='both'?'selected':'')+'>Both (AS + EWA)</option>'
      +'<option value="as" '+(svc==='as'?'selected':'')+'>Advance Salary Only</option>'
      +'<option value="ewa" '+(svc==='ewa'?'selected':'')+'>EWA Only</option>'
      +'</select></div>'
      +'<div class="form-group"><label class="form-label">Credit Limit (PKR)</label><input class="form-input" id="rc-limit" type="number" value="'+(d.limit||0)+'"></div></div>'
      +'<div style="border-top:1px solid var(--border);margin:10px 0 8px"></div>'
      +'<div id="rc-charges">'+chargeFieldsHTML(svc,d.chargeAS||3,d.chargeEWA||5000,d.chargeEWAType||'flat')+'</div>'
      +'</div>'
      +'<div id="resub-corp-msg" style="margin-top:8px"></div>'
      +'<div style="display:flex;gap:10px;margin-top:12px">'
      +'<button class="btn btn-primary" data-rid="'+esc(reqId)+'" onclick="doResubmitCorp(this.dataset.rid)">Resubmit to Banker Approver</button>'
      +'<button class="btn" onclick="closeModal()">Cancel</button>'
      +'</div>');
  });
}
async function doResubmitCorp(reqId){
  var svc=(document.getElementById('rc-svc')||{}).value||'both';
  var charges=getChargeValues(svc);
  var newData={
    name:((document.getElementById('rc-name')||{}).value||'').trim(),
    account:((document.getElementById('rc-account')||{}).value||'').trim(),
    services:svc,
    limit:((document.getElementById('rc-limit')||{}).value||0),
    chargeAS:charges.chargeAS,
    chargeEWA:charges.chargeEWA,
    chargeEWAType:charges.chargeEWAType
  };
  var msg=document.getElementById('resub-corp-msg');
  if(!newData.name||!newData.account){
    if(msg) msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>Name and account are required.</span></div>';
    return;
  }
  var res=await apiFetch('/api/corp-requests/'+reqId+'/resubmit','POST',{data:newData});
  if(res.success){closeModal();showToast('Corrected request resubmitted to Banker Approver','success');renderCurrentPage();}
  else{if(msg) msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>'+esc(res.error||'Failed')+'</span></div>';}
}
function showCorpReqDetail(rid){
  apiFetch('/api/corp-requests').then(function(reqs){
    var r=reqs.find(function(x){return x.id===rid;});
    if(!r) return;
    showModal('<div class="modal-title">Request Detail — '+esc(r.id)+' <button class="btn btn-sm" onclick="closeModal()">x</button></div>'
      +'<div class="split-2" style="margin-bottom:14px">'
      +'<div class="metric-card"><div class="metric-label">Action</div><div style="margin-top:4px;font-size:13px">'+esc(r.action)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Corporate</div><div style="margin-top:4px;font-size:13px;font-weight:500">'+esc(r.corpName)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Submitted By</div><div style="margin-top:4px;font-size:13px">'+esc(r.submittedBy)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Status</div><div style="margin-top:6px">'+(r.status==='approved'?'<span class="badge badge-green">Authorized</span>':'<span class="badge badge-red">Rejected</span>')+'</div></div>'
      +'</div>'
      +(r.approverRemark?'<div style="background:rgba(224,62,62,0.08);border:1px solid rgba(224,62,62,0.25);border-radius:8px;padding:12px 14px;margin-bottom:14px"><div style="font-size:11px;font-weight:600;color:#FF7575;margin-bottom:4px">Rejection Reason</div><div style="font-size:13px">'+esc(r.approverRemark)+'</div></div>':'')
      +'<div class="section-title" style="margin-bottom:8px">Full History</div>'+historyTimelineHTML(r)
      +'<button class="btn" style="width:100%;margin-top:14px" onclick="closeModal()">Close</button>');
  });
}

async function approverQueue(){
  var url='/api/batches?status=pending_approver';
  if(CORP_FILTER) url+='&corp='+encodeURIComponent(CORP_FILTER);
  var batches=await apiFetch(url);
  var filterWidget=await corpFilterWidget(CORP_FILTER);
  var statsBar=CORP_FILTER?corpStatsBar(batches,CORP_FILTER):'';
  if(!batches.length&&!CORP_FILTER) return '<div class="empty-state"><div class="empty-icon">&#9989;</div><p>No batches in the final authorization queue.</p></div>';
  if(!batches.length&&CORP_FILTER) return filterWidget+'<div class="empty-state"><div class="empty-icon">&#128269;</div><p>No batches for <strong>'+esc(CORP_FILTER)+'</strong>.</p><button class="btn btn-sm" onclick="clearCorpFilter()" style="margin-top:8px">Clear Filter</button></div>';
  var cards='';
  batches.forEach(function(b){
    cards+='<div class="card" style="margin-bottom:20px">'
      +'<div class="card-header"><div style="display:flex;align-items:center;gap:10px">'+typePill(b.type)+'<span class="card-title">'+esc(b.id)+' — '+esc(b.corp)+'</span></div><span class="badge badge-amber">Awaiting Final Authorization</span></div>'
      +'<div class="card-body">'+approvalChainHTML(b)
      +'<div class="alert alert-info" style="margin-bottom:14px"><span class="alert-icon">&#127974;</span><div>Banker <strong>'+esc(b.banker)+'</strong> has reviewed. <strong>Your authorization forwards the salary instruction to Core Banking System for '+b.employees+' employees.</strong></div></div>'
      +'<div class="split-3" style="margin-bottom:14px">'
      +'<div class="metric-card"><div class="metric-label">Corporate</div><div style="font-size:13px;font-weight:500;margin-top:4px">'+esc(b.corp)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Employees</div><div class="metric-value blue">'+b.employees+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Salary Amount</div><div class="metric-value green" style="font-size:16px">'+fmt(b.amount)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Service Charge</div><div class="metric-value amber" style="font-size:16px">'+fmt(b.charge)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Corp. Total Repayment</div><div style="font-size:15px;font-weight:700;margin-top:4px">'+fmt(b.amount+b.charge)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Month</div><div style="margin-top:4px">'+esc(b.month)+'</div></div>'
      +'</div>'
      +'<div style="display:flex;gap:10px;padding-top:14px;border-top:1px solid var(--border)">'
      +'<button class="btn" style="background:rgba(29,179,104,0.2);border-color:rgba(29,179,104,0.5);color:#4DD890;font-weight:600;font-size:14px;padding:10px 22px" data-bid="'+esc(b.id)+'" onclick="approverAction(this.dataset.bid,\'approve\')">Forward to Core Banking System (CBS)</button>'
      +'<button class="btn btn-danger" data-bid="'+esc(b.id)+'" onclick="showRejectModal(this.dataset.bid,\'approver\')">Reject</button>'
      +'<button class="btn btn-sm" data-bid="'+esc(b.id)+'" onclick="showBatchDetail(this.dataset.bid)">Full Detail</button>'
      +'</div></div></div>';
  });
  return filterWidget+statsBar+cards;
}

async function approverAction(id,action){
  var res=await apiFetch('/api/batches/'+id+'/approver','POST',{action:action});
  if(res.success){
    if(action==='approve'){
      var b=res.batch;
      showModal('<div class="modal-title" style="color:#4DD890">Forwarded to Core Banking System!</div>'
        +'<div class="alert alert-success"><span class="alert-icon">&#9989;</span><div><strong>Batch '+esc(id)+' authorized.</strong><br>Salary instruction has been forwarded to CBS.<br><strong>'+b.employees+' employees</strong> will receive payment in the next CBS processing window.</div></div>'
        +'<div style="background:var(--surface);border-radius:10px;padding:16px;margin:14px 0">'
        +'<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Transaction Summary</div>'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Salary Amount (CBS Instruction)</span><span style="font-weight:600;color:#4DD890">'+fmt(b.amount)+'</span></div>'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Service Charge</span><span style="color:#F0B843">'+fmt(b.charge)+'</span></div>'
        +'<div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;margin-top:4px"><span style="font-weight:600">Corporate Total Repayment</span><span style="font-weight:700;font-size:16px">'+fmt(b.amount+b.charge)+'</span></div>'
        +'</div>'
        +'<button class="btn btn-primary" style="width:100%" onclick="closeModal();renderCurrentPage()">Continue</button>');
    }else{showToast('Batch rejected at final authorization','danger');renderCurrentPage();}
  }else showToast('Error: '+(res.error||'Unknown'),'danger');
}

// ── SHARED BATCH LIST ─────────────────────────────────────────
async function pageBatchList(){
  var url='/api/batches';
  var needFilter=(ME.role==='banker'||ME.role==='approver');
  if(needFilter&&CORP_FILTER) url+='?corp='+encodeURIComponent(CORP_FILTER);
  var batches=await apiFetch(url);
  var filterWidget=needFilter?await corpFilterWidget(CORP_FILTER):'';
  var rows='';
  batches.forEach(function(x){
    rows+='<tr><td class="mono">'+esc(x.id)+'</td><td>'+typeBadge(x.type)+'</td><td style="font-size:12px">'+esc(x.corp)+'</td><td>'+esc(x.month)+'</td><td>'+x.employees+'</td><td>'+fmt(x.amount)+'</td><td>'+fmt(x.charge)+'</td><td>'+statusBadge(x.status)+'</td><td>'+esc(x.date)+'</td><td><button class="btn btn-sm" data-bid="'+esc(x.id)+'" onclick="showBatchDetail(this.dataset.bid)">View</button></td></tr>';
  });
  if(!rows) rows='<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">No batches found</td></tr>';
  return filterWidget+'<div class="card"><div class="table-wrap"><table><thead><tr><th>Batch ID</th><th>Type</th><th>Corporate</th><th>Month</th><th>Employees</th><th>Amount</th><th>Charge</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}

// ── MODALS ────────────────────────────────────────────────────
async function bankerIncoming(){
  var url='/api/batches?status=pending_banker';
  if(CORP_FILTER) url+='&corp='+encodeURIComponent(CORP_FILTER);
  var batches=await apiFetch(url);
  var filterWidget=await corpFilterWidget(CORP_FILTER);
  var statsBar=CORP_FILTER?corpStatsBar(batches,CORP_FILTER):'';
  if(!batches.length&&!CORP_FILTER) return '<div class="empty-state"><div class="empty-icon">&#128229;</div><p>No batches pending bank review.</p></div>';
  if(!batches.length&&CORP_FILTER) return filterWidget+'<div class="empty-state"><div class="empty-icon">&#128269;</div><p>No incoming batches for <strong>'+esc(CORP_FILTER)+'</strong>.</p><button class="btn btn-sm" onclick="clearCorpFilter()" style="margin-top:8px">Clear Filter</button></div>';
  var cards='';
  batches.forEach(function(b){
    var empRows='';
    if(b.employeeData&&b.employeeData.length){
      b.employeeData.forEach(function(e,i){
        empRows+='<tr><td>'+(i+1)+'</td><td>'+esc(e['Employee Name'])+'</td><td class="mono">'+esc(e['Employee ID'])+'</td><td class="mono">'+esc(e['CNIC'])+'</td><td class="mono" style="font-size:10px">'+esc(e['Account Number'])+'</td><td>'+fmt(e.salary||e.ewaAmount||0)+'</td></tr>';
      });
    }
    cards+='<div class="card" style="margin-bottom:20px">'
      +'<div class="card-header"><div style="display:flex;align-items:center;gap:10px">'+typePill(b.type)+'<span class="card-title">'+esc(b.id)+' — '+esc(b.corp)+'</span></div><span class="badge badge-amber">Pending Bank Review</span></div>'
      +'<div class="card-body">'+approvalChainHTML(b)
      +'<div class="alert alert-info" style="margin-bottom:14px"><span class="alert-icon">&#8505;&#65039;</span><div>Approved by Corporate Checker <strong>'+esc(b.checker)+'</strong>.</div></div>'
      +'<div class="split-3" style="margin-bottom:14px">'
      +'<div class="metric-card"><div class="metric-label">Corporate</div><div style="font-size:13px;font-weight:500;margin-top:4px">'+esc(b.corp)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Employees</div><div class="metric-value blue">'+b.employees+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Disbursement</div><div class="metric-value green" style="font-size:16px">'+fmt(b.amount)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Service Charge</div><div class="metric-value amber" style="font-size:16px">'+fmt(b.charge)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Corp. Repayment</div><div style="font-size:14px;font-weight:600;margin-top:4px">'+fmt(b.amount+b.charge)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">File</div><div style="margin-top:6px"><a href="/api/batches/'+esc(b.id)+'/download" class="btn btn-sm">Download</a></div></div>'
      +'</div>'
      +(empRows?'<div style="margin-bottom:14px"><div class="section-title" style="margin-bottom:8px">Employee Data Preview</div><div class="table-wrap"><table><thead><tr><th>#</th><th>Name</th><th>Emp ID</th><th>CNIC</th><th>Account</th><th>Amount</th></tr></thead><tbody>'+empRows+'</tbody></table></div></div>':'')
      +'<div style="display:flex;gap:10px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap">'
      +'<button class="btn btn-primary" data-bid="'+esc(b.id)+'" onclick="bankerAction(this.dataset.bid,&quot;approve&quot;)">Forward to Final Authorization</button>'
      +'<button class="btn btn-danger" data-bid="'+esc(b.id)+'" onclick="showRejectModal(this.dataset.bid,&quot;banker&quot;)">Reject Batch</button>'
      +'<button class="btn btn-sm" data-bid="'+esc(b.id)+'" onclick="showBatchDetail(this.dataset.bid)">Full Detail</button>'
      +'<a href="/api/batches/'+esc(b.id)+'/download" class="btn btn-sm">Download File</a>'
      +'</div></div></div>';
  });
  return filterWidget+statsBar+cards;
}

async function bankerAction(id,action){
  var res=await apiFetch('/api/batches/'+id+'/banker','POST',{action:action});
  if(res.success){showToast(action==='approve'?'Forwarded for final authorization':'Batch rejected',action==='approve'?'success':'danger');renderCurrentPage();}
  else showToast('Error: '+(res.error||'Unknown'),'danger');
}

async function pageLogsTyped(type){
  var url='/api/batches?type='+type;
  if(CORP_FILTER) url+='&corp='+encodeURIComponent(CORP_FILTER);
  var batches=await apiFetch(url);
  var filterWidget=await corpFilterWidget(CORP_FILTER);
  var statsBar=CORP_FILTER?corpStatsBar(batches,CORP_FILTER):'';
  var rows='';
  batches.forEach(function(b){
    rows+='<tr><td class="mono">'+esc(b.id)+'</td><td style="font-size:12px">'+esc(b.corp)+'</td><td>'+esc(b.month)+'</td><td>'+b.employees+'</td><td>'+fmt(b.amount)+'</td><td>'+fmt(b.charge)+'</td><td>'+statusBadge(b.status)+'</td><td>'+esc(b.date)+'</td><td><button class="btn btn-sm" data-bid="'+esc(b.id)+'" onclick="showBatchDetail(this.dataset.bid)">View</button></td></tr>';
  });
  if(!rows) rows='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">No records yet</td></tr>';
  return filterWidget+statsBar+'<div class="card"><div class="table-wrap"><table><thead><tr><th>Batch ID</th><th>Corp</th><th>Month</th><th>Employees</th><th>Amount</th><th>Charge</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}

async function approverDashboard(){
  var batches=await apiFetch('/api/batches');
  var corpReqs=await apiFetch('/api/corp-requests');
  var queue=batches.filter(function(b){return b.status==='pending_approver';});
  var fwded=batches.filter(function(b){return b.status==='forwarded_cbs';});
  var total=fwded.reduce(function(s,b){return s+b.amount;},0);
  var revenue=fwded.reduce(function(s,b){return s+b.charge;},0);
  var pendingCorpReqs=corpReqs.filter(function(r){return r.status==='pending_approver';});
  var queueRows='';
  queue.forEach(function(b){
    queueRows+='<tr><td class="mono">'+esc(b.id)+'</td><td>'+typeBadge(b.type)+'</td><td>'+esc(b.corp)+'</td><td style="font-weight:600">'+fmt(b.amount)+'</td><td>'+fmt(b.charge)+'</td><td><span class="badge badge-blue">'+esc(b.banker)+'</span></td><td><button class="btn btn-sm btn-primary" onclick="loadPage(&quot;final_queue&quot;)">Final Review</button></td></tr>';
  });
  if(!queueRows) queueRows='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Queue clear</td></tr>';
  return '<div class="metrics-row">'
    +'<div class="metric-card"><div class="metric-label">Final Auth Queue</div><div class="metric-value red">'+queue.length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Forwarded to CBS</div><div class="metric-value green">'+fwded.length+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Total Forwarded</div><div class="metric-value blue">PKR '+(total/1000000).toFixed(1)+'M</div></div>'
    +'<div class="metric-card"><div class="metric-label">Service Revenue</div><div class="metric-value accent">PKR '+(revenue/1000).toFixed(0)+'K</div></div>'
    +'</div>'
    +(queue.length>0?'<div class="alert alert-danger"><span class="alert-icon">&#128737;&#65039;</span><div><strong>'+queue.length+' batch(es) need your FINAL authorization.</strong></div></div>':'<div class="alert alert-success"><span class="alert-icon">&#9989;</span><div>Final authorization queue is clear.</div></div>')
    +(pendingCorpReqs.length>0?'<div class="alert alert-warning"><span class="alert-icon">&#127970;</span><div><strong>'+pendingCorpReqs.length+' corporate change request(s)</strong> need your authorization. <button class="btn btn-sm" onclick="loadPage(&quot;corp_approvals&quot;)" style="margin-left:8px">Review Now</button></div></div>':'')
    +'<div class="section-hdr"><span class="section-title">Final Authorization Queue</span><button class="btn btn-sm" onclick="loadPage(&quot;final_queue&quot;)">Process Now</button></div>'
    +'<div class="card"><div class="table-wrap"><table><thead><tr><th>Batch ID</th><th>Type</th><th>Corporate</th><th>Amount</th><th>Charge</th><th>Banker</th><th></th></tr></thead><tbody>'+queueRows+'</tbody></table></div></div>';
}

async function approverCorpQueue(){
  var reqs=await apiFetch('/api/corp-requests');
  var pending=reqs.filter(function(r){return r.status==='pending_approver';});
  var history=reqs.filter(function(r){return r.status!=='pending_approver'&&r.status!=='superseded';});
  if(!pending.length&&!history.length) return '<div class="empty-state"><div class="empty-icon">&#127970;</div><p>No corporate change requests.</p></div>';
  var actionLabel={add:'Add New Corporate',edit:'Edit Corporate',toggle_status:'Change Status'};
  var html='';
  if(pending.length){
    html+='<div class="section-title" style="margin-bottom:12px">Pending Your Authorization ('+pending.length+')</div>';
    pending.forEach(function(r){
      var changes='';
      if(r.action==='add'){
        var d=r.data||{};
        changes='<div class="split-3" style="margin-bottom:14px">'
          +'<div class="metric-card"><div class="metric-label">Legal Name</div><div style="margin-top:4px;font-size:13px">'+esc(d.name||'-')+'</div></div>'
          +'<div class="metric-card"><div class="metric-label">Account</div><div style="margin-top:4px;font-size:12px;font-family:monospace">'+esc(d.account||'-')+'</div></div>'
          +'<div class="metric-card"><div class="metric-label">Services</div><div style="margin-top:4px">'+esc(d.services||'-')+'</div></div>'
          +'<div class="metric-card"><div class="metric-label">Credit Limit</div><div style="margin-top:4px;font-size:13px">'+fmt(d.limit||0)+'</div></div>'
          +'<div class="metric-card"><div class="metric-label">AS Charge</div><div style="margin-top:4px;font-size:13px">'+(d.services!=='ewa'?(d.chargeAS||3)+'%':'-')+'</div></div>'
          +'<div class="metric-card"><div class="metric-label">EWA Charge</div><div style="margin-top:4px;font-size:13px">'+(d.services!=='as'?(d.chargeEWAType==='pct'?(d.chargeEWA||2)+'%':'PKR '+(d.chargeEWA||5000).toLocaleString()):'-')+'</div></div>'
          +'</div>';
      } else if(r.action==='edit'&&r.existingSnapshot){
        var ex=r.existingSnapshot; var nd=r.data||{};
        var diffs='';
        ['name','account','services','limit','status','chargeAS','chargeEWA','chargeEWAType'].forEach(function(k){
          if(nd[k]!==undefined&&String(nd[k])!==String(ex[k])){
            diffs+='<div style="display:flex;gap:10px;margin-bottom:4px;font-size:12px"><span style="color:var(--text-muted);min-width:100px">'+k+'</span><span style="color:#FF7575;text-decoration:line-through">'+esc(String(ex[k]))+'</span><span style="margin:0 6px">&rarr;</span><span style="color:#4DD890">'+esc(String(nd[k]))+'</span></div>';
          }
        });
        changes='<div style="background:var(--surface);border-radius:8px;padding:12px 14px;margin-bottom:14px"><div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase">Proposed Changes</div>'+(diffs||'<div style="font-size:12px;color:var(--text-muted)">No changes detected.</div>')+'</div>';
      } else if(r.action==='toggle_status'){
        changes='<div style="background:var(--surface);border-radius:8px;padding:12px 14px;margin-bottom:14px"><div style="font-size:13px">Change status of <strong>'+esc(r.corpName)+'</strong> to <span class="badge '+(r.data.newStatus==='active'?'badge-green':'badge-gray')+'">'+esc(r.data.newStatus)+'</span></div></div>';
      }
      html+='<div class="card" style="margin-bottom:20px;border-left:3px solid #F0B843">'
        +'<div class="card-header"><span class="card-title">'+esc(r.id)+' — '+(actionLabel[r.action]||r.action)+': '+esc(r.corpName)+'</span><span class="badge badge-amber">Pending Your Authorization</span></div>'
        +'<div class="card-body">'
        +changes
        +'<div style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">Submitted by '+esc(r.submittedBy)+' at '+esc(r.submittedAt)+'</div>'
        +'<div class="section-title" style="margin-bottom:8px">Request History</div>'+historyTimelineHTML(r)
        +'<div style="display:flex;gap:10px;padding-top:14px;border-top:1px solid var(--border);margin-top:12px">'
        +'<button class="btn btn-success" data-rid="'+esc(r.id)+'" onclick="approveCorpRequest(this.dataset.rid)">Authorize &amp; Apply</button>'
        +'<button class="btn btn-danger" data-rid="'+esc(r.id)+'" onclick="showRejectCorpModal(this.dataset.rid)">Reject</button>'
        +'</div></div></div>';
    });
  }
  if(history.length){
    html+='<div class="section-title" style="margin-bottom:12px;margin-top:20px">Previous Requests ('+history.length+')</div>';
    var histRows='';
    history.forEach(function(r){
      histRows+='<tr><td class="mono" style="font-size:11px">'+esc(r.id)+'</td><td>'+(actionLabel[r.action]||r.action)+'</td><td>'+esc(r.corpName)+'</td><td>'+esc(r.submittedBy)+'</td><td>'+esc(r.submittedAt)+'</td><td>'+(r.status==='approved'?'<span class="badge badge-green">Authorized</span>':'<span class="badge badge-red">Rejected</span>')+'</td><td><button class="btn btn-sm" data-rid="'+esc(r.id)+'" onclick="showCorpReqDetail(this.dataset.rid)">View</button></td></tr>';
    });
    html+='<div class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Action</th><th>Corporate</th><th>Submitted By</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>'+histRows+'</tbody></table></div></div>';
  }
  return html;
}

async function approveCorpRequest(rid){
  var res=await apiFetch('/api/corp-requests/'+rid+'/approve','POST',{});
  if(res.success){showToast('Corporate request authorized & applied','success');renderCurrentPage();}
  else showToast('Error: '+(res.error||'Unknown'),'danger');
}

function showRejectCorpModal(rid){
  showModal('<div class="modal-title">Reject Corporate Request</div>'
    +'<div class="alert alert-warning"><span class="alert-icon">&#9888;&#65039;</span><div>The banker will be notified and can correct &amp; resubmit.</div></div>'
    +'<div class="form-group" style="margin-bottom:14px"><label class="form-label">Rejection Reason (required)</label><textarea class="form-input form-textarea" id="corp-rej-remarks" placeholder="Explain why this request is being rejected..."></textarea></div>'
    +'<div id="corp-rej-msg"></div>'
    +'<div style="display:flex;gap:10px"><button class="btn btn-danger" data-rid="'+esc(rid)+'" onclick="rejectCorpRequest(this.dataset.rid)">Confirm Rejection</button><button class="btn" onclick="closeModal()">Cancel</button></div>');
}

async function rejectCorpRequest(rid){
  var remarks=document.getElementById('corp-rej-remarks').value.trim();
  var msg=document.getElementById('corp-rej-msg');
  if(!remarks){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>Please enter rejection remarks.</span></div>';return;}
  var res=await apiFetch('/api/corp-requests/'+rid+'/reject','POST',{remarks:remarks});
  if(res.success){closeModal();showToast('Corporate request rejected','danger');renderCurrentPage();}
  else showToast('Error: '+(res.error||'Unknown'),'danger');
}

function showCorpReqDetail(rid){
  apiFetch('/api/corp-requests').then(function(reqs){
    var r=reqs.find(function(x){return x.id===rid;});
    if(!r) return;
    showModal('<div class="modal-title">Request Detail — '+esc(r.id)+' <button class="btn btn-sm" onclick="closeModal()">x</button></div>'
      +'<div class="split-2" style="margin-bottom:14px">'
      +'<div class="metric-card"><div class="metric-label">Action</div><div style="margin-top:4px;font-size:13px">'+esc(r.action)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Corporate</div><div style="margin-top:4px;font-size:13px;font-weight:500">'+esc(r.corpName)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Submitted By</div><div style="margin-top:4px;font-size:13px">'+esc(r.submittedBy)+'</div></div>'
      +'<div class="metric-card"><div class="metric-label">Status</div><div style="margin-top:6px">'+(r.status==='approved'?'<span class="badge badge-green">Authorized</span>':'<span class="badge badge-red">Rejected</span>')+'</div></div>'
      +'</div>'
      +(r.approverRemark?'<div style="background:rgba(224,62,62,0.08);border:1px solid rgba(224,62,62,0.25);border-radius:8px;padding:12px 14px;margin-bottom:14px"><div style="font-size:11px;font-weight:600;color:#FF7575;margin-bottom:4px">Rejection Reason</div><div style="font-size:13px">'+esc(r.approverRemark)+'</div></div>':'')
      +'<div class="section-title" style="margin-bottom:8px">Full History</div>'+historyTimelineHTML(r)
      +'<button class="btn" style="width:100%;margin-top:14px" onclick="closeModal()">Close</button>');
  });
}

async function showBatchDetail(id){
  var b=await apiFetch('/api/batches/'+id);
  showModal('<div class="modal-title">Batch Detail — '+esc(b.id)+' <button class="btn btn-sm" onclick="closeModal()">x</button></div>'
    +'<div style="margin-bottom:12px">'+typePill(b.type)+'</div>'
    +approvalChainHTML(b)
    +'<div class="split-2" style="margin-bottom:14px">'
    +'<div class="metric-card"><div class="metric-label">Corporate</div><div style="font-size:13px;margin-top:4px;font-weight:500">'+esc(b.corp)+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Month</div><div style="margin-top:4px">'+esc(b.month)+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Employees</div><div class="metric-value blue">'+b.employees+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Amount</div><div style="font-weight:600;font-size:16px;margin-top:4px">'+fmt(b.amount)+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Charge</div><div class="metric-value amber" style="font-size:16px">'+fmt(b.charge)+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">File</div><div style="margin-top:6px"><a href="/api/batches/'+esc(b.id)+'/download" class="btn btn-sm">Download</a></div></div>'
    +'</div>'
    +'<div class="section-title" style="margin-bottom:10px">Full Approval History</div>'
    +historyTimelineHTML(b)
    +'<button class="btn" style="width:100%;margin-top:14px" onclick="closeModal()">Close</button>');
}

function showRejectModal(id,stage){
  showModal('<div class="modal-title">Reject Batch — '+esc(id)+'</div>'
    +'<div class="alert alert-warning"><span class="alert-icon">&#9888;&#65039;</span><div>The maker will be notified. Be specific so they can correct and resubmit.</div></div>'
    +'<div class="form-group" style="margin-bottom:14px"><label class="form-label">Rejection Remarks (required)</label><textarea class="form-input form-textarea" id="reject-remarks" style="min-height:90px" placeholder="e.g. CNIC format invalid on row 3..."></textarea></div>'
    +'<div id="reject-msg"></div>'
    +'<div style="display:flex;gap:10px"><button class="btn btn-danger" onclick="confirmReject(\''+esc(id)+'\',\''+esc(stage)+'\')">Confirm Rejection</button><button class="btn" onclick="closeModal()">Cancel</button></div>');
}
async function confirmReject(id,stage){
  var remarks=document.getElementById('reject-remarks').value.trim();
  var msg=document.getElementById('reject-msg');
  if(!remarks){msg.innerHTML='<div class="alert alert-danger" style="margin-bottom:10px"><span>Please enter rejection remarks.</span></div>';return;}
  var res=await apiFetch('/api/batches/'+id+'/'+stage,'POST',{action:'reject',remarks:remarks});
  if(res.success){closeModal();showToast('Batch rejected','danger');renderCurrentPage();}
  else showToast('Error: '+(res.error||'Unknown'),'danger');
}

// Corporate modals (Banker)
function chargeFieldsHTML(services,as_charge,ewa_charge,ewaType){
  var showAS=services!=='ewa'; var showEWA=services!=='as';
  var html='';
  if(showAS) html+='<div class="form-group" style="margin-bottom:12px"><label class="form-label">Advance Salary Charge (%)</label><input class="form-input" type="number" id="cf-chargeAS" value="'+(as_charge||3)+'" min="0" max="20" step="0.1"></div>';
  if(showEWA) html+='<div class="form-group" style="margin-bottom:12px"><label class="form-label">EWA Charge Type</label><select class="form-select" id="cf-ewaType" onchange="toggleEWACharge()" style="margin-bottom:8px"><option value="flat" '+(ewaType!=='pct'?'selected':'')+'>Flat Amount (PKR per batch)</option><option value="pct" '+(ewaType==='pct'?'selected':'')+'>Percentage (%)</option></select><div id="ewa-flat-wrap" style="display:'+(ewaType==='pct'?'none':'block')+'"><input class="form-input" type="number" id="cf-ewaFlat" value="'+(ewaType!=='pct'?(ewa_charge||5000):5000)+'"></div><div id="ewa-pct-wrap" style="display:'+(ewaType==='pct'?'block':'none')+'"><input class="form-input" type="number" id="cf-ewaPct" value="'+(ewaType==='pct'?(ewa_charge||2):2)+'"></div></div>';
  return html;
}
function toggleEWACharge(){
  var t=document.getElementById('cf-ewaType');
  if(!t) return;
  var fw=document.getElementById('ewa-flat-wrap'); var pw=document.getElementById('ewa-pct-wrap');
  if(fw) fw.style.display=t.value==='pct'?'none':'block';
  if(pw) pw.style.display=t.value==='pct'?'block':'none';
}
function getChargeValues(services){
  var showAS=services!=='ewa'; var showEWA=services!=='as';
  var chargeAS=showAS?(parseFloat((document.getElementById('cf-chargeAS')||{}).value)||3):0;
  var ewaType=showEWA?((document.getElementById('cf-ewaType')||{}).value||'flat'):'flat';
  var chargeEWA=showEWA?(ewaType==='pct'?(parseFloat((document.getElementById('cf-ewaPct')||{}).value)||2):(parseInt((document.getElementById('cf-ewaFlat')||{}).value)||5000)):0;
  return {chargeAS:chargeAS,chargeEWA:chargeEWA,chargeEWAType:ewaType};
}

function showAddCorpModal(){
  showModal('<div class="modal-title">Add New Corporate <button class="btn btn-sm" onclick="closeModal()">x</button></div>'
    +'<div class="alert alert-info" style="margin-bottom:14px"><span class="alert-icon">&#8505;&#65039;</span><div>This request will be sent to Banker Approver for authorization before the corporate is added.</div></div>'
    +'<div style="max-height:60vh;overflow-y:auto;padding-right:4px">'
    +'<div class="form-row"><div class="form-group"><label class="form-label">Legal Name</label><input class="form-input" id="nc-name" placeholder="e.g. Sunrise Garments Ltd"></div><div class="form-group"><label class="form-label">Account Number</label><input class="form-input" id="nc-account" placeholder="0123-4567-8900"></div></div>'
    +'<div class="form-row"><div class="form-group"><label class="form-label">Services</label><select class="form-select" id="nc-svc" onchange="document.getElementById(\'nc-charges\').innerHTML=chargeFieldsHTML(this.value,3,5000,\'flat\')"><option value="both">Both (AS + EWA)</option><option value="as">Advance Salary Only</option><option value="ewa">EWA Only</option></select></div><div class="form-group"><label class="form-label">Credit Limit (PKR)</label><input class="form-input" id="nc-limit" type="number" placeholder="e.g. 5000000"></div></div>'
    +'<div style="border-top:1px solid var(--border);margin:12px 0 10px"></div>'
    +'<div id="nc-charges">'+chargeFieldsHTML('both',3,5000,'flat')+'</div>'
    +'</div>'
    +'<div id="nc-msg" style="margin-top:8px"></div>'
    +'<div style="display:flex;gap:10px;margin-top:12px"><button class="btn btn-primary" onclick="submitAddCorp()">Submit for Authorization</button><button class="btn" onclick="closeModal()">Cancel</button></div>');
}
async function submitAddCorp(){
  var svc=(document.getElementById('nc-svc')||{}).value||'both';
  var charges=getChargeValues(svc);
  var data={name:((document.getElementById('nc-name')||{}).value||'').trim(),account:((document.getElementById('nc-account')||{}).value||'').trim(),services:svc,limit:((document.getElementById('nc-limit')||{}).value||0)};
  var msg=document.getElementById('nc-msg');
  if(!data.name||!data.account){msg.innerHTML='<div class="alert alert-danger"><span>Name and account are required.</span></div>';return;}
  data.chargeAS=charges.chargeAS;
  data.chargeEWA=charges.chargeEWA;
  data.chargeEWAType=charges.chargeEWAType;
  var res=await apiFetch('/api/corp-requests','POST',{action:'add',data:data});
  if(res.success){closeModal();showToast('Add request submitted to Banker Approver','success');loadPage('corp_mgmt');}
  else msg.innerHTML='<div class="alert alert-danger"><span>'+esc(res.error||'Failed')+'</span></div>';
}

function showEditCorpModalData(c){
  showModal('<div class="modal-title">Edit — '+esc(c.name)+' <button class="btn btn-sm" onclick="closeModal()">x</button></div>'
    +'<div class="alert alert-info" style="margin-bottom:14px"><span class="alert-icon">&#8505;&#65039;</span><div>Changes will be sent to Banker Approver for authorization before being applied.</div></div>'
    +'<div style="max-height:60vh;overflow-y:auto;padding-right:4px">'
    +'<div class="form-row"><div class="form-group"><label class="form-label">Legal Name</label><input class="form-input" id="ec-name" value="'+esc(c.name)+'"></div><div class="form-group"><label class="form-label">Account Number</label><input class="form-input" id="ec-account" value="'+esc(c.account)+'"></div></div>'
    +'<div class="form-row"><div class="form-group"><label class="form-label">Services</label><select class="form-select" id="ec-svc" onchange="document.getElementById(\'ec-charges\').innerHTML=chargeFieldsHTML(this.value,3,5000,\'flat\')"><option value="both" '+(c.services==='both'?'selected':'')+'>Both (AS + EWA)</option><option value="as" '+(c.services==='as'?'selected':'')+'>Advance Salary Only</option><option value="ewa" '+(c.services==='ewa'?'selected':'')+'>EWA Only</option></select></div><div class="form-group"><label class="form-label">Credit Limit (PKR)</label><input class="form-input" id="ec-limit" type="number" value="'+c.limit+'"></div></div>'
    +'<div class="form-row"><div class="form-group"><label class="form-label">Status</label><select class="form-select" id="ec-status"><option value="active" '+(c.status==='active'?'selected':'')+'>Active</option><option value="inactive" '+(c.status==='inactive'?'selected':'')+'>Inactive</option></select></div></div>'
    +'<div style="border-top:1px solid var(--border);margin:12px 0 10px"></div>'
    +'<div id="ec-charges">'+chargeFieldsHTML(c.services,c.chargeAS||3,c.chargeEWA||5000,c.chargeEWAType||'flat')+'</div>'
    +'</div>'
    +'<div id="ec-msg" style="margin-top:8px"></div>'
    +'<div style="display:flex;gap:10px;margin-top:12px"><button class="btn btn-primary" onclick="submitEditCorp(\''+esc(c.id)+'\')">Submit for Authorization</button><button class="btn" onclick="closeModal()">Cancel</button></div>');
}
async function submitEditCorp(id){
  var svc=(document.getElementById('ec-svc')||{}).value||'both';
  var charges=getChargeValues(svc);
  var data={name:((document.getElementById('ec-name')||{}).value||'').trim(),account:((document.getElementById('ec-account')||{}).value||'').trim(),services:svc,limit:((document.getElementById('ec-limit')||{}).value||0),status:((document.getElementById('ec-status')||{}).value||'active')};
  var msg=document.getElementById('ec-msg');
  data.chargeAS=charges.chargeAS;
  data.chargeEWA=charges.chargeEWA;
  data.chargeEWAType=charges.chargeEWAType;
  var res=await apiFetch('/api/corp-requests','POST',{action:'edit',corpId:id,data:data});
  if(res.success){closeModal();showToast('Edit request submitted to Banker Approver','success');loadPage('corp_mgmt');}
  else msg.innerHTML='<div class="alert alert-danger"><span>'+esc(res.error||'Failed')+'</span></div>';
}

function showCorpDetail(c){
  showModal('<div class="modal-title">'+esc(c.name)+' <button class="btn btn-sm" onclick="closeModal()">x</button></div>'
    +'<div class="split-2" style="margin-bottom:14px">'
    +'<div class="metric-card"><div class="metric-label">Corp ID</div><div class="mono" style="margin-top:4px;font-size:12px">'+esc(c.id)+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Status</div><div style="margin-top:6px"><span class="badge '+(c.status==='active'?'badge-green':'badge-gray')+'">'+c.status+'</span></div></div>'
    +'<div class="metric-card"><div class="metric-label">Account</div><div class="mono" style="margin-top:4px;font-size:12px">'+esc(c.account)+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Services</div><div style="margin-top:6px"><span class="tag '+(c.services==='both'?'tag-both':c.services==='as'?'tag-as':'tag-ewa')+'">'+(c.services==='both'?'AS+EWA':c.services==='as'?'Adv Salary':'EWA')+'</span></div></div>'
    +'<div class="metric-card"><div class="metric-label">Credit Limit</div><div style="font-weight:600;margin-top:4px">'+fmt(c.limit)+'</div></div>'
    +'<div class="metric-card"><div class="metric-label">Since</div><div style="margin-top:4px;font-size:13px">'+esc(c.since)+'</div></div>'
    +'</div>'
    +'<div style="background:var(--surface);border-radius:8px;padding:12px 14px;margin-bottom:14px">'
    +'<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Service Charges</div>'
    +(c.services!=='ewa'?'<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px"><span>Advance Salary Charge</span><span style="font-weight:600;color:#F0B843">'+(c.chargeAS||3)+'%</span></div>':'')
    +(c.services!=='as'?'<div style="display:flex;justify-content:space-between;font-size:13px"><span>EWA Charge</span><span style="font-weight:600;color:#F0B843">'+(c.chargeEWAType==='pct'?(c.chargeEWA||2)+'%':'PKR '+(c.chargeEWA||5000).toLocaleString()+' (flat)')+'</span></div>':'')
    +'</div>'
    +'<div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="closeModal();showEditCorpModal(\''+esc(c.id)+'\')">Edit</button><button class="btn" onclick="closeModal()">Close</button></div>');
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
var notifOpen=false;
function toggleNotifications(){
  notifOpen=!notifOpen;
  document.getElementById('notif-drawer').style.display=notifOpen?'block':'none';
  if(notifOpen) loadNotifications();
}
async function loadNotifications(){
  var notifs=await apiFetch('/api/notifications');
  var badge=document.getElementById('notif-badge');
  badge.textContent=notifs.length; badge.style.display=notifs.length?'block':'none';
  var colors={success:'#4DD890',warning:'#F0B843',danger:'#FF7575',info:'#6DA3FF'};
  var html='';
  if(notifs.length){
    html='<div style="padding:10px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:flex-end"><button class="btn btn-sm" onclick="clearNotifs()">Clear All</button></div>';
    notifs.forEach(function(n,i){
      html+='<div class="notif-item" style="'+(i===0?'background:rgba(255,255,255,0.02)':'')+'">'
        +'<div class="notif-dot" style="background:'+(colors[n.type]||colors.info)+'"></div>'
        +'<div style="flex:1;min-width:0"><div class="notif-msg" style="line-height:1.5;word-break:break-word">'+esc(n.msg)+'</div><div class="notif-time">'+esc(n.time)+'</div></div>'
        +'</div>';
    });
  }else{html='<div style="padding:32px 20px;text-align:center;color:var(--text-muted);font-size:13px">No notifications yet</div>';}
  document.getElementById('notif-list').innerHTML=html;
}
async function clearNotifs(){await apiFetch('/api/notifications/clear','POST');loadNotifications();}
async function pollNotifications(){
  try{
    var notifs=await apiFetch('/api/notifications');
    var badge=document.getElementById('notif-badge');
    if(badge){badge.textContent=notifs.length;badge.style.display=notifs.length?'block':'none';}
    if(notifOpen) loadNotifications();
  }catch(e){}
  setTimeout(pollNotifications,10000);
}

// ── UTILS ─────────────────────────────────────────────────────
async function apiFetch(url,method,body){
  method=method||'GET';
  var opts={method:method,credentials:'same-origin',headers:{}};
  if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
  var res=await fetch(url,opts);
  return res.json();
}
function showModal(html){document.getElementById('modal-box').innerHTML=html;document.getElementById('modal-overlay').style.display='flex';}
function closeModal(event){if(!event||event.target===document.getElementById('modal-overlay'))document.getElementById('modal-overlay').style.display='none';}
function showToast(msg,type){
  type=type||'info';
  var colors={success:'#4DD890',warning:'#F0B843',danger:'#FF7575',info:'#6DA3FF'};
  document.querySelectorAll('.toast-msg').forEach(function(t){t.remove();});
  var t=document.createElement('div');
  t.className='toast-msg';
  t.style.cssText='position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--navy-mid);border:1px solid '+(colors[type]||colors.info)+';border-radius:10px;padding:12px 18px;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text);max-width:360px;box-shadow:0 4px 20px rgba(0,0,0,0.4)';
  t.textContent=msg; document.body.appendChild(t);
  setTimeout(function(){t.remove();},4000);
}
async function logout(){await fetch('/api/logout',{method:'POST',credentials:'same-origin'});window.location.href='/';}

var style=document.createElement('style');
style.textContent='@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:none;opacity:1}}';
document.head.appendChild(style);

init();