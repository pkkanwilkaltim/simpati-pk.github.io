/* ============================================================
   Dashboard Kanwil Ditjenpas Kaltim-Utara — app.js
   ============================================================ */

/* ===== STATE ===== */
var currentUser = null;
var currentRole = 'user';
var selectedLoginRole = 'user';
var laporan_count = 0;
var lastResult = '';
var currentArsipDetail = null;
var activityLog = [];

var ACCOUNTS = [
  {username:'admin',password:'admin123',role:'admin',nama:'Administrator'},
  {username:'user',password:'user123',role:'user',nama:'Operator Kanwil'},
];

var USERS_DB = [...ACCOUNTS];

var ARSIP_DB = [
  {id:1,bulan:'Mei',tahun:2025,bapas:'Semua',dewasa:1520,anak:94,catatan:'Laporan rutin bulanan. Peningkatan klien asimilasi.',laporan:''},
  {id:2,bulan:'April',tahun:2025,bapas:'Semua',dewasa:1498,anak:91,catatan:'Data stabil. Ada penambahan klien baru Tarakan.',laporan:''},
  {id:3,bulan:'Maret',tahun:2025,bapas:'Semua',dewasa:1475,anak:88,catatan:'Rekap Q1 selesai.',laporan:''},
  {id:4,bulan:'Februari',tahun:2025,bapas:'Semua',dewasa:1460,anak:85,catatan:'Peningkatan Litmas dewasa.',laporan:''},
  {id:5,bulan:'Januari',tahun:2025,bapas:'Semua',dewasa:1440,anak:82,catatan:'Awal tahun. Data diverifikasi ulang.',laporan:''},
  {id:6,bulan:'Desember',tahun:2024,bapas:'Semua',dewasa:1435,anak:80,catatan:'Tutup tahun 2024.',laporan:''},
  {id:7,bulan:'November',tahun:2024,bapas:'Semua',dewasa:1420,anak:78,catatan:'Rekap akhir tahun.',laporan:''},
  {id:8,bulan:'Oktober',tahun:2024,bapas:'Semua',dewasa:1410,anak:75,catatan:'Normal.',laporan:''},
];

var HARI_LIST = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
var BULAN_LIST = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

var charts = {};

/* ===== LOGIN ===== */
function selectRole(role, el) {
  selectedLoginRole = role;
  document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
}

function doLogin() {
  var u = document.getElementById('login-user').value.trim();
  var p = document.getElementById('login-pass').value;
  var err = document.getElementById('login-err');
  var acc = ACCOUNTS.find(a=>a.username===u && a.password===p && a.role===selectedLoginRole);
  if (!acc) { err.style.display='block'; return; }
  err.style.display='none';
  currentUser = acc;
  currentRole = acc.role;
  document.getElementById('login-screen').style.display='none';
  var app = document.getElementById('app');
  app.style.display='flex'; app.classList.add('ready');
  if (currentRole==='admin') app.classList.add('is-admin');
  else app.classList.remove('is-admin');
  setupUserUI();
  initApp();
  logActivity('Login: ' + acc.nama + ' (' + acc.role + ')');
}

function doLogout() {
  logActivity('Logout: ' + currentUser.nama);
  currentUser = null;
  document.getElementById('app').style.display='none';
  document.getElementById('app').classList.remove('ready','is-admin');
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
}

function setupUserUI() {
  var u = currentUser;
  document.getElementById('sb-username').textContent = u.nama;
  document.getElementById('sb-role-text').textContent = u.role==='admin'?'Administrator':'Operator';
  var av = document.getElementById('sb-avatar');
  av.textContent = u.nama[0].toUpperCase();
  av.className = 'su-avatar' + (u.role==='admin'?' admin-av':'');
  var badge = document.getElementById('sb-role-badge');
  badge.textContent = u.role==='admin'?'Admin':'User';
  badge.className = 'su-badge ' + u.role;
  var tbav = document.getElementById('tb-avatar');
  tbav.textContent = u.nama[0].toUpperCase();
  tbav.className = 'tb-avatar' + (u.role==='admin'?' admin':'');
  var btnSave = document.getElementById('btn-save-arsip');
  if (btnSave) btnSave.style.display = u.role==='admin'?'inline-block':'none';
  var gc = document.getElementById('gender-input-card');
  if (gc) gc.style.display = u.role==='admin'?'block':'none';
}

/* ===== INIT ===== */
function initApp() {
  var now = new Date();
  var hari = HARI_LIST[now.getDay()];
  var tgl = now.getDate();
  var bln = BULAN_LIST[now.getMonth()+1];
  var thn = now.getFullYear();
  var tanggal = hari+', '+tgl+' '+bln+' '+thn;
  document.getElementById('tb-date').textContent = '📅 '+tanggal;
  document.getElementById('meta-hari').value = tanggal;

  ['kanwil','smr','bpp','trk'].forEach(updateJftTotal);
  syncOvJft();
  renderArsip();
  renderOvArsip();
  renderUserTable();
  renderActivityLog();
  setTimeout(initCharts, 100);
  setTimeout(renderJftDoughnuts, 150);
}

/* ===== PAGE NAVIGATION ===== */
function goPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  var page = document.getElementById('page-'+id);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');
  else {
    document.querySelectorAll('.nav-item').forEach(n=>{
      if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'"+id+"'")) n.classList.add('active');
    });
  }
  var titles = {
    'dashboard':'Dashboard','laporan-harian':'Laporan Harian',
    'laporan-bulanan':'Laporan Bulanan','infografis':'Infografis',
    'jft-infografis':'Infografis JFT','admin':'Panel Admin'
  };
  document.getElementById('topbar-title').textContent = titles[id]||id;
  if (id==='infografis') { setTimeout(refreshInfografis, 200); }
  if (id==='jft-infografis') { setTimeout(refreshJftInfografis, 200); }
  closeSidebar();
}

/* ===== SIDEBAR ===== */
function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sb-overlay');
  sb.classList.toggle('open');
  ov.style.display = sb.classList.contains('open')?'block':'none';
}
function closeSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sb-overlay');
  sb.classList.remove('open');
  ov.style.display='none';
}

/* ===== TAB SWITCHING ===== */
function switchTab(id, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-'+id).classList.add('active');
}

function switchAdminTab(id, el) {
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ap-'+id).classList.add('active');
}

/* ===== BADGE ===== */
function updateBadge(id) {
  var txt = document.getElementById('txt-'+id).value.trim();
  var badge = document.getElementById('badge-'+id);
  var label = id==='smr'?'Samarinda':id==='bpp'?'Balikpapan':'Tarakan';
  if (txt.length>20) { badge.className='badge ok'; badge.textContent=label+': sudah diisi ✓'; }
  else { badge.className='badge'; badge.textContent=label+': belum diisi'; }
}

/* ===== JFT TOTAL ===== */
function updateJftTotal(unit) {
  var ids = unit==='kanwil'
    ? ['jft_kanwil_pertama','jft_kanwil_muda','jft_kanwil_madya']
    : ['jft_'+unit+'_apk','jft_'+unit+'_pertama','jft_'+unit+'_muda','jft_'+unit+'_madya'];
  var total = ids.reduce(function(s,id){var el=document.getElementById(id);return s+(el?(parseInt(el.value)||0):0);},0);
  document.getElementById('jft-'+unit+'-total').textContent = total;
}

function syncOvJft() {
  function iv(id){var el=document.getElementById(id);return el?(parseInt(el.value)||0):0;}
  var kw = iv('jft_kanwil_pertama')+iv('jft_kanwil_muda')+iv('jft_kanwil_madya');
  var smr = iv('jft_smr_apk')+iv('jft_smr_pertama')+iv('jft_smr_muda')+iv('jft_smr_madya');
  var bpp = iv('jft_bpp_apk')+iv('jft_bpp_pertama')+iv('jft_bpp_muda')+iv('jft_bpp_madya');
  var trk = iv('jft_trk_apk')+iv('jft_trk_pertama')+iv('jft_trk_muda')+iv('jft_trk_madya');
  var tot = kw+smr+bpp+trk;
  document.getElementById('ov-jft-kanwil').textContent = kw;
  document.getElementById('ov-jft-smr').textContent = smr;
  document.getElementById('ov-jft-bpp').textContent = bpp;
  document.getElementById('ov-jft-trk').textContent = trk;
  document.getElementById('ov-total-jft').textContent = tot;
  ['inf-jft-kanwil','inf-jft-smr','inf-jft-bpp','inf-jft-trk'].forEach(function(id,i){
    var el=document.getElementById(id); if(el) el.textContent=[kw,smr,bpp,trk][i];
  });
  var totalEl = document.getElementById('inf-jft-total');
  if(totalEl) totalEl.textContent = tot;
  // kanwil bars
  var kwp=iv('jft_kanwil_pertama'),kwm=iv('jft_kanwil_muda'),kwma=iv('jft_kanwil_madya');
  setBar('inf-kw-1',kwp,'inf-kw-bar1',kwp,kw||1);
  setBar('inf-kw-2',kwm,'inf-kw-bar2',kwm,kw||1);
  setBar('inf-kw-3',kwma,'inf-kw-bar3',kwma,kw||1);
  // smr
  var sa=iv('jft_smr_apk'),sp=iv('jft_smr_pertama'),sm=iv('jft_smr_muda');
  setBar('inf-smr-0',sa,'inf-smr-bar0',sa,smr||1);
  setBar('inf-smr-1',sp,'inf-smr-bar1',sp,smr||1);
  setBar('inf-smr-2',sm,'inf-smr-bar2',sm,smr||1);
  var sma=iv('jft_smr_madya');
  setBar('inf-smr-3',sma,'inf-smr-bar3',sma,smr||1);
  // bpp
  var ba=iv('jft_bpp_apk'),bp=iv('jft_bpp_pertama'),bm=iv('jft_bpp_muda');
  setBar('inf-bpp-0',ba,'inf-bpp-bar0',ba,bpp||1);
  setBar('inf-bpp-1',bp,'inf-bpp-bar1',bp,bpp||1);
  setBar('inf-bpp-2',bm,'inf-bpp-bar2',bm,bpp||1);
  var bma=iv('jft_bpp_madya');
  setBar('inf-bpp-3',bma,'inf-bpp-bar3',bma,bpp||1);
  // trk
  var ta=iv('jft_trk_apk'),tp=iv('jft_trk_pertama'),tm=iv('jft_trk_muda');
  setBar('inf-trk-0',ta,'inf-trk-bar0',ta,trk||1);
  setBar('inf-trk-1',tp,'inf-trk-bar1',tp,trk||1);
  setBar('inf-trk-2',tm,'inf-trk-bar2',tm,trk||1);
  var tma=iv('jft_trk_madya');
  setBar('inf-trk-3',tma,'inf-trk-bar3',tma,trk||1);
}

function setBar(labelId,val,barId,v,max){
  var lel=document.getElementById(labelId); if(lel) lel.textContent=val;
  var bel=document.getElementById(barId); if(bel) bel.style.width=Math.round((v/max)*100)+'%';
}

/* ===== PARSER ===== */
function extractNum(text,patterns){for(var i=0;i<patterns.length;i++){var m=text.match(patterns[i]);if(m){var raw=m[1].replace(/[.,\s]/g,'');var num=parseInt(raw,10);if(!isNaN(num))return num;}}return null;}
function extractIntFromLine(text,keyword){var esc=keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');var re1=new RegExp('^'+esc+'\\s*[:\\-]?\\s*([\\d.,]+)','im');var m1=text.match(re1);if(m1)return parseInt(m1[1].replace(/[.,]/g,''),10);var re2=new RegExp(esc+'[\\s\\S]{0,60}?jumlah\\s*[=:]\\s*([\\d.,]+)','i');var m2=text.match(re2);if(m2)return parseInt(m2[1].replace(/[.,]/g,''),10);return null;}
function parseReport(text){
  var t=text,d={};
  var mDew=t.match(/klien dewasa[\s\S]{0,200}?jumlah\s*[=:]\s*([\d.,]+)/i);
  if(mDew){d.dewasa=parseInt(mDew[1].replace(/[.,]/g,''),10);}else{var mDew2=t.match(/jumlah\s*[=:]\s*([\d.,]+)\s*orang/i);d.dewasa=mDew2?parseInt(mDew2[1].replace(/[.,]/g,''),10):null;}
  var mAnak=t.match(/klien anak[\s\S]{0,200}?jumlah\s*[=:]\s*([\d.,]+)/i);
  d.anak=mAnak?parseInt(mAnak[1].replace(/[.,]/g,''),10):null;
  d.pb_dewasa=extractIntFromLine(t,'pb');d.cb_dewasa=extractIntFromLine(t,'cb');d.cmb_dewasa=extractIntFromLine(t,'cmb');d.cmk_dewasa=extractIntFromLine(t,'cmk');
  var asimJA=t.match(/asimila[si]*[\s\S]{0,60}?jumlah\s*[=:]\s*([\d.,]+)/i);var asimA=t.match(/asimila[si]*\s*[:\-]?\s*([\d.,]+)/i);
  if(asimJA){d.asim_dewasa=parseInt(asimJA[1].replace(/[.,]/g,''),10);}else if(asimA){d.asim_dewasa=parseInt(asimA[1].replace(/[.,]/g,''),10);}else{d.asim_dewasa=null;}
  var anakM=t.match(/klien anak[\s\S]{0,1500}/i);
  if(anakM){var ab=anakM[0];d.pb_anak=extractIntFromLine(ab,'pb');d.cb_anak=extractIntFromLine(ab,'cb');d.cmb_anak=extractIntFromLine(ab,'cmb');var asimAnak=ab.match(/asimila[si]*[\s\S]{0,60}?jumlah\s*[=:]\s*([\d.,]+)/i);d.asim_anak=asimAnak?parseInt(asimAnak[1].replace(/[.,]/g,''),10):null;}else{d.pb_anak=null;d.cb_anak=null;d.asim_anak=null;d.cmb_anak=null;}
  d.litmas_dew_req=extractNum(t,[/permintaan litmas dewasa\s*\d{0,4}\s*[:\-]?\s*([\d.,]+)/i,/permintaan litmas[\s\S]{0,50}dewasa\s*[:\-]?\s*([\d.,]+)/i]);
  d.litmas_dew_done=extractNum(t,[/penyelesaian litmas dewasa\s*\d{0,4}\s*[:\-]?\s*([\d.,]+)/i,/penyelesaian litmas[\s\S]{0,50}dewasa\s*[:\-]?\s*([\d.,]+)/i]);
  d.litmas_anak_req=extractNum(t,[/permintaan litmas anak\s*\d{0,4}\s*[:\-]?\s*([\d.,]+)/i]);
  d.litmas_anak_done=extractNum(t,[/penyelesaian litmas anak\s*\d{0,4}\s*[:\-]?\s*([\d.,]+)/i]);
  d.diversi=extractNum(t,[/diversi\s*[:\-]?\s*([\d.,]+)/i,/diversi[\s\S]{0,50}jumlah\s*[=:]\s*([\d.,]+)/i]);
  d.akot=extractNum(t,[/akot[\s\S]{0,60}jumlah\s*[=:]\s*([\d.,]+)/i,/^akot\s*[:\-]?\s*([\d.,]+)/im]);
  d.latker=extractNum(t,[/latker[\s\S]{0,60}jumlah\s*[=:]\s*([\d.,]+)/i,/pelatihan kerja[\s\S]{0,60}jumlah\s*[=:]\s*([\d.,]+)/i]);
  d.sekolah=extractNum(t,[/klien anak sekolah\s*[:\-]?\s*([\d.,]+)/i,/sekolah\s*[:\-]?\s*([\d.,]+)/i]);
  d.bekerja=extractNum(t,[/klien bekerja[\s\S]{0,80}jumlah\s*[=:]\s*([\d.,]+)/i]);
  var splitPos=t.search(/klien anak/i);var tDew=splitPos>=0?t.substring(0,splitPos):t;var tAnak=splitPos>=0?t.substring(splitPos):'';
  var nDew=extractNum(tDew,[/narkotika[\s\S]{0,80}jumlah\s*[=:]\s*([\d.,]+)/i]);
  var nAnak=tAnak?extractNum(tAnak,[/narkotika[\s\S]{0,60}jumlah\s*[=:]\s*([\d.,]+)/i]):null;
  d.narkotika=(nDew!==null||nAnak!==null)?(nDew||0)+(nAnak||0):null;
  var tDew2=extractNum(tDew,[/teroris\s*[:\-]?\s*([\d.,]+)/i]);
  var tAnak2=tAnak?extractNum(tAnak,[/teroris\s*[:\-]?\s*([\d.,]+)/i]):null;
  d.teroris=(tDew2!==null||tAnak2!==null)?(tDew2||0)+(tAnak2||0):null;
  return d;
}

var previewTimers={};
var PREVIEW_FIELDS=[
  {key:'dewasa',label:'Klien Dewasa'},{key:'anak',label:'Klien Anak'},
  {key:'pb_dewasa',label:'PB (Dewasa)'},{key:'cb_dewasa',label:'CB (Dewasa)'},
  {key:'cmb_dewasa',label:'CMB'},{key:'cmk_dewasa',label:'CMK'},
  {key:'asim_dewasa',label:'Asimilasi Dew.'},{key:'pb_anak',label:'PB (Anak)'},
  {key:'cb_anak',label:'CB (Anak)'},{key:'asim_anak',label:'Asimilasi Anak'},
  {key:'litmas_dew_req',label:'Litmas Dew.(Req)'},{key:'litmas_dew_done',label:'Litmas Dew.(Done)'},
  {key:'litmas_anak_req',label:'Litmas Anak(Req)'},{key:'litmas_anak_done',label:'Litmas Anak(Done)'},
  {key:'diversi',label:'Diversi'},{key:'akot',label:'AKOT'},
  {key:'latker',label:'Latker/LPKS'},{key:'sekolah',label:'Klien Sekolah'},
  {key:'bekerja',label:'Klien Bekerja'},{key:'narkotika',label:'Narkotika'},{key:'teroris',label:'Teroris'},
];
function livePreview(id){
  var txt=document.getElementById('txt-'+id).value.trim();
  var prev=document.getElementById('prev-'+id);
  var grid=document.getElementById('prev-'+id+'-grid');
  if(txt.length<20){prev.classList.remove('show');return;}
  clearTimeout(previewTimers[id]);
  previewTimers[id]=setTimeout(function(){
    var data=parseReport(txt);
    var html='';
    PREVIEW_FIELDS.forEach(function(f){
      var v=(data[f.key]!==undefined&&data[f.key]!==null)?data[f.key]:null;
      var cls=v===null?'':v>0?'found':'zero';
      var disp=v===null?'—':Number(v).toLocaleString('id-ID');
      html+='<div class="parse-item '+cls+'"><div class="key">'+f.label+'</div><div class="val">'+disp+'</div></div>';
    });
    grid.innerHTML=html;
    prev.classList.add('show');
  },400);
}
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

/* ===== GENERATOR ===== */
function n(v){return v!==null&&v!==undefined?v:0;}
function fmt(v){return Number(v).toLocaleString('id-ID');}
function buildJft(){
  function iv(id,def){var el=document.getElementById(id);return el?(parseInt(el.value)||0):def;}
  var jft={
    kanwil_pertama:iv('jft_kanwil_pertama',0),kanwil_muda:iv('jft_kanwil_muda',2),kanwil_madya:iv('jft_kanwil_madya',2),
    smr_apk:iv('jft_smr_apk',1),smr_pertama:iv('jft_smr_pertama',12),smr_muda:iv('jft_smr_muda',7),smr_madya:iv('jft_smr_madya',4),
    bpp_apk:iv('jft_bpp_apk',0),bpp_pertama:iv('jft_bpp_pertama',16),bpp_muda:iv('jft_bpp_muda',6),bpp_madya:iv('jft_bpp_madya',5),
    trk_apk:iv('jft_trk_apk',0),trk_pertama:iv('jft_trk_pertama',10),trk_muda:iv('jft_trk_muda',1),trk_madya:iv('jft_trk_madya',2),
  };
  jft.kanwil_total=jft.kanwil_pertama+jft.kanwil_muda+jft.kanwil_madya;
  jft.smr_total=jft.smr_apk+jft.smr_pertama+jft.smr_muda+jft.smr_madya;
  jft.bpp_total=jft.bpp_apk+jft.bpp_pertama+jft.bpp_muda+jft.bpp_madya;
  jft.trk_total=jft.trk_apk+jft.trk_pertama+jft.trk_muda+jft.trk_madya;
  jft.grand_total=jft.kanwil_total+jft.smr_total+jft.bpp_total+jft.trk_total;
  return jft;
}

function buildLaporan(smr,bpp,trk,jft,hari,pukul,nama,nip){
  var zwj='\u200E',out='';
  out+='Laporan Harian Data Pembimbing Kemasyarakatan dan Klien Balai Pemasyarakatan Wilayah Kalimantan Timur-Utara\n\n';
  out+='Yth.\nDirektur Pembimbingan Kemasyarakatan\n\n';
  out+='Dari :\nKepala Bidang Pembimbingan Kemasyarakatan Kanwil Direktorat Jenderal Pemasyarakatan Kalimantan Timur\n\n';
  out+='Tembusan :\nDirektur Jenderal Pemasyarakatan Kementerian Imigrasi dan Pemasyarakatan RI\n\n';
  out+='Bersama ini kami sampaikan Laporan Harian Data Pembimbing Kemasyarakatan dan Klien Balai Pemasyarakatan Wilayah Kalimantan Timur-Utara pada \n';
  out+='Hari/Tgl\t: '+hari+'\nPukul   \t: '+pukul+'\n';
  out+='\nI.DATA JFT PK : '+jft.grand_total+' ORANG\n\n';
  out+='Kanwil Ditjenpas        \t: '+jft.kanwil_total+' orang\n';
  out+='•PK Pertama             \t: '+jft.kanwil_pertama+' orang\n';
  out+='•PK Muda                \t: '+jft.kanwil_muda+' orang\n';
  out+='•PK Madya               \t: '+jft.kanwil_madya+' orang\n';
  out+='Bapas Kelas I Samarinda \t: '+jft.smr_total+' orang\n';
  out+='•APK                    \t: '+jft.smr_apk+' orang\n•PK Pertama             \t: '+jft.smr_pertama+' orang\n•PK Muda                \t: '+jft.smr_muda+' orang\n•PK Madya               \t: '+jft.smr_madya+' orang\n';
  out+='Bapas Kelas I Balikpapan\t: '+jft.bpp_total+' orang\n';
  out+='•APK                    \t: '+jft.bpp_apk+' orang\n•PK Pertama             \t: '+jft.bpp_pertama+' orang\n•PK Muda                \t: '+jft.bpp_muda+' orang\n•PK Madya               \t: '+jft.bpp_madya+' orang\n';
  out+='Bapas Kelas II Tarakan  \t: '+jft.trk_total+' orang\n';
  out+='•APK                    \t: '+jft.trk_apk+' orang\n•PK Pertama             \t: '+jft.trk_pertama+' orang\n•PK Muda                \t: '+jft.trk_muda+' orang\n•PK Madya               \t: '+jft.trk_madya+' orang\n';
  var smrDew=n(smr.dewasa),smrAnak=n(smr.anak),bppDew=n(bpp.dewasa),bppAnak=n(bpp.anak),trkDew=n(trk.dewasa),trkAnak=n(trk.anak);
  var totalDew=smrDew+bppDew+trkDew,totalAnak=smrAnak+bppAnak+trkAnak,totalKlien=totalDew+totalAnak;
  out+='\nII.DATA KLIEN :  '+fmt(totalKlien)+' ORANG\n';
  out+=zwj+'Bapas Kelas I Samarinda  : '+fmt(smrDew+smrAnak)+' orang\n•Dewasa\t\t:  '+fmt(smrDew)+' orang\n•Anak\t\t:  '+smrAnak+' orang\n\n';
  out+=zwj+'Bapas Kelas I Balikpapan : '+fmt(bppDew+bppAnak)+' orang\n•Dewasa\t\t:  '+fmt(bppDew)+' orang\n•Anak\t\t:  '+bppAnak+' orang\n\n';
  out+=zwj+'Bapas Kelas II Tarakan   :  '+fmt(trkDew+trkAnak)+' orang\n•Dewasa\t\t: '+fmt(trkDew)+' orang\n•Anak\t\t: '+trkAnak+' orang\n';
  out+='\nIII.PENELITIAN KEMASYARAKATAN\n\n';
  var units=[{label:'Bapas Kelas I Samarinda',data:smr},{label:'Bapas Kelas I Balikpapan',data:bpp},{label:'Bapas Kelas II Tarakan',data:trk}];
  units.forEach(function(u){
    out+=u.label+'\n•Permintaan Litmas\n1. Dewasa \t: '+n(u.data.litmas_dew_req)+' orang\n2. Anak \t: '+n(u.data.litmas_anak_req)+' orang\n* Penyelesaian Litmas\n1. Dewasa \t: '+n(u.data.litmas_dew_done)+' orang\n2. Anak \t: '+n(u.data.litmas_anak_done)+' orang\n\n';
  });
  out+='IV.KLIEN INTEGRASI DEWASA\n\n';
  units.forEach(function(u){out+=u.label+'\n•Asimilasi \t: '+n(u.data.asim_dewasa)+' orang\n•PB            \t: '+fmt(n(u.data.pb_dewasa))+' orang\n•CB            \t: '+n(u.data.cb_dewasa)+' orang\n•CMB         \t: '+n(u.data.cmb_dewasa)+' orang\n•CMK         \t: '+n(u.data.cmk_dewasa)+' orang\n\n';});
  out+='V.KLIEN INTEGRASI ANAK\n\n';
  units.forEach(function(u){out+=u.label+'\n•Asimilasi \t: '+n(u.data.asim_anak)+' orang\n•PB            \t: '+n(u.data.pb_anak)+' orang\n•CB            \t: '+n(u.data.cb_anak)+' orang\n\n';});
  out+='VI. PENDAMPINGAN DIVERSI DAN PERADILAN\n\n';
  out+=zwj+'Bapas Kelas I Samarinda  : '+n(smr.diversi)+' orang\n'+zwj+'Bapas Kelas I Balikpapan : '+n(bpp.diversi)+' orang\n'+zwj+'Bapas Kelas II Tarakan   : '+n(trk.diversi)+' orang\n\n';
  out+='VII. AKOT\n\n'+zwj+'Bapas Kelas I Samarinda  : '+n(smr.akot)+' orang\n'+zwj+'Bapas Kelas I Balikpapan : '+n(bpp.akot)+' orang\n'+zwj+'Bapas Kelas II Tarakan   : '+n(trk.akot)+' orang\n\n';
  out+='VIII. PELATIHAN KERJA\n\n'+zwj+'Bapas Kelas I Samarinda  : '+n(smr.latker)+' orang\n'+zwj+'Bapas Kelas I Balikpapan : '+n(bpp.latker)+' orang\n'+zwj+'Bapas Kelas II Tarakan   : '+n(trk.latker)+' orang\n\n';
  out+='IX. KLIEN SEKOLAH\n\n'+zwj+'Bapas Kelas I Samarinda  : '+n(smr.sekolah)+' orang\n'+zwj+'Bapas Kelas I Balikpapan : '+n(bpp.sekolah)+' orang\n'+zwj+'Bapas Kelas II Tarakan   : '+n(trk.sekolah)+' orang\n\n';
  out+='X. KLIEN BEKERJA\n\n'+zwj+'Bapas Kelas I Samarinda  : '+fmt(n(smr.bekerja))+' orang\n'+zwj+'Bapas Kelas I Balikpapan : '+fmt(n(bpp.bekerja))+' orang\n'+zwj+'Bapas Kelas II Tarakan   : '+fmt(n(trk.bekerja))+' orang\n\n';
  out+=zwj+'XI. KLIEN TERORIS\n\n'+zwj+'Bapas Kelas I Samarinda  : '+n(smr.teroris)+' orang\n'+zwj+'Bapas Kelas I Balikpapan : '+n(bpp.teroris)+' orang\n'+zwj+'Bapas Kelas II Tarakan   : '+n(trk.teroris)+' orang\n\n';
  out+=zwj+'XII. KLIEN NARKOTIKA\n\n'+zwj+'Bapas Kelas I Samarinda  : '+fmt(n(smr.narkotika))+' orang\n'+zwj+'Bapas Kelas I Balikpapan : '+fmt(n(bpp.narkotika))+' orang\n'+zwj+'Bapas Kelas II Tarakan   : '+fmt(n(trk.narkotika))+' orang\n\n';
  out+=zwj+'XIII. PENUTUP\n\n'+zwj+'Demikian laporan ini kami sampaikan, atas perhatian diucapkan terima kasih.\n\n';
  out+='Kepala Bidang Pembimbingan Kemasyarakatan\n\n\nttd\n\n'+nama+'\nNIP. '+nip;
  return out;
}

function generateLaporan(){
  var txtSmr=document.getElementById('txt-smr').value.trim();
  var txtBpp=document.getElementById('txt-bpp').value.trim();
  var txtTrk=document.getElementById('txt-trk').value.trim();
  var errEl=document.getElementById('err-msg');
  // Validasi: minimal 3 Bapas harus terisi
  var filled=[txtSmr,txtBpp,txtTrk].filter(function(t){return t.length>20;}).length;
  if(filled<3){errEl.textContent='⚠ Minimal 3 Bapas (Samarinda, Balikpapan, dan Tarakan) harus diisi sebelum generate laporan.';errEl.style.display='block';return;}
  // Validasi: data JFT harus kosong (0) sebelum laporan harian diisi
  function iv(id){var el=document.getElementById(id);return el?(parseInt(el.value)||0):0;}
  var jftTotal=iv('jft_kanwil_pertama')+iv('jft_kanwil_muda')+iv('jft_kanwil_madya')
    +iv('jft_smr_apk')+iv('jft_smr_pertama')+iv('jft_smr_muda')+iv('jft_smr_madya')
    +iv('jft_bpp_apk')+iv('jft_bpp_pertama')+iv('jft_bpp_muda')+iv('jft_bpp_madya')
    +iv('jft_trk_apk')+iv('jft_trk_pertama')+iv('jft_trk_muda')+iv('jft_trk_madya');
  if(jftTotal>0){errEl.textContent='⚠ Data JFT harus dikosongkan (semua bernilai 0) sebelum mengisi laporan harian. Silakan kosongkan data JFT terlebih dahulu.';errEl.style.display='block';return;}
  errEl.style.display='none';
  var smr=txtSmr?parseReport(txtSmr):{};
  var bpp=txtBpp?parseReport(txtBpp):{};
  var trk=txtTrk?parseReport(txtTrk):{};
  // Simpan ke state global untuk infografis & JFT infografis
  _parsedKlien.smr = {dewasa:n(smr.dewasa), anak:n(smr.anak)};
  _parsedKlien.bpp = {dewasa:n(bpp.dewasa), anak:n(bpp.anak)};
  _parsedKlien.trk = {dewasa:n(trk.dewasa), anak:n(trk.anak)};
  var jft=buildJft();
  var hari=document.getElementById('meta-hari').value.trim()||getTanggalHariIni();
  var pukul=document.getElementById('meta-pukul').value.trim()||'08.00 Wita';
  var nama=document.getElementById('meta-nama').value.trim()||'Huzaifah Makmur Hidayah';
  var nip=document.getElementById('meta-nip').value.trim()||'197505241999021001';
  var result=buildLaporan(smr,bpp,trk,jft,hari,pukul,nama,nip);
  lastResult=result;
  document.getElementById('result-text').textContent=result;
  var ra=document.getElementById('result-area');
  ra.style.display='block';
  laporan_count++;
  var totalKlien=(n(smr.dewasa)+n(smr.anak))+(n(bpp.dewasa)+n(bpp.anak))+(n(trk.dewasa)+n(trk.anak));
  if(totalKlien>0) document.getElementById('ov-total-klien').textContent=fmt(totalKlien);
  syncInfTotalKlien();
  syncJftInfografisFromLaporan();
  setTimeout(function(){ra.scrollIntoView({behavior:'smooth',block:'start'});},150);
  showToast('Laporan berhasil di-generate! ✓','success');
  logActivity('Generate laporan harian oleh '+currentUser.nama);
}

function getTanggalHariIni(){var now=new Date();return HARI_LIST[now.getDay()]+', '+now.getDate()+' '+BULAN_LIST[now.getMonth()+1]+' '+now.getFullYear();}

function clearAll(){
  ['smr','bpp','trk'].forEach(function(id){
    var ta=document.getElementById('txt-'+id);if(ta)ta.value='';
    updateBadge(id);
    var prev=document.getElementById('prev-'+id);if(prev)prev.classList.remove('show');
  });
  document.getElementById('result-area').style.display='none';
  document.getElementById('err-msg').style.display='none';
}

function copyResult(){
  var text=document.getElementById('result-text').textContent;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){showToast('Laporan berhasil disalin! 📋','success');}).catch(fallback);
  }else{fallback();}
  function fallback(){var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;';document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand('copy');showToast('Laporan disalin!','success');}catch(e){}document.body.removeChild(ta);}
}

function saveToArsip(){
  if(currentRole!=='admin'){showToast('Hanya admin yang dapat menyimpan arsip.','error');return;}
  showToast('Laporan disimpan ke arsip! ✓','success');
  logActivity('Simpan laporan ke arsip oleh '+currentUser.nama);
}

/* ===== ARSIP ===== */
function renderArsip(){
  var list=document.getElementById('arsip-list');
  var empty=document.getElementById('arsip-empty');
  var tahun=document.getElementById('filter-tahun').value;
  var bapas=document.getElementById('filter-bapas').value;
  var q=(document.getElementById('search-arsip').value||'').toLowerCase();
  var filtered=ARSIP_DB.filter(function(a){
    return (!tahun||String(a.tahun)===tahun)&&(!bapas||a.bapas===bapas||a.bapas==='Semua')&&(!q||(a.bulan+' '+a.tahun+' '+a.catatan).toLowerCase().includes(q));
  });
  if(!filtered.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  list.innerHTML=filtered.map(function(a){
    return '<div class="arsip-card" onclick="viewArsip('+a.id+')">'
      +'<div class="arsip-month-badge">'+a.bulan+' '+a.tahun+'</div>'
      +'<h3>Laporan Bulanan '+a.bulan+' '+a.tahun+'</h3>'
      +'<p>'+a.catatan+'</p>'
      +'<div class="arsip-meta">'
      +'<span class="arsip-chip">👥 '+fmt(a.dewasa)+' Dewasa</span>'
      +'<span class="arsip-chip">👦 '+a.anak+' Anak</span>'
      +'<span class="arsip-chip">📍 '+a.bapas+'</span>'
      +'</div>'
      +'<div class="arsip-actions">'
      +'<button class="btn-accent" onclick="event.stopPropagation();viewArsip('+a.id+')">Lihat Detail</button>'
      +(currentRole==='admin'?'<button class="btn-danger" onclick="event.stopPropagation();deleteArsip('+a.id+')">🗑</button>':'')
      +'</div>'
      +'</div>';
  }).join('');
}

function renderOvArsip(){
  var list=document.getElementById('ov-arsip-list');
  var recent=ARSIP_DB.slice(0,4);
  list.innerHTML=recent.map(function(a){
    return '<div class="arsip-card" onclick="goPage(\'laporan-bulanan\',null)" style="cursor:pointer;">'
      +'<div class="arsip-month-badge">'+a.bulan+' '+a.tahun+'</div>'
      +'<h3>Laporan '+a.bulan+' '+a.tahun+'</h3>'
      +'<p style="font-size:12px;">'+a.catatan+'</p>'
      +'<div class="arsip-meta"><span class="arsip-chip">👥 '+fmt(a.dewasa+a.anak)+' Klien</span></div>'
      +'</div>';
  }).join('');
  document.getElementById('ov-arsip').textContent=ARSIP_DB.length;
}

function viewArsip(id){
  var a=ARSIP_DB.find(x=>x.id===id);if(!a)return;
  currentArsipDetail=a;
  document.getElementById('modal-arsip-title').textContent='Detail Laporan — '+a.bulan+' '+a.tahun;
  document.getElementById('modal-arsip-body').innerHTML=
    '<div class="detail-section"><h4>Informasi Umum</h4>'
    +'<div class="detail-row"><span>Periode</span><span>'+a.bulan+' '+a.tahun+'</span></div>'
    +'<div class="detail-row"><span>Unit</span><span>'+a.bapas+'</span></div>'
    +'<div class="detail-row"><span>Catatan</span><span style="font-family:inherit;font-size:12px;text-align:right;max-width:300px;">'+a.catatan+'</span></div>'
    +'</div>'
    +'<div class="detail-section"><h4>Data Klien</h4>'
    +'<div class="detail-row"><span>Klien Dewasa</span><span>'+fmt(a.dewasa)+' orang</span></div>'
    +'<div class="detail-row"><span>Klien Anak</span><span>'+a.anak+' orang</span></div>'
    +'<div class="detail-row"><span>Total Klien</span><span>'+fmt(a.dewasa+a.anak)+' orang</span></div>'
    +'</div>'
    +(a.laporan?'<div class="detail-section"><h4>Teks Laporan</h4><pre style="font-size:11px;max-height:200px;overflow-y:auto;">'+escHtml(a.laporan)+'</pre></div>':'');
  openModal('modal-arsip');
}

function copyArsipContent(){
  if(!currentArsipDetail)return;
  var text='Laporan Bulanan '+currentArsipDetail.bulan+' '+currentArsipDetail.tahun+'\n'
    +'Klien Dewasa: '+fmt(currentArsipDetail.dewasa)+'\nKlien Anak: '+currentArsipDetail.anak+'\n'+currentArsipDetail.catatan;
  navigator.clipboard&&navigator.clipboard.writeText(text);
  showToast('Data arsip disalin!','success');
}

function deleteArsip(id){
  if(!confirm('Hapus arsip ini?'))return;
  ARSIP_DB=ARSIP_DB.filter(x=>x.id!==id);
  renderArsip();renderOvArsip();
  showToast('Arsip dihapus.','success');
  logActivity('Hapus arsip id='+id+' oleh '+currentUser.nama);
}

function openAddArsipModal(){document.getElementById('modal-add-arsip') && openModal('modal-add-arsip');}

function doAddArsip(){
  var b=document.getElementById('add-bulan').value;
  var t=parseInt(document.getElementById('add-tahun').value)||2025;
  var d=parseInt(document.getElementById('add-dewasa').value)||0;
  var a=parseInt(document.getElementById('add-anak').value)||0;
  var c=document.getElementById('add-catatan').value;
  var l=document.getElementById('add-laporan-text').value;
  var newId=ARSIP_DB.length?Math.max.apply(null,ARSIP_DB.map(x=>x.id))+1:1;
  ARSIP_DB.unshift({id:newId,bulan:b,tahun:t,bapas:'Semua',dewasa:d,anak:a,catatan:c,laporan:l});
  closeModal('modal-add-arsip');
  renderArsip();renderOvArsip();
  showToast('Arsip berhasil ditambahkan! ✓','success');
  logActivity('Tambah arsip '+b+' '+t+' oleh '+currentUser.nama);
}

/* ===== USERS ===== */
function renderUserTable(){
  var tbody=document.getElementById('user-table-body');if(!tbody)return;
  tbody.innerHTML=USERS_DB.map(function(u){
    return '<tr><td><code style="font-family:\'DM Mono\',monospace;font-size:12px;">'+u.username+'</code></td>'
      +'<td>'+u.nama+'</td>'
      +'<td><span class="role-pill '+u.role+'">'+u.role+'</span></td>'
      +'<td><span class="online-dot"></span>Aktif</td>'
      +'<td><button class="btn-danger" onclick="deleteUser(\''+u.username+'\')">Hapus</button></td></tr>';
  }).join('');
}

function openAddUserModal(){openModal('modal-add-user');}

function doAddUser(){
  var un=document.getElementById('new-username').value.trim();
  var pw=document.getElementById('new-password').value;
  var nm=document.getElementById('new-nama').value.trim();
  var rl=document.getElementById('new-role').value;
  if(!un||!pw||!nm){showToast('Semua field harus diisi.','error');return;}
  if(USERS_DB.find(u=>u.username===un)){showToast('Username sudah ada.','error');return;}
  var nu={username:un,password:pw,role:rl,nama:nm};
  USERS_DB.push(nu);
  ACCOUNTS.push(nu);
  closeModal('modal-add-user');
  renderUserTable();
  showToast('User '+un+' berhasil ditambahkan!','success');
  logActivity('Tambah user '+un+' ('+rl+') oleh '+currentUser.nama);
}

function deleteUser(username){
  if(username===currentUser.username){showToast('Tidak dapat menghapus akun sendiri.','error');return;}
  if(!confirm('Hapus user '+username+'?'))return;
  USERS_DB=USERS_DB.filter(u=>u.username!==username);
  renderUserTable();
  showToast('User dihapus.','success');
  logActivity('Hapus user '+username+' oleh '+currentUser.nama);
}

/* ===== ACTIVITY LOG ===== */
function logActivity(msg){
  var now=new Date();
  var ts='['+now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0')+'] ';
  activityLog.unshift(ts+msg);
  renderActivityLog();
}
function renderActivityLog(){
  var el=document.getElementById('activity-log');if(!el)return;
  el.innerHTML=activityLog.length?activityLog.map(function(l){return '<div>'+escHtml(l)+'</div>';}).join(''):'<div style="color:var(--text3);">Belum ada aktivitas.</div>';
}

/* ===== CHARTS — PER BAPAS (Dewasa & Anak masing-masing) ===== */
function getGenderData(){
  function iv(id){var el=document.getElementById(id);return el?(parseInt(el.value)||0):0;}
  return {
    smr:{dl:iv('g_smr_dl'),dp:iv('g_smr_dp'),al:iv('g_smr_al'),ap:iv('g_smr_ap')},
    bpp:{dl:iv('g_bpp_dl'),dp:iv('g_bpp_dp'),al:iv('g_bpp_al'),ap:iv('g_bpp_ap')},
    trk:{dl:iv('g_trk_dl'),dp:iv('g_trk_dp'),al:iv('g_trk_al'),ap:iv('g_trk_ap')},
  };
}

function getJftData(){
  function iv(id){var el=document.getElementById(id);return el?(parseInt(el.value)||0):0;}
  return [
    iv('jft_kanwil_pertama')+iv('jft_kanwil_muda')+iv('jft_kanwil_madya'),
    iv('jft_smr_apk')+iv('jft_smr_pertama')+iv('jft_smr_muda')+iv('jft_smr_madya'),
    iv('jft_bpp_apk')+iv('jft_bpp_pertama')+iv('jft_bpp_muda')+iv('jft_bpp_madya'),
    iv('jft_trk_apk')+iv('jft_trk_pertama')+iv('jft_trk_muda')+iv('jft_trk_madya'),
  ];
}

function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}

function initCharts(){
  var g = getGenderData();
  var jftVals = getJftData();

  var defaults = {
    responsive:true,
    maintainAspectRatio:false,
    plugins:{legend:{position:'bottom',labels:{font:{size:11,family:'Plus Jakarta Sans'},padding:10,boxWidth:12}}}
  };

  /* ---- Bapas Samarinda: Dewasa & Anak ---- */
  destroyChart('smr-dewasa');
  charts['smr-dewasa'] = new Chart(document.getElementById('chart-smr-dewasa'),{
    type:'doughnut',
    data:{
      labels:['Laki-laki','Perempuan'],
      datasets:[{data:[g.smr.dl,g.smr.dp],backgroundColor:['rgba(59,130,246,.9)','rgba(244,114,182,.9)'],borderWidth:0,hoverOffset:5}]
    },
    options:{...defaults,cutout:'62%',plugins:{...defaults.plugins,title:{display:true,text:'Dewasa — '+( g.smr.dl+g.smr.dp)+' org',font:{size:11},color:'#475569',padding:{bottom:4}}}}
  });

  destroyChart('smr-anak');
  charts['smr-anak'] = new Chart(document.getElementById('chart-smr-anak'),{
    type:'doughnut',
    data:{
      labels:['Laki-laki','Perempuan'],
      datasets:[{data:[g.smr.al,g.smr.ap],backgroundColor:['rgba(16,185,129,.9)','rgba(251,191,36,.9)'],borderWidth:0,hoverOffset:5}]
    },
    options:{...defaults,cutout:'62%',plugins:{...defaults.plugins,title:{display:true,text:'Anak — '+(g.smr.al+g.smr.ap)+' org',font:{size:11},color:'#475569',padding:{bottom:4}}}}
  });

  /* ---- Bapas Balikpapan: Dewasa & Anak ---- */
  destroyChart('bpp-dewasa');
  charts['bpp-dewasa'] = new Chart(document.getElementById('chart-bpp-dewasa'),{
    type:'doughnut',
    data:{
      labels:['Laki-laki','Perempuan'],
      datasets:[{data:[g.bpp.dl,g.bpp.dp],backgroundColor:['rgba(245,158,11,.9)','rgba(244,114,182,.9)'],borderWidth:0,hoverOffset:5}]
    },
    options:{...defaults,cutout:'62%',plugins:{...defaults.plugins,title:{display:true,text:'Dewasa — '+(g.bpp.dl+g.bpp.dp)+' org',font:{size:11},color:'#475569',padding:{bottom:4}}}}
  });

  destroyChart('bpp-anak');
  charts['bpp-anak'] = new Chart(document.getElementById('chart-bpp-anak'),{
    type:'doughnut',
    data:{
      labels:['Laki-laki','Perempuan'],
      datasets:[{data:[g.bpp.al,g.bpp.ap],backgroundColor:['rgba(249,115,22,.9)','rgba(251,191,36,.9)'],borderWidth:0,hoverOffset:5}]
    },
    options:{...defaults,cutout:'62%',plugins:{...defaults.plugins,title:{display:true,text:'Anak — '+(g.bpp.al+g.bpp.ap)+' org',font:{size:11},color:'#475569',padding:{bottom:4}}}}
  });

  /* ---- Bapas Tarakan: Dewasa & Anak ---- */
  destroyChart('trk-dewasa');
  charts['trk-dewasa'] = new Chart(document.getElementById('chart-trk-dewasa'),{
    type:'doughnut',
    data:{
      labels:['Laki-laki','Perempuan'],
      datasets:[{data:[g.trk.dl,g.trk.dp],backgroundColor:['rgba(139,92,246,.9)','rgba(244,114,182,.9)'],borderWidth:0,hoverOffset:5}]
    },
    options:{...defaults,cutout:'62%',plugins:{...defaults.plugins,title:{display:true,text:'Dewasa — '+(g.trk.dl+g.trk.dp)+' org',font:{size:11},color:'#475569',padding:{bottom:4}}}}
  });

  destroyChart('trk-anak');
  charts['trk-anak'] = new Chart(document.getElementById('chart-trk-anak'),{
    type:'doughnut',
    data:{
      labels:['Laki-laki','Perempuan'],
      datasets:[{data:[g.trk.al,g.trk.ap],backgroundColor:['rgba(99,102,241,.9)','rgba(251,191,36,.9)'],borderWidth:0,hoverOffset:5}]
    },
    options:{...defaults,cutout:'62%',plugins:{...defaults.plugins,title:{display:true,text:'Anak — '+(g.trk.al+g.trk.ap)+' org',font:{size:11},color:'#475569',padding:{bottom:4}}}}
  });

  /* ---- Bar gabungan Dewasa & Anak per Bapas ---- */
  destroyChart('klien-compare');
  var labels = ['Samarinda','Balikpapan','Tarakan'];
  charts['klien-compare'] = new Chart(document.getElementById('chart-klien-compare'),{
    type:'bar',
    data:{
      labels:labels,
      datasets:[
        {label:'Klien Dewasa',data:[g.smr.dl+g.smr.dp, g.bpp.dl+g.bpp.dp, g.trk.dl+g.trk.dp],backgroundColor:'rgba(59,130,246,.85)',borderRadius:6,borderSkipped:false},
        {label:'Klien Anak',  data:[g.smr.al+g.smr.ap, g.bpp.al+g.bpp.ap, g.trk.al+g.trk.ap],backgroundColor:'rgba(16,185,129,.85)',borderRadius:6,borderSkipped:false}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{font:{size:11,family:'Plus Jakarta Sans'},padding:12}}},
      scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'},ticks:{font:{size:11}}},x:{grid:{display:false}}}
    }
  });

  /* ---- JFT compare (bar) ---- */
  destroyChart('jft-compare');
  charts['jft-compare'] = new Chart(document.getElementById('chart-jft-compare'),{
    type:'bar',
    data:{
      labels:['Kanwil','Samarinda','Balikpapan','Tarakan'],
      datasets:[{label:'Jumlah PK',data:jftVals,backgroundColor:['rgba(13,37,64,.85)','rgba(16,185,129,.85)','rgba(245,158,11,.85)','rgba(139,92,246,.85)'],borderRadius:7,borderSkipped:false}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'},ticks:{font:{size:11}}}}}
  });
}

function refreshInfografis(){
  syncOvJft();
  syncInfTotalKlien();
  initCharts();
  renderJftDoughnuts();
}

/* ===== TOTAL KLIEN INFOGRAFIS (dari hasil parse laporan harian) ===== */
// Data klien tersimpan setelah generate laporan
var _parsedKlien = {
  smr:{dewasa:0,anak:0}, bpp:{dewasa:0,anak:0}, trk:{dewasa:0,anak:0}
};

function syncInfTotalKlien(){
  var d = _parsedKlien;
  var smrDew=n(d.smr.dewasa), smrAnak=n(d.smr.anak);
  var bppDew=n(d.bpp.dewasa), bppAnak=n(d.bpp.anak);
  var trkDew=n(d.trk.dewasa), trkAnak=n(d.trk.anak);
  var smrTot=smrDew+smrAnak, bppTot=bppDew+bppAnak, trkTot=trkDew+trkAnak;
  var grandDew=smrDew+bppDew+trkDew, grandAnak=smrAnak+bppAnak+trkAnak, grand=grandDew+grandAnak;
  function setEl(id,v){var el=document.getElementById(id);if(el)el.textContent=grand>0?fmt(v):'—';}
  function setElSub(id,v){var el=document.getElementById(id);if(el)el.textContent=grand>0?fmt(v):'—';}
  setEl('inf-total-smr',smrTot); setElSub('inf-total-smr-dew',smrDew); setElSub('inf-total-smr-anak',smrAnak);
  setEl('inf-total-bpp',bppTot); setElSub('inf-total-bpp-dew',bppDew); setElSub('inf-total-bpp-anak',bppAnak);
  setEl('inf-total-trk',trkTot); setElSub('inf-total-trk-dew',trkDew); setElSub('inf-total-trk-anak',trkAnak);
  setEl('inf-total-semua',grand); setElSub('inf-total-semua-dew',grandDew); setElSub('inf-total-semua-anak',grandAnak);
  renderKlienTotalCharts(smrDew,smrAnak,bppDew,bppAnak,trkDew,trkAnak,grand);
  renderBapasDoughnuts(smrDew,smrAnak,bppDew,bppAnak,trkDew,trkAnak);
}

function renderBapasDoughnuts(smrDew,smrAnak,bppDew,bppAnak,trkDew,trkAnak){
  var configs=[
    {id:'chart-inf-smr-doughnut',dew:smrDew,anak:smrAnak,
     lblDew:'lbl-inf-smr-dew',lblAnak:'lbl-inf-smr-anak',lblTotal:'lbl-inf-smr-total',
     colors:['rgba(59,130,246,.9)','rgba(16,185,129,.9)']},
    {id:'chart-inf-bpp-doughnut',dew:bppDew,anak:bppAnak,
     lblDew:'lbl-inf-bpp-dew',lblAnak:'lbl-inf-bpp-anak',lblTotal:'lbl-inf-bpp-total',
     colors:['rgba(245,158,11,.9)','rgba(249,115,22,.9)']},
    {id:'chart-inf-trk-doughnut',dew:trkDew,anak:trkAnak,
     lblDew:'lbl-inf-trk-dew',lblAnak:'lbl-inf-trk-anak',lblTotal:'lbl-inf-trk-total',
     colors:['rgba(139,92,246,.9)','rgba(99,102,241,.9)']},
  ];
  configs.forEach(function(c){
    destroyChart(c.id);
    var canvas=document.getElementById(c.id); if(!canvas)return;
    var total=c.dew+c.anak;
    var hasData=total>0;
    var dLabel=document.getElementById(c.lblDew); if(dLabel)dLabel.textContent=hasData?fmt(c.dew):'—';
    var aLabel=document.getElementById(c.lblAnak); if(aLabel)aLabel.textContent=hasData?fmt(c.anak):'—';
    var tLabel=document.getElementById(c.lblTotal); if(tLabel)tLabel.textContent=hasData?fmt(total):'—';
    charts[c.id]=new Chart(canvas,{
      type:'doughnut',
      data:{
        labels:['Klien Dewasa','Klien Anak'],
        datasets:[{
          data:hasData?[c.dew,c.anak]:[1,1],
          backgroundColor:hasData?c.colors:['rgba(220,220,220,.4)','rgba(220,220,220,.2)'],
          borderWidth:0,hoverOffset:6
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,cutout:'62%',
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:function(ctx){
            if(!hasData)return 'Belum ada data';
            var pct=total>0?Math.round(ctx.raw/total*100):0;
            return ctx.label+': '+Number(ctx.raw).toLocaleString('id-ID')+' org ('+pct+'%)';
          }}}
        }
      }
    });
  });
}

function renderJftDoughnuts(){
  function iv(id){var el=document.getElementById(id);return el?(parseInt(el.value)||0):0;}
  var kw=iv('jft_kanwil_pertama')+iv('jft_kanwil_muda')+iv('jft_kanwil_madya');
  var smr=iv('jft_smr_apk')+iv('jft_smr_pertama')+iv('jft_smr_muda')+iv('jft_smr_madya');
  var bpp=iv('jft_bpp_apk')+iv('jft_bpp_pertama')+iv('jft_bpp_muda')+iv('jft_bpp_madya');
  var trk=iv('jft_trk_apk')+iv('jft_trk_pertama')+iv('jft_trk_muda')+iv('jft_trk_madya');
  var grand=kw+smr+bpp+trk;
  var hasData=grand>0;

  /* Isi angka legend kustom & center */
  function setLeg(id,v){var el=document.getElementById(id);if(el)el.textContent=hasData?v:'—';}
  setLeg('jft-leg-kw',kw); setLeg('jft-leg-smr',smr); setLeg('jft-leg-bpp',bpp); setLeg('jft-leg-trk',trk);
  setLeg('jft-leg-total',grand);
  var center=document.getElementById('jft-donut-center-val');
  if(center)center.textContent=hasData?grand:'—';

  /* Donut per unit kerja */
  destroyChart('jft-donut-unit');
  var c1=document.getElementById('chart-jft-donut-unit');
  if(c1){
    charts['jft-donut-unit']=new Chart(c1,{
      type:'doughnut',
      data:{
        labels:['Kanwil','Bapas Samarinda','Bapas Balikpapan','Bapas Tarakan'],
        datasets:[{
          data:hasData?[kw,smr,bpp,trk]:[1,1,1,1],
          backgroundColor:hasData
            ?['rgba(13,37,64,.85)','rgba(16,185,129,.85)','rgba(245,158,11,.85)','rgba(139,92,246,.85)']
            :['rgba(220,220,220,.4)','rgba(220,220,220,.3)','rgba(220,220,220,.2)','rgba(220,220,220,.1)'],
          borderWidth:0,hoverOffset:8
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,cutout:'62%',
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:function(ctx){
            if(!hasData)return 'Belum ada data';
            var pct=grand>0?Math.round(ctx.raw/grand*100):0;
            return ctx.label+': '+ctx.raw+' PK ('+pct+'%)';
          }}}
        }
      }
    });
  }
}

function renderKlienTotalCharts(smrDew,smrAnak,bppDew,bppAnak,trkDew,trkAnak,grand){
  var labels=['Bapas Samarinda','Bapas Balikpapan','Bapas Tarakan'];
  var dewData=[smrDew,bppDew,trkDew];
  var anakData=[smrAnak,bppAnak,trkAnak];
  var totData=[smrDew+smrAnak,bppDew+bppAnak,trkDew+trkAnak];
  var colors=['rgba(59,130,246,.85)','rgba(245,158,11,.85)','rgba(139,92,246,.85)'];

  /* Bar chart */
  destroyChart('klien-total-bar');
  var canvasBar=document.getElementById('chart-klien-total-bar');
  if(canvasBar){
    charts['klien-total-bar']=new Chart(canvasBar,{
      type:'bar',
      data:{
        labels:labels,
        datasets:[
          {label:'Klien Dewasa',data:dewData,backgroundColor:['rgba(59,130,246,.8)','rgba(245,158,11,.8)','rgba(139,92,246,.8)'],borderRadius:7,borderSkipped:false},
          {label:'Klien Anak',  data:anakData,backgroundColor:['rgba(96,165,250,.7)','rgba(251,191,36,.7)','rgba(196,181,253,.7)'],borderRadius:7,borderSkipped:false}
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom',labels:{font:{size:11,family:'Plus Jakarta Sans'},padding:10,boxWidth:12}},
          tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+Number(c.raw).toLocaleString('id-ID')+' orang';}}}
        },
        scales:{
          y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'},ticks:{font:{size:11},callback:function(v){return Number(v).toLocaleString('id-ID');}}},
          x:{grid:{display:false},ticks:{font:{size:11}}}
        }
      }
    });
  }

  /* Donut total per Bapas */
  destroyChart('klien-total-donut');
  var canvasDon=document.getElementById('chart-klien-total-donut');
  if(canvasDon){
    // Plugin untuk menampilkan angka di setiap segmen doughnut
    var pluginKlienDonut={
      id:'klienDonutLabels',
      afterDatasetsDraw:function(chart){
        var ctx=chart.ctx;
        chart.data.datasets.forEach(function(dataset,i){
          var meta=chart.getDatasetMeta(i);
          if(!meta.hidden){
            meta.data.forEach(function(element,index){
              ctx.save();
              var val=dataset.data[index];
              if(!val)return;
              ctx.fillStyle='#fff';
              ctx.font='bold 13px Plus Jakarta Sans, sans-serif';
              ctx.textAlign='center';
              ctx.textBaseline='middle';
              var angle=(element.startAngle+element.endAngle)/2;
              var outerR=element.outerRadius, innerR=element.innerRadius;
              var r=(outerR+innerR)/2;
              var x=element.x+r*Math.cos(angle);
              var y=element.y+r*Math.sin(angle);
              ctx.fillText(Number(val).toLocaleString('id-ID'),x,y);
              ctx.restore();
            });
          }
        });
      }
    };
    charts['klien-total-donut']=new Chart(canvasDon,{
      type:'doughnut',
      data:{
        labels:['Samarinda','Balikpapan','Tarakan'],
        datasets:[{data:totData,backgroundColor:colors,borderWidth:2,hoverOffset:8}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        cutout:'58%',
        plugins:{
          legend:{position:'bottom',labels:{font:{size:11,family:'Plus Jakarta Sans'},padding:10,boxWidth:12}},
          tooltip:{callbacks:{label:function(c){var pct=grand>0?Math.round(c.raw/grand*100):0;return c.label+': '+Number(c.raw).toLocaleString('id-ID')+' org ('+pct+'%)';}}}
        }
      },
      plugins:[pluginKlienDonut]
    });
  }
}

/* ===== JFT INFOGRAFIS (dari input JFT di Laporan Harian) ===== */
function syncJftInfografisFromLaporan(){
  // Ambil data langsung dari form JFT laporan harian
  function iv(id){var el=document.getElementById(id);return el?(parseInt(el.value)||0):0;}
  var kw=iv('jft_kanwil_pertama')+iv('jft_kanwil_muda')+iv('jft_kanwil_madya');
  var smr=iv('jft_smr_apk')+iv('jft_smr_pertama')+iv('jft_smr_muda')+iv('jft_smr_madya');
  var bpp=iv('jft_bpp_apk')+iv('jft_bpp_pertama')+iv('jft_bpp_muda')+iv('jft_bpp_madya');
  var trk=iv('jft_trk_apk')+iv('jft_trk_pertama')+iv('jft_trk_muda')+iv('jft_trk_madya');
  var grand=kw+smr+bpp+trk;
  function setEl(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  setEl('inf-jft-kanwil',kw); setEl('inf-jft-smr',smr); setEl('inf-jft-bpp',bpp); setEl('inf-jft-trk',trk);
  setEl('inf-jft-total',grand);
  // bars Kanwil
  var kwp=iv('jft_kanwil_pertama'),kwm=iv('jft_kanwil_muda'),kwma=iv('jft_kanwil_madya');
  setBar('inf-kw-1',kwp,'inf-kw-bar1',kwp,kw||1);
  setBar('inf-kw-2',kwm,'inf-kw-bar2',kwm,kw||1);
  setBar('inf-kw-3',kwma,'inf-kw-bar3',kwma,kw||1);
  // Samarinda
  var sa=iv('jft_smr_apk'),sp=iv('jft_smr_pertama'),sm=iv('jft_smr_muda');
  setBar('inf-smr-0',sa,'inf-smr-bar0',sa,smr||1);
  setBar('inf-smr-1',sp,'inf-smr-bar1',sp,smr||1);
  setBar('inf-smr-2',sm,'inf-smr-bar2',sm,smr||1);
  var sma2=iv('jft_smr_madya');
  setBar('inf-smr-3',sma2,'inf-smr-bar3',sma2,smr||1);
  // Balikpapan
  var ba=iv('jft_bpp_apk'),bp=iv('jft_bpp_pertama'),bm=iv('jft_bpp_muda');
  setBar('inf-bpp-0',ba,'inf-bpp-bar0',ba,bpp||1);
  setBar('inf-bpp-1',bp,'inf-bpp-bar1',bp,bpp||1);
  setBar('inf-bpp-2',bm,'inf-bpp-bar2',bm,bpp||1);
  var bma2=iv('jft_bpp_madya');
  setBar('inf-bpp-3',bma2,'inf-bpp-bar3',bma2,bpp||1);
  // Tarakan
  var ta=iv('jft_trk_apk'),tp=iv('jft_trk_pertama'),tm=iv('jft_trk_muda');
  setBar('inf-trk-0',ta,'inf-trk-bar0',ta,trk||1);
  setBar('inf-trk-1',tp,'inf-trk-bar1',tp,trk||1);
  setBar('inf-trk-2',tm,'inf-trk-bar2',tm,trk||1);
  var tma2=iv('jft_trk_madya');
  setBar('inf-trk-3',tma2,'inf-trk-bar3',tma2,trk||1);
  // rebuild chart
  if(charts['jft-compare']){charts['jft-compare'].destroy();delete charts['jft-compare'];}
  var canvas=document.getElementById('chart-jft-compare');
  if(canvas){
    charts['jft-compare']=new Chart(canvas,{
      type:'bar',
      data:{
        labels:['Kanwil','Samarinda','Balikpapan','Tarakan'],
        datasets:[{label:'Jumlah PK',data:[kw,smr,bpp,trk],backgroundColor:['rgba(13,37,64,.85)','rgba(16,185,129,.85)','rgba(245,158,11,.85)','rgba(139,92,246,.85)'],borderRadius:7,borderSkipped:false}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.05)'},ticks:{font:{size:11}}}}}
    });
  }
  renderJftDoughnuts();
}

function refreshJftInfografis(){
  syncJftInfografisFromLaporan();
  showToast('Data JFT diperbarui dari Laporan Harian ✓','success');
}
function openModal(id){var el=document.getElementById(id);if(el)el.classList.add('open');}
function closeModal(id){var el=document.getElementById(id);if(el)el.classList.remove('open');}
document.addEventListener('click',function(e){
  if(e.target.classList.contains('modal-overlay'))e.target.classList.remove('open');
});

/* ===== TOAST ===== */
var toastTimer;
function showToast(msg,type){
  var el=document.getElementById('toast');
  el.textContent=msg;
  el.className='toast '+(type||'');
  clearTimeout(toastTimer);
  setTimeout(function(){el.classList.add('show');},10);
  toastTimer=setTimeout(function(){el.classList.remove('show');},3200);
}
