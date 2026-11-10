import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, ArrowUpRight, BarChart3, Bell, Building2, CalendarCheck,
  CheckCircle2, ChevronDown, CircleHelp, Clock3, FileClock, LayoutDashboard,
  LogOut, Menu, Monitor, Package, Plus, QrCode, ReceiptText, Search, Settings, ShieldCheck,
  ShoppingBag, Store, Users, Wallet, Warehouse, X,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";

const nav = [
  { group: "UTAMA", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
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
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [roleReady, setRoleReady] = useState(false);

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

  const pageTitle = titles[active] ?? "Dashboard";
    async function signIn(e: FormEvent) {
    e.preventDefault(); setAuthError(""); setLoading(true);
    if (!supabase) { setAuthError("Konfigurasi Supabase belum tersedia. Isi environment variables terlebih dahulu."); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setLoading(false);
  }

  async function signOut() { await supabase?.auth.signOut(); setSession(null); }

  if (!authReady) return <div className="boot-screen"><div className="brand-mark">a</div><span>Menyiapkan acoPos…</span></div>;

  if (!session) return <main className="login-shell">
    <section className="login-brand"><div className="brand-lockup"><div className="brand-mark">a</div><span>aco<span>Pos</span></span></div><div className="login-copy"><div className="eyebrow">BUSINESS OPERATING PLATFORM</div><h1>Kelola bisnis.<br/><em>Lebih terarah.</em></h1><p>Satu workspace untuk penjualan, inventaris, tim, dan seluruh operasional bisnis Anda.</p></div><div className="login-foot">© 2026 acoPos · Business Workspace</div></section>
    <section className="login-panel"><form className="login-card" onSubmit={signIn}><div className="mobile-brand"><div className="brand-mark">a</div><b>acoPos</b></div><div className="eyebrow">SELAMAT DATANG KEMBALI</div><h2>Masuk ke akun Anda</h2><p className="muted">Gunakan akun acoPos untuk melanjutkan.</p><label>Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@perusahaan.com"/><label>Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password"/>{authError && <div className="error-note">{authError}</div>}<button className="primary-btn" disabled={loading}>{loading ? "Memproses…" : "Masuk"} <ArrowUpRight size={17}/></button><div className="login-help">Butuh bantuan? <a href="mailto:support@acopos.app">Hubungi Joeclyn</a></div></form></section>
  </main>;

  if (session && !roleReady) return <div className="boot-screen"><div className="brand-mark">a</div><span>Memeriksa hak akses…</span></div>;
  if (session && platformRole === "super_admin") return <SuperAdminHome email={session.user.email ?? ""} onSignOut={signOut} />;

  return <div className="app-shell">
    {mobileOpen && <button className="scrim" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand-lockup side-brand"><div className="brand-mark">a</div><span>aco<span>Pos</span></span><button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-icon"><Store size={18}/></div><div><b>Workspace</b><small>Tenant aktif</small></div><ChevronDown size={15}/></div>
      <nav className="side-nav">{nav.map(group => <div className="nav-group" key={group.group}><div className="nav-label">{group.group}</div>{group.items.map(item => <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => { setActive(item.id); setMobileOpen(false); }}><item.icon size={18} strokeWidth={1.8}/><span>{item.label}</span></button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><b>Perlu bantuan?</b><small>Joeclyn siap membantu</small></div><ArrowUpRight size={15}/></div><button className="profile-row" onClick={signOut}><div className="avatar">{(session.user.email ?? "U").slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{session.user.email}</b><small>Keluar dari akun</small></div><LogOut size={16}/></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-btn menu-toggle" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><div className="breadcrumbs">Workspace <span>/</span> <b>{pageTitle}</b></div></div><div className="topbar-actions"><div className="search-box"><Search size={16}/><input placeholder="Cari menu atau data…"/></div><button className="icon-btn notification-btn"><Bell size={18}/><i/></button><div className="top-avatar">{(session.user.email ?? "U").slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content"><div className="page-heading"><div><div className="eyebrow">TENANT WORKSPACE</div><h1>{pageTitle}</h1><p>Ringkasan dan pengelolaan operasional bisnis Anda.</p></div><div className="heading-actions"><button className="secondary-btn"><Clock3 size={16}/> Hari ini <ChevronDown size={15}/></button><button className="primary-btn small"><Plus size={16}/> Tambah baru</button></div></div>
        {active === "dashboard" ? <Dashboard /> : <ModulePage id={active} title={pageTitle} userId={session.user.id} />}
      </div>
    </main>
  </div>;
}

function Dashboard() {
  const stats = [{label:"Penjualan hari ini",value:money(0),change:"Belum ada transaksi",icon:Wallet},{label:"Total transaksi",value:"0",change:"Hari ini",icon:ReceiptText},{label:"Produk aktif",value:"—",change:"Menunggu data produk",icon:Package},{label:"Karyawan",value:"—",change:"Tenant aktif",icon:Users}];
  return <><div className="stats-grid">{stats.map((s,i) => <article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><div className="stat-icon"><s.icon size={18}/></div></div><strong>{s.value}</strong><small className={i===0?"positive":""}>{s.change}</small></article>)}</div><div className="dashboard-grid"><section className="panel sales-panel"><div className="panel-heading"><div><h3>Ikhtisar penjualan</h3><p>Performa penjualan berdasarkan periode</p></div><button className="text-btn">Lihat laporan <ArrowUpRight size={15}/></button></div><div className="empty-chart"><div className="chart-icon"><BarChart3 size={25}/></div><b>Data penjualan akan tampil di sini</b><span>Mulai catat transaksi melalui POS untuk melihat performa bisnis.</span></div></section><section className="panel"><div className="panel-heading"><div><h3>Status operasional</h3><p>Kondisi Tenant saat ini</p></div><Activity size={18}/></div><div className="status-list"><div><span><i className="status-dot gray"/>Sesi kasir</span><b>Belum dibuka</b></div><div><span><i className="status-dot gray"/>Antrean aktif</span><b>0 tiket</b></div><div><span><i className="status-dot gray"/>Self Order</span><b>Belum dikonfigurasi</b></div></div></section></div><div className="notice-panel"><div className="notice-icon"><Building2 size={19}/></div><div><b>Workspace acoPos siap dikembangkan</b><p>Dashboard ini akan terhubung dengan data Company, Tenant, transaksi, stok, dan aktivitas secara real-time setelah konfigurasi awal selesai.</p></div><CheckCircle2 size={18}/></div></>;
}

function ModulePage({id,title,userId}:{id:string;title:string;userId:string}) {
  if (id === "attendance") return <AttendanceModule userId={userId} report={false}/>;
  if (id === "attendance-report") return <AttendanceModule userId={userId} report={true}/>;
  const descriptions: Record<string,string> = {pos:"Antarmuka penjualan, keranjang, pembayaran, catatan item, dan catatan pesanan.",display:"Tampilan pelanggan yang tersinkronisasi dengan register kasir.",transactions:"Riwayat, detail, pembayaran, dan status transaksi Tenant.",products:"Katalog produk, kategori, harga modal, harga jual, dan barcode.",inventory:"Stok awal, pergerakan barang, penyesuaian, dan peringatan stok.",cashier:"Pembukaan modal awal, sesi kasir, rekonsiliasi cash/transfer/QRIS, dan bukti tutup.",queue:"Pengaturan nomor antrean, pemanggilan, loket, dan layar pelanggan.", "self-order":"Katalog QR, pesanan pelanggan, bukti pembayaran, dan verifikasi.",employees:"Akun karyawan, penugasan Tenant, role, dan izin granular.",attendance:"Absensi kasir otomatis serta absensi masuk/pulang karyawan non-kasir.",finance:"Penjualan, metode pembayaran, rekonsiliasi, HPP, dan laba kotor.", "attendance-report":"Rekap kehadiran, jam masuk/pulang, durasi, dan sesi terbuka.",audit:"Jejak perubahan data, aktivitas pengguna, dan aktivitas keamanan.",settings:"Profil toko, register, pembayaran, struk, dan konfigurasi modul.",help:"Live Chat dan kanal bantuan Telegram Joeclyn."};
  return <section className="module-placeholder"><div className="module-icon"><Store size={24}/></div><div className="eyebrow">MODUL TENANT</div><h2>{title}</h2><p>{descriptions[id] ?? "Modul operasional acoPos."}</p><div className="module-state"><Activity size={16}/> Fondasi modul sedang disiapkan dan akan dihubungkan ke database.</div></section>;
}

export default App;

function SuperAdminHome({email,onSignOut}:{email:string;onSignOut:()=>void}) {
  const [counts,setCounts] = useState({companies:0,tenants:0,admins:0,packages:0});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) return;
      setLoading(true); setError("");
      const tables = ["companies","tenants","profiles","packages"] as const;
      const results = await Promise.all(tables.map(table => supabase!.from(table).select("*",{count:"exact",head:true})));
      if (!alive) return;
      const failed = results.find(r => r.error);
      if (failed?.error) setError("Sebagian ringkasan belum dapat dibaca. Periksa kebijakan akses database.");
      setCounts({companies:results[0].count ?? 0,tenants:results[1].count ?? 0,admins:results[2].count ?? 0,packages:results[3].count ?? 0});
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  },[]);
  const cards = [
    {label:"Company terdaftar",value:counts.companies,icon:Building2},
    {label:"Tenant terdaftar",value:counts.tenants,icon:Store},
    {label:"Akun profil",value:counts.admins,icon:Users},
    {label:"Paket berlangganan",value:counts.packages,icon:Wallet},
  ];
  const areas = [
    ["Manajemen Company","Pantau perusahaan pelanggan, status akun, dan pemilik Company."],
    ["Manajemen Tenant","Lihat seluruh Tenant dan relasinya dengan Company."],
    ["Admin Platform","Kelola administrator platform dan ruang kewenangannya."],
    ["Paket & Langganan","Atur paket, harga, kuota Tenant, dan masa berlangganan."],
    ["Kode Aktivasi","Kelola kode aktivasi untuk pendaftaran Owner."],
    ["Audit Platform","Telusuri perubahan konfigurasi dan aktivitas penting."],
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup side-brand"><div className="brand-mark">a</div><span>aco<span>Pos</span></span></div>
      <div className="workspace-switch"><div className="workspace-icon"><ShieldCheck size={18}/></div><div><b>Platform Control</b><small>Super Admin</small></div></div>
      <nav className="side-nav">
        <div className="nav-group"><div className="nav-label">PENGELOLAAN PLATFORM</div>
          {["Ringkasan","Company","Tenant","Admin Platform","Paket & Langganan","Kode Aktivasi","Audit Platform"].map((item,i)=><div className={i===0?"nav-item active":"nav-item"} key={item}><span>{item}</span></div>)}
        </div>
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><b>Joeclyn Support</b><small>Bantuan platform</small></div></div><button className="profile-row" onClick={onSignOut}><div className="avatar">{email.slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{email}</b><small>Keluar dari akun</small></div><LogOut size={16}/></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">Platform Control <span>/</span> <b>Ringkasan</b></div><div className="topbar-actions"><span className="eyebrow">SUPER ADMIN</span><div className="top-avatar">{email.slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">PUSAT KENDALI ACOPOS</div><h1>Platform Overview</h1><p>Pengelolaan ekosistem Company, Tenant, akun, dan langganan acoPos.</p></div><span className="module-state"><ShieldCheck size={16}/> Akses Super Admin</span></div>
        <div className="stats-grid">{cards.map(card=><article className="stat-card" key={card.label}><div className="stat-top"><span>{card.label}</span><div className="stat-icon"><card.icon size={18}/></div></div><strong>{loading?"…":card.value.toLocaleString("id-ID")}</strong><small>Data database saat ini</small></article>)}</div>
        {error&&<div className="error-note">{error}</div>}
        <section className="panel"><div className="panel-heading"><div><h3>Area kendali platform</h3><p>Modul administrasi tingkat platform</p></div></div><div className="stats-grid">{areas.map(([title,description])=><article className="stat-card" key={title}><strong style={{fontSize:16}}>{title}</strong><small>{description}</small></article>)}</div></section>
        <div className="notice-panel"><div className="notice-icon"><ShieldCheck size={19}/></div><div><b>Anda masuk sebagai Super Admin</b><p>Panel ini terpisah dari Workspace Tenant. Pengelolaan lintas Company hanya tersedia melalui kewenangan platform dan tetap dicatat pada audit log.</p></div><CheckCircle2 size={18}/></div>
      </div>
    </main>
  </div>;
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
  const ownOpen=rows.find(r=>r.employee_id===userId && !r.check_out_at && r.source==="manual");
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
        {!report&&<div className="heading-actions">{ownOpen?<button className="primary-btn" disabled={busy} onClick={checkOut}>{busy?"Menyimpan…":"Catat Pulang"}</button>:<button className="primary-btn" disabled={busy||!tenantId} onClick={checkIn}>{busy?"Menyimpan…":"Catat Masuk"}</button>}</div>}
        {message&&<div className="notice-panel">{message}</div>}{error&&<div className="error-note">{error}</div>}
        <div className="table-wrap"><table><thead><tr><th>Waktu Masuk</th><th>Waktu Pulang</th><th>Sumber</th><th>Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{fmt(row.check_in_at)}</td><td>{fmt(row.check_out_at)}</td><td>{row.source==="cashier_session"?"Sesi kasir":"Manual akun"}</td><td>{row.check_out_at?"Selesai":"Sedang bekerja"}</td></tr>)}{rows.length===0&&<tr><td colSpan={4}>Belum ada catatan kehadiran.</td></tr>}</tbody></table></div>
      </>}
    </section>
  </div>;
}
