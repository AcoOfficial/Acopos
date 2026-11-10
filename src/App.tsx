import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, ArrowUpRight, BarChart3, Bell, Building2, CalendarCheck, 
  CheckCircle2, ChevronDown, CircleHelp, Clock3, FileClock, LayoutDashboard,
  LogOut, Menu, Monitor, Package, Plus, QrCode, ReceiptText, Search, Settings, ShieldCheck,
  ShoppingBag, Store, Users, Wallet, Warehouse, X, ShoppingCart, Trash2, UserPlus, PackagePlus, RefreshCw, Tag, Printer, TrendingUp,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";

const nav = [
  { group: "UTAMA", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { group: "PERUSAHAAN", items: [{ id: "company", label: "Pusat Perusahaan", icon: Building2 }] },
  { group: "PENJUALAN", items: [{ id: "pos", label: "POS / Kasir", icon: ShoppingBag }, { id: "display", label: "Customer Display", icon: Monitor }, { id: "transactions", label: "Transaksi", icon: ReceiptText }] },
  { group: "PRODUK", items: [{ id: "products", label: "Produk & Kategori", icon: Package }, { id: "inventory", label: "Inventaris & Stok", icon: Warehouse }] },
  { group: "OPERASIONAL", items: [{ id: "cashier", label: "Manajemen Kasir", icon: Wallet }, { id: "queue", label: "Antrean", icon: Activity }, { id: "self-order", label: "Self Order", icon: QrCode }] },
  { group: "SDM", items: [{ id: "employees", label: "Karyawan", icon: Users }, { id: "attendance", label: "Absensi", icon: CalendarCheck }] },
  { group: "LAPORAN", items: [{ id: "finance", label: "Laporan Keuangan", icon: BarChart3 }, { id: "attendance-report", label: "Laporan Absensi", icon: FileClock }] },
  { group: "SISTEM", items: [{ id: "audit", label: "Riwayat Aktivitas", icon: ShieldCheck }, { id: "settings", label: "Pengaturan Tenant", icon: Settings }, { id: "help", label: "Bantuan Joeclyn", icon: CircleHelp }] },
];

const titles: Record<string, string> = Object.fromEntries(nav.flatMap(g => g.items.map(i => [i.id, i.label] as const)));
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<"login"|"register">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<{id:string;name:string;company_id:string;status:string}[]>([]);
  const [activeTenantId, setActiveTenantId] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadRole() {
      if (!session || !supabase) { setPlatformRole(null); setRoleReady(true); return; }
      setRoleReady(false);
      const { data, error } = await supabase.from("profiles").select("platform_role").eq("id", session.user.id).maybeSingle();
      if (!alive) return;
      setPlatformRole(error ? null : (data?.platform_role ?? "none"));
      setRoleReady(true);
    }
    void loadRole();
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    let alive = true;
    async function loadTenants() {
      if (!supabase || !session) { setTenantOptions([]); setActiveTenantId(""); return; }
      const { data } = await supabase.from("tenants").select("id,name,company_id,status").order("created_at", { ascending: true });
      if (!alive) return;
      const next = (data ?? []) as {id:string;name:string;company_id:string;status:string}[];
      setTenantOptions(next);
      if (!next.some(t => t.id === activeTenantId)) setActiveTenantId(next[0]?.id ?? "");
    }
    void loadTenants();
    return () => { alive = false; };
  }, [session, active, activeTenantId]);

  const pageTitle = titles[active] ?? "Dashboard";
    async function signIn(e: FormEvent) {
    e.preventDefault(); setAuthError(""); setAuthMessage(""); setLoading(true);
    if (!supabase) { setAuthError("Konfigurasi Supabase belum tersedia. Isi environment variables terlebih dahulu."); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setLoading(false);
  }

  async function signUp(e: FormEvent) {
    e.preventDefault(); setAuthError(""); setAuthMessage(""); setLoading(true);
    if (!supabase) { setAuthError("Konfigurasi Supabase belum tersedia."); setLoading(false); return; }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    if (error) setAuthError(error.message);
    else if (data.session) setSession(data.session);
    else setAuthMessage("Pendaftaran berhasil. Periksa email untuk verifikasi, lalu masuk dan buka Pusat Perusahaan untuk memasukkan Kode Aktivasi Owner.");
    setLoading(false);
  }

  async function signOut() { await supabase?.auth.signOut(); setSession(null); }

  const publicOrderSlug = window.location.pathname.startsWith("/order/") ? decodeURIComponent(window.location.pathname.slice("/order/".length)) : new URLSearchParams(window.location.search).get("self-order");
  if (publicOrderSlug) return <PublicSelfOrder slug={publicOrderSlug}/>;

  if (!authReady) return <div className="boot-screen"><div className="brand-mark">a</div><span>Menyiapkan acoPos…</span></div>;

  if (!session) return <main className="login-shell">
    <section className="login-brand"><div className="brand-lockup"><div className="brand-mark">a</div><span>aco<span>Pos</span></span></div><div className="login-copy"><div className="eyebrow">BUSINESS OPERATING PLATFORM</div><h1>Kelola bisnis.<br/><em>Lebih terarah.</em></h1><p>Satu workspace untuk penjualan, inventaris, tim, dan seluruh operasional bisnis Anda.</p></div><div className="login-foot">© 2026 acoPos · Business Workspace</div></section>
    <section className="login-panel"><form className="login-card" onSubmit={authMode==="login"?signIn:signUp}><div className="mobile-brand"><div className="brand-mark">a</div><b>acoPos</b></div><div className="eyebrow">{authMode==="login"?"SELAMAT DATANG KEMBALI":"MULAI MENGGUNAKAN ACOPOS"}</div><h2>{authMode==="login"?"Masuk ke akun Anda":"Daftar akun Owner"}</h2><p className="muted">{authMode==="login"?"Gunakan akun acoPos untuk melanjutkan.":"Buat akun terlebih dahulu. Aktivasi Company membutuhkan Kode Aktivasi dari Super Admin."}</p>{authMode==="register"&&<><label>Nama lengkap</label><input required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Nama Anda"/></>}<label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@perusahaan.com"/><label>Password</label><input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter"/>{authError&&<div className="error-note">{authError}</div>}{authMessage&&<div className="notice-panel">{authMessage}</div>}<button className="primary-btn" disabled={loading}>{loading?"Memproses…":authMode==="login"?"Masuk":"Buat akun"} <ArrowUpRight size={17}/></button><div className="login-help">{authMode==="login"?"Belum punya akun?":"Sudah punya akun?"} <button type="button" className="text-btn" onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthError("");setAuthMessage("");}}>{authMode==="login"?"Daftar Owner":"Masuk"}</button></div><div className="login-help">Butuh bantuan? <a href="mailto:support@acopos.app">Hubungi Joeclyn</a></div></form></section>
  </main>;

  if (session && !roleReady) return <div className="boot-screen"><div className="brand-mark">a</div><span>Memeriksa hak akses…</span></div>;
  if (session && platformRole === "super_admin") return <SuperAdminHome email={session.user.email ?? ""} onSignOut={signOut} />;
  if (session && platformRole === "admin_platform") return <AdminPlatformHome email={session.user.email ?? ""} onSignOut={signOut} />;

  return <div className="app-shell">
    {mobileOpen && <button className="scrim" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand-lockup side-brand"><div className="brand-mark">a</div><span>aco<span>Pos</span></span><button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-icon"><Store size={18}/></div><div><b>Workspace</b><small>Tenant aktif</small></div><ChevronDown size={15}/></div>
      <nav className="side-nav">{nav.map(group => <div className="nav-group" key={group.group}><div className="nav-label">{group.group}</div>{group.items.map(item => <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => { setActive(item.id); setMobileOpen(false); }}><item.icon size={18} strokeWidth={1.8}/><span>{item.label}</span></button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><b>Perlu bantuan?</b><small>Joeclyn siap membantu</small></div><ArrowUpRight size={15}/></div><button className="profile-row" onClick={signOut}><div className="avatar">{(session.user.email ?? "U").slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{session.user.email}</b><small>Keluar dari akun</small></div><LogOut size={16}/></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-btn menu-toggle" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><div className="breadcrumbs">Workspace <span>/</span> <b>{pageTitle}</b></div></div><div className="topbar-actions">{tenantOptions.length > 0 && <select aria-label="Tenant aktif" className="tenant-picker" value={activeTenantId} onChange={e => setActiveTenantId(e.target.value)}>{tenantOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}<div className="search-box"><Search size={16}/><input placeholder="Cari menu atau data…"/></div><button className="icon-btn notification-btn"><Bell size={18}/><i/></button><div className="top-avatar">{(session.user.email ?? "U").slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content"><div className="page-heading"><div><div className="eyebrow">TENANT WORKSPACE</div><h1>{pageTitle}</h1><p>Ringkasan dan pengelolaan operasional bisnis Anda.</p></div><div className="heading-actions"><button className="secondary-btn"><Clock3 size={16}/> Hari ini <ChevronDown size={15}/></button><button className="primary-btn small"><Plus size={16}/> Tambah baru</button></div></div>
        {active === "dashboard" ? <Dashboard tenantId={activeTenantId} /> : <ModulePage id={active} title={pageTitle} userId={session.user.id} tenantId={activeTenantId} onRefreshTenants={() => { void supabase?.from("tenants").select("id,name,company_id,status").order("created_at").then(({data}) => { const next=(data??[]) as {id:string;name:string;company_id:string;status:string}[]; setTenantOptions(next); if(!activeTenantId && next[0]) setActiveTenantId(next[0].id); }); }} />}
      </div>
    </main>
  </div>;
}

function Dashboard({tenantId}:{tenantId:string}) {
 const [stats,setStats]=useState([{label:"Penjualan hari ini",value:money(0),change:"Hari ini",icon:Wallet},{label:"Total transaksi",value:"0",change:"Hari ini",icon:ReceiptText},{label:"Produk aktif",value:"0",change:"Tenant aktif",icon:Package},{label:"Karyawan",value:"0",change:"Tenant aktif",icon:Users}]);
 const [openSession,setOpenSession]=useState<any>(null);const [queueCount,setQueueCount]=useState(0);const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;async function load(){if(!supabase||!tenantId){setLoading(false);return;}const start=new Date();start.setHours(0,0,0,0);const [sales,products,members,sessions,queue]=await Promise.all([supabase.from("sales_transactions").select("grand_total",{count:"exact"}).eq("tenant_id",tenantId).eq("status","completed").gte("created_at",start.toISOString()),supabase.from("products").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("is_active",true),supabase.from("tenant_members").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).eq("is_active",true),supabase.from("cashier_sessions").select("id,session_number,opened_at").eq("tenant_id",tenantId).eq("status","open").limit(1),supabase.from("queue_tickets").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId).in("status",["waiting","called","serving"])]);if(!live)return;setStats([{label:"Penjualan hari ini",value:money((sales.data??[]).reduce((s,r)=>s+Number(r.grand_total),0)),change:"Hari ini",icon:Wallet},{label:"Total transaksi",value:String(sales.count??0),change:"Hari ini",icon:ReceiptText},{label:"Produk aktif",value:String(products.count??0),change:"Tenant aktif",icon:Package},{label:"Karyawan",value:String(members.count??0),change:"Tenant aktif",icon:Users}]);setOpenSession(sessions.data?.[0]??null);setQueueCount(queue.count??0);setLoading(false);}void load();return()=>{live=false}},[tenantId]);
 return <><div className="stats-grid">{stats.map(s=><article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><div className="stat-icon"><s.icon size={18}/></div></div><strong>{loading?"…":s.value}</strong><small>{s.change}</small></article>)}</div><div className="dashboard-grid"><section className="panel sales-panel"><div className="panel-heading"><div><h3>Ikhtisar penjualan</h3><p>Akumulasi transaksi berhasil hari ini</p></div><button className="text-btn" onClick={()=>window.print()}>Cetak ringkasan <Printer size={14}/></button></div><div className="empty-chart"><div className="chart-icon"><TrendingUp size={25}/></div><b>{loading?"Memuat data…":"Data operasional diperbarui dari database"}</b><span>Ringkasan penjualan, stok, dan karyawan mengikuti Tenant yang sedang dipilih.</span></div></section><section className="panel"><div className="panel-heading"><div><h3>Status operasional</h3><p>Kondisi Tenant saat ini</p></div><Activity size={18}/></div><div className="status-list"><div><span><i className={"status-dot "+(openSession?"green":"gray")}/>Sesi kasir</span><b>{openSession?"Sesi #"+openSession.session_number+" aktif":"Belum dibuka"}</b></div><div><span><i className={"status-dot "+(queueCount?"green":"gray")}/>Antrean aktif</span><b>{queueCount} tiket</b></div><div><span><i className="status-dot gray"/>Self Order</span><b>Kelola pada modul Self Order</b></div></div></section></div></>;
}
function ModulePage({id,title,userId,tenantId,onRefreshTenants}:{id:string;title:string;userId:string;tenantId:string;onRefreshTenants:()=>void}) {
  if (id === "company") return <CompanyModule userId={userId} onRefreshTenants={onRefreshTenants}/>;
  if (!tenantId) return <section className="module-placeholder"><div className="module-icon"><Building2 size={24}/></div><h2>Belum ada Tenant</h2><p>Buat Company dan Tenant melalui Pusat Perusahaan terlebih dahulu.</p></section>;
  if (id === "products") return <ProductsModule tenantId={tenantId}/>;
  if (id === "inventory") return <InventoryModule tenantId={tenantId}/>;
  if (id === "pos") return <PosModule tenantId={tenantId} userId={userId}/>;
  if (id === "cashier") return <CashierModule tenantId={tenantId} userId={userId}/>;
  if (id === "transactions") return <TransactionsModule tenantId={tenantId}/>;
  if (id === "finance") return <FinanceModule tenantId={tenantId}/>;
  if (id === "employees") return <EmployeesModule tenantId={tenantId}/>;
  if (id === "queue") return <QueueModule tenantId={tenantId}/>;
  if (id === "self-order") return <SelfOrderModule tenantId={tenantId}/>;
  if (id === "display") return <DisplayModule tenantId={tenantId}/>;
  if (id === "settings") return <SettingsModule tenantId={tenantId} userId={userId}/>;
  if (id === "audit") return <AuditModule tenantId={tenantId}/>;
  if (id === "help") return <HelpModule tenantId={tenantId} userId={userId}/>;
  if (id === "attendance") return <AttendanceModule userId={userId} report={false}/>;
  if (id === "attendance-report") return <AttendanceModule userId={userId} report={true}/>;
  const descriptions: Record<string,string> = {pos:"Antarmuka penjualan, keranjang, pembayaran, catatan item, dan catatan pesanan.",display:"Tampilan pelanggan yang tersinkronisasi dengan register kasir.",transactions:"Riwayat, detail, pembayaran, dan status transaksi Tenant.",products:"Katalog produk, kategori, harga modal, harga jual, dan barcode.",inventory:"Stok awal, pergerakan barang, penyesuaian, dan peringatan stok.",cashier:"Pembukaan modal awal, sesi kasir, rekonsiliasi cash/transfer/QRIS, dan bukti tutup.",queue:"Pengaturan nomor antrean, pemanggilan, loket, dan layar pelanggan.", "self-order":"Katalog QR, pesanan pelanggan, bukti pembayaran, dan verifikasi.",employees:"Akun karyawan, penugasan Tenant, role, dan izin granular.",attendance:"Absensi kasir otomatis serta absensi masuk/pulang karyawan non-kasir.",finance:"Penjualan, metode pembayaran, rekonsiliasi, HPP, dan laba kotor.", "attendance-report":"Rekap kehadiran, jam masuk/pulang, durasi, dan sesi terbuka.",audit:"Jejak perubahan data, aktivitas pengguna, dan aktivitas keamanan.",settings:"Profil toko, register, pembayaran, struk, dan konfigurasi modul.",help:"Live Chat dan kanal bantuan Telegram Joeclyn."};
  return <section className="module-placeholder"><div className="module-icon"><Store size={24}/></div><div className="eyebrow">MODUL TENANT</div><h2>{title}</h2><p>{descriptions[id] ?? "Modul operasional acoPos."}</p><div className="module-state"><Activity size={16}/> Fondasi modul sedang disiapkan dan akan dihubungkan ke database.</div></section>;
}

export default App;

function SuperAdminHome({email,onSignOut}:{email:string;onSignOut:()=>void}) {
  const [page,setPage]=useState("Ringkasan");
  const [counts,setCounts]=useState({companies:0,tenants:0,admins:0,packages:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let alive=true;
    async function load(){
      if(!supabase)return;
      const tables=["companies","tenants","profiles","packages"] as const;
      const results=await Promise.all(tables.map(table=>supabase!.from(table).select("*",{count:"exact",head:true})));
      if(!alive)return;
      if(results.some(r=>r.error))setError("Sebagian ringkasan belum dapat dibaca. Periksa kebijakan akses database.");
      setCounts({companies:results[0].count??0,tenants:results[1].count??0,admins:results[2].count??0,packages:results[3].count??0});
      setLoading(false);
    }
    void load();return()=>{alive=false;};
  },[]);
  const cards=[
    {label:"Company terdaftar",value:counts.companies,icon:Building2},
    {label:"Tenant terdaftar",value:counts.tenants,icon:Store},
    {label:"Akun profil",value:counts.admins,icon:Users},
    {label:"Paket berlangganan",value:counts.packages,icon:Wallet},
  ];
  const navItems=["Ringkasan","Company","Tenant","Admin Platform","Paket & Langganan","Langganan Company","Permintaan Pembayaran","Kode Aktivasi","Audit Platform"];
  const descriptions:Record<string,string>={
    Company:"Daftar Company pelanggan. Akses ini tidak membuka rincian transaksi pelanggan.",
    Tenant:"Daftar Tenant dan Company induknya.",
    "Admin Platform":"Akun administrator platform dan status akunnya.",
    "Langganan Company":"Status langganan per Company, masa aktif, dan kuota Tenant.",
    "Audit Platform":"Jejak aktivitas platform dan perubahan administrasi.",
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup side-brand"><div className="brand-mark">a</div><span>aco<span>Pos</span></span></div>
      <div className="workspace-switch"><div className="workspace-icon"><ShieldCheck size={18}/></div><div><b>Platform Control</b><small>Super Admin</small></div></div>
      <nav className="side-nav"><div className="nav-group"><div className="nav-label">PENGELOLAAN PLATFORM</div>
        {navItems.map(item=><button key={item} className={"nav-item "+(page===item?"active":"")} onClick={()=>setPage(item)}><span>{item}</span></button>)}
      </div></nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><b>Joeclyn Support</b><small>Bantuan platform</small></div></div><button className="profile-row" onClick={onSignOut}><div className="avatar">{email.slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{email}</b><small>Keluar dari akun</small></div><LogOut size={16}/></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Platform Control <span>/</span> <b>{page}</b></div><div className="topbar-actions"><span className="eyebrow">SUPER ADMIN</span><div className="top-avatar">{email.slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">PUSAT KENDALI ACOPOS</div><h1>{page==="Ringkasan"?"Platform Overview":page}</h1><p>{descriptions[page]??"Pengelolaan ekosistem Company, Tenant, akun, dan langganan acoPos."}</p></div><span className="module-state"><ShieldCheck size={16}/> Akses Super Admin</span></div>
        {page==="Ringkasan"&&<>
          <div className="stats-grid">{cards.map(card=><article className="stat-card" key={card.label}><div className="stat-top"><span>{card.label}</span><div className="stat-icon"><card.icon size={18}/></div></div><strong>{loading?"…":card.value.toLocaleString("id-ID")}</strong><small>Data database saat ini</small></article>)}</div>
          <section className="panel"><div className="panel-heading"><div><h3>Area kendali platform</h3><p>Pilih modul administrasi di navigasi sebelah kiri.</p></div></div><div className="stats-grid">{navItems.slice(1).map(title=><button className="stat-card" key={title} onClick={()=>setPage(title)}><strong style={{fontSize:16}}>{title}</strong><small>{descriptions[title]??"Konfigurasi dan administrasi platform acoPos."}</small></button>)}</div></section>
          <div className="notice-panel"><div className="notice-icon"><ShieldCheck size={19}/></div><div><b>Anda masuk sebagai Super Admin</b><p>Panel platform terpisah dari Workspace Tenant. Data transaksi pelanggan tetap dibatasi sesuai prinsip akses minimum.</p></div><CheckCircle2 size={18}/></div>
        </>}
        {page==="Company"&&<PlatformTable table="companies" title="Company terdaftar" columns={["name","slug","status","owner_user_id","created_at"]}/>}
        {page==="Tenant"&&<PlatformTable table="tenants" title="Tenant terdaftar" columns={["name","slug","status","company_id","created_at"]}/>}
        {page==="Admin Platform"&&<PlatformAdminsManager/>}
        {page==="Paket & Langganan"&&<PackagesManager/>}
        {page==="Langganan Company"&&<PlatformTable table="company_subscriptions" title="Langganan Company" columns={["company_id","package_id","status","starts_at","ends_at","tenant_quota_snapshot"]}/>}
        {page==="Audit Platform"&&<PlatformTable table="audit_logs" title="Audit platform" columns={["action","entity_type","entity_id","actor_id","created_at"]}/>}
        {page==="Permintaan Pembayaran"&&<PaymentRequestsManager/>}
        {page==="Kode Aktivasi"&&<ActivationCodesManager/>}
        {error&&<div className="error-note">{error}</div>}
      </div>
    </main>
  </div>;
}

function PlatformTable({table,title,columns,filterAdmin=false}:{table:string;title:string;columns:string[];filterAdmin?:boolean}) {
  const [rows,setRows]=useState<Record<string,any>[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let alive=true;
    async function load(){
      if(!supabase)return;
      let query=supabase.from(table).select(columns.join(",")).order("created_at",{ascending:false}).limit(100);
      if(filterAdmin)query=query.eq("platform_role","admin_platform");
      const {data,error}=await query;
      if(!alive)return;
      if(error)setError(error.message);
      setRows((data??[]) as Record<string,any>[]);setLoading(false);
    }
    void load();return()=>{alive=false;};
  },[table,columns.join(","),filterAdmin]);
  return <section className="panel"><div className="panel-heading"><div><h3>{title}</h3><p>Maksimal 100 data terbaru.</p></div></div>{error&&<div className="error-note">{error}</div>}<div className="table-wrap"><table><thead><tr>{columns.map(col=><th key={col}>{col.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan={columns.length}>Memuat data…</td></tr>:rows.map((row,i)=><tr key={row.id??i}>{columns.map(col=><td key={col}>{row[col]===null?"—":String(row[col]??"—")}</td>)}</tr>)}{!loading&&rows.length===0&&<tr><td colSpan={columns.length}>Belum ada data.</td></tr>}</tbody></table></div></section>;
}

function PackagesManager() {
  const [rows,setRows]=useState<any[]>([]);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [price,setPrice]=useState("0");
  const [duration,setDuration]=useState("30");
  const [quota,setQuota]=useState("1");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function load(){if(!supabase)return;const {data,error}=await supabase.from("packages").select("id,name,description,price,duration_days,tenant_quota,is_active").order("created_at",{ascending:false});if(error)setError(error.message);setRows(data??[]);}
  useEffect(()=>{void load();},[]);
  async function create(e:FormEvent){
    e.preventDefault();if(!supabase)return;setBusy(true);setError("");setMessage("");
    const {error}=await supabase.from("packages").insert({name:name.trim(),description:description.trim()||null,price:Number(price),duration_days:Number(duration),tenant_quota:Number(quota),features:{},is_active:true});
    if(error)setError(error.message);else{setMessage("Paket berhasil dibuat.");setName("");setDescription("");setPrice("0");await load();}
    setBusy(false);
  }
  async function toggle(row:any){
    if(!supabase)return;setBusy(true);setError("");const {error}=await supabase.from("packages").update({is_active:!row.is_active}).eq("id",row.id);if(error)setError(error.message);else await load();setBusy(false);
  }
  return <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Buat paket langganan</h3><p>Harga dalam Rupiah. Durasi dan kuota berlaku per Company.</p></div></div>
    <form className="login-card" onSubmit={create}><label>Nama paket</label><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Contoh: Basic"/><label>Deskripsi</label><input value={description} onChange={e=>setDescription(e.target.value)}/><label>Harga (IDR)</label><input type="number" min="0" required value={price} onChange={e=>setPrice(e.target.value)}/><label>Durasi (hari)</label><input type="number" min="1" required value={duration} onChange={e=>setDuration(e.target.value)}/><label>Kuota Tenant</label><input type="number" min="1" required value={quota} onChange={e=>setQuota(e.target.value)}/><button className="primary-btn" disabled={busy}>{busy?"Menyimpan…":"Simpan Paket"}</button></form>
    {message&&<div className="notice-panel">{message}</div>}{error&&<div className="error-note">{error}</div>}
  </section><section className="panel"><div className="panel-heading"><div><h3>Daftar paket</h3><p>Nonaktifkan paket agar tidak ditawarkan untuk pembelian baru.</p></div></div><div className="table-wrap"><table><thead><tr><th>Paket</th><th>Harga</th><th>Durasi</th><th>Tenant</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}</td><td>{Number(row.price).toLocaleString("id-ID")}</td><td>{row.duration_days} hari</td><td>{row.tenant_quota}</td><td>{row.is_active?"Aktif":"Nonaktif"}</td><td><button className="text-btn" disabled={busy} onClick={()=>void toggle(row)}>{row.is_active?"Nonaktifkan":"Aktifkan"}</button></td></tr>)}{rows.length===0&&<tr><td colSpan={6}>Belum ada paket.</td></tr>}</tbody></table></div></section></div>;
}



type TenantOption = {id:string;name:string};
type AttendanceRow = {id:string;tenant_id:string;employee_id:string;source:string;check_in_at:string;check_out_at:string|null};
function AttendanceModule({userId,report}:{userId:string;report:boolean}) {
  const [tenants,setTenants] = useState<TenantOption[]>([]);
  const [tenantId,setTenantId] = useState("");
  const [rows,setRows] = useState<AttendanceRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  async function loadTenants() {
    if (!supabase) return;
    const {data:owned}=await supabase.from("companies").select("id").eq("owner_user_id",userId);
    let tenantRows:any[]=[];
    if (owned?.length) {
      const {data}=await supabase.from("tenants").select("id,name").in("company_id",owned.map(x=>x.id)).order("name");
      tenantRows=data??[];
    } else {
      const {data}=await supabase.from("tenant_members").select("tenant_id,tenants(id,name)").eq("user_id",userId).eq("is_active",true);
      tenantRows=(data??[]).map((x:any)=>Array.isArray(x.tenants)?x.tenants[0]:x.tenants).filter(Boolean);
    }
    setTenants(tenantRows);
    if (tenantRows.length && !tenantRows.some(t=>t.id===tenantId)) setTenantId(tenantRows[0].id);
    setLoading(false);
  }
  async function loadRows() {
    if (!supabase || !tenantId) {setRows([]);return;}
    const {data,error:queryError}=await supabase.from("attendance_records").select("id,tenant_id,employee_id,source,check_in_at,check_out_at").eq("tenant_id",tenantId).order("check_in_at",{ascending:false}).limit(100);
    if (queryError) setError(queryError.message);
    setRows((data??[]) as AttendanceRow[]);
  }
  useEffect(()=>{void loadTenants();},[userId]);
  useEffect(()=>{void loadRows();},[tenantId,report]);
  const ownOpen=rows.find(r=>r.employee_id===userId && !r.check_out_at);
  const fmt=(v:string|null)=>v?new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"Belum pulang";
  async function checkIn() {
    if (!supabase || !tenantId) return;
    setBusy(true);setError("");setMessage("");
    const {error:insertError}=await supabase.from("attendance_records").insert({tenant_id:tenantId,employee_id:userId,source:"manual"});
    if (insertError) setError(insertError.message); else setMessage("Absensi masuk berhasil dicatat menggunakan waktu server.");
    await loadRows();setBusy(false);
  }
  async function checkOut() {
    if (!supabase || !ownOpen) return;
    setBusy(true);setError("");setMessage("");
    const {error:updateError}=await supabase.from("attendance_records").update({check_out_at:new Date().toISOString()}).eq("id",ownOpen.id).is("check_out_at",null);
    if (updateError) setError(updateError.message); else setMessage("Absensi pulang berhasil dicatat menggunakan waktu server.");
    await loadRows();setBusy(false);
  }
  return <div className="dashboard-grid">
    <section className="panel">
      <div className="panel-heading"><div><h3>{report?"Laporan kehadiran":"Absensi karyawan"}</h3><p>{report?"Riwayat kehadiran untuk Tenant yang dapat Anda akses.":"Absensi masuk/pulang berbasis akun untuk karyawan non-kasir."}</p></div><CalendarCheck size={19}/></div>
      {loading?<p className="muted">Memuat Tenant…</p>:tenants.length===0?<div className="empty-chart"><b>Belum ada Tenant yang ditugaskan</b><span>Owner perlu membuat Tenant atau Manager/Employee perlu ditugaskan ke Tenant.</span></div>:<>
        <label>Tenant</label><select value={tenantId} onChange={e=>setTenantId(e.target.value)}>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {!report&&<div className="notice-panel"><div className="notice-icon"><Clock3 size={18}/></div><div><b>{ownOpen?"Anda sudah tercatat masuk":"Belum ada absensi masuk aktif"}</b><p>{ownOpen?"Masuk: "+fmt(ownOpen.check_in_at)+" · Sumber: akun karyawan":"Tekan tombol masuk saat mulai bekerja, lalu pulang saat selesai. Waktu dicatat oleh server."}</p></div></div>}
        {!report&&<div className="heading-actions">{ownOpen?(ownOpen.source==="manual"?<button className="primary-btn" disabled={busy} onClick={checkOut}>{busy?"Menyimpan…":"Catat Pulang"}</button>:<p className="muted">Absensi masuk tercatat otomatis dari sesi kasir. Tutup sesi kasir untuk mencatat waktu pulang.</p>):<button className="primary-btn" disabled={busy||!tenantId} onClick={checkIn}>{busy?"Menyimpan…":"Catat Masuk"}</button>}</div>}
        {message&&<div className="notice-panel">{message}</div>}{error&&<div className="error-note">{error}</div>}
        <div className="table-wrap"><table><thead><tr><th>Waktu Masuk</th><th>Waktu Pulang</th><th>Sumber</th><th>Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{fmt(row.check_in_at)}</td><td>{fmt(row.check_out_at)}</td><td>{row.source==="cashier_session"?"Sesi kasir":"Manual akun"}</td><td>{row.check_out_at?"Selesai":"Sedang bekerja"}</td></tr>)}{rows.length===0&&<tr><td colSpan={4}>Belum ada catatan kehadiran.</td></tr>}</tbody></table></div>
      </>}
    </section>
  </div>;
}

type TenantRow={id:string;name:string;company_id:string;status:string};
const fmtDate=(v:string)=>new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));
const slugify=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
async function hashActivation(code:string){const bytes=new TextEncoder().encode(code.trim().toUpperCase());const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");}

function CompanyModule({userId,onRefreshTenants}:{userId:string;onRefreshTenants:()=>void}) {
 const [company,setCompany]=useState<any>(null);const [tenants,setTenants]=useState<TenantRow[]>([]);const [subscription,setSubscription]=useState<any>(null);const [packages,setPackages]=useState<any[]>([]);
 const [code,setCode]=useState("");const [companyName,setCompanyName]=useState("");const [tenantName,setTenantName]=useState("");
 const [newTenant,setNewTenant]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
 const [paymentPackage,setPaymentPackage]=useState("");const [paymentMethod,setPaymentMethod]=useState("bank_transfer");const [reference,setReference]=useState("");
 async function load(){if(!supabase)return;const {data:co}=await supabase.from("companies").select("*").eq("owner_user_id",userId).maybeSingle();setCompany(co);if(co){const [t,s,p]=await Promise.all([supabase.from("tenants").select("id,name,company_id,status").eq("company_id",co.id).order("created_at"),supabase.from("company_subscriptions").select("*,packages(name,price,duration_days,tenant_quota)").eq("company_id",co.id).maybeSingle(),supabase.from("packages").select("id,name,price,duration_days,tenant_quota").eq("is_active",true).order("price")]);setTenants((t.data??[]) as TenantRow[]);setSubscription(s.data);setPackages(p.data??[]);if(!paymentPackage&&p.data?.[0])setPaymentPackage(p.data[0].id);} }
 useEffect(()=>{void load()},[userId]);
 async function activate(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError("");setMessage("");try{const hash=await hashActivation(code);const {error}=await supabase.rpc("redeem_owner_activation",{p_code_hash:hash,p_company_name:companyName,p_tenant_name:tenantName});if(error)throw error;setMessage("Akun Owner, Company, dan Tenant utama berhasil diaktifkan.");setCode("");await load();onRefreshTenants();}catch(e:any){setError(e.message??"Aktivasi gagal");}setBusy(false);}
 async function addTenant(e:FormEvent){e.preventDefault();if(!supabase||!company)return;setBusy(true);setError("");const slug=slugify(newTenant)+"-"+Math.random().toString(36).slice(2,7);const {error}=await supabase.from("tenants").insert({company_id:company.id,name:newTenant,slug,status:"active"});if(error)setError(error.message);else{setMessage("Tenant berhasil dibuat.");setNewTenant("");await load();onRefreshTenants();}setBusy(false);}
 async function requestPayment(e:FormEvent){e.preventDefault();if(!supabase||!company)return;const pkg=packages.find(p=>p.id===paymentPackage);if(!pkg)return;setBusy(true);setError("");const {error}=await supabase.from("subscription_payment_requests").insert({company_id:company.id,package_id:pkg.id,amount:pkg.price,payment_method:paymentMethod,payment_reference:reference||null,requested_by:userId});if(error)setError(error.message);else{setMessage("Permintaan aktivasi/perpanjangan tercatat. Admin Platform akan memverifikasi pembayaran.");setReference("");}setBusy(false);}
 if(!company)return <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Aktivasi Owner acoPos</h3><p>Masukkan kode aktivasi yang diterbitkan Super Admin. Kode aktivasi mengaktifkan akun Owner, bukan langganan Company.</p></div><ShieldCheck size={20}/></div><form className="form-grid" onSubmit={activate}><label>Kode Aktivasi<input required value={code} onChange={e=>setCode(e.target.value)} placeholder="ACO-XXXXXXXXXXXX"/></label><label>Nama Company<input required value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Nama perusahaan"/></label><label>Nama Tenant utama<input required value={tenantName} onChange={e=>setTenantName(e.target.value)} placeholder="Nama toko/cabang utama"/></label><button className="primary-btn" disabled={busy}>{busy?"Memproses…":"Aktifkan Company"}</button></form>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}</section></div>;
 return <div className="dashboard-grid"><section className="panel"><div className="page-heading"><div><div className="eyebrow">COMPANY CONTROL CENTER</div><h2>{company.name}</h2><p>Pengelolaan seluruh Tenant dan langganan dalam satu Company.</p></div><span className="module-state">{company.status}</span></div><div className="stats-grid"><article className="stat-card"><span>Total Tenant</span><strong>{tenants.length}</strong><small>Kuota utama dihitung satu</small></article><article className="stat-card"><span>Langganan</span><strong>{subscription?.status??"Belum aktif"}</strong><small>{subscription?.ends_at?("Berakhir "+new Date(subscription.ends_at).toLocaleDateString("id-ID")):"Operasional menunggu aktivasi"}</small></article><article className="stat-card"><span>Kuota Tenant</span><strong>{subscription?.tenant_quota_snapshot??0}</strong><small>{tenants.length} digunakan</small></article></div></section><section className="panel"><div className="panel-heading"><div><h3>Daftar Tenant</h3><p>Workspace operasional milik Company ini.</p></div></div><div className="table-wrap"><table><thead><tr><th>Nama Tenant</th><th>Status</th><th>Tenant ID</th></tr></thead><tbody>{tenants.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.status}</td><td>{t.id}</td></tr>)}{!tenants.length&&<tr><td colSpan={3}>Belum ada Tenant.</td></tr>}</tbody></table></div><form className="inline-form" onSubmit={addTenant}><input required value={newTenant} onChange={e=>setNewTenant(e.target.value)} placeholder="Nama Tenant baru"/><button className="primary-btn" disabled={busy||!subscription||subscription.status!=="active"}><Plus size={16}/> Tambah Tenant</button></form>{!subscription||subscription.status!=="active"?<p className="muted">Aktifkan langganan Company untuk mengoperasikan Tenant.</p>:null}</section><section className="panel"><div className="panel-heading"><div><h3>Langganan dan pembayaran</h3><p>Pembayaran manual diverifikasi Admin Platform; belum terhubung ke payment gateway.</p></div></div><form className="form-grid" onSubmit={requestPayment}><label>Pilih paket<select value={paymentPackage} onChange={e=>setPaymentPackage(e.target.value)}>{packages.map(p=><option key={p.id} value={p.id}>{p.name} · {money(Number(p.price))} · {p.duration_days} hari · {p.tenant_quota} Tenant</option>)}</select></label><label>Metode pembayaran<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="bank_transfer">Transfer bank</option><option value="qris">QRIS</option><option value="cash">Tunai/manual</option></select></label><label>Referensi / catatan pembayaran<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Nomor referensi atau catatan"/></label><button className="primary-btn" disabled={busy||!packages.length}>Kirim permintaan pembayaran</button></form>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}</section></div>;
}

function ProductsModule({tenantId}:{tenantId:string}) {
 const [products,setProducts]=useState<any[]>([]);const [categories,setCategories]=useState<any[]>([]);const [name,setName]=useState("");const [category,setCategory]=useState("");const [sku,setSku]=useState("");const [cost,setCost]=useState("0");const [price,setPrice]=useState("0");const [stock,setStock]=useState("0");const [minStock,setMinStock]=useState("0");const [categoryName,setCategoryName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function load(){if(!supabase)return;const [p,c]=await Promise.all([supabase.from("products").select("*").eq("tenant_id",tenantId).order("name"),supabase.from("product_categories").select("*").eq("tenant_id",tenantId).order("sort_order")]);setProducts(p.data??[]);setCategories(c.data??[]);}
 useEffect(()=>{void load()},[tenantId]);
 async function addCategory(e:FormEvent){e.preventDefault();if(!supabase)return;const {error}=await supabase.from("product_categories").insert({tenant_id:tenantId,name:categoryName});if(error)setError(error.message);else{setCategoryName("");await load();}}
 async function addProduct(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError("");const {error}=await supabase.from("products").insert({tenant_id:tenantId,category_id:category||null,name,sku:sku||null,cost_price:Number(cost),sale_price:Number(price),stock_quantity:Number(stock),minimum_stock:Number(minStock),is_active:true}).select("id").single();if(error)setError(error.message);else{name&&setName("");setSku("");setCost("0");setPrice("0");setStock("0");setMinStock("0");await load();}setBusy(false);}
 async function toggle(p:any){if(!supabase)return;const {error}=await supabase.from("products").update({is_active:!p.is_active}).eq("id",p.id);if(error)setError(error.message);else await load();}
 return <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Tambah produk</h3><p>Harga modal dan harga jual disimpan terpisah.</p></div><PackagePlus size={19}/></div><form className="form-grid" onSubmit={addProduct}><label>Nama produk<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Tanpa kategori</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>SKU / Barcode<input value={sku} onChange={e=>setSku(e.target.value)}/></label><label>Harga modal<input type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></label><label>Harga jual<input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Stok awal<input type="number" min="0" step="0.001" value={stock} onChange={e=>setStock(e.target.value)}/></label><label>Stok minimum<input type="number" min="0" step="0.001" value={minStock} onChange={e=>setMinStock(e.target.value)}/></label><button className="primary-btn" disabled={busy}>{busy?"Menyimpan…":"Simpan Produk"}</button></form><form className="inline-form" onSubmit={addCategory}><input required value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Nama kategori baru"/><button className="secondary-btn"><Tag size={15}/> Tambah kategori</button></form>{error&&<div className="error-note">{error}</div>}</section><section className="panel"><div className="panel-heading"><div><h3>Katalog produk</h3><p>{products.length} produk terdaftar.</p></div><button className="icon-btn" onClick={()=>void load()}><RefreshCw size={16}/></button></div><div className="table-wrap"><table><thead><tr><th>Produk</th><th>SKU</th><th>Harga jual</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku??"—"}</td><td>{money(Number(p.sale_price))}</td><td>{p.stock_quantity}</td><td>{Number(p.stock_quantity)<=Number(p.minimum_stock)?"Stok rendah":p.is_active?"Aktif":"Nonaktif"}</td><td><button className="text-btn" onClick={()=>void toggle(p)}>{p.is_active?"Nonaktifkan":"Aktifkan"}</button></td></tr>)}{!products.length&&<tr><td colSpan={6}>Belum ada produk.</td></tr>}</tbody></table></div></section></div>;
}

function InventoryModule({tenantId}:{tenantId:string}) {
 const [products,setProducts]=useState<any[]>([]);const [movements,setMovements]=useState<any[]>([]);const [product,setProduct]=useState("");const [quantity,setQuantity]=useState("1");const [type,setType]=useState("in");const [reason,setReason]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("");
 async function load(){if(!supabase)return;const [p,m]=await Promise.all([supabase.from("products").select("id,name,stock_quantity").eq("tenant_id",tenantId).order("name"),supabase.from("inventory_movements").select("*,products(name)").eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(100)]);setProducts(p.data??[]);setMovements(m.data??[]);if(!product&&p.data?.[0])setProduct(p.data[0].id);}
 useEffect(()=>{void load()},[tenantId]);
 async function save(e:FormEvent){e.preventDefault();if(!supabase)return;setError("");setMessage("");const {error}=await supabase.rpc("adjust_product_stock",{p_tenant_id:tenantId,p_product_id:product,p_quantity:Number(quantity),p_movement_type:type,p_reason:reason});if(error)setError(error.message);else{setMessage("Pergerakan stok berhasil dicatat.");setReason("");await load();}}
 return <div className="dashboard-grid"><section className="panel"><h3>Penyesuaian stok</h3><form className="form-grid" onSubmit={save}><label>Produk<select value={product} onChange={e=>setProduct(e.target.value)}>{products.map(p=><option value={p.id} key={p.id}>{p.name} · stok {p.stock_quantity}</option>)}</select></label><label>Jenis<select value={type} onChange={e=>setType(e.target.value)}><option value="in">Stok masuk</option><option value="out">Stok keluar</option><option value="adjustment">Set stok aktual</option></select></label><label>{type==="adjustment"?"Jumlah stok aktual":"Jumlah"}<input type="number" min="0.001" step="0.001" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Alasan<input required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Pembelian, rusak, koreksi…"/></label><button className="primary-btn" disabled={!product}>Simpan pergerakan</button></form>{message&&<div className="notice-panel">{message}</div>}{error&&<div className="error-note">{error}</div>}</section><section className="panel"><h3>Riwayat pergerakan stok</h3><div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th>Qty</th><th>Sebelum → Sesudah</th><th>Alasan</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{fmtDate(m.created_at)}</td><td>{m.products?.name??m.product_id}</td><td>{m.movement_type}</td><td>{m.quantity}</td><td>{m.before_quantity} → {m.after_quantity}</td><td>{m.reason??"—"}</td></tr>)}{!movements.length&&<tr><td colSpan={6}>Belum ada pergerakan.</td></tr>}</tbody></table></div></section></div>;
}

function CashierModule({tenantId,userId}:{tenantId:string;userId:string}) {
 const [registers,setRegisters]=useState<any[]>([]);const [sessions,setSessions]=useState<any[]>([]);const [register,setRegister]=useState("");const [regName,setRegName]=useState("Kasir Utama");const [float,setFloat]=useState("0");const [actualCash,setActualCash]=useState("0");const [actualTransfer,setActualTransfer]=useState("0");const [actualQris,setActualQris]=useState("0");const [explanation,setExplanation]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 async function load(){if(!supabase)return;const [r,s]=await Promise.all([supabase.from("registers").select("*").eq("tenant_id",tenantId).eq("is_active",true).order("created_at"),supabase.from("cashier_sessions").select("*,registers(name),cashier_session_closings(*)").eq("tenant_id",tenantId).order("opened_at",{ascending:false}).limit(30)]);setRegisters(r.data??[]);setSessions(s.data??[]);if(!register&&r.data?.[0])setRegister(r.data[0].id);}
 useEffect(()=>{void load()},[tenantId]);
 async function addRegister(e:FormEvent){e.preventDefault();if(!supabase)return;const {error}=await supabase.from("registers").insert({tenant_id:tenantId,name:regName,is_active:true});if(error)setError(error.message);else await load();}
 const open=sessions.find(s=>s.status==="open"&&s.opened_by===userId);
 async function openSession(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError("");const {error}=await supabase.rpc("open_cashier_session",{p_tenant_id:tenantId,p_register_id:register,p_opening_float:Number(float)});if(error)setError(error.message);else{setMessage("Sesi kasir berhasil dibuka.");await load();}setBusy(false);}
 async function closeSession(e:FormEvent){e.preventDefault();if(!supabase||!open)return;setBusy(true);setError("");const {error:insertError}=await supabase.from("cashier_session_closings").insert({session_id:open.id,actual_cash:Number(actualCash),actual_transfer:Number(actualTransfer),actual_qris:Number(actualQris),confirmed_by:userId,explanation:explanation||null});if(insertError){setError(insertError.message);setBusy(false);return;}const {error:updateError}=await supabase.from("cashier_sessions").update({status:"closed",closed_by:userId}).eq("id",open.id).eq("status","open");if(updateError)setError(updateError.message);else{setMessage("Kasir ditutup dan rekonsiliasi tersimpan.");setExplanation("");await load();}setBusy(false);}
 return <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>{open?"Sesi kasir sedang berjalan":"Buka sesi kasir"}</h3><p>Kasir yang membuka sesi wajib menutup sesi yang sama.</p></div><Wallet size={20}/></div>{open?<form className="form-grid" onSubmit={closeSession}><div className="notice-panel"><b>Sesi #{open.session_number}</b><p>Dibuka {fmtDate(open.opened_at)} · Modal awal {money(Number(open.opening_float))}</p></div><label>Uang tunai aktual<input type="number" min="0" required value={actualCash} onChange={e=>setActualCash(e.target.value)}/></label><label>Transfer aktual<input type="number" min="0" required value={actualTransfer} onChange={e=>setActualTransfer(e.target.value)}/></label><label>QRIS aktual<input type="number" min="0" required value={actualQris} onChange={e=>setActualQris(e.target.value)}/></label><label>Penjelasan selisih (opsional)<input value={explanation} onChange={e=>setExplanation(e.target.value)}/></label><button className="primary-btn" disabled={busy}>{busy?"Menyimpan…":"Rekonsiliasi & Tutup Kasir"}</button></form>:<form className="form-grid" onSubmit={openSession}><label>Register<select value={register} onChange={e=>setRegister(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Modal awal tunai<input type="number" min="0" required value={float} onChange={e=>setFloat(e.target.value)}/></label><button className="primary-btn" disabled={busy||!register}>{busy?"Memproses…":"Buka Kasir"}</button></form>}<form className="inline-form" onSubmit={addRegister}><input required value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Nama register"/><button className="secondary-btn">Tambah register</button></form>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}</section><section className="panel"><h3>Riwayat sesi kasir</h3><div className="table-wrap"><table><thead><tr><th>Sesi</th><th>Register</th><th>Buka</th><th>Tutup</th><th>Status</th><th>Selisih total</th><th>Bukti</th></tr></thead><tbody>{sessions.map(s=>{const cl=s.cashier_session_closings?.[0];const diff=Number(cl?.difference_cash??0)+Number(cl?.difference_transfer??0)+Number(cl?.difference_qris??0);return <tr key={s.id}><td>#{s.session_number}</td><td>{s.registers?.name??"—"}</td><td>{fmtDate(s.opened_at)}</td><td>{s.closed_at?fmtDate(s.closed_at):"—"}</td><td>{s.status}</td><td>{cl?money(diff):"—"}</td><td>{cl?<button className="text-btn" onClick={()=>window.print()}><Printer size={14}/> Cetak</button>:"—"}</td></tr>})}</tbody></table></div></section></div>;
}

function PosModule({tenantId,userId}:{tenantId:string;userId:string}) {
 const [products,setProducts]=useState<any[]>([]);const [registers,setRegisters]=useState<any[]>([]);const [sessions,setSessions]=useState<any[]>([]);const [register,setRegister]=useState("");const [cart,setCart]=useState<{product:any;quantity:number;note:string}[]>([]);const [orderNote,setOrderNote]=useState("");const [discount,setDiscount]=useState("0");const [tax,setTax]=useState("0");const [method,setMethod]=useState("cash");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
 async function load(){if(!supabase)return;const [p,r,s]=await Promise.all([supabase.from("products").select("*").eq("tenant_id",tenantId).eq("is_active",true).order("name"),supabase.from("registers").select("*").eq("tenant_id",tenantId).eq("is_active",true),supabase.from("cashier_sessions").select("*").eq("tenant_id",tenantId).eq("status","open").eq("opened_by",userId)]);setProducts(p.data??[]);setRegisters(r.data??[]);setSessions(s.data??[]);if(!register&&r.data?.[0])setRegister(r.data[0].id);}
 useEffect(()=>{void load()},[tenantId,userId]);
 const session=sessions.find(s=>s.register_id===register);const subtotal=cart.reduce((sum,item)=>sum+Number(item.product.sale_price)*item.quantity,0);const total=Math.max(0,subtotal-Number(discount||0)+Number(tax||0));
 function add(p:any){setCart(old=>{const i=old.findIndex(x=>x.product.id===p.id&&!x.note);if(i>=0)return old.map((x,j)=>j===i?{...x,quantity:x.quantity+1}:x);return [...old,{product:p,quantity:1,note:""}]});}
 async function checkout(){if(!supabase||!session)return;setBusy(true);setError("");setMessage("");const items=cart.map(x=>({product_id:x.product.id,quantity:x.quantity,note:x.note}));const payments=[{method,amount:total}];const {data,error}=await supabase.rpc("complete_pos_sale",{p_tenant_id:tenantId,p_register_id:register,p_session_id:session.id,p_items:items,p_payments:payments,p_order_note:orderNote,p_discount:Number(discount),p_tax:Number(tax)});if(error)setError(error.message);else{setMessage("Transaksi selesai: "+data);await supabase.from("customer_display_state").upsert({register_id:register,tenant_id:tenantId,updated_by:userId,state:{status:"completed",transaction_id:data,items:cart.map(x=>({name:x.product.name,quantity:x.quantity,note:x.note,price:x.product.sale_price})),total,order_note:orderNote}},{onConflict:"register_id"});setCart([]);setOrderNote("");setDiscount("0");setTax("0");await load();}setBusy(false);}
 async function syncDisplay(){if(!supabase||!register||!cart.length)return;await supabase.from("customer_display_state").upsert({register_id:register,tenant_id:tenantId,updated_by:userId,state:{status:"cart",items:cart.map(x=>({name:x.product.name,quantity:x.quantity,note:x.note,price:x.product.sale_price})),total,order_note:orderNote}},{onConflict:"register_id"});}
 useEffect(()=>{void syncDisplay()},[cart,orderNote,register]);
 if(!session)return <section className="module-placeholder"><div className="module-icon"><Wallet size={24}/></div><h2>Kasir belum dibuka</h2><p>Buka sesi kasir dan masukkan modal awal sebelum membuat transaksi.</p></section>;
 return <div className="pos-layout"><section className="panel"><div className="panel-heading"><div><h3>Pilih produk</h3><p>Register {registers.find(r=>r.id===register)?.name??""} · Sesi #{session.session_number}</p></div><select value={register} onChange={e=>setRegister(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div className="product-grid">{products.map(p=><button className="product-tile" key={p.id} onClick={()=>add(p)} disabled={Number(p.stock_quantity)<=0}><b>{p.name}</b><span>{money(Number(p.sale_price))}</span><small>Stok {p.stock_quantity}</small></button>)}</div></section><section className="panel cart-panel"><div className="panel-heading"><div><h3>Keranjang</h3><p>{cart.length} baris produk</p></div><ShoppingCart size={19}/></div>{cart.map((item,i)=><div className="cart-line" key={item.product.id+"-"+i}><div><b>{item.product.name}</b><small>{money(Number(item.product.sale_price))} × {item.quantity}</small><input placeholder="Catatan item" value={item.note} onChange={e=>setCart(old=>old.map((x,j)=>j===i?{...x,note:e.target.value}:x))}/></div><div className="qty-actions"><button onClick={()=>setCart(old=>old.map((x,j)=>j===i?{...x,quantity:Math.max(1,x.quantity-1)}:x))}>−</button><span>{item.quantity}</span><button onClick={()=>setCart(old=>old.map((x,j)=>j===i?{...x,quantity:Math.min(Number(x.product.stock_quantity),x.quantity+1)}:x))}>+</button><button onClick={()=>setCart(old=>old.filter((_,j)=>j!==i))}><Trash2 size={14}/></button></div></div>)}{!cart.length&&<div className="empty-chart">Keranjang masih kosong.</div>}<label>Catatan pesanan<input value={orderNote} onChange={e=>setOrderNote(e.target.value)} placeholder="Catatan untuk seluruh pesanan"/></label><div className="form-grid"><label>Diskon<input type="number" min="0" value={discount} onChange={e=>setDiscount(e.target.value)}/></label><label>Pajak / biaya tambahan<input type="number" min="0" value={tax} onChange={e=>setTax(e.target.value)}/></label><label>Metode pembayaran<select value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="qris">QRIS</option><option value="other">Lainnya</option></select></label></div><div className="total-line"><span>Total</span><strong>{money(total)}</strong></div><button className="primary-btn" disabled={busy||!cart.length} onClick={()=>void checkout()}>{busy?"Memproses…":"Selesaikan Transaksi"}</button>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}</section></div>;
}

function TransactionsModule({tenantId}:{tenantId:string}) {
 const [rows,setRows]=useState<any[]>([]);const [error,setError]=useState("");
 async function load(){if(!supabase)return;const {data,error}=await supabase.from("sales_transactions").select("*,transaction_items(*),transaction_payments(*)").eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(100);if(error)setError(error.message);setRows(data??[]);}
 useEffect(()=>{void load()},[tenantId]);
 return <section className="panel"><div className="panel-heading"><div><h3>Riwayat transaksi</h3><p>Transaksi selesai dan rincian pembayaran.</p></div><button className="icon-btn" onClick={()=>void load()}><RefreshCw size={16}/></button></div>{error&&<div className="error-note">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Waktu</th><th>Item</th><th>Subtotal</th><th>Diskon</th><th>Total</th><th>Pembayaran</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td>{t.transaction_number}</td><td>{fmtDate(t.created_at)}</td><td>{t.transaction_items?.map((i:any)=>i.product_name_snapshot+" × "+i.quantity+(i.item_note?" ("+i.item_note+")":"")).join(", ")}</td><td>{money(Number(t.subtotal))}</td><td>{money(Number(t.discount_total))}</td><td>{money(Number(t.grand_total))}</td><td>{t.transaction_payments?.map((p:any)=>p.payment_method+": "+money(Number(p.amount))).join(", ")}</td></tr>)}{!rows.length&&<tr><td colSpan={7}>Belum ada transaksi.</td></tr>}</tbody></table></div></section>;
}

function FinanceModule({tenantId}:{tenantId:string}) {
 const [transactions,setTransactions]=useState<any[]>([]);const [items,setItems]=useState<any[]>([]);
 useEffect(()=>{let live=true;async function load(){if(!supabase)return;const [t,i]=await Promise.all([supabase.from("sales_transactions").select("id,grand_total,subtotal,discount_total,tax_total,status,created_at,transaction_payments(payment_method,amount)").eq("tenant_id",tenantId).eq("status","completed").order("created_at",{ascending:false}).limit(500),supabase.from("transaction_items").select("cost_price_snapshot,quantity,line_total,transaction_id").limit(2000)]);if(live){setTransactions(t.data??[]);setItems(i.data??[]);}}void load();return()=>{live=false}},[tenantId]);
 const total=transactions.reduce((s,t)=>s+Number(t.grand_total),0);const cash=transactions.reduce((s,t)=>s+(t.transaction_payments??[]).filter((p:any)=>p.payment_method==="cash").reduce((a:number,p:any)=>a+Number(p.amount),0),0);const transfer=transactions.reduce((s,t)=>s+(t.transaction_payments??[]).filter((p:any)=>p.payment_method==="transfer").reduce((a:number,p:any)=>a+Number(p.amount),0),0);const qris=transactions.reduce((s,t)=>s+(t.transaction_payments??[]).filter((p:any)=>p.payment_method==="qris").reduce((a:number,p:any)=>a+Number(p.amount),0),0);
 return <div className="dashboard-grid"><div className="stats-grid"><article className="stat-card"><span>Penjualan bersih tercatat</span><strong>{money(total)}</strong><small>{transactions.length} transaksi</small></article><article className="stat-card"><span>Tunai</span><strong>{money(cash)}</strong><small>Pembayaran cash</small></article><article className="stat-card"><span>Transfer</span><strong>{money(transfer)}</strong><small>Pembayaran transfer</small></article><article className="stat-card"><span>QRIS</span><strong>{money(qris)}</strong><small>Pembayaran QRIS</small></article></div><section className="panel"><h3>Ringkasan laba kotor</h3><p className="muted">Perhitungan biaya modal akan ditampilkan setelah data item transaksi lengkap. Laporan ini belum memasukkan biaya operasional di luar data POS.</p><b>HPP item tercatat: {money(items.reduce((s,i)=>s+Number(i.cost_price_snapshot)*Number(i.quantity),0))}</b><p>Estimasi laba kotor dari periode data yang dimuat: {money(total-items.reduce((s,i)=>s+Number(i.cost_price_snapshot)*Number(i.quantity),0))}</p></section></div>;
}

function EmployeesModule({tenantId}:{tenantId:string}) {
 const [members,setMembers]=useState<any[]>([]);const [company,setCompany]=useState<any>(null);const [email,setEmail]=useState("");const [name,setName]=useState("");const [role,setRole]=useState("employee");const [job,setJob]=useState("");const [permissions,setPermissions]=useState<string[]>(["pos.use"]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
 const permissionOptions=["pos.use","products.manage","inventory.manage","cashier.open","cashier.manage","queue.manage","self_order.manage","attendance.use","attendance.correct","employees.manage","settings.manage","audit.view"];
 async function load(){if(!supabase)return;const [m,t]=await Promise.all([supabase.from("tenant_members").select("*,profiles(display_name)").eq("tenant_id",tenantId).order("created_at"),supabase.from("tenants").select("company_id").eq("id",tenantId).single()]);setMembers(m.data??[]);if(t.data){const {data}=await supabase.from("companies").select("id,name").eq("id",t.data.company_id).single();setCompany(data);}}
 useEffect(()=>{void load()},[tenantId]);
 async function invite(e:FormEvent){e.preventDefault();if(!supabase||!company)return;setBusy(true);setError("");setMessage("");const {data,error}=await supabase.functions.invoke("acopos-admin",{body:{action:"invite_tenant_member",email,display_name:name,company_id:company.id,tenant_id:tenantId,role,job_title:job,permissions}});if(error)setError(error.message);else if(data?.error)setError(data.error);else{setMessage("Undangan diproses. Jika akun baru, undangan email sudah dikirim.");setEmail("");setName("");await load();}setBusy(false);}
 async function toggleActive(m:any){if(!supabase)return;const {error}=await supabase.from("tenant_members").update({is_active:!m.is_active}).eq("id",m.id);if(error)setError(error.message);else await load();}
 return <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Undang karyawan / Manager</h3><p>Manager hanya dapat ditugaskan ke Tenant tertentu. Manager tidak dapat membuat Manager lain.</p></div><UserPlus size={19}/></div><form className="form-grid" onSubmit={invite}><label>Email akun<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Nama tampilan<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Jabatan<input value={job} onChange={e=>setJob(e.target.value)}/></label><label>Peran<select value={role} onChange={e=>setRole(e.target.value)}><option value="employee">Employee</option><option value="manager">Tenant Manager</option></select></label><div className="permission-grid"><b>Hak akses Tenant</b>{permissionOptions.map(p=><label className="check-row" key={p}><input type="checkbox" checked={permissions.includes(p)} onChange={e=>setPermissions(old=>e.target.checked?[...old,p]:old.filter(x=>x!==p))}/>{p}</label>)}</div><button className="primary-btn" disabled={busy||!company}>{busy?"Mengirim…":"Kirim undangan"}</button></form>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}</section><section className="panel"><h3>Anggota Tenant</h3><div className="table-wrap"><table><thead><tr><th>Nama</th><th>Peran</th><th>Jabatan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td>{m.profiles?.display_name||m.user_id}</td><td>{m.role}</td><td>{m.job_title??"—"}</td><td>{m.is_active?"Aktif":"Nonaktif"}</td><td><button className="text-btn" onClick={()=>void toggleActive(m)}>{m.is_active?"Nonaktifkan":"Aktifkan"}</button></td></tr>)}{!members.length&&<tr><td colSpan={5}>Belum ada anggota.</td></tr>}</tbody></table></div></section></div>;
}

function QueueModule({tenantId}:{tenantId:string}) {
 const [rows,setRows]=useState<any[]>([]);const [name,setName]=useState("");const [counter,setCounter]=useState("Loket 1");const [error,setError]=useState("");
 async function load(){if(!supabase)return;const {data,error}=await supabase.from("queue_tickets").select("*").eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(100);if(error)setError(error.message);setRows(data??[]);}
 useEffect(()=>{void load()},[tenantId]);
 async function create(e:FormEvent){e.preventDefault();if(!supabase)return;const {error}=await supabase.rpc("create_queue_ticket",{p_tenant_id:tenantId,p_customer_name:name||null,p_counter_name:counter});if(error)setError(error.message);else{name&&setName("");await load();}}
 async function update(row:any,status:string){if(!supabase)return;const payload:any={status};if(status==="called")payload.called_at=new Date().toISOString();if(status==="completed")payload.completed_at=new Date().toISOString();const {error}=await supabase.from("queue_tickets").update(payload).eq("id",row.id);if(error)setError(error.message);else await load();}
 return <div className="dashboard-grid"><section className="panel"><h3>Buat nomor antrean</h3><form className="inline-form" onSubmit={create}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama pelanggan (opsional)"/><input value={counter} onChange={e=>setCounter(e.target.value)} placeholder="Loket"/><button className="primary-btn">Ambil nomor</button></form>{error&&<div className="error-note">{error}</div>}</section><section className="panel"><h3>Daftar antrean</h3><div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Nama</th><th>Loket</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.ticket_number}</b></td><td>{r.customer_name??"—"}</td><td>{r.counter_name??"—"}</td><td>{r.status}</td><td><div className="table-actions">{r.status==="waiting"&&<button className="text-btn" onClick={()=>void update(r,"called")}>Panggil</button>}{r.status==="called"&&<button className="text-btn" onClick={()=>void update(r,"serving")}>Layani</button>}{["called","serving"].includes(r.status)&&<button className="text-btn" onClick={()=>void update(r,"completed")}>Selesai</button>}{r.status==="waiting"&&<button className="text-btn" onClick={()=>void update(r,"skipped")}>Lewati</button>}</div></td></tr>)}{!rows.length&&<tr><td colSpan={5}>Belum ada antrean.</td></tr>}</tbody></table></div></section></div>;
}

function SelfOrderModule({tenantId}:{tenantId:string}) {
 const [rows,setRows]=useState<any[]>([]);const [error,setError]=useState("");
 async function load(){if(!supabase)return;const {data,error}=await supabase.from("self_orders").select("*,self_order_items(*)").eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(100);if(error)setError(error.message);setRows(data??[]);}
 useEffect(()=>{void load()},[tenantId]);
 async function change(_row:any,key:"payment_status"|"order_status",value:string){if(!supabase)return;const {error}=await supabase.from("self_orders").update({[key]:value}).eq("id",_row.id);if(error)setError(error.message);else await load();}
 return <section className="panel"><div className="panel-heading"><div><h3>Pesanan Self Order</h3><p>Status pembayaran dan status pemrosesan dikelola terpisah.</p></div><button className="icon-btn" onClick={()=>void load()}><RefreshCw size={16}/></button></div>{error&&<div className="error-note">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Pelanggan</th><th>Total</th><th>Pembayaran</th><th>Pesanan</th><th>Aksi</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.order_number}</td><td>{r.customer_name??"—"}</td><td>{money(Number(r.total_amount))}</td><td>{r.payment_status}</td><td>{r.order_status}</td><td>{r.payment_status==="submitted"&&<button className="text-btn" onClick={()=>void change(r,"payment_status","approved")}>Setujui bayar</button>}<select value={r.order_status} onChange={e=>void change(r,"order_status",e.target.value)}><option value="received">Diterima</option><option value="processing">Diproses</option><option value="ready">Siap</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></td></tr>)}{!rows.length&&<tr><td colSpan={6}>Belum ada pesanan.</td></tr>}</tbody></table></div></section>;
}

function DisplayModule({tenantId}:{tenantId:string}) {
 const [registers,setRegisters]=useState<any[]>([]);const [register,setRegister]=useState("");const [state,setState]=useState<any>({});
 useEffect(()=>{if(!supabase)return;void supabase.from("registers").select("id,name").eq("tenant_id",tenantId).then(({data})=>{setRegisters(data??[]);if(data?.[0])setRegister(data[0].id);});},[tenantId]);
 useEffect(()=>{if(!supabase||!register)return;let live=true;void supabase.from("customer_display_state").select("state").eq("register_id",register).maybeSingle().then(({data})=>{if(live)setState(data?.state??{});});const channel=supabase.channel("display-"+register).on("postgres_changes",{event:"*",schema:"public",table:"customer_display_state",filter:"register_id=eq."+register},payload=>{const next=(payload.new as any)?.state;if(next)setState(next);}).subscribe();return()=>{live=false;void supabase?.removeChannel(channel);};},[register]);
 return <section className="display-screen"><div className="display-head"><div className="brand-mark">a</div><h2>acoPos · Customer Display</h2><select value={register} onChange={e=>setRegister(e.target.value)}>{registers.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></div>{state.status==="cart"&&state.items?.length?<><h1>Pesanan Anda</h1><div className="display-items">{state.items.map((i:any,index:number)=><div key={index}><span>{i.quantity} × {i.name}{i.note?" — "+i.note:""}</span><b>{money(Number(i.price)*i.quantity)}</b></div>)}</div><div className="display-total"><span>Total</span><strong>{money(Number(state.total))}</strong></div>{state.order_note&&<p>{state.order_note}</p>}</>:state.status==="completed"?<div className="display-thanks"><CheckCircle2 size={54}/><h1>Terima kasih!</h1><p>Transaksi Anda berhasil diselesaikan.</p></div>:<div className="display-thanks"><ShoppingBag size={50}/><h1>Selamat datang</h1><p>Pesanan Anda akan ditampilkan di layar ini.</p></div>}</section>;
}

function SettingsModule({tenantId,userId}:{tenantId:string;userId:string}) {
 const [settings,setSettings]=useState<any>({});const [error,setError]=useState("");const [message,setMessage]=useState("");
 useEffect(()=>{if(!supabase)return;void supabase.from("tenant_settings").select("settings").eq("tenant_id",tenantId).maybeSingle().then(({data})=>setSettings(data?.settings??{}));},[tenantId]);
 async function save(){if(!supabase)return;const {error}=await supabase.from("tenant_settings").upsert({tenant_id:tenantId,settings,updated_by:userId},{onConflict:"tenant_id"});if(error)setError(error.message);else setMessage("Pengaturan berhasil disimpan.");}
 return <section className="panel"><div className="panel-heading"><div><h3>Pengaturan Tenant</h3><p>Profil toko dan konfigurasi dasar.</p></div></div><div className="form-grid"><label>Nama toko<input value={settings.store_name??""} onChange={e=>setSettings({...settings,store_name:e.target.value})}/></label><label>Alamat<input value={settings.address??""} onChange={e=>setSettings({...settings,address:e.target.value})}/></label><label>Nomor kontak<input value={settings.phone??""} onChange={e=>setSettings({...settings,phone:e.target.value})}/></label><label>Footer struk<input value={settings.receipt_footer??""} onChange={e=>setSettings({...settings,receipt_footer:e.target.value})}/></label><button className="primary-btn" onClick={()=>void save()}>Simpan pengaturan</button></div>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}</section>;
}

function AuditModule({tenantId}:{tenantId:string}) {
 const [rows,setRows]=useState<any[]>([]);
 useEffect(()=>{if(!supabase)return;void supabase.from("audit_logs").select("*").eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(200).then(({data})=>setRows(data??[]));},[tenantId]);
 return <section className="panel"><h3>Riwayat aktivitas</h3><div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th><th>ID</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{fmtDate(r.created_at)}</td><td>{r.actor_id??"Sistem"}</td><td>{r.action}</td><td>{r.entity_type}</td><td>{r.entity_id??"—"}</td></tr>)}{!rows.length&&<tr><td colSpan={5}>Belum ada aktivitas.</td></tr>}</tbody></table></div></section>;
}


function ActivationCodesManager() {
 const [codes,setCodes]=useState<any[]>([]);const [expires,setExpires]=useState("");const [issued,setIssued]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function load(){if(!supabase)return;const {data,error}=await supabase.functions.invoke("acopos-admin",{body:{action:"list_activation_codes"}});if(error)setError(error.message);else if(data?.error)setError(data.error);else setCodes(data.codes??[]);}
 useEffect(()=>{void load()},[]);
 async function issue(){if(!supabase)return;setBusy(true);setError("");setIssued("");const {data,error}=await supabase.functions.invoke("acopos-admin",{body:{action:"create_activation_code",expires_at:expires?new Date(expires+"T23:59:59").toISOString():null}});if(error)setError(error.message);else if(data?.error)setError(data.error);else{setIssued(data.code);setExpires("");await load();}setBusy(false);}
 return <div className="dashboard-grid"><section className="panel"><h3>Terbitkan Kode Aktivasi Owner</h3><p className="muted">Kode hanya untuk aktivasi akun Owner baru. Kode tidak mengaktifkan langganan Company.</p><label>Berlaku sampai (opsional)<input type="date" value={expires} onChange={e=>setExpires(e.target.value)}/></label><button className="primary-btn" disabled={busy} onClick={()=>void issue()}>{busy?"Menerbitkan…":"Terbitkan kode"}</button>{issued&&<div className="notice-panel"><div><b>Kode baru — salin sekarang</b><p className="activation-code">{issued}</p></div><button className="text-btn" onClick={()=>void navigator.clipboard.writeText(issued)}>Salin</button></div>}{error&&<div className="error-note">{error}</div>}</section><section className="panel"><div className="panel-heading"><div><h3>Riwayat kode aktivasi</h3><p>Nilai kode asli tidak disimpan dan tidak dapat ditampilkan ulang.</p></div><button className="icon-btn" onClick={()=>void load()}><RefreshCw size={16}/></button></div><div className="table-wrap"><table><thead><tr><th>Dibuat</th><th>Status</th><th>Kedaluwarsa</th><th>Digunakan oleh</th><th>Waktu penukaran</th></tr></thead><tbody>{codes.map(c=><tr key={c.id}><td>{fmtDate(c.created_at)}</td><td>{c.status}</td><td>{c.expires_at?fmtDate(c.expires_at):"Tidak ada"}</td><td>{c.redeemed_by??"—"}</td><td>{c.redeemed_at?fmtDate(c.redeemed_at):"—"}</td></tr>)}{!codes.length&&<tr><td colSpan={5}>Belum ada kode.</td></tr>}</tbody></table></div></section></div>;
}

function PlatformAdminsManager() {
 const [email,setEmail]=useState("");const [enabled,setEnabled]=useState(true);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
 async function save(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError("");setMessage("");const {data,error}=await supabase.functions.invoke("acopos-admin",{body:{action:"set_platform_admin",email,enabled}});if(error)setError(error.message);else if(data?.error)setError(data.error);else{setMessage(email+" sekarang memiliki peran "+data.platform_role);setEmail("");}setBusy(false);}
 return <div className="dashboard-grid"><section className="panel"><h3>Kelola Admin Platform</h3><p className="muted">Hanya akun yang sudah terdaftar dapat diberi peran Admin Platform. Admin Platform tidak otomatis memperoleh akses transaksi pelanggan.</p><form className="form-grid" onSubmit={save}><label>Email akun<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Tindakan<select value={enabled?"enable":"disable"} onChange={e=>setEnabled(e.target.value==="enable")}><option value="enable">Jadikan Admin Platform</option><option value="disable">Cabut peran Admin Platform</option></select></label><button className="primary-btn" disabled={busy}>{busy?"Menyimpan…":"Simpan peran"}</button></form>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}</section><PlatformTable table="profiles" title="Daftar Admin Platform" columns={["display_name","platform_role","account_status","created_at"]} filterAdmin/></div>;
}

function PaymentRequestsManager() {
 const [rows,setRows]=useState<any[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
 async function load(){if(!supabase)return;const {data,error}=await supabase.from("subscription_payment_requests").select("*,companies(name),packages(name,duration_days,tenant_quota)").order("created_at",{ascending:false}).limit(100);if(error)setError(error.message);setRows(data??[]);}
 useEffect(()=>{void load()},[]);
 async function review(row:any,decision:"approved"|"rejected"){if(!supabase)return;setBusy(true);setError("");setMessage("");const {data,error}=await supabase.functions.invoke("acopos-admin",{body:{action:"review_payment",request_id:row.id,decision}});if(error)setError(error.message);else if(data?.error)setError(data.error);else{setMessage("Permintaan "+row.id+" "+(decision==="approved"?"disetujui dan langganan diaktifkan.":"ditolak."));await load();}setBusy(false);}
 return <section className="panel"><div className="panel-heading"><div><h3>Permintaan pembayaran Company</h3><p>Verifikasi manual. Persetujuan mengaktifkan langganan Company sesuai paket.</p></div><button className="icon-btn" onClick={()=>void load()}><RefreshCw size={16}/></button></div>{error&&<div className="error-note">{error}</div>}{message&&<div className="notice-panel">{message}</div>}<div className="table-wrap"><table><thead><tr><th>Company</th><th>Paket</th><th>Nominal</th><th>Metode</th><th>Referensi</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.companies?.name??r.company_id}</td><td>{r.packages?.name??r.package_id}</td><td>{money(Number(r.amount))}</td><td>{r.payment_method}</td><td>{r.payment_reference??"—"}</td><td>{r.status}</td><td>{fmtDate(r.created_at)}</td><td>{r.status==="pending"?<div className="table-actions"><button className="text-btn" disabled={busy} onClick={()=>void review(r,"approved")}>Setujui</button><button className="text-btn" disabled={busy} onClick={()=>void review(r,"rejected")}>Tolak</button></div>:"Selesai"}</td></tr>)}{!rows.length&&<tr><td colSpan={8}>Belum ada permintaan pembayaran.</td></tr>}</tbody></table></div></section>;
}


function AdminPlatformHome({email,onSignOut}:{email:string;onSignOut:()=>void}) {
 const [page,setPage]=useState("Ringkasan");
 const items=["Ringkasan","Company","Tenant","Langganan Company","Permintaan Pembayaran","Audit Platform"];
 return <div className="app-shell"><aside className="sidebar"><div className="brand-lockup side-brand"><div className="brand-mark">a</div><span>aco<span>Pos</span></span></div><div className="workspace-switch"><div className="workspace-icon"><ShieldCheck size={18}/></div><div><b>Platform Support</b><small>Admin Platform</small></div></div><nav className="side-nav"><div className="nav-group"><div className="nav-label">OPERASIONAL PLATFORM</div>{items.map(item=><button key={item} className={"nav-item "+(page===item?"active":"")} onClick={()=>setPage(item)}><span>{item}</span></button>)}</div></nav><div className="sidebar-bottom"><button className="profile-row" onClick={onSignOut}><div className="avatar">{email.slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{email}</b><small>Keluar dari akun</small></div><LogOut size={16}/></button></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumbs">Platform Support <span>/</span> <b>{page}</b></div><span className="eyebrow">ADMIN PLATFORM</span></header><div className="page-content"><div className="page-heading"><div><div className="eyebrow">ACOPOS OPERATIONS</div><h1>{page}</h1><p>Pengelolaan pelanggan dan verifikasi langganan sesuai kewenangan Admin Platform.</p></div><span className="module-state"><ShieldCheck size={16}/> Akses terbatas</span></div>{page==="Ringkasan"&&<div className="stats-grid"><article className="stat-card"><strong>Company & Tenant</strong><small>Pemantauan akun pelanggan</small><button className="text-btn" onClick={()=>setPage("Company")}>Lihat Company</button></article><article className="stat-card"><strong>Langganan</strong><small>Periksa masa aktif dan paket</small><button className="text-btn" onClick={()=>setPage("Langganan Company")}>Lihat langganan</button></article><article className="stat-card"><strong>Pembayaran</strong><small>Verifikasi bukti pembayaran manual</small><button className="text-btn" onClick={()=>setPage("Permintaan Pembayaran")}>Periksa permintaan</button></article></div>}{page==="Company"&&<PlatformTable table="companies" title="Company pelanggan" columns={["name","slug","status","created_at"]}/>}{page==="Tenant"&&<PlatformTable table="tenants" title="Tenant pelanggan" columns={["name","slug","status","company_id","created_at"]}/>}{page==="Langganan Company"&&<PlatformTable table="company_subscriptions" title="Langganan Company" columns={["company_id","package_id","status","starts_at","ends_at","tenant_quota_snapshot"]}/>}{page==="Permintaan Pembayaran"&&<PaymentRequestsManager/>}{page==="Audit Platform"&&<PlatformTable table="audit_logs" title="Audit platform" columns={["action","entity_type","entity_id","actor_id","created_at"]}/>}</div></main></div>;
}


function PublicSelfOrder({slug}:{slug:string}) {
 const [catalog,setCatalog]=useState<any>(null);const [cart,setCart]=useState<{product:any;quantity:number;note:string}[]>([]);const [customer,setCustomer]=useState("");const [contact,setContact]=useState("");const [method,setMethod]=useState("transfer");const [reference,setReference]=useState("");const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");
 useEffect(()=>{let live=true;if(!supabase)return;supabase.rpc("get_self_order_catalog",{p_tenant_slug:slug}).then(({data,error})=>{if(!live)return;if(error)setError(error.message);else setCatalog(data);setLoading(false);});return()=>{live=false};},[slug]);
 const total=cart.reduce((s,x)=>s+Number(x.product.price)*x.quantity,0);
 function add(p:any){setCart(old=>{const i=old.findIndex(x=>x.product.id===p.id);if(i>=0)return old.map((x,j)=>j===i?{...x,quantity:x.quantity+1}:x);return [...old,{product:p,quantity:1,note:""}]});}
 async function submit(e:FormEvent){e.preventDefault();if(!supabase||!cart.length)return;setBusy(true);setError("");const {data,error}=await supabase.rpc("create_self_order",{p_tenant_slug:slug,p_customer_name:customer,p_customer_contact:contact,p_payment_method:method,p_items:cart.map(x=>({product_id:x.product.id,quantity:x.quantity,note:x.note})),p_payment_reference:reference||null});if(error)setError(error.message);else{setSuccess("Pesanan berhasil dibuat. Simpan nomor pesanan: "+data);setCart([]);setReference("");}setBusy(false);}
 if(loading)return <div className="public-order-shell"><div className="boot-screen">Memuat menu…</div></div>;
 if(error&&!catalog)return <div className="public-order-shell"><section className="panel"><h2>Menu belum tersedia</h2><p>{error}</p></section></div>;
 return <div className="public-order-shell"><header className="public-order-header"><div className="brand-mark">a</div><div><b>{catalog?.tenant_name}</b><small>Pesan langsung melalui acoPos</small></div></header>{success?<section className="panel public-order-confirm"><CheckCircle2 size={42}/><h1>Pesanan diterima</h1><p>{success}</p><button className="primary-btn" onClick={()=>{setSuccess("");setCustomer("");setContact("");}}>Buat pesanan lain</button></section>:<div className="public-order-layout"><section className="panel"><div className="panel-heading"><div><h2>Menu tersedia</h2><p>Pilih produk, jumlah, dan catatan item.</p></div></div><div className="product-grid">{(catalog?.products??[]).map((p:any)=><button className="product-tile" key={p.id} onClick={()=>add(p)}><b>{p.name}</b><span>{money(Number(p.price))}</span><small>{p.category??"Menu"}</small></button>)}</div></section><section className="panel"><h2>Pesanan Anda</h2>{cart.map((x,i)=><div className="cart-line" key={x.product.id}><div><b>{x.product.name}</b><small>{money(Number(x.product.price))}</small><input placeholder="Catatan item (opsional)" value={x.note} onChange={e=>setCart(old=>old.map((v,j)=>j===i?{...v,note:e.target.value}:v))}/></div><div className="qty-actions"><button onClick={()=>setCart(old=>old.map((v,j)=>j===i?{...v,quantity:Math.max(1,v.quantity-1)}:v))}>−</button><span>{x.quantity}</span><button onClick={()=>setCart(old=>old.map((v,j)=>j===i?{...v,quantity:v.quantity+1}:v))}>+</button><button onClick={()=>setCart(old=>old.filter((_,j)=>j!==i))}><Trash2 size={14}/></button></div></div>)}{!cart.length&&<p className="muted">Belum ada produk dipilih.</p>}<div className="total-line"><span>Total pesanan</span><strong>{money(total)}</strong></div><form className="form-grid" onSubmit={submit}><label>Nama pelanggan<input required value={customer} onChange={e=>setCustomer(e.target.value)}/></label><label>Nomor kontak (opsional)<input value={contact} onChange={e=>setContact(e.target.value)}/></label><label>Metode pembayaran<select value={method} onChange={e=>setMethod(e.target.value)}><option value="transfer">Transfer</option><option value="qris">QRIS</option><option value="cash">Bayar di kasir</option></select></label>{method!=="cash"&&<label>Referensi pembayaran (opsional)<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Nomor referensi"/></label>}<button className="primary-btn" disabled={busy||!cart.length}>{busy?"Mengirim…":"Kirim pesanan"}</button></form>{error&&<div className="error-note">{error}</div>}<p className="muted">Pesanan diproses setelah pembayaran diverifikasi oleh toko. Stok aktual tidak ditampilkan pada menu publik.</p></section></div>}</div>;
}

function HelpModule({tenantId,userId}:{tenantId:string;userId:string}) {
 const [companyId,setCompanyId]=useState("");const [conversation,setConversation]=useState<any>(null);const [messages,setMessages]=useState<any[]>([]);const [body,setBody]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function load(){if(!supabase)return;const {data:t}=await supabase.from("tenants").select("company_id").eq("id",tenantId).single();if(!t)return;setCompanyId(t.company_id);const {data:c}=await supabase.from("support_conversations").select("*").eq("company_id",t.company_id).neq("status","closed").order("updated_at",{ascending:false}).limit(1).maybeSingle();setConversation(c);if(c){const {data:m}=await supabase.from("support_messages").select("*").eq("conversation_id",c.id).order("created_at");setMessages(m??[]);}}
 useEffect(()=>{void load()},[tenantId]);
 useEffect(()=>{if(!supabase||!conversation?.id)return;const channel=supabase.channel("support-user-"+conversation.id).on("postgres_changes",{event:"*",schema:"public",table:"support_messages",filter:"conversation_id=eq."+conversation.id},()=>{void supabase?.from("support_messages").select("*").eq("conversation_id",conversation.id).order("created_at").then(({data})=>setMessages(data??[]));}).subscribe();return()=>{void supabase?.removeChannel(channel)};},[conversation?.id]);
 async function start(){if(!supabase||!companyId)return;const {data,error}=await supabase.from("support_conversations").insert({company_id:companyId,tenant_id:tenantId,created_by:userId,subject:"Bantuan acoPos",status:"open"}).select("*").single();if(error)setError(error.message);else{setConversation(data);setMessages([]);}}
 async function send(e:FormEvent){e.preventDefault();if(!supabase||!conversation||!body.trim())return;setBusy(true);const {error}=await supabase.from("support_messages").insert({conversation_id:conversation.id,sender_id:userId,body:body.trim()});if(error)setError(error.message);else{setBody("");await supabase.from("support_conversations").update({updated_at:new Date().toISOString(),status:"open"}).eq("id",conversation.id);const {data}=await supabase.from("support_messages").select("*").eq("conversation_id",conversation.id).order("created_at");setMessages(data??[]);}setBusy(false);}
 return <section className="panel chat-panel"><div className="panel-heading"><div><h3>Joeclyn · Pusat Bantuan</h3><p>Live Chat dengan tim Admin Platform acoPos.</p></div><CircleHelp size={20}/></div>{!conversation?<div className="empty-chart"><b>Butuh bantuan?</b><span>Buat percakapan baru. Riwayat bantuan tersimpan pada Company Anda.</span><button className="primary-btn" onClick={()=>void start()}>Mulai Live Chat</button></div>:<><div className="chat-messages">{messages.map(m=><div className={"chat-bubble "+(m.sender_id===userId?"mine":"theirs")} key={m.id}><p>{m.body}</p><small>{fmtDate(m.created_at)}</small></div>)}{!messages.length&&<p className="muted">Kirim pesan pertama kepada Joeclyn.</p>}</div><form className="inline-form" onSubmit={send}><input required value={body} onChange={e=>setBody(e.target.value)} placeholder="Tulis pesan bantuan…"/><button className="primary-btn" disabled={busy}>Kirim</button></form></>}{error&&<div className="error-note">{error}</div>}<div className="chat-foot">Jika Live Chat belum dijawab, silakan hubungi support@acopos.app. Kanal Telegram resmi dapat ditambahkan melalui konfigurasi platform.</div></section>;
}

function SupportInbox() {
 const [conversations,setConversations]=useState<any[]>([]);const [active,setActive]=useState<any>(null);const [messages,setMessages]=useState<any[]>([]);const [body,setBody]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function load(){if(!supabase)return;const {data,error}=await supabase.from("support_conversations").select("*,companies(name),tenants(name)").order("updated_at",{ascending:false}).limit(100);if(error)setError(error.message);setConversations(data??[]);}
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(!supabase||!active?.id)return;const fetchMessages=()=>supabase!.from("support_messages").select("*").eq("conversation_id",active.id).order("created_at").then(({data})=>setMessages(data??[]));void fetchMessages();const channel=supabase.channel("support-admin-"+active.id).on("postgres_changes",{event:"*",schema:"public",table:"support_messages",filter:"conversation_id=eq."+active.id},()=>void fetchMessages()).subscribe();return()=>{void supabase?.removeChannel(channel)};},[active?.id]);
 async function send(e:FormEvent){e.preventDefault();if(!supabase||!active||!body.trim())return;setBusy(true);const {data:user}=await supabase.auth.getUser();const {error}=await supabase.from("support_messages").insert({conversation_id:active.id,sender_id:user.user?.id,body:body.trim()});if(error)setError(error.message);else{setBody("");await supabase.from("support_conversations").update({updated_at:new Date().toISOString(),status:"waiting"}).eq("id",active.id);await load();}setBusy(false);}
 return <div className="support-inbox"><section className="panel"><h3>Percakapan masuk</h3><div className="conversation-list">{conversations.map(c=><button className={"conversation-item "+(active?.id===c.id?"selected":"")} key={c.id} onClick={()=>setActive(c)}><b>{c.subject}</b><small>{c.companies?.name??c.company_id} · {c.tenants?.name??"Company"}</small><small>{c.status} · {fmtDate(c.updated_at)}</small></button>)}{!conversations.length&&<p className="muted">Belum ada percakapan.</p>}</div></section><section className="panel"><h3>{active?.subject??"Pilih percakapan"}</h3>{active&&<><div className="chat-messages">{messages.map(m=><div className="chat-bubble theirs" key={m.id}><p>{m.body}</p><small>{m.sender_id} · {fmtDate(m.created_at)}</small></div>)}{!messages.length&&<p className="muted">Belum ada pesan.</p>}</div><form className="inline-form" onSubmit={send}><input required value={body} onChange={e=>setBody(e.target.value)} placeholder="Balas pelanggan…"/><button className="primary-btn" disabled={busy}>Kirim balasan</button></form><button className="text-btn" onClick={()=>void supabase?.from("support_conversations").update({status:"closed"}).eq("id",active.id).then(()=>load())}>Tutup percakapan</button></>}{error&&<div className="error-note">{error}</div>}</section></div>;
}
