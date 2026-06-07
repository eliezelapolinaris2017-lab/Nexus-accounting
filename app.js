const navItems = [
  ['dashboard','Dashboard'],['chart','Catálogo de Cuentas'],['journal','Libro Diario'],['ledger','Libro Mayor'],
  ['invoices','Facturación'],['ar','Cuentas por Cobrar'],['ap','Cuentas por Pagar'],['banks','Bancos'],
  ['reconciliation','Reconciliaciones'],['taxes','Impuestos'],['financials','Estados Financieros'],['settings','Configuración']
];

const seed = {
  company:{ name:'Nexus Demo LLC', fiscalYear:2026, ivu:11.5 },
  accounts:[
    {code:'1000',name:'Activos',type:'asset',parent:null},{code:'1100',name:'Caja',type:'asset',parent:'1000'},
    {code:'1200',name:'Banco',type:'asset',parent:'1000'},{code:'1300',name:'Cuentas por Cobrar',type:'asset',parent:'1000'},
    {code:'1500',name:'Equipos',type:'asset',parent:'1000'},
    {code:'2000',name:'Pasivos',type:'liability',parent:null},{code:'2100',name:'Cuentas por Pagar',type:'liability',parent:'2000'},
    {code:'2300',name:'IVU por Pagar',type:'liability',parent:'2000'},
    {code:'3000',name:'Capital',type:'equity',parent:null},{code:'3100',name:'Capital Aportado',type:'equity',parent:'3000'},
    {code:'4000',name:'Ingresos',type:'income',parent:null},{code:'4100',name:'Ventas / Servicios',type:'income',parent:'4000'},
    {code:'4300',name:'Intereses Bancarios',type:'income',parent:'4000'},
    {code:'5000',name:'Gastos',type:'expense',parent:null},{code:'5100',name:'Materiales',type:'expense',parent:'5000'},
    {code:'5200',name:'Combustible',type:'expense',parent:'5000'},{code:'5300',name:'Renta',type:'expense',parent:'5000'},
    {code:'5400',name:'Publicidad',type:'expense',parent:'5000'},
    {code:'5500',name:'Cargos Bancarios',type:'expense',parent:'5000'},
  ],
  customers:[{id:crypto.randomUUID(),name:'Cliente Demo',email:'cliente@demo.com',phone:'787-000-0000',balance:0}],
  vendors:[{id:crypto.randomUUID(),name:'Suplidor Demo',email:'suplidor@demo.com',phone:'787-111-1111',balance:0}],
  invoices:[], bills:[], payments:[], bankAccounts:[{id:'bank-main',name:'Banco Principal',account:'1200',balance:0}],
  reconciliations:[], statementImports:[], entries:[], audit:[]
};

let db = load();
let active = 'dashboard';

function load(){
  const raw = localStorage.getItem('nexusAccountingPR');
  if(raw){ const parsed = JSON.parse(raw); return migrate(parsed); }
  const initial = structuredClone(seed);
  initial.entries.push(entry('2026-06-01','Aporte inicial','CAP-001',[line('1200',5000,0),line('3100',0,5000)]));
  localStorage.setItem('nexusAccountingPR', JSON.stringify(initial));
  return initial;
}
function migrate(data){
  data.reconciliations ||= [];
  data.statementImports ||= [];
  data.bankAccounts ||= [{id:'bank-main',name:'Banco Principal',account:'1200',balance:0}];
  const ensure = acc => { if(!data.accounts.some(a=>a.code===acc.code)) data.accounts.push(acc); };
  ensure({code:'4300',name:'Intereses Bancarios',type:'income',parent:'4000'});
  ensure({code:'5500',name:'Cargos Bancarios',type:'expense',parent:'5000'});
  return data;
}
function save(){ localStorage.setItem('nexusAccountingPR', JSON.stringify(db)); }
function money(n){ return Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'}); }
function today(){ return new Date().toISOString().slice(0,10); }
function account(code){ return db.accounts.find(a=>a.code===code) || {name:'Cuenta no encontrada',type:'asset'}; }
function line(accountCode,debit,credit){ return {accountCode,debit:Number(debit||0),credit:Number(credit||0)}; }
function entry(date,concept,reference,lines){ return {id:crypto.randomUUID(),date,concept,reference,lines,createdAt:new Date().toISOString()}; }
function postEntry(e){
  const debit = e.lines.reduce((s,l)=>s+Number(l.debit||0),0);
  const credit = e.lines.reduce((s,l)=>s+Number(l.credit||0),0);
  if(Math.round(debit*100)!==Math.round(credit*100)) throw new Error('El asiento no cuadra: débitos y créditos deben ser iguales.');
  db.entries.push(e); db.audit.push({date:new Date().toISOString(),action:'Asiento creado',reference:e.reference}); save();
}
function balanceByAccount(code){
  const acc = account(code);
  const raw = db.entries.flatMap(e=>e.lines).filter(l=>l.accountCode===code).reduce((s,l)=>s+Number(l.debit||0)-Number(l.credit||0),0);
  return ['asset','expense'].includes(acc.type) ? raw : -raw;
}
function totals(){
  const byType = type => db.accounts.filter(a=>a.type===type && a.parent).reduce((s,a)=>s+balanceByAccount(a.code),0);
  const assets=byType('asset'), liabilities=byType('liability'), equity=byType('equity'), income=byType('income'), expense=byType('expense');
  return {assets,liabilities,equity,income,expense,net:income-expense, ar:balanceByAccount('1300'), ap:balanceByAccount('2100'), bank:balanceByAccount('1200'), unreconciled:unreconciledCount()};
}

function login(){ document.getElementById('loginView').classList.add('hidden'); document.getElementById('appView').classList.remove('hidden'); renderNav(); render('dashboard'); }
function renderNav(){
  document.getElementById('mainNav').innerHTML = navItems.map(([id,label])=>`<button class="nav-btn ${active===id?'active':''}" onclick="render('${id}')">${label}</button>`).join('');
}
function render(page){ active=page; document.getElementById('pageTitle').textContent=navItems.find(n=>n[0]===page)?.[1]||'Dashboard'; renderNav(); const map={dashboard,chart,journal,ledger,invoices,ar,ap,banks,reconciliation,taxes,financials,settings}; document.getElementById('content').innerHTML = map[page](); if(page==='reconciliation') setTimeout(updateRecSummary,0); }

function dashboard(){
  const t=totals();
  const score = Math.max(0, Math.min(100, Math.round(70 + (t.net>0?10:-10) + (t.bank>0?10:-5) + (t.ar<5000?5:-5))));
  return `<div class="grid kpi-grid">
    ${kpi('Activos',t.assets,'Base financiera')}${kpi('Pasivos',t.liabilities,'Obligaciones')}${kpi('Capital',t.equity,'Patrimonio')}${kpi('Utilidad Neta',t.net,'Ingresos - gastos', t.net>=0?'positive':'negative')}
    ${kpi('Ingresos',t.income,'Mes actual','positive')}${kpi('Gastos',t.expense,'Mes actual','negative')}${kpi('Cuentas por Cobrar',t.ar,'Facturas pendientes')}${kpi('Banco',t.bank,'Disponible')}${kpi('Sin Reconciliar',t.unreconciled,'Movimientos bancarios pendientes','warning')}
  </div>
  <div class="grid two" style="margin-top:16px">
    <div class="card"><div class="section-title"><h3>Últimos movimientos</h3><button onclick="openModal('journal')">+ Asiento</button></div>${entriesTable(db.entries.slice(-8).reverse())}</div>
    <div class="card"><h3>Nexus Score Contable</h3><div class="kpi"><div class="value ${score>=80?'positive':score>=60?'warning':'negative'}">${score}/100</div><div class="sub">Indicador básico por liquidez, utilidad y cobros.</div></div><hr><div class="quick"><button onclick="openModal('invoice')">Nueva factura</button><button onclick="openModal('expense')">Registrar gasto</button><button onclick="render('reconciliation')">Reconciliar</button><button onclick="render('financials')">Estados</button></div></div>
  </div>`;
}
function kpi(label,value,sub,cls=''){ return `<div class="card kpi"><div class="label">${label}</div><div class="value ${cls}">${money(value)}</div><div class="sub">${sub}</div></div>`; }
function chart(){ return `<div class="card"><div class="section-title"><h3>Catálogo de Cuentas</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Cuenta</th><th>Tipo</th><th>Saldo</th></tr></thead><tbody>${db.accounts.map(a=>`<tr><td>${a.code}</td><td>${a.parent?'— ':''}${a.name}</td><td><span class="badge">${a.type}</span></td><td>${a.parent?money(balanceByAccount(a.code)):'-'}</td></tr>`).join('')}</tbody></table></div></div>`; }
function journal(){ return `<div class="card"><div class="section-title"><h3>Libro Diario</h3><button onclick="openModal('journal')">+ Nuevo asiento</button></div>${entriesTable(db.entries.slice().reverse(), true)}</div>`; }
function entriesTable(entries, detail=false){ if(!entries.length) return `<div class="empty">Sin movimientos todavía.</div>`; return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Referencia</th><th>Concepto</th><th>Débitos</th><th>Créditos</th></tr></thead><tbody>${entries.map(e=>{const d=e.lines.reduce((s,l)=>s+l.debit,0), c=e.lines.reduce((s,l)=>s+l.credit,0);return `<tr><td>${e.date}</td><td>${e.reference}</td><td>${e.concept}${detail?`<br><small>${e.lines.map(l=>`${account(l.accountCode).name}: D ${money(l.debit)} / C ${money(l.credit)}`).join('<br>')}</small>`:''}</td><td>${money(d)}</td><td>${money(c)}</td></tr>`}).join('')}</tbody></table></div>`; }
function ledger(){ return `<div class="grid">${db.accounts.filter(a=>a.parent).map(a=>`<div class="card"><h3>${a.code} · ${a.name}</h3>${ledgerRows(a.code)}<strong>Saldo actual: ${money(balanceByAccount(a.code))}</strong></div>`).join('')}</div>`; }
function ledgerRows(code){ const rows=[]; db.entries.forEach(e=>e.lines.filter(l=>l.accountCode===code).forEach(l=>rows.push({...l,date:e.date,ref:e.reference,concept:e.concept}))); if(!rows.length) return '<p class="empty">Sin movimientos.</p>'; return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Ref.</th><th>Concepto</th><th>Débito</th><th>Crédito</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${r.ref}</td><td>${r.concept}</td><td>${money(r.debit)}</td><td>${money(r.credit)}</td></tr>`).join('')}</tbody></table></div>`; }
function invoices(){ return `<div class="card"><div class="section-title"><h3>Facturación</h3><button onclick="openModal('invoice')">+ Nueva factura</button></div>${invoiceTable()}</div>`; }
function invoiceTable(){ if(!db.invoices.length) return '<div class="empty">No hay facturas creadas.</div>'; return `<div class="table-wrap"><table class="table"><thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Balance</th><th>Estado</th><th></th></tr></thead><tbody>${db.invoices.map(inv=>`<tr><td>${inv.number}</td><td>${inv.customerName}</td><td>${inv.date}</td><td>${money(inv.total)}</td><td>${money(inv.balance)}</td><td><span class="badge ${inv.status==='Pagada'?'green':inv.status==='Vencida'?'red':'amber'}">${inv.status}</span></td><td>${inv.balance>0?`<button onclick="payInvoice('${inv.id}')">Cobrar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`; }
function ar(){ return `<div class="card"><h3>Cuentas por Cobrar</h3>${invoiceTable()}</div>`; }
function ap(){ return `<div class="card"><h3>Cuentas por Pagar</h3><div class="empty">Base lista. En la próxima iteración añadimos registro de facturas de suplidores con doble partida.</div></div>`; }

function banks(){ return `<div class="grid two"><div class="card"><div class="section-title"><h3>Bancos</h3><button onclick="render('reconciliation')">Reconciliar</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Banco</th><th>Cuenta contable</th><th>Saldo libro</th><th>Pendientes</th></tr></thead><tbody>${db.bankAccounts.map(b=>`<tr><td>${b.name}</td><td>${account(b.account).name}</td><td>${money(balanceByAccount(b.account))}</td><td><span class="badge amber">${bankLines(b.account).filter(x=>!isCleared(x.key)).length}</span></td></tr>`).join('')}</tbody></table></div></div><div class="card"><h3>Últimas reconciliaciones</h3>${reconciliationHistory()}</div></div>`; }
function bankLines(accountCode='1200'){
  const rows=[];
  db.entries.forEach(e=>e.lines.forEach((l,idx)=>{ if(l.accountCode===accountCode){ rows.push({key:`${e.id}-${idx}`,date:e.date,reference:e.reference,concept:e.concept,debit:l.debit,credit:l.credit,amount:Number(l.debit||0)-Number(l.credit||0)}); } }));
  return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
function clearedKeys(){ return new Set((db.reconciliations||[]).flatMap(r=>r.clearedKeys||[])); }
function isCleared(key){ return clearedKeys().has(key); }
function unreconciledCount(){ return bankLines('1200').filter(x=>!isCleared(x.key)).length; }
function reconciliationHistory(){ if(!db.reconciliations?.length) return '<div class="empty">No hay reconciliaciones cerradas.</div>'; return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha estado</th><th>Banco</th><th>Balance estado</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>${db.reconciliations.slice().reverse().map(r=>`<tr><td>${r.statementDate}</td><td>${r.bankName}</td><td>${money(r.statementBalance)}</td><td>${money(r.difference)}</td><td><span class="badge green">${r.status}</span></td></tr>`).join('')}</tbody></table></div>`; }
function reconciliation(){
  const b=db.bankAccounts[0]; const rows=bankLines(b.account); const open=rows.filter(r=>!isCleared(r.key));
  const imported=(db.statementImports||[]).filter(x=>x.bankAccountId===b.id && !x.reconciled);
  return `<div class="grid two">
    <div class="card">
      <div class="section-title"><h3>Reconciliación Bancaria</h3><button onclick="finalizeReconciliation()">Cerrar reconciliación</button></div>
      <div class="form-grid"><label>Banco<input id="recBank" value="${b.name}" disabled></label><label>Fecha del estado<input id="recDate" type="date" value="${today()}"></label><label>Balance según banco<input id="recStatement" type="number" step="0.01" value="${balanceByAccount(b.account).toFixed(2)}" oninput="updateRecSummary()"></label><label>Cuenta contable<input value="${b.account} · ${account(b.account).name}" disabled></label></div>
      <hr><div id="recSummary">${reconciliationSummaryHtml()}</div>
    </div>
    <div class="card">
      <div class="section-title"><h3>Subir estado de cuenta</h3><button class="ghost" onclick="autoMatchStatement()">Auto reconciliar</button></div>
      <p class="muted">Carga CSV del banco o entra partidas manuales. Columnas aceptadas: fecha/date, descripción/description, referencia/ref, débito/debit, crédito/credit, monto/amount.</p>
      <div class="form-grid"><label class="full">Archivo CSV<input id="statementFile" type="file" accept=".csv,text/csv" onchange="importStatementCSV(event)"></label></div>
      <div class="actions"><button class="ghost" onclick="openModal('statementLine')">+ Partida manual</button><button class="ghost" onclick="clearImportedStatement()">Limpiar importadas</button></div>
      ${statementImportTable(imported)}
    </div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Movimientos del libro pendientes</h3>${open.length?`<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Fecha</th><th>Ref.</th><th>Concepto</th><th>Entrada</th><th>Salida</th><th>Match</th></tr></thead><tbody>${open.map(r=>`<tr><td><input class="rec-check" type="checkbox" value="${r.key}" onchange="updateRecSummary()" ${isMatched(r.key)?'checked':''}></td><td>${r.date}</td><td>${r.reference}</td><td>${r.concept}</td><td>${r.amount>0?money(r.amount):'-'}</td><td>${r.amount<0?money(Math.abs(r.amount)):'-'}</td><td>${isMatched(r.key)?'<span class="badge green">Auto</span>':'<span class="badge amber">Manual</span>'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No hay movimientos pendientes. Banco limpio, como debe ser.</div>'}</div>`;
}
function statementImportTable(rows){
  if(!rows.length) return '<div class="empty">No hay partidas importadas del estado de cuenta.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Descripción</th><th>Ref.</th><th>Monto</th><th>Estado</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${r.description}</td><td>${r.reference||'-'}</td><td>${money(r.amount)}</td><td>${r.bookKey?'<span class="badge green">Conciliada</span>':'<span class="badge amber">Pendiente</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function isMatched(bookKey){ return (db.statementImports||[]).some(x=>x.bookKey===bookKey); }
function normalizeHeader(h){ return h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function parseCSV(text){
  const lines=text.split(/\r?\n/).filter(x=>x.trim()); if(lines.length<2) return [];
  const split=line=>line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x=>x.replace(/^"|"$/g,'').trim());
  const headers=split(lines[0]).map(normalizeHeader);
  return lines.slice(1).map(line=>{ const cols=split(line); const obj={}; headers.forEach((h,i)=>obj[h]=cols[i]||''); return obj; });
}
function num(v){ return Number(String(v||'0').replace(/[$, ]/g,'').replace(/^\((.*)\)$/,'-$1'))||0; }
function importStatementCSV(ev){
  const file=ev.target.files?.[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const b=db.bankAccounts[0]; const rows=parseCSV(reader.result);
    const mapped=rows.map(r=>{
      const date=r.fecha||r.date||r.postingdate||today();
      const description=r.descripcion||r.description||r.memo||r.detalle||'Movimiento importado';
      const reference=r.referencia||r.ref||r.reference||r.numero||'';
      let amount = r.monto||r.amount ? num(r.monto||r.amount) : (num(r.credito||r.credit||r.deposit||r.entrada)-num(r.debito||r.debit||r.withdrawal||r.salida));
      return {id:crypto.randomUUID(),bankAccountId:b.id,date,description,reference,amount,reconciled:false,bookKey:null,createdAt:new Date().toISOString()};
    }).filter(x=>x.amount!==0);
    db.statementImports.push(...mapped); db.audit.push({date:new Date().toISOString(),action:'Estado bancario importado',reference:`${file.name} · ${mapped.length} partidas`}); save(); render('reconciliation');
  };
  reader.readAsText(file);
}
function autoMatchStatement(){
  const b=db.bankAccounts[0]; const open=bankLines(b.account).filter(r=>!isCleared(r.key) && !isMatched(r.key));
  const imported=(db.statementImports||[]).filter(x=>x.bankAccountId===b.id && !x.bookKey);
  let matched=0;
  imported.forEach(st=>{
    const found=open.find(bl=>!isMatched(bl.key) && Math.abs(bl.amount-st.amount)<.01 && Math.abs(new Date(bl.date)-new Date(st.date)) <= 7*86400000);
    if(found){ st.bookKey=found.key; st.reconciled=true; matched++; }
  });
  db.audit.push({date:new Date().toISOString(),action:'Auto reconciliación ejecutada',reference:`${matched} partidas encontradas`}); save(); render('reconciliation'); alert(`${matched} partidas conciliadas automáticamente.`);
}
function clearImportedStatement(){ if(confirm('¿Limpiar partidas importadas no cerradas?')){ db.statementImports=(db.statementImports||[]).filter(x=>x.bookKey && x.reconciled); save(); render('reconciliation'); } }
function selectedRecRows(){ const keys=[...document.querySelectorAll('.rec-check:checked')].map(x=>x.value); const all=bankLines(db.bankAccounts[0].account); return all.filter(r=>keys.includes(r.key)); }
function reconciliationSummary(){ const statement=Number(document.getElementById('recStatement')?.value||0); const selected=selectedRecRows(); const cleared=selected.reduce((s,r)=>s+r.amount,0); const difference=statement-cleared; return {statement,cleared,difference,selected}; }
function reconciliationSummaryHtml(){ return `<div class="grid three"><div class="mini-stat"><span>Balance banco</span><strong id="recStatementView">$0.00</strong></div><div class="mini-stat"><span>Movimientos marcados</span><strong id="recClearedView">$0.00</strong></div><div class="mini-stat"><span>Diferencia</span><strong id="recDiffView">$0.00</strong></div></div><div class="actions"><button class="ghost" onclick="createBankAdjustment()">Crear ajuste por diferencia</button></div>`; }
function updateRecSummary(){ const r=reconciliationSummary(); document.getElementById('recStatementView').textContent=money(r.statement); document.getElementById('recClearedView').textContent=money(r.cleared); const diff=document.getElementById('recDiffView'); diff.textContent=money(r.difference); diff.className=Math.abs(r.difference)<.01?'positive':'warning'; }
function createBankAdjustment(){ try{ const r=reconciliationSummary(); if(Math.abs(r.difference)<.01) return alert('No hay diferencia para ajustar.'); const ref=`ADJ-BANK-${Date.now().toString().slice(-6)}`; if(r.difference>0){ postEntry(entry(today(),'Ajuste reconciliación: ingreso bancario no registrado',ref,[line('1200',r.difference,0),line('4300',0,r.difference)])); } else { const amt=Math.abs(r.difference); postEntry(entry(today(),'Ajuste reconciliación: cargo bancario no registrado',ref,[line('5500',amt,0),line('1200',0,amt)])); } render('reconciliation'); }catch(e){ alert(e.message); } }
function finalizeReconciliation(){ try{ const r=reconciliationSummary(); if(Math.abs(r.difference)>=.01 && !confirm('La reconciliación tiene diferencia. ¿Deseas cerrarla de todos modos?')) return; const b=db.bankAccounts[0]; db.reconciliations.push({id:crypto.randomUUID(),bankAccountId:b.id,bankName:b.name,statementDate:recDate.value,statementBalance:r.statement,clearedBalance:r.cleared,difference:r.difference,clearedKeys:r.selected.map(x=>x.key),importedLines:(db.statementImports||[]).filter(x=>x.bankAccountId===b.id && x.bookKey).map(x=>x.id),status:Math.abs(r.difference)<.01?'Cuadrada':'Cerrada con diferencia',createdAt:new Date().toISOString()}); (db.statementImports||[]).forEach(x=>{ if(x.bankAccountId===b.id && x.bookKey) x.closed=true; }); db.audit.push({date:new Date().toISOString(),action:'Reconciliación bancaria cerrada',reference:b.name}); save(); render('reconciliation'); }catch(e){ alert(e.message); } }

function taxes(){ const ivuPayable=balanceByAccount('2300'); return `<div class="grid three"><div class="card kpi"><div class="label">IVU Configurado</div><div class="value">${db.company.ivu}%</div><div class="sub">Puerto Rico</div></div>${kpi('IVU por Pagar',ivuPayable,'Generado por facturas','warning')}<div class="card"><h3>Resumen</h3><p>El IVU se calcula automáticamente desde facturación y se acredita a IVU por Pagar.</p></div></div>`; }
function financials(){ const t=totals(); return `<div class="grid two"><div class="card"><h3>Estado de Resultados</h3><table class="table"><tr><td>Ingresos</td><td>${money(t.income)}</td></tr><tr><td>Gastos</td><td>${money(t.expense)}</td></tr><tr><th>Utilidad neta</th><th>${money(t.net)}</th></tr></table></div><div class="card"><h3>Balance General</h3><table class="table"><tr><td>Activos</td><td>${money(t.assets)}</td></tr><tr><td>Pasivos</td><td>${money(t.liabilities)}</td></tr><tr><td>Capital</td><td>${money(t.equity)}</td></tr></table></div></div>`; }
function settings(){ return `<div class="card"><h3>Configuración</h3><div class="form-grid"><label>Empresa<input id="cfgName" value="${db.company.name}"></label><label>IVU %<input id="cfgIvu" type="number" step="0.01" value="${db.company.ivu}"></label></div><div class="actions"><button onclick="saveSettings()">Guardar configuración</button></div></div>`; }
function saveSettings(){ db.company.name=document.getElementById('cfgName').value; db.company.ivu=Number(document.getElementById('cfgIvu').value); save(); document.getElementById('companyLabel').textContent=`${db.company.name} · Año Fiscal ${db.company.fiscalYear}`; render('settings'); }

function openModal(type){
  document.getElementById('modal').classList.remove('hidden');
  if(type==='journal') modal('Nuevo asiento contable', journalForm());
  if(type==='invoice') modal('Nueva factura', invoiceForm());
  if(type==='expense') modal('Registrar gasto', expenseForm());
  if(type==='statementLine') modal('Partida manual del estado bancario', statementLineForm());
}
function closeModal(){ document.getElementById('modal').classList.add('hidden'); }
function modal(title,body){ document.getElementById('modalTitle').textContent=title; document.getElementById('modalBody').innerHTML=body; }
function accountOptions(filter=null){ return db.accounts.filter(a=>a.parent && (!filter || a.type===filter)).map(a=>`<option value="${a.code}">${a.code} · ${a.name}</option>`).join(''); }
function journalForm(){ return `<div class="form-grid"><label>Fecha<input id="jDate" type="date" value="${today()}"></label><label>Referencia<input id="jRef" value="JE-${Date.now().toString().slice(-6)}"></label><label class="full">Concepto<input id="jConcept" placeholder="Descripción del asiento"></label><label>Cuenta débito<select id="jDebitAcc">${accountOptions()}</select></label><label>Monto débito<input id="jDebit" type="number" step="0.01"></label><label>Cuenta crédito<select id="jCreditAcc">${accountOptions()}</select></label><label>Monto crédito<input id="jCredit" type="number" step="0.01"></label></div><div class="actions"><button onclick="saveJournal()">Guardar asiento</button></div>`; }
function saveJournal(){ try{ postEntry(entry(jDate.value,jConcept.value,jRef.value,[line(jDebitAcc.value,jDebit.value,0),line(jCreditAcc.value,0,jCredit.value)])); closeModal(); render(active); }catch(e){ alert(e.message); } }
function invoiceForm(){ return `<div class="form-grid"><label>Cliente<select id="iCustomer">${db.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label><label>Fecha<input id="iDate" type="date" value="${today()}"></label><label class="full">Descripción<input id="iDesc" value="Servicios profesionales"></label><label>Subtotal<input id="iSubtotal" type="number" step="0.01" value="100.00"></label><label>Aplicar IVU<select id="iTax"><option value="yes">Sí</option><option value="no">No</option></select></label></div><div class="actions"><button onclick="saveInvoice()">Crear factura</button></div>`; }
function saveInvoice(){ const c=db.customers.find(x=>x.id===iCustomer.value); const subtotal=Number(iSubtotal.value||0); const tax=iTax.value==='yes'?subtotal*(db.company.ivu/100):0; const total=subtotal+tax; const number=`INV-2026-${String(db.invoices.length+1).padStart(6,'0')}`; const inv={id:crypto.randomUUID(),number,customerId:c.id,customerName:c.name,date:iDate.value,desc:iDesc.value,subtotal,tax,total,balance:total,status:'Pendiente'}; db.invoices.push(inv); postEntry(entry(iDate.value,`Factura ${number} - ${c.name}`,number,[line('1300',total,0),line('4100',0,subtotal),line('2300',0,tax)])); save(); closeModal(); render('invoices'); }
function payInvoice(id){ const inv=db.invoices.find(i=>i.id===id); const amount=inv.balance; inv.balance=0; inv.status='Pagada'; postEntry(entry(today(),`Cobro factura ${inv.number}`,`PAY-${inv.number}`,[line('1200',amount,0),line('1300',0,amount)])); save(); render(active); }
function expenseForm(){ return `<div class="form-grid"><label>Fecha<input id="eDate" type="date" value="${today()}"></label><label>Categoría<select id="eAcc">${accountOptions('expense')}</select></label><label class="full">Descripción<input id="eDesc" value="Gasto operacional"></label><label>Monto<input id="eAmount" type="number" step="0.01" value="50.00"></label><label>Pago desde<select id="eBank"><option value="1200">Banco</option><option value="1100">Caja</option></select></label></div><div class="actions"><button onclick="saveExpense()">Registrar gasto</button></div>`; }
function saveExpense(){ try{ const amt=Number(eAmount.value||0); postEntry(entry(eDate.value,eDesc.value,`EXP-${Date.now().toString().slice(-6)}`,[line(eAcc.value,amt,0),line(eBank.value,0,amt)])); closeModal(); render('dashboard'); }catch(e){ alert(e.message); } }

function statementLineForm(){ return `<div class="form-grid"><label>Fecha<input id="sDate" type="date" value="${today()}"></label><label>Referencia<input id="sRef" placeholder="Opcional"></label><label class="full">Descripción<input id="sDesc" value="Movimiento bancario manual"></label><label>Monto<input id="sAmount" type="number" step="0.01" placeholder="Depósito positivo / retiro negativo"></label></div><div class="actions"><button onclick="saveStatementLine()">Guardar partida</button></div>`; }
function saveStatementLine(){ const b=db.bankAccounts[0]; const amt=Number(sAmount.value||0); if(!amt) return alert('El monto no puede ser cero.'); db.statementImports.push({id:crypto.randomUUID(),bankAccountId:b.id,date:sDate.value,description:sDesc.value,reference:sRef.value,amount:amt,reconciled:false,bookKey:null,manual:true,createdAt:new Date().toISOString()}); save(); closeModal(); render('reconciliation'); }

function exportData(){ const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='nexus-accounting-pr-data.json'; a.click(); }
function resetDemo(){ if(confirm('Esto reinicia la demo local.')){ localStorage.removeItem('nexusAccountingPR'); db=load(); render('dashboard'); } }

window.addEventListener('DOMContentLoaded',()=>{ document.getElementById('companyLabel').textContent=`${db.company.name} · Año Fiscal ${db.company.fiscalYear}`; });

// ===== v0.4 · Bandeja de Importación + Reconciliación Inteligente =====
if(!navItems.some(n=>n[0]==='importTray')) navItems.splice(8,0,['importTray','Bandeja de Importación']);

function render(page){
  active=page;
  document.getElementById('pageTitle').textContent=navItems.find(n=>n[0]===page)?.[1]||'Dashboard';
  renderNav();
  const map={dashboard,chart,journal,ledger,invoices,ar,ap,banks,importTray,reconciliation,taxes,financials,settings};
  document.getElementById('content').innerHTML = (map[page]||dashboard)();
  if(page==='reconciliation') setTimeout(updateRecSummary,0);
}

function importTray(){
  const rows=(db.statementImports||[]).slice().reverse();
  return `<div class="grid two">
    <div class="card">
      <div class="section-title"><h3>Bandeja de Importación</h3><button onclick="autoMatchStatement()">Auto reconciliar</button></div>
      <p class="muted">Sube estados bancarios para que el sistema cree partidas de conciliación. Recomendado: CSV descargado desde Banco Popular, FirstBank, Oriental, Stripe, ATH Business, PayPal o Square.</p>
      <div class="form-grid">
        <label>Banco destino<select id="trayBank">${db.bankAccounts.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></label>
        <label>Tipo de archivo<select id="trayType"><option value="csv">CSV / TXT</option><option value="excel">Excel exportado como CSV</option></select></label>
        <label class="full">Estado de cuenta<input id="statementFile" type="file" accept=".csv,.txt,text/csv,text/plain" onchange="importStatementCSV(event)"></label>
      </div>
      <div class="actions"><button class="ghost" onclick="downloadSampleCSV()">Descargar plantilla CSV</button><button class="ghost" onclick="openModal('statementLine')">+ Partida manual</button><button class="ghost" onclick="clearImportedStatement()">Limpiar pendientes</button></div>
      <hr><h3>Formato aceptado</h3><p class="muted">Columnas: date, description, reference, amount. También reconoce fecha/descripción/referencia/monto, debit/credit o débito/crédito.</p>
    </div>
    <div class="card"><h3>Partidas importadas</h3>${statementImportTable(rows)}</div>
  </div>`;
}

function reconciliation(){
  const b=db.bankAccounts[0];
  const open=bankLines(b.account).filter(r=>!isCleared(r.key));
  const imported=(db.statementImports||[]).filter(x=>x.bankAccountId===b.id && !x.closed);
  return `<div class="grid two">
    <div class="card">
      <div class="section-title"><h3>Centro de Reconciliación</h3><button onclick="finalizeReconciliation()">Cerrar reconciliación</button></div>
      <div class="form-grid"><label>Banco<input id="recBank" value="${b.name}" disabled></label><label>Fecha del estado<input id="recDate" type="date" value="${today()}"></label><label>Balance según banco<input id="recStatement" type="number" step="0.01" value="${balanceByAccount(b.account).toFixed(2)}" oninput="updateRecSummary()"></label><label>Cuenta contable<input value="${b.account} · ${account(b.account).name}" disabled></label></div>
      <hr><div id="recSummary">${reconciliationSummaryHtml()}</div>
      <div class="actions"><button class="ghost" onclick="render('importTray')">Ir a Bandeja de Importación</button><button class="ghost" onclick="autoMatchStatement()">Auto reconciliar</button><button class="ghost" onclick="openModal('statementLine')">+ Partida manual</button></div>
    </div>
    <div class="card"><h3>Estado bancario importado</h3>${statementImportTable(imported)}</div>
  </div>
  <div class="grid two" style="margin-top:16px">
    <div class="card"><h3>Movimientos del libro pendientes</h3>${bookPendingTable(open)}</div>
    <div class="card"><h3>Candidatos sugeridos</h3>${candidateTable(open, imported)}</div>
  </div>`;
}

function bookPendingTable(rows){
  if(!rows.length) return '<div class="empty">No hay movimientos del libro pendientes.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Fecha</th><th>Ref.</th><th>Concepto</th><th>Entrada</th><th>Salida</th><th>Estado</th></tr></thead><tbody>${rows.map(r=>`<tr><td><input class="rec-check" type="checkbox" value="${r.key}" onchange="updateRecSummary()" ${isMatched(r.key)?'checked':''}></td><td>${r.date}</td><td>${r.reference}</td><td>${r.concept}</td><td>${r.amount>0?money(r.amount):'-'}</td><td>${r.amount<0?money(Math.abs(r.amount)):'-'}</td><td>${isMatched(r.key)?'<span class="badge green">Conciliado</span>':'<span class="badge amber">Pendiente</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}

function statementImportTable(rows){
  if(!rows.length) return '<div class="empty">No hay partidas importadas del estado de cuenta.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Descripción</th><th>Ref.</th><th>Monto</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${r.description}</td><td>${r.reference||'-'}</td><td>${money(r.amount)}</td><td>${r.bookKey?'<span class="badge green">Conciliada</span>':'<span class="badge amber">Pendiente</span>'}</td><td>${r.bookKey?`<button class="ghost mini" onclick="unmatchStatement('${r.id}')">Soltar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}

function matchScore(book, st){
  let score=0;
  if(Math.abs(book.amount-st.amount)<.01) score+=55;
  const days=Math.abs(new Date(book.date)-new Date(st.date))/86400000;
  if(days===0) score+=25; else if(days<=2) score+=18; else if(days<=7) score+=10;
  const text=(book.reference+' '+book.concept).toLowerCase();
  const bank=(st.reference+' '+st.description).toLowerCase();
  const tokens=bank.split(/\W+/).filter(x=>x.length>3);
  const hits=tokens.filter(t=>text.includes(t)).length;
  score+=Math.min(20,hits*5);
  return Math.min(100,Math.round(score));
}

function candidateTable(open, imported){
  const pendingImports=imported.filter(x=>!x.bookKey);
  const candidates=[];
  open.filter(b=>!isMatched(b.key)).forEach(book=>{
    pendingImports.forEach(st=>{
      const score=matchScore(book,st);
      if(score>=55) candidates.push({book,st,score});
    });
  });
  candidates.sort((a,b)=>b.score-a.score);
  if(!candidates.length) return '<div class="empty">Sin candidatos automáticos. Usa conciliación manual o crea ajustes.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Score</th><th>Libro</th><th>Banco</th><th>Monto</th><th></th></tr></thead><tbody>${candidates.slice(0,12).map(c=>`<tr><td><span class="badge ${c.score>=85?'green':'amber'}">${c.score}%</span></td><td>${c.book.date}<br><small>${c.book.concept}</small></td><td>${c.st.date}<br><small>${c.st.description}</small></td><td>${money(c.book.amount)}</td><td><button class="mini" onclick="manualMatch('${c.book.key}','${c.st.id}')">Conciliar</button></td></tr>`).join('')}</tbody></table></div>`;
}

function autoMatchStatement(){
  const b=db.bankAccounts[0];
  const open=bankLines(b.account).filter(r=>!isCleared(r.key) && !isMatched(r.key));
  const imported=(db.statementImports||[]).filter(x=>x.bankAccountId===b.id && !x.bookKey && !x.closed);
  let matched=0;
  imported.forEach(st=>{
    const best=open.filter(bl=>!isMatched(bl.key)).map(bl=>({bl,score:matchScore(bl,st)})).sort((a,b)=>b.score-a.score)[0];
    if(best && best.score>=80){ st.bookKey=best.bl.key; st.reconciled=true; st.score=best.score; matched++; }
  });
  db.audit.push({date:new Date().toISOString(),action:'Auto reconciliación inteligente ejecutada',reference:`${matched} partidas encontradas`});
  save(); render('reconciliation'); alert(`${matched} partidas conciliadas automáticamente.`);
}

function manualMatch(bookKey, statementId){
  const st=(db.statementImports||[]).find(x=>x.id===statementId);
  if(!st) return alert('Partida bancaria no encontrada.');
  st.bookKey=bookKey; st.reconciled=true; st.score=100; save(); render('reconciliation');
}
function unmatchStatement(statementId){
  const st=(db.statementImports||[]).find(x=>x.id===statementId);
  if(st){ st.bookKey=null; st.reconciled=false; delete st.score; save(); render(active); }
}

function downloadSampleCSV(){
  const csv='date,description,reference,amount\n2026-06-01,DEP CLIENTE DEMO,INV-2026-000001,111.50\n2026-06-02,BANK SERVICE FEE,FEE-001,-15.00\n';
  const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='plantilla_estado_bancario_nexus.csv'; a.click();
}


// ===== v0.6 · Motor de Estados Financieros + Balance de Comprobación =====
if(!navItems.some(n=>n[0]==='validation')) navItems.splice(navItems.findIndex(n=>n[0]==='financials'),0,['validation','Validación Contable']);
if(!navItems.some(n=>n[0]==='closing')) navItems.splice(navItems.findIndex(n=>n[0]==='settings'),0,['closing','Cierre Mensual']);

function periodState(){
  db.periods ||= [{id:'2026-06',year:2026,month:6,label:'Junio 2026',status:'Abierto',closedAt:null,closedBy:null}];
  db.activePeriod ||= '2026-06';
  return db.periods.find(p=>p.id===db.activePeriod) || db.periods[0];
}
function periodEntries(){
  const p=periodState();
  return db.entries.filter(e=>String(e.date||'').slice(0,7)===p.id);
}
function normalBalance(type){ return ['asset','expense'].includes(type) ? 'debit' : 'credit'; }
function accountActivity(code, entries=periodEntries()){
  let debit=0, credit=0;
  entries.forEach(e=>e.lines.filter(l=>l.accountCode===code).forEach(l=>{ debit+=Number(l.debit||0); credit+=Number(l.credit||0); }));
  const acc=account(code);
  const raw=debit-credit;
  const balance=normalBalance(acc.type)==='debit' ? raw : -raw;
  return {code,name:acc.name,type:acc.type,debit,credit,balance,raw};
}
function financialEngine(){
  const detail=db.accounts.filter(a=>a.parent).map(a=>accountActivity(a.code));
  const byType=type=>detail.filter(a=>a.type===type).reduce((s,a)=>s+a.balance,0);
  const assets=byType('asset'), liabilities=byType('liability'), equity=byType('equity'), income=byType('income'), expense=byType('expense');
  const netIncome=income-expense;
  const debits=detail.reduce((s,a)=>s+a.debit,0), credits=detail.reduce((s,a)=>s+a.credit,0);
  return {detail,assets,liabilities,equity,income,expense,netIncome,debits,credits,trialDifference:debits-credits,period:periodState()};
}
function statementRows(type){
  const rows=financialEngine().detail.filter(a=>a.type===type && Math.abs(a.balance)>0.004);
  if(!rows.length) return `<tr><td colspan="2" class="muted">Sin actividad en el período.</td></tr>`;
  return rows.map(a=>`<tr><td>${a.code} · ${a.name}</td><td>${money(a.balance)}</td></tr>`).join('');
}
function trialBalanceTable(){
  const f=financialEngine();
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Cuenta</th><th>Tipo</th><th>Débitos</th><th>Créditos</th><th>Saldo normal</th></tr></thead><tbody>${f.detail.map(a=>`<tr><td>${a.code} · ${a.name}</td><td><span class="badge">${a.type}</span></td><td>${money(a.debit)}</td><td>${money(a.credit)}</td><td>${money(a.balance)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th><th></th><th>${money(f.debits)}</th><th>${money(f.credits)}</th><th>${money(f.trialDifference)}</th></tr></tfoot></table></div>`;
}
function incomeStatementCard(){
  const f=financialEngine();
  return `<div class="card"><div class="section-title"><h3>Estado de Resultados</h3><span class="badge">${f.period.label}</span></div><table class="table"><tbody><tr><th colspan="2">Ingresos</th></tr>${statementRows('income')}<tr><th>Total ingresos</th><th>${money(f.income)}</th></tr><tr><th colspan="2">Gastos</th></tr>${statementRows('expense')}<tr><th>Total gastos</th><th>${money(f.expense)}</th></tr><tr><th>Utilidad neta</th><th class="${f.netIncome>=0?'positive':'negative'}">${money(f.netIncome)}</th></tr></tbody></table></div>`;
}
function balanceSheetCard(){
  const f=financialEngine();
  const liabilitiesEquity=f.liabilities+f.equity+f.netIncome;
  return `<div class="card"><div class="section-title"><h3>Balance General</h3><span class="badge">${f.period.label}</span></div><table class="table"><tbody><tr><th colspan="2">Activos</th></tr>${statementRows('asset')}<tr><th>Total activos</th><th>${money(f.assets)}</th></tr><tr><th colspan="2">Pasivos</th></tr>${statementRows('liability')}<tr><th>Total pasivos</th><th>${money(f.liabilities)}</th></tr><tr><th colspan="2">Capital</th></tr>${statementRows('equity')}<tr><td>Utilidad neta del período</td><td>${money(f.netIncome)}</td></tr><tr><th>Total capital + utilidad</th><th>${money(f.equity+f.netIncome)}</th></tr><tr><th>Pasivo + Capital</th><th>${money(liabilitiesEquity)}</th></tr><tr><th>Diferencia</th><th class="${Math.abs(f.assets-liabilitiesEquity)<.01?'positive':'warning'}">${money(f.assets-liabilitiesEquity)}</th></tr></tbody></table></div>`;
}
function cashFlowCard(){
  const f=financialEngine();
  const bank=accountActivity('1200').balance;
  const cash=accountActivity('1100').balance;
  const operations=f.netIncome;
  return `<div class="card"><div class="section-title"><h3>Flujo de Efectivo</h3><span class="badge">Inicial</span></div><table class="table"><tbody><tr><td>Actividades operacionales</td><td>${money(operations)}</td></tr><tr><td>Disponible en caja</td><td>${money(cash)}</td></tr><tr><td>Disponible en banco</td><td>${money(bank)}</td></tr><tr><th>Efectivo disponible</th><th>${money(cash+bank)}</th></tr></tbody></table><p class="muted">Versión inicial basada en caja/banco y utilidad del período. Preparada para método indirecto en la próxima iteración.</p></div>`;
}
function validationResults(){
  const f=financialEngine();
  const recPending=(db.statementImports||[]).filter(x=>!x.closed && !x.bookKey).length;
  const ar=accountActivity('1300').balance;
  const invoiceBalance=(db.invoices||[]).reduce((s,i)=>s+Number(i.balance||0),0);
  const ap=accountActivity('2100').balance;
  const unbalancedEntries=periodEntries().filter(e=>Math.round(e.lines.reduce((s,l)=>s+Number(l.debit||0),0)*100)!==Math.round(e.lines.reduce((s,l)=>s+Number(l.credit||0),0)*100));
  const checks=[
    {name:'Libro Diario balanceado',ok:unbalancedEntries.length===0,detail:unbalancedEntries.length?`${unbalancedEntries.length} asientos descuadrados`:'Débitos y créditos cuadran'},
    {name:'Balance de comprobación',ok:Math.abs(f.trialDifference)<.01,detail:`Diferencia ${money(f.trialDifference)}`},
    {name:'Balance General',ok:Math.abs(f.assets-(f.liabilities+f.equity+f.netIncome))<.01,detail:`Diferencia ${money(f.assets-(f.liabilities+f.equity+f.netIncome))}`},
    {name:'Cuentas por Cobrar',ok:Math.abs(ar-invoiceBalance)<.01,detail:`Libro ${money(ar)} vs facturas ${money(invoiceBalance)}`},
    {name:'Cuentas por Pagar',ok:ap>=-0.01,detail:`Saldo AP ${money(ap)}`},
    {name:'Reconciliaciones',ok:recPending===0,detail:recPending?`${recPending} partidas bancarias pendientes`:'Sin partidas bancarias importadas pendientes'},
  ];
  return checks;
}
function validation(){
  const checks=validationResults();
  const score=Math.round((checks.filter(c=>c.ok).length/checks.length)*100);
  return `<div class="grid three"><div class="card kpi"><div class="label">Integridad Contable</div><div class="value ${score>=90?'positive':score>=70?'warning':'negative'}">${score}%</div><div class="sub">Período ${periodState().label}</div></div><div class="card kpi"><div class="label">Incidencias</div><div class="value ${checks.every(c=>c.ok)?'positive':'warning'}">${checks.filter(c=>!c.ok).length}</div><div class="sub">Antes del cierre</div></div><div class="card kpi"><div class="label">Estado</div><div class="value">${periodState().status}</div><div class="sub">Período activo</div></div></div><div class="card" style="margin-top:16px"><div class="section-title"><h3>Validación Contable</h3><button onclick="render('closing')">Ir a Cierre</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Control</th><th>Resultado</th><th>Detalle</th><th>Acción</th></tr></thead><tbody>${checks.map(c=>`<tr><td>${c.name}</td><td>${c.ok?'<span class="badge green">OK</span>':'<span class="badge amber">Revisar</span>'}</td><td>${c.detail}</td><td>${c.ok?'-':resolveButton(c.name)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function resolveButton(name){
  if(name.includes('Reconciliaciones')) return `<button class="mini" onclick="render('reconciliation')">Resolver</button>`;
  if(name.includes('Cobrar')) return `<button class="mini" onclick="render('ar')">Resolver</button>`;
  return `<button class="mini" onclick="render('journal')">Revisar</button>`;
}
function financials(){
  const f=financialEngine();
  return `<div class="grid four"><div class="card kpi"><div class="label">Débitos</div><div class="value">${money(f.debits)}</div><div class="sub">Balance de comprobación</div></div><div class="card kpi"><div class="label">Créditos</div><div class="value">${money(f.credits)}</div><div class="sub">Balance de comprobación</div></div><div class="card kpi"><div class="label">Diferencia</div><div class="value ${Math.abs(f.trialDifference)<.01?'positive':'warning'}">${money(f.trialDifference)}</div><div class="sub">Debe ser $0.00</div></div><div class="card kpi"><div class="label">Utilidad Neta</div><div class="value ${f.netIncome>=0?'positive':'negative'}">${money(f.netIncome)}</div><div class="sub">${f.period.label}</div></div></div><div class="grid two" style="margin-top:16px">${incomeStatementCard()}${balanceSheetCard()}</div><div class="grid two" style="margin-top:16px"><div class="card"><div class="section-title"><h3>Balance de Comprobación</h3><button onclick="downloadFinancialCSV()">Exportar CSV</button></div>${trialBalanceTable()}</div>${cashFlowCard()}</div>`;
}
function closing(){
  const checks=validationResults(); const ready=checks.every(c=>c.ok); const p=periodState();
  return `<div class="card"><div class="section-title"><h3>Cierre Mensual Asistido</h3><span class="badge ${p.status==='Cerrado'?'green':'amber'}">${p.status}</span></div><p class="muted">El cierre depende del Motor de Estados Financieros, el Balance de Comprobación y la Validación Contable.</p>${validation()}<hr><div class="actions"><button ${ready&&p.status!=='Cerrado'?'':'disabled'} onclick="closeAccountingPeriod()">Cerrar período y generar paquete</button><button class="ghost" onclick="downloadAccountingPackage()">Descargar paquete contable JSON</button><button class="ghost" onclick="downloadFinancialCSV()">Exportar balance CSV</button></div></div>`;
}
function closeAccountingPeriod(){
  const p=periodState(); if(p.status==='Cerrado') return alert('Este período ya está cerrado.');
  const checks=validationResults(); if(!checks.every(c=>c.ok)) return alert('No puedes cerrar: existen incidencias pendientes.');
  p.status='Cerrado'; p.closedAt=new Date().toISOString(); p.closedBy='Administrador Demo';
  db.audit.push({date:new Date().toISOString(),action:'Período contable cerrado',reference:p.label}); save(); render('closing'); alert('Período cerrado. Paquete contable listo.');
}
function accountingPackage(){
  const f=financialEngine();
  return {company:db.company.name,period:f.period,generatedAt:new Date().toISOString(),trialBalance:f.detail,incomeStatement:{income:f.income,expense:f.expense,netIncome:f.netIncome},balanceSheet:{assets:f.assets,liabilities:f.liabilities,equity:f.equity,netIncome:f.netIncome,difference:f.assets-(f.liabilities+f.equity+f.netIncome)},cashFlow:{cash:accountActivity('1100').balance,bank:accountActivity('1200').balance},validation:validationResults(),journal:periodEntries(),reconciliations:db.reconciliations||[],taxes:{ivuPayable:accountActivity('2300').balance}};
}
function downloadAccountingPackage(){
  const blob=new Blob([JSON.stringify(accountingPackage(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`paquete_contable_${periodState().id}.json`; a.click();
}
function downloadFinancialCSV(){
  const f=financialEngine();
  const rows=[['Cuenta','Tipo','Debitos','Creditos','Saldo normal'],...f.detail.map(a=>[`${a.code} ${a.name}`,a.type,a.debit,a.credit,a.balance]),['TOTAL','',f.debits,f.credits,f.trialDifference]];
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`balance_comprobacion_${periodState().id}.csv`; a.click();
}

function render(page){
  active=page;
  periodState();
  document.getElementById('pageTitle').textContent=navItems.find(n=>n[0]===page)?.[1]||'Dashboard';
  renderNav();
  const map={dashboard,chart,journal,ledger,invoices,ar,ap,banks,importTray,reconciliation,taxes,validation,financials,closing,settings};
  document.getElementById('content').innerHTML = (map[page]||dashboard)();
  if(page==='reconciliation') setTimeout(updateRecSummary,0);
}

// ===== v0.7 · Configuración completa de Empresa + Asiento de Apertura =====
function companyDefaults(){
  db.company ||= {};
  db.company.legalName ||= db.company.name || 'Nexus Demo LLC';
  db.company.tradeName ||= db.company.name || 'Nexus Demo LLC';
  db.company.ein ||= '';
  db.company.merchantRegistry ||= '';
  db.company.industry ||= 'Servicios profesionales';
  db.company.entityType ||= 'LLC';
  db.company.foundedDate ||= '';
  db.company.currency ||= 'USD';
  db.company.fiscalYear ||= 2026;
  db.company.fiscalStart ||= `${db.company.fiscalYear}-01-01`;
  db.company.fiscalEnd ||= `${db.company.fiscalYear}-12-31`;
  db.company.accountingMethod ||= 'Accrual';
  db.company.periodFrequency ||= 'Mensual';
  db.company.phone ||= '';
  db.company.email ||= '';
  db.company.website ||= '';
  db.company.address1 ||= '';
  db.company.address2 ||= '';
  db.company.city ||= '';
  db.company.state ||= 'PR';
  db.company.zip ||= '';
  db.company.country ||= 'Puerto Rico';
  db.company.logoData ||= '';
  db.company.primaryColor ||= '#0f2a52';
  db.company.accentColor ||= '#0f8a5f';
  db.company.invoicePrefix ||= 'INV';
  db.company.paymentPrefix ||= 'PAY';
  db.company.journalPrefix ||= 'JE';
  db.company.nextInvoice ||= 1;
  db.company.nextPayment ||= 1;
  db.company.nextJournal ||= 1;
  db.company.ivuEnabled = db.company.ivuEnabled ?? true;
  db.company.ivu = Number(db.company.ivu ?? 11.5);
  db.company.municipality ||= '';
  db.company.withholdingEnabled = db.company.withholdingEnabled ?? false;
  db.company.withholdingRate ||= 0;
  db.company.taxableSalesAccount ||= '4100';
  db.company.ivuPayableAccount ||= '2300';
  db.company.mainBankId ||= db.bankAccounts?.[0]?.id || 'bank-main';
  db.company.setupCompleted = db.company.setupCompleted ?? false;
  db.users ||= [{id:'u-admin',name:'Administrador Demo',email:'admin@nexuspr.com',role:'Administrador',status:'Activo'}];
  db.documents ||= [];
  db.openingBalances ||= {cash:0,bank:5000,ar:0,inventory:0,equipment:0,ap:0,loans:0,cards:0,capital:5000,retained:0};
  db.periods ||= [{id:'2026-06',year:2026,month:6,label:'Junio 2026',status:'Abierto',closedAt:null,closedBy:null}];
  db.activePeriod ||= db.periods[0]?.id || '2026-06';
  db.audit ||= [];
}
companyDefaults(); save();

function setupProgress(){
  companyDefaults();
  const c=db.company, ob=db.openingBalances||{};
  const steps=[
    {name:'Información general',ok:!!(c.tradeName && c.legalName && c.entityType && c.fiscalYear)},
    {name:'Contacto',ok:!!(c.phone || c.email || c.address1)},
    {name:'Configuración contable',ok:!!(c.accountingMethod && c.periodFrequency && c.invoicePrefix && c.journalPrefix)},
    {name:'Impuestos',ok:typeof c.ivu==='number' && c.ivu>=0},
    {name:'Bancos',ok:(db.bankAccounts||[]).length>0},
    {name:'Saldos iniciales',ok:Object.values(ob).some(v=>Number(v||0)!==0)},
    {name:'Período inicial',ok:(db.periods||[]).length>0 && !!db.activePeriod},
  ];
  const pct=Math.round((steps.filter(s=>s.ok).length/steps.length)*100);
  return {steps,pct};
}

function settings(){
  companyDefaults();
  const p=setupProgress();
  const c=db.company;
  const logo=c.logoData?`<img src="${c.logoData}" alt="Logo">`:'LOGO';
  return `<div class="grid two">
    <div class="card">
      <div class="section-title"><h3>Expediente Maestro de Empresa</h3><span class="badge ${p.pct===100?'green':'amber'}">${p.pct}% completo</span></div>
      <div class="progress"><span style="width:${p.pct}%"></span></div>
      <div class="step-list" style="margin-top:14px">${p.steps.map(s=>`<div class="step-item"><strong>${s.name}</strong>${s.ok?'<span class="badge green">OK</span>':'<span class="badge amber">Pendiente</span>'}</div>`).join('')}</div>
      <div class="actions"><button onclick="markSetupComplete()">Marcar configuración completada</button><button class="ghost" onclick="createOpeningPeriod()">Crear período inicial</button></div>
    </div>
    <div class="card">
      <div class="section-title"><h3>Identidad</h3><div class="logo-preview">${logo}</div></div>
      <div class="form-grid">
        <label>Logo<input type="file" accept="image/*" onchange="loadCompanyLogo(event)"></label>
        <label>Color principal<input id="cfgPrimaryColor" type="color" value="${c.primaryColor}"></label>
        <label>Nombre comercial<input id="cfgTradeName" value="${escapeAttr(c.tradeName)}"></label>
        <label>Razón social<input id="cfgLegalName" value="${escapeAttr(c.legalName)}"></label>
      </div>
    </div>
  </div>
  <div class="card config-section">
    <div class="section-title"><h3>Configuración completa</h3><button onclick="saveCompanySettings()">Guardar empresa</button></div>
    <div class="tabs"><span class="tab">General</span><span class="tab">Contacto</span><span class="tab">Contable</span><span class="tab">Impuestos</span><span class="tab">Bancos</span><span class="tab">Saldos iniciales</span></div>
    <h3>Información General</h3>
    <div class="form-grid">
      <label>Nombre comercial<input id="cfgName" value="${escapeAttr(c.tradeName)}"></label>
      <label>Razón social<input id="cfgLegal" value="${escapeAttr(c.legalName)}"></label>
      <label>EIN / Número patronal<input id="cfgEin" value="${escapeAttr(c.ein)}" placeholder="XX-XXXXXXX"></label>
      <label>Registro de Comerciante<input id="cfgMerchant" value="${escapeAttr(c.merchantRegistry)}"></label>
      <label>Industria<input id="cfgIndustry" value="${escapeAttr(c.industry)}"></label>
      <label>Tipo de entidad<select id="cfgEntity">${['Individuo','LLC','Corporación','Partnership','Non-Profit'].map(x=>`<option ${c.entityType===x?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>Fecha constitución<input id="cfgFounded" type="date" value="${c.foundedDate}"></label>
      <label>Moneda<select id="cfgCurrency"><option ${c.currency==='USD'?'selected':''}>USD</option></select></label>
    </div>
    <h3>Información de Contacto</h3>
    <div class="form-grid">
      <label>Dirección física<input id="cfgAddress1" value="${escapeAttr(c.address1)}"></label>
      <label>Dirección postal<input id="cfgAddress2" value="${escapeAttr(c.address2)}"></label>
      <label>Ciudad<input id="cfgCity" value="${escapeAttr(c.city)}"></label>
      <label>Estado<input id="cfgState" value="${escapeAttr(c.state)}"></label>
      <label>Código postal<input id="cfgZip" value="${escapeAttr(c.zip)}"></label>
      <label>País<input id="cfgCountry" value="${escapeAttr(c.country)}"></label>
      <label>Teléfono<input id="cfgPhone" value="${escapeAttr(c.phone)}"></label>
      <label>Email<input id="cfgEmail" value="${escapeAttr(c.email)}"></label>
      <label class="full">Website<input id="cfgWebsite" value="${escapeAttr(c.website)}"></label>
    </div>
    <h3>Configuración Contable</h3>
    <div class="form-grid">
      <label>Método contable<select id="cfgMethod"><option ${c.accountingMethod==='Efectivo'?'selected':''}>Efectivo</option><option ${c.accountingMethod==='Accrual'?'selected':''}>Accrual</option></select></label>
      <label>Frecuencia de período<select id="cfgPeriodFreq"><option ${c.periodFrequency==='Mensual'?'selected':''}>Mensual</option><option ${c.periodFrequency==='Trimestral'?'selected':''}>Trimestral</option><option ${c.periodFrequency==='Anual'?'selected':''}>Anual</option></select></label>
      <label>Año fiscal<input id="cfgFiscalYear" type="number" value="${c.fiscalYear}"></label>
      <label>Banco principal<select id="cfgMainBank">${(db.bankAccounts||[]).map(b=>`<option value="${b.id}" ${c.mainBankId===b.id?'selected':''}>${b.name}</option>`).join('')}</select></label>
      <label>Prefijo facturas<input id="cfgInvPrefix" value="${escapeAttr(c.invoicePrefix)}"></label>
      <label>Próxima factura<input id="cfgNextInv" type="number" value="${c.nextInvoice}"></label>
      <label>Prefijo pagos<input id="cfgPayPrefix" value="${escapeAttr(c.paymentPrefix)}"></label>
      <label>Prefijo asientos<input id="cfgJePrefix" value="${escapeAttr(c.journalPrefix)}"></label>
    </div>
    <h3>Impuestos Puerto Rico</h3>
    <div class="form-grid">
      <label>IVU activo<select id="cfgIvuEnabled"><option value="true" ${c.ivuEnabled?'selected':''}>Sí</option><option value="false" ${!c.ivuEnabled?'selected':''}>No</option></select></label>
      <label>IVU %<input id="cfgIvu" type="number" step="0.01" value="${c.ivu}"></label>
      <label>Municipio<input id="cfgMunicipality" value="${escapeAttr(c.municipality)}"></label>
      <label>Retenciones<select id="cfgWhEnabled"><option value="false" ${!c.withholdingEnabled?'selected':''}>No</option><option value="true" ${c.withholdingEnabled?'selected':''}>Sí</option></select></label>
      <label>Retención %<input id="cfgWhRate" type="number" step="0.01" value="${c.withholdingRate}"></label>
      <label>Cuenta IVU por pagar<select id="cfgIvuAcc">${accountOptions('liability')}</select></label>
    </div>
    <div class="actions"><button onclick="saveCompanySettings()">Guardar empresa</button></div>
  </div>
  <div class="grid two config-section">
    <div class="card"><div class="section-title"><h3>Cuentas Bancarias</h3><button onclick="addBankAccountConfig()">+ Banco</button></div>${bankConfigTable()}${bankConfigForm()}</div>
    <div class="card"><div class="section-title"><h3>Saldos Iniciales</h3><button onclick="saveOpeningBalances()">Generar asiento de apertura</button></div>${openingBalancesForm()}</div>
  </div>
  <div class="grid two config-section">
    <div class="card"><div class="section-title"><h3>Usuarios y Roles</h3><button onclick="addUserConfig()">+ Usuario</button></div>${usersConfigTable()}</div>
    <div class="card"><div class="section-title"><h3>Documentos Corporativos</h3><button onclick="addDocumentConfig()">Registrar documento</button></div>${documentsConfigTable()}</div>
  </div>`;
}

function escapeAttr(v){ return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function saveCompanySettings(){
  companyDefaults();
  const c=db.company;
  c.name=cfgName.value.trim() || cfgTradeName.value.trim() || c.name;
  c.tradeName=cfgName.value.trim() || cfgTradeName.value.trim() || c.tradeName;
  c.legalName=cfgLegal.value.trim() || cfgLegalName.value.trim() || c.legalName;
  c.ein=cfgEin.value.trim(); c.merchantRegistry=cfgMerchant.value.trim(); c.industry=cfgIndustry.value.trim(); c.entityType=cfgEntity.value;
  c.foundedDate=cfgFounded.value; c.currency=cfgCurrency.value; c.address1=cfgAddress1.value.trim(); c.address2=cfgAddress2.value.trim();
  c.city=cfgCity.value.trim(); c.state=cfgState.value.trim(); c.zip=cfgZip.value.trim(); c.country=cfgCountry.value.trim(); c.phone=cfgPhone.value.trim(); c.email=cfgEmail.value.trim(); c.website=cfgWebsite.value.trim();
  c.accountingMethod=cfgMethod.value; c.periodFrequency=cfgPeriodFreq.value; c.fiscalYear=Number(cfgFiscalYear.value||new Date().getFullYear()); c.mainBankId=cfgMainBank.value;
  c.invoicePrefix=cfgInvPrefix.value.trim()||'INV'; c.paymentPrefix=cfgPayPrefix.value.trim()||'PAY'; c.journalPrefix=cfgJePrefix.value.trim()||'JE'; c.nextInvoice=Number(cfgNextInv.value||1);
  c.ivuEnabled=cfgIvuEnabled.value==='true'; c.ivu=Number(cfgIvu.value||0); c.municipality=cfgMunicipality.value.trim(); c.withholdingEnabled=cfgWhEnabled.value==='true'; c.withholdingRate=Number(cfgWhRate.value||0);
  c.primaryColor=cfgPrimaryColor.value; document.documentElement.style.setProperty('--brand',c.primaryColor);
  db.audit.push({date:new Date().toISOString(),action:'Configuración de empresa actualizada',reference:c.tradeName});
  save(); document.getElementById('companyLabel').textContent=`${c.tradeName} · Año Fiscal ${c.fiscalYear}`; render('settings');
}
function loadCompanyLogo(ev){
  const file=ev.target.files?.[0]; if(!file) return;
  const reader=new FileReader(); reader.onload=()=>{ db.company.logoData=reader.result; save(); render('settings'); }; reader.readAsDataURL(file);
}
function bankConfigTable(){
  if(!db.bankAccounts?.length) return '<div class="empty">No hay cuentas bancarias.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Banco</th><th>Tipo</th><th>Últimos 4</th><th>Cuenta contable</th><th>Balance libro</th></tr></thead><tbody>${db.bankAccounts.map(b=>`<tr><td>${b.name}</td><td>${b.type||'Operacional'}</td><td>${b.last4||'----'}</td><td>${b.account}</td><td>${money(balanceByAccount(b.account))}</td></tr>`).join('')}</tbody></table></div>`;
}
function bankConfigForm(){ return `<hr><div class="form-grid"><label>Banco<input id="newBankName" placeholder="Banco Popular"></label><label>Tipo<select id="newBankType"><option>Operacional</option><option>Ahorro</option><option>Tarjeta</option><option>Procesador</option></select></label><label>Últimos 4<input id="newBankLast4" maxlength="4" placeholder="1234"></label><label>Balance inicial<input id="newBankOpening" type="number" step="0.01" value="0"></label></div>`; }
function addBankAccountConfig(){
  companyDefaults(); const name=newBankName.value.trim(); if(!name) return alert('Escribe el nombre del banco.');
  const id=crypto.randomUUID(); db.bankAccounts.push({id,name,type:newBankType.value,last4:newBankLast4.value.trim(),account:'1200',balance:Number(newBankOpening.value||0),currency:'USD'});
  db.company.mainBankId ||= id; db.audit.push({date:new Date().toISOString(),action:'Cuenta bancaria creada',reference:name}); save(); render('settings');
}
function openingBalancesForm(){
  const o=db.openingBalances||{};
  const fields=[['cash','Caja'],['bank','Bancos'],['ar','Cuentas por cobrar'],['inventory','Inventario'],['equipment','Equipos'],['ap','Cuentas por pagar'],['loans','Préstamos'],['cards','Tarjetas'],['capital','Capital aportado'],['retained','Utilidades retenidas']];
  return `<p class="muted">Estos saldos crean el asiento de apertura. Debe cuadrar: Activos = Pasivos + Capital.</p><div class="form-grid">${fields.map(([k,l])=>`<label>${l}<input id="ob_${k}" type="number" step="0.01" value="${Number(o[k]||0)}"></label>`).join('')}</div><hr><div id="openingCheck">${openingBalanceCheck()}</div>`;
}
function openingBalanceCheck(){
  const o=db.openingBalances||{}; const assets=Number(o.cash||0)+Number(o.bank||0)+Number(o.ar||0)+Number(o.inventory||0)+Number(o.equipment||0); const liab=Number(o.ap||0)+Number(o.loans||0)+Number(o.cards||0); const eq=Number(o.capital||0)+Number(o.retained||0); const diff=assets-liab-eq;
  return `<div class="grid three"><div class="mini-stat"><span>Activos</span><strong>${money(assets)}</strong></div><div class="mini-stat"><span>Pasivos + Capital</span><strong>${money(liab+eq)}</strong></div><div class="mini-stat"><span>Diferencia</span><strong class="${Math.abs(diff)<.01?'positive':'warning'}">${money(diff)}</strong></div></div>`;
}
function saveOpeningBalances(){
  const keys=['cash','bank','ar','inventory','equipment','ap','loans','cards','capital','retained'];
  db.openingBalances={}; keys.forEach(k=>db.openingBalances[k]=Number(document.getElementById('ob_'+k).value||0));
  const o=db.openingBalances; const assets=o.cash+o.bank+o.ar+o.inventory+o.equipment; const liab=o.ap+o.loans+o.cards; const eq=o.capital+o.retained; const diff=assets-liab-eq;
  if(Math.abs(diff)>.01) return alert(`El asiento de apertura no cuadra. Diferencia: ${money(diff)}`);
  db.entries = db.entries.filter(e=>e.reference!=='OPENING-BALANCE');
  const lines=[]; if(o.cash) lines.push(line('1100',o.cash,0)); if(o.bank) lines.push(line('1200',o.bank,0)); if(o.ar) lines.push(line('1300',o.ar,0)); if(o.inventory) lines.push(line('1400',o.inventory,0)); if(o.equipment) lines.push(line('1500',o.equipment,0));
  if(o.ap) lines.push(line('2100',0,o.ap)); if(o.loans) lines.push(line('2200',0,o.loans)); if(o.cards) lines.push(line('2200',0,o.cards)); if(o.capital) lines.push(line('3100',0,o.capital)); if(o.retained) lines.push(line('3200',0,o.retained));
  if(lines.length) postEntry(entry(db.company.fiscalStart||`${db.company.fiscalYear}-01-01`,'Asiento de apertura de empresa','OPENING-BALANCE',lines));
  db.audit.push({date:new Date().toISOString(),action:'Asiento de apertura generado',reference:'OPENING-BALANCE'}); save(); render('settings');
}
function createOpeningPeriod(){
  companyDefaults(); const y=Number(db.company.fiscalYear||new Date().getFullYear()); const id=`${y}-01`; const label=`Enero ${y}`;
  if(!db.periods.some(p=>p.id===id)) db.periods.unshift({id,year:y,month:1,label,status:'Abierto',closedAt:null,closedBy:null});
  db.activePeriod=id; db.audit.push({date:new Date().toISOString(),action:'Período inicial creado',reference:label}); save(); render('settings');
}
function markSetupComplete(){ const p=setupProgress(); if(p.pct<100 && !confirm('La configuración no está al 100%. ¿Marcar como completada de todos modos?')) return; db.company.setupCompleted=true; db.audit.push({date:new Date().toISOString(),action:'Configuración inicial completada',reference:db.company.tradeName}); save(); render('settings'); }
function usersConfigTable(){ return `<div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead><tbody>${(db.users||[]).map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td><span class="badge">${u.role}</span></td><td>${u.status}</td></tr>`).join('')}</tbody></table></div>`; }
function addUserConfig(){ const name=prompt('Nombre del usuario:'); if(!name) return; const email=prompt('Email:')||''; const role=prompt('Rol: Administrador, Contador, Auditor, Usuario','Usuario')||'Usuario'; db.users.push({id:crypto.randomUUID(),name,email,role,status:'Activo'}); save(); render('settings'); }
function documentsConfigTable(){ if(!db.documents?.length) return '<div class="empty">Sin documentos registrados. Aquí se listarán registros, certificados y documentos contables de apertura.</div>'; return `<div class="table-wrap"><table class="table"><thead><tr><th>Tipo</th><th>Nombre</th><th>Fecha</th></tr></thead><tbody>${db.documents.map(d=>`<tr><td>${d.type}</td><td>${d.name}</td><td>${d.date}</td></tr>`).join('')}</tbody></table></div>`; }
function addDocumentConfig(){ const type=prompt('Tipo de documento:'); if(!type) return; const name=prompt('Nombre o descripción:')||type; db.documents.push({id:crypto.randomUUID(),type,name,date:today()}); save(); render('settings'); }

const originalResetDemoV07 = resetDemo;
resetDemo = function(){ if(confirm('Esto reinicia la demo local.')){ localStorage.removeItem('nexusAccountingPR'); db=load(); companyDefaults(); save(); render('dashboard'); } };

// ===== v0.8 · Accounting Engine + Firebase DEV adapter =====
(function bootV08(){
  if(!navItems.some(n=>n[0]==='engine')) navItems.splice(2,0,['engine','Motor Contable']);
  if(!navItems.some(n=>n[0]==='firebase')) navItems.push(['firebase','Firebase DEV']);
  migrateV08();
})();

function migrateV08(){
  db.meta ||= {};
  db.meta.version = '0.8.1';
  db.company ||= {};
  db.company.id ||= 'dev-company';
  db.company.operatingStatus ||= db.company.setupCompleted ? 'Operativo' : 'Configuración';
  db.sequences ||= { invoice: Number(db.company.nextInvoice||1), payment: Number(db.company.nextPayment||1), journal: Number(db.company.nextJournal||1), reconciliation: 1 };
  db.engineTransactions ||= [];
  db.incidents ||= [];
  db.firebase ||= { enabled:false, projectId:'oasis-visit-card', lastSync:null, mode:'DEV' };
  db.companyTemplates ||= defaultCompanyTemplates();
  save();
}

function defaultCompanyTemplates(){
  return [
    {id:'services',name:'Servicios',accounts:['4100 Servicios','5100 Materiales','5200 Combustible','5500 Cargos Bancarios']},
    {id:'commerce',name:'Comercio',accounts:['4100 Ventas','1400 Inventario','5100 Costo de ventas']},
    {id:'construction',name:'Construcción',accounts:['4100 Contratos','5100 Materiales','5600 Subcontratistas']},
    {id:'professional',name:'Profesional',accounts:['4200 Honorarios','5400 Publicidad','5300 Renta']},
    {id:'custom',name:'Personalizado',accounts:[]}
  ];
}

const NexusAccountingEngine = {
  post({type,date=today(),description,reference,lines,source='manual',payload={}}){
    if(!description) throw new Error('Falta descripción.');
    const debit = lines.reduce((s,l)=>s+Number(l.debit||0),0);
    const credit = lines.reduce((s,l)=>s+Number(l.credit||0),0);
    if(Math.round(debit*100)!==Math.round(credit*100)) throw new Error('La transacción no cuadra.');
    const ref = reference || nextSequence('journal');
    const e = entry(date, description, ref, lines);
    e.periodId = db.activePeriod;
    e.source = source;
    e.transactionType = type;
    postEntry(e);
    db.engineTransactions.push({id:crypto.randomUUID(),type,date,description,reference:ref,source,payload,entryId:e.id,createdAt:new Date().toISOString()});
    audit('Motor contable: transacción registrada', ref, {type,description});
    validateAccountingIntegrity();
    save();
    return e;
  },
  invoice({customer='Cliente',subtotal=0,taxRate=db.company.ivu||0,date=today()}){
    const tax = Number(subtotal||0) * Number(taxRate||0) / 100;
    const total = Number(subtotal||0) + tax;
    const invNo = nextSequence('invoice');
    db.invoices.push({id:crypto.randomUUID(),number:invNo,customer,date,subtotal,tax,total,status:'Pendiente',periodId:db.activePeriod});
    return this.post({type:'invoice',date,description:`Factura ${invNo} - ${customer}`,reference:invNo,source:'invoice',payload:{customer,subtotal,tax,total},lines:[line('1300',total,0),line('4100',0,subtotal),line('2300',0,tax)]});
  },
  receipt({customer='Cliente',amount=0,bankAccount='1200',date=today(),reference}){
    return this.post({type:'receipt',date,description:`Cobro recibido - ${customer}`,reference:reference||nextSequence('payment'),source:'payment',payload:{customer,amount},lines:[line(bankAccount,amount,0),line('1300',0,amount)]});
  },
  expense({category='5500',amount=0,bankAccount='1200',description='Gasto',date=today(),reference}){
    return this.post({type:'expense',date,description,reference:reference||nextSequence('journal'),source:'expense',payload:{category,amount},lines:[line(category,amount,0),line(bankAccount,0,amount)]});
  },
  bankFee({amount=0,date=today(),description='Cargo bancario',bankAccount='1200'}){
    return this.expense({category:'5500',amount,bankAccount,description,date,reference:nextSequence('journal')});
  },
  interest({amount=0,date=today(),bankAccount='1200'}){
    return this.post({type:'interest',date,description:'Interés bancario',reference:nextSequence('journal'),source:'bank_adjustment',payload:{amount},lines:[line(bankAccount,amount,0),line('4300',0,amount)]});
  }
};

function nextSequence(kind){
  migrateV08();
  const map={invoice:['invoice',db.company.invoicePrefix||'INV'],payment:['payment',db.company.paymentPrefix||'PAY'],journal:['journal',db.company.journalPrefix||'JE'],reconciliation:['reconciliation','REC']};
  const [key,prefix]=map[kind]||map.journal;
  const n=Number(db.sequences[key]||1);
  db.sequences[key]=n+1;
  return `${prefix}-${db.company.fiscalYear||new Date().getFullYear()}-${String(n).padStart(6,'0')}`;
}
function audit(action,reference,details={}){ db.audit ||= []; db.audit.push({date:new Date().toISOString(),action,reference,details,user:'local-dev'}); }

function validateAccountingIntegrity(){
  db.incidents=[];
  for(const e of db.entries||[]){
    const d=e.lines.reduce((s,l)=>s+Number(l.debit||0),0), c=e.lines.reduce((s,l)=>s+Number(l.credit||0),0);
    if(Math.round(d*100)!==Math.round(c*100)) db.incidents.push({id:crypto.randomUUID(),severity:'alta',type:'asiento_descuadrado',reference:e.reference,message:`Asiento descuadrado: ${e.reference}`});
    if(!e.periodId && e.reference!=='OPENING-BALANCE') db.incidents.push({id:crypto.randomUUID(),severity:'media',type:'sin_periodo',reference:e.reference,message:`Asiento sin período: ${e.reference}`});
  }
  const p=setupProgress?.();
  if(p && p.pct<100) db.incidents.push({id:'setup-incomplete',severity:'media',type:'configuracion',reference:'SETUP',message:`Configuración incompleta: ${p.pct}%`});
  const unrecon = unreconciledCount?.() || 0;
  if(unrecon>0) db.incidents.push({id:'unreconciled',severity:'baja',type:'reconciliacion',reference:'BANK',message:`Movimientos bancarios sin reconciliar: ${unrecon}`});
  save();
  return db.incidents;
}

function engine(){
  migrateV08();
  const inc=validateAccountingIntegrity();
  const trial=trialBalanceRows?.() || [];
  const debit=trial.reduce((s,r)=>s+Number(r.debit||0),0), credit=trial.reduce((s,r)=>s+Number(r.credit||0),0);
  return `<div class="grid three">
    ${kpi('Asientos',db.entries.length,'Fuente oficial: Libro Diario','')}
    ${kpi('Débitos',debit,'Balance de comprobación','')}
    ${kpi('Créditos',credit,'Debe cuadrar con débitos',Math.round(debit*100)===Math.round(credit*100)?'':'warning')}
  </div>
  <div class="grid two config-section">
    <div class="card"><div class="section-title"><h3>Accounting Engine</h3><span class="badge green">Doble partida activa</span></div>
      <p class="muted">Toda operación genera asiento en Libro Diario y alimenta Libro Mayor, estados financieros, validación y cierre mensual.</p>
      <div class="actions wrap">
        <button onclick="engineDemoInvoice()">Crear factura demo</button>
        <button onclick="engineDemoReceipt()">Registrar cobro demo</button>
        <button onclick="engineDemoExpense()">Registrar gasto demo</button>
        <button onclick="engineDemoFee()">Ajuste cargo bancario</button>
      </div>
    </div>
    <div class="card"><div class="section-title"><h3>Incidencias Contables</h3><span class="badge ${inc.length?'amber':'green'}">${inc.length} pendientes</span></div>
      ${inc.length?`<div class="step-list">${inc.map(i=>`<div class="step-item"><strong>${i.message}</strong><span class="badge ${i.severity==='alta'?'red':i.severity==='media'?'amber':'blue'}">${i.severity}</span></div>`).join('')}</div>`:'<div class="empty">No hay incidencias críticas. El motor contable está estable.</div>'}
    </div>
  </div>
  <div class="card config-section"><div class="section-title"><h3>Últimas transacciones del motor</h3><button onclick="exportAccountingPackage()">Exportar paquete contable JSON</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Descripción</th><th>Origen</th></tr></thead><tbody>${(db.engineTransactions||[]).slice(-12).reverse().map(t=>`<tr><td>${t.date}</td><td>${t.type}</td><td>${t.reference}</td><td>${t.description}</td><td>${t.source}</td></tr>`).join('')||'<tr><td colspan="5">Sin transacciones nuevas del motor.</td></tr>'}</tbody></table></div>
  </div>`;
}
function engineDemoInvoice(){ try{ NexusAccountingEngine.invoice({customer:'Cliente Demo',subtotal:1000}); save(); render('engine'); }catch(e){ alert(e.message); } }
function engineDemoReceipt(){ try{ NexusAccountingEngine.receipt({customer:'Cliente Demo',amount:1115}); save(); render('engine'); }catch(e){ alert(e.message); } }
function engineDemoExpense(){ try{ NexusAccountingEngine.expense({category:'5200',amount:75,description:'Combustible operacional'}); save(); render('engine'); }catch(e){ alert(e.message); } }
function engineDemoFee(){ try{ NexusAccountingEngine.bankFee({amount:15}); save(); render('engine'); }catch(e){ alert(e.message); } }

function firebase(){
  migrateV08();
  const f=db.firebase||{};
  return `<div class="grid two">
    <div class="card"><div class="section-title"><h3>Firebase DEV</h3><span class="badge blue">${f.projectId||'oasis-visit-card'}</span></div>
      <p class="muted">Este panel prepara Nexus Accounting PR para Firebase Auth, Firestore, Storage y Hosting. La configuración puede cargarse sin exponerla en el código principal.</p>
      <div class="form-grid">
        <label>API Key<input id="fbApiKey" value="${escapeAttr(f.apiKey||'')}"></label>
        <label>Auth Domain<input id="fbAuthDomain" value="${escapeAttr(f.authDomain||'oasis-visit-card.firebaseapp.com')}"></label>
        <label>Project ID<input id="fbProjectId" value="${escapeAttr(f.projectId||'oasis-visit-card')}"></label>
        <label>Storage Bucket<input id="fbStorage" value="${escapeAttr(f.storageBucket||'oasis-visit-card.firebasestorage.app')}"></label>
        <label>Sender ID<input id="fbSender" value="${escapeAttr(f.messagingSenderId||'')}"></label>
        <label>App ID<input id="fbAppId" value="${escapeAttr(f.appId||'')}"></label>
      </div>
      <div class="actions wrap"><button onclick="saveFirebaseConfigLocal()">Guardar config local</button><button onclick="testFirebaseConnection()">Probar conexión</button><button onclick="syncCompanyToFirestore()">Sincronizar empresa</button><button onclick="downloadFirebaseRules()">Ver reglas incluidas</button></div>
      <small>Modo actual: ${f.mode||'DEV'} · Última sincronización: ${f.lastSync||'Nunca'}</small>
      <p class="muted"><strong>Nota:</strong> pega los valores sin comillas ni coma. Si los pegas con formato de consola, la app ahora los limpia automáticamente. Para DEV activa Authentication → Anonymous.</p>
    </div>
    <div class="card"><h3>Estructura Firestore</h3><pre class="code-block">companies/{companyId}
  settings/main
  users/{uid}
  chart_accounts/{code}
  bank_accounts/{bankId}
  periods/{periodId}
  journal_entries/{entryId}
  audit_logs/{logId}</pre></div>
  </div>`;
}
function cleanFirebaseValue(value){
  let v=String(value||'').trim();
  // Limpia valores copiados directo desde Firebase Console: comillas, comas, punto y coma, llaves, etiquetas y comillas curvas.
  v=v.replace(/[“”]/g,'\"').replace(/[‘’]/g,"'").trim();
  v=v.replace(/^\s*[a-zA-Z0-9_]+\s*:\s*/,'');
  v=v.replace(/[{}]/g,'').trim();
  v=v.replace(/^[`'\"]+|[`'\",;]+$/g,'').trim();
  return v;
}
function normalizeFirebaseConfig(raw){
  return {
    apiKey: cleanFirebaseValue(raw.apiKey),
    authDomain: cleanFirebaseValue(raw.authDomain),
    projectId: cleanFirebaseValue(raw.projectId),
    storageBucket: cleanFirebaseValue(raw.storageBucket),
    messagingSenderId: cleanFirebaseValue(raw.messagingSenderId),
    appId: cleanFirebaseValue(raw.appId)
  };
}
function validateFirebaseConfig(cfg){
  if(!cfg.apiKey || !cfg.apiKey.startsWith('AIza')) throw new Error('API Key inválida. Pega solo el valor que empieza con AIza, sin comillas ni coma.');
  if(!cfg.projectId) throw new Error('Falta Project ID.');
  if(!cfg.appId || !cfg.appId.includes(':web:')) throw new Error('App ID inválido.');
}
function saveFirebaseConfigLocal(){
  try{
    const cleaned=normalizeFirebaseConfig({apiKey:fbApiKey.value,authDomain:fbAuthDomain.value,projectId:fbProjectId.value,storageBucket:fbStorage.value,messagingSenderId:fbSender.value,appId:fbAppId.value});
    validateFirebaseConfig(cleaned);
    db.firebase={enabled:true,mode:'DEV',...cleaned,lastSync:db.firebase?.lastSync||null};
    save(); alert('Configuración Firebase guardada localmente y saneada.'); render('firebase');
  }catch(e){ alert(e.message); }
}
let nexusFirebaseApp = null;
async function getFirebaseServices(){
  const cfg=db.firebase||{};
  if(!cfg.apiKey || !cfg.projectId || !cfg.appId) throw new Error('Falta completar la configuración Firebase.');
  const { initializeApp, getApps, getApp, deleteApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const { getAuth, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
  const firebaseConfig=normalizeFirebaseConfig(cfg);
  validateFirebaseConfig(firebaseConfig);
  const appName='nexus-accounting-dev';
  const existing=getApps().find(app=>app.name===appName);
  if(existing){
    const current=existing.options||{};
    if(current.projectId!==firebaseConfig.projectId || current.appId!==firebaseConfig.appId || current.apiKey!==firebaseConfig.apiKey){
      await deleteApp(existing);
      nexusFirebaseApp=initializeApp(firebaseConfig,appName);
    }else{
      nexusFirebaseApp=getApp(appName);
    }
  }else{
    nexusFirebaseApp=initializeApp(firebaseConfig,appName);
  }
  const auth=getAuth(nexusFirebaseApp);
  if(!auth.currentUser){
    try{ await signInAnonymously(auth); }
    catch(err){ throw new Error('Firebase Auth no está activo. En Firebase Console activa Authentication → Sign-in method → Anonymous. Detalle: '+err.message); }
  }
  const firestore=getFirestore(nexusFirebaseApp);
  return {auth,firestore,doc,setDoc};
}
async function testFirebaseConnection(){
  try{
    const s=await getFirebaseServices();
    alert('Conexión Firebase OK. UID DEV: '+s.auth.currentUser.uid);
  }catch(e){ alert('Prueba fallida: '+e.message); }
}
async function syncCompanyToFirestore(){
  try{
    const s=await getFirebaseServices(); const companyId=db.company.id||'dev-company'; const uid=s.auth.currentUser.uid;
    await s.setDoc(s.doc(s.firestore,'companies',companyId),{...db.company,ownerUid:uid,updatedAt:new Date().toISOString(),source:'Nexus Accounting PR v0.8.1'},{merge:true});
    await s.setDoc(s.doc(s.firestore,'companies',companyId,'users',uid),{uid,email:s.auth.currentUser.email||'anonymous-dev',role:'Administrador',status:'Activo',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{merge:true});
    await s.setDoc(s.doc(s.firestore,'companies',companyId,'settings','main'),{sequences:db.sequences,activePeriod:db.activePeriod,setupProgress:setupProgress().pct,updatedAt:new Date().toISOString()},{merge:true});
    for(const a of db.accounts) await s.setDoc(s.doc(s.firestore,'companies',companyId,'chart_accounts',String(a.code)),a,{merge:true});
    for(const b of db.bankAccounts||[]) await s.setDoc(s.doc(s.firestore,'companies',companyId,'bank_accounts',String(b.id)),b,{merge:true});
    for(const p of db.periods||[]) await s.setDoc(s.doc(s.firestore,'companies',companyId,'periods',String(p.id)),p,{merge:true});
    for(const e of (db.entries||[]).slice(-100)) await s.setDoc(s.doc(s.firestore,'companies',companyId,'journal_entries',String(e.id)),e,{merge:true});
    db.firebase.lastSync=new Date().toISOString(); audit('Firebase sync ejecutado',companyId,{projectId:db.firebase.projectId,uid}); save(); alert('Sincronización completada. Revisa Firestore: companies/'+companyId); render('firebase');
  }catch(e){ alert('No se pudo sincronizar: '+e.message); }
}
function downloadFirebaseRules(){ alert('El ZIP incluye reglas actualizadas. Importante: publica firestore.rules antes de sincronizar datos reales.'); }
function exportAccountingPackage(){
  const pack={version:'0.8.1',company:db.company,period:db.activePeriod,accounts:db.accounts,entries:db.entries,trialBalance:trialBalanceRows?.()||[],incidents:db.incidents,audit:db.audit,exportedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`nexus_accounting_package_${db.activePeriod||'period'}_v0.8.1.json`; a.click();
}

const renderV07 = render;
render = function(page){
  migrateV08(); active=page; periodState?.();
  document.getElementById('pageTitle').textContent=navItems.find(n=>n[0]===page)?.[1]||'Dashboard';
  renderNav();
  const map={dashboard,chart,engine,journal,ledger,invoices,ar,ap,banks,importTray,reconciliation,taxes,validation,financials,closing,settings,firebase};
  document.getElementById('content').innerHTML = (map[page]||dashboard)();
  if(page==='reconciliation') setTimeout(updateRecSummary,0);
};

const loginV08 = login;
login = function(){ migrateV08(); document.getElementById('loginView').classList.add('hidden'); document.getElementById('appView').classList.remove('hidden'); renderNav(); render('dashboard'); };
