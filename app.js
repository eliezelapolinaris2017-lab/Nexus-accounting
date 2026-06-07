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
  reconciliations:[], entries:[], audit:[]
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
  return `<div class="grid two"><div class="card"><div class="section-title"><h3>Reconciliación Bancaria</h3><button onclick="finalizeReconciliation()">Cerrar reconciliación</button></div><div class="form-grid"><label>Banco<input id="recBank" value="${b.name}" disabled></label><label>Fecha del estado<input id="recDate" type="date" value="${today()}"></label><label>Balance según banco<input id="recStatement" type="number" step="0.01" value="${balanceByAccount(b.account).toFixed(2)}" oninput="updateRecSummary()"></label><label>Cuenta contable<input value="${b.account} · ${account(b.account).name}" disabled></label></div><hr><div id="recSummary">${reconciliationSummaryHtml()}</div></div><div class="card"><h3>Movimientos pendientes de reconciliar</h3>${open.length?`<div class="table-wrap"><table class="table"><thead><tr><th></th><th>Fecha</th><th>Ref.</th><th>Concepto</th><th>Entrada</th><th>Salida</th></tr></thead><tbody>${open.map(r=>`<tr><td><input class="rec-check" type="checkbox" value="${r.key}" onchange="updateRecSummary()" checked></td><td>${r.date}</td><td>${r.reference}</td><td>${r.concept}</td><td>${r.amount>0?money(r.amount):'-'}</td><td>${r.amount<0?money(Math.abs(r.amount)):'-'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No hay movimientos pendientes. Banco limpio, como debe ser.</div>'}</div></div>`;
}
function selectedRecRows(){ const keys=[...document.querySelectorAll('.rec-check:checked')].map(x=>x.value); const all=bankLines(db.bankAccounts[0].account); return all.filter(r=>keys.includes(r.key)); }
function reconciliationSummary(){ const statement=Number(document.getElementById('recStatement')?.value||0); const selected=selectedRecRows(); const cleared=selected.reduce((s,r)=>s+r.amount,0); const difference=statement-cleared; return {statement,cleared,difference,selected}; }
function reconciliationSummaryHtml(){ return `<div class="grid three"><div class="mini-stat"><span>Balance banco</span><strong id="recStatementView">$0.00</strong></div><div class="mini-stat"><span>Movimientos marcados</span><strong id="recClearedView">$0.00</strong></div><div class="mini-stat"><span>Diferencia</span><strong id="recDiffView">$0.00</strong></div></div><div class="actions"><button class="ghost" onclick="createBankAdjustment()">Crear ajuste por diferencia</button></div>`; }
function updateRecSummary(){ const r=reconciliationSummary(); document.getElementById('recStatementView').textContent=money(r.statement); document.getElementById('recClearedView').textContent=money(r.cleared); const diff=document.getElementById('recDiffView'); diff.textContent=money(r.difference); diff.className=Math.abs(r.difference)<.01?'positive':'warning'; }
function createBankAdjustment(){ try{ const r=reconciliationSummary(); if(Math.abs(r.difference)<.01) return alert('No hay diferencia para ajustar.'); const ref=`ADJ-BANK-${Date.now().toString().slice(-6)}`; if(r.difference>0){ postEntry(entry(today(),'Ajuste reconciliación: ingreso bancario no registrado',ref,[line('1200',r.difference,0),line('4300',0,r.difference)])); } else { const amt=Math.abs(r.difference); postEntry(entry(today(),'Ajuste reconciliación: cargo bancario no registrado',ref,[line('5500',amt,0),line('1200',0,amt)])); } render('reconciliation'); }catch(e){ alert(e.message); } }
function finalizeReconciliation(){ try{ const r=reconciliationSummary(); if(Math.abs(r.difference)>=.01 && !confirm('La reconciliación tiene diferencia. ¿Deseas cerrarla de todos modos?')) return; const b=db.bankAccounts[0]; db.reconciliations.push({id:crypto.randomUUID(),bankAccountId:b.id,bankName:b.name,statementDate:recDate.value,statementBalance:r.statement,clearedBalance:r.cleared,difference:r.difference,clearedKeys:r.selected.map(x=>x.key),status:Math.abs(r.difference)<.01?'Cuadrada':'Cerrada con diferencia',createdAt:new Date().toISOString()}); db.audit.push({date:new Date().toISOString(),action:'Reconciliación bancaria cerrada',reference:b.name}); save(); render('reconciliation'); }catch(e){ alert(e.message); } }

function taxes(){ const ivuPayable=balanceByAccount('2300'); return `<div class="grid three"><div class="card kpi"><div class="label">IVU Configurado</div><div class="value">${db.company.ivu}%</div><div class="sub">Puerto Rico</div></div>${kpi('IVU por Pagar',ivuPayable,'Generado por facturas','warning')}<div class="card"><h3>Resumen</h3><p>El IVU se calcula automáticamente desde facturación y se acredita a IVU por Pagar.</p></div></div>`; }
function financials(){ const t=totals(); return `<div class="grid two"><div class="card"><h3>Estado de Resultados</h3><table class="table"><tr><td>Ingresos</td><td>${money(t.income)}</td></tr><tr><td>Gastos</td><td>${money(t.expense)}</td></tr><tr><th>Utilidad neta</th><th>${money(t.net)}</th></tr></table></div><div class="card"><h3>Balance General</h3><table class="table"><tr><td>Activos</td><td>${money(t.assets)}</td></tr><tr><td>Pasivos</td><td>${money(t.liabilities)}</td></tr><tr><td>Capital</td><td>${money(t.equity)}</td></tr></table></div></div>`; }
function settings(){ return `<div class="card"><h3>Configuración</h3><div class="form-grid"><label>Empresa<input id="cfgName" value="${db.company.name}"></label><label>IVU %<input id="cfgIvu" type="number" step="0.01" value="${db.company.ivu}"></label></div><div class="actions"><button onclick="saveSettings()">Guardar configuración</button></div></div>`; }
function saveSettings(){ db.company.name=document.getElementById('cfgName').value; db.company.ivu=Number(document.getElementById('cfgIvu').value); save(); document.getElementById('companyLabel').textContent=`${db.company.name} · Año Fiscal ${db.company.fiscalYear}`; render('settings'); }

function openModal(type){
  document.getElementById('modal').classList.remove('hidden');
  if(type==='journal') modal('Nuevo asiento contable', journalForm());
  if(type==='invoice') modal('Nueva factura', invoiceForm());
  if(type==='expense') modal('Registrar gasto', expenseForm());
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
function exportData(){ const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='nexus-accounting-pr-data.json'; a.click(); }
function resetDemo(){ if(confirm('Esto reinicia la demo local.')){ localStorage.removeItem('nexusAccountingPR'); db=load(); render('dashboard'); } }

window.addEventListener('DOMContentLoaded',()=>{ document.getElementById('companyLabel').textContent=`${db.company.name} · Año Fiscal ${db.company.fiscalYear}`; });
