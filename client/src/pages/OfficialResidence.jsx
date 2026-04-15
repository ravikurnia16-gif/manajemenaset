import { useState, useRef, useEffect } from "react";
import axios from "../lib/axios";
import { 
  Home, Building, Users, FileText, Settings, BarChart3, 
  Search, Plus, Edit2, Trash2, Download, AlertTriangle, CheckCircle2,
  X, ChevronDown, ChevronRight
} from "lucide-react";

/* ── Signature Pad Component ─────────────────────────────────────── */
function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, [value]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.strokeStyle = "#1a3a5c";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-semibold text-gray-600">{label}</label>
        <button type="button" onClick={clear} className="text-xs text-red-400 hover:text-red-600 underline">Hapus</button>
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 hover:border-blue-400 transition cursor-crosshair"
        style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={400} height={120}
          style={{ width: "100%", height: "120px", display: "block" }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">✍️ Gambar tanda tangan di atas</p>
    </div>
  );
}

/* ── jsPDF loader ────────────────────────────────────────────────── */
function loadJsPDF() {
  return new Promise((resolve) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve(window.jspdf.jsPDF);
    document.head.appendChild(s);
  });
}

async function downloadMOUPdf(mou) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  const line = (extra = 0) => { y += 5 + extra; };
  const text = (txt, x, size = 11, style = "normal", align = "left") => {
    doc.setFontSize(size); doc.setFont("helvetica", style);
    doc.text(txt, x, y, { align });
  };
  const hline = (lm = margin, rm = W - margin) => {
    doc.setDrawColor(180); doc.line(lm, y, rm, y);
  };

  // Load logo as base64
  let logoBase64 = null;
  try {
    const logoRes = await fetch("/Sarpras.jpeg");
    const blob = await logoRes.blob();
    logoBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Logo not found, proceeding without logo");
  }

  // Header strip
  doc.setFillColor(20, 90, 50);
  doc.rect(0, 0, W, 32, "F");

  // Logo on the left
  const logoSize = 20;
  const logoX = margin;
  const logoY = 6;
  if (logoBase64) {
    try {
      // White circle background for logo
      doc.setFillColor(255, 255, 255);
      doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 1, "F");
      doc.addImage(logoBase64, "JPEG", logoX, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn("Failed to add logo to PDF");
    }
  }

  // Text shifted to account for logo
  const textCenterX = logoBase64 ? (logoX + logoSize + 10 + (W - logoX - logoSize - 10 - margin) / 2) : W / 2;
  doc.setTextColor(255, 255, 255);
  y = 13;
  text("YAYASAN DAR EL IMAN", textCenterX, 16, "bold", "center");
  y = 20;
  text("SURAT PERJANJIAN PENGGUNAAN RUMAH DINAS", textCenterX, 9, "normal", "center");
  y = 26;
  doc.setFontSize(7); doc.setFont("helvetica", "italic");
  doc.text("Kota Padang, Sumatera Barat", textCenterX, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 40;

  // Sub-title
  text("Memorandum of Understanding (MOU)", W / 2, 10, "italic", "center"); line();
  doc.setDrawColor(20, 90, 50); doc.setLineWidth(0.5); hline(); line();

  // Nomor & tanggal
  text(`Nomor  : ${mou.mouNumber}`, margin, 10, "bold"); line();
  text(`Tanggal Tanda Tangan  : ${mou.signedDate ? new Date(mou.signedDate).toLocaleDateString("id-ID") : "-"}`, margin, 10); line(3);

  hline(); line(2);

  // Pembukaan
  const intro = `Pada hari ini, telah dibuat perjanjian antara Yayasan Dar El Iman, berkedudukan di Kota Padang, selanjutnya disebut PIHAK PERTAMA, dengan ${mou.residentName}, selanjutnya disebut PIHAK KEDUA, mengenai penggunaan Rumah Dinas Unit ${mou.unit?.code || mou.unitId}.`;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  const introLines = doc.splitTextToSize(intro, W - margin * 2);
  doc.text(introLines, margin, y); y += introLines.length * 5 + 4;

  // Pasal-pasal
  const pasal = [
    { judul: "Pasal 1 – Objek Perjanjian", isi: `Pihak Pertama memberikan hak penggunaan Rumah Dinas Unit ${mou.unit?.code || mou.unitId} kepada Pihak Kedua selama masa perjanjian berlaku, terhitung mulai ${new Date(mou.startDate).toLocaleDateString("id-ID")} sampai dengan ${new Date(mou.endDate).toLocaleDateString("id-ID")} (${mou.durationYears} tahun).` },
    { judul: "Pasal 2 – Hak Pihak Kedua", isi: mou.rights },
    { judul: "Pasal 3 – Kewajiban Pihak Kedua", isi: mou.obligations },
    { judul: "Pasal 4 – Berakhirnya Perjanjian", isi: `Perjanjian ini berakhir pada tanggal ${new Date(mou.endDate).toLocaleDateString("id-ID")}. Pihak Kedua wajib mengembalikan unit dalam kondisi baik selambat-lambatnya 14 hari setelah berakhirnya perjanjian.` },
    { judul: "Pasal 5 – Ketentuan Lain", isi: mou.notes && mou.notes !== "-" ? mou.notes : "Hal-hal yang belum diatur dalam perjanjian ini akan diselesaikan secara musyawarah dan mufakat." },
  ];

  for (const p of pasal) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(p.judul, margin, y); y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(p.isi, W - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 5 + 4;
  }

  y += 6;
  if (y > 220) { doc.addPage(); y = 20; }

  // Signature area
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  const sigY = y;
  doc.text("Pihak Pertama,", margin, sigY);
  doc.text("Pihak Kedua,", W / 2 + 10, sigY);

  // QR Code for Pihak Pertama (Kabid Sarpras)
  const sigH = 25;
  try {
    const qrData = `MOU: ${mou.mouNumber} | Penghuni: ${mou.residentName} | Unit: ${mou.unit?.code || mou.unitId} | Berlaku: ${new Date(mou.startDate).toLocaleDateString("id-ID")} s/d ${new Date(mou.endDate).toLocaleDateString("id-ID")} | Status: ${mou.status} | Ditandatangani secara digital oleh Kepala Bidang Sarana dan Prasarana, Yayasan Dar El Iman`;
    // Create QR code using canvas
    const qrCanvas = document.createElement('canvas');
    const QRCodeLib = await import('react-qr-code');
    const { createRoot } = await import('react-dom/client');
    const qrContainer = document.createElement('div');
    qrContainer.style.position = 'fixed';
    qrContainer.style.left = '-9999px';
    document.body.appendChild(qrContainer);
    const root = createRoot(qrContainer);
    await new Promise((resolve) => {
      const { createElement } = require('react');
      root.render(createElement(QRCodeLib.default, { value: qrData, size: 200, level: 'H' }));
      setTimeout(resolve, 300);
    });
    const svgEl = qrContainer.querySelector('svg');
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 200);
      ctx.drawImage(img, 0, 0, 200, 200);
      const qrImgData = c.toDataURL('image/png');
      doc.addImage(qrImgData, 'PNG', margin, sigY + 3, sigH, sigH);
      URL.revokeObjectURL(url);
    }
    root.unmount();
    document.body.removeChild(qrContainer);
  } catch (e) {
    console.warn('QR generation failed, skipping', e);
  }

  // Draw Party 2 signature (handwritten)
  if (mou.signatureParty2) {
    try { doc.addImage(mou.signatureParty2, "PNG", W / 2 + 10, sigY + 2, 55, sigH); } catch (e) {}
  }

  const nameY = sigY + sigH + 8;
  doc.line(margin, nameY, margin + 65, nameY);
  doc.line(W / 2 + 10, nameY, W / 2 + 75, nameY);
  doc.setFontSize(9);
  doc.text("Kepala Bidang Sarpras", margin, nameY + 5);
  doc.setFontSize(7); doc.setFont("helvetica", "italic");
  doc.text("(Ditandatangani secara digital)", margin, nameY + 9);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(mou.residentName, W / 2 + 10, nameY + 5);

  // Footer
  const fY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7); doc.setTextColor(140);
  doc.text(`Dokumen ini dicetak secara digital oleh Sistem Manajemen Rumah Dinas Yayasan Dar El Iman`, W / 2, fY, { align: "center" });

  doc.save(`MOU_${mou.mouNumber.replace(/\//g, "-")}.pdf`);
}

const TABS = ["Dashboard", "Data Unit", "Data Penghuni", "MOU", "Pemeliharaan", "Laporan"];
const TAB_ICONS = { 
  "Dashboard": <BarChart3 size={18} />, 
  "Data Unit": <Building size={18} />, 
  "Data Penghuni": <Users size={18} />, 
  "MOU": <FileText size={18} />, 
  "Pemeliharaan": <Settings size={18} />, 
  "Laporan": <Download size={18} /> 
};

const statusColor = (s) => {
  const map = { 
    "DITEMPATI": "bg-emerald-100 text-emerald-700", 
    "KOSONG": "bg-blue-100 text-blue-700", 
    "MAINTENANCE": "bg-amber-100 text-amber-700", 
    "AKTIF": "bg-emerald-100 text-emerald-700", 
    "NON_AKTIF": "bg-red-100 text-red-700", 
    "SELESAI": "bg-emerald-100 text-emerald-700", 
    "DALAM_PENGERJAAN": "bg-blue-100 text-blue-700", 
    "MENUNGGU": "bg-amber-100 text-amber-700", 
    "TINGGI": "bg-red-100 text-red-700", 
    "SEDANG": "bg-amber-100 text-amber-700", 
    "RENDAH": "bg-green-100 text-green-700", 
    "DIPERPANJANG": "bg-purple-100 text-purple-700", 
    "KADALUARSA": "bg-red-100 text-red-700" 
  };
  return map[s] || "bg-gray-100 text-gray-700";
};

export default function OfficialResidence() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [units, setUnits] = useState([]);
  const [residents, setResidents] = useState([]);
  const [mous, setMous] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [showModal, setShowModal] = useState(null);
  const [viewMOU, setViewMOU] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState("");
  const [pdfLoading, setPdfLoading] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [nameSearch, setNameSearch] = useState("");
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "Dashboard") {
        const res = await axios.get("/official-residence/dashboard");
        setStats(res.data);
      } else if (activeTab === "Data Unit") {
        const res = await axios.get("/official-residence/units");
        setUnits(res.data);
      } else if (activeTab === "Data Penghuni") {
        const res = await axios.get("/official-residence/residents");
        setResidents(res.data);
      } else if (activeTab === "MOU") {
        const res = await axios.get("/official-residence/mou");
        setMous(res.data);
      } else if (activeTab === "Pemeliharaan") {
        const res = await axios.get("/official-residence/maintenance");
        setMaintenance(res.data);
      }
      
      // Always fetch all users for the dropdowns
      const usersRes = await axios.get("/personnel/all-users");
      setAllUsers(usersRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const openModal = (type, data = {}) => { 
    setShowModal(type); 
    setForm({ ...data }); 
  };
  
  const closeModal = () => { 
    setShowModal(null); 
    setForm({}); 
    setNameSearch("");
    setShowNameDropdown(false);
  };

  const handleSave = async () => {
    try {
      let endpoint = `/official-residence/${showModal === "mou" ? "mou" : showModal === "maintenance" ? "maintenance" : showModal + "s"}`;
      if (form.id) {
        await axios.put(`${endpoint}/${form.id}`, form);
      } else {
        await axios.post(endpoint, form);
      }
      fetchData();
      closeModal();
    } catch (error) {
      alert("Gagal menyimpan data: " + error.response?.data?.error || error.message);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    try {
      let endpoint = `/official-residence/${type === "mou" ? "mou" : type === "maintenance" ? "maintenance" : type + "s"}`;
      await axios.delete(`${endpoint}/${id}`);
      fetchData();
    } catch (error) {
      alert("Gagal menghapus data: " + error.message);
    }
  };

  const handleDownloadPDF = async (m) => {
    setPdfLoading(m.id);
    try { await downloadMOUPdf(m); }
    catch (e) { alert("Gagal membuat PDF: " + e.message); }
    setPdfLoading(null);
  };

  const onUserSelect = (user) => {
    if (showModal === "resident") {
      setForm({
        ...form,
        name: user.name,
        nik: user.nip || "",
        phone: user.phone || ""
      });
    } else if (showModal === "mou") {
      setForm({
        ...form,
        residentName: user.name,
        residentPosition: user.nip || "" // Use residentPosition to store NIY in DB
      });
    }
    setNameSearch(user.name);
    setShowNameDropdown(false);
  };

  const filteredUsers = allUsers.filter(u => 
    u.name?.toLowerCase().includes(nameSearch.toLowerCase()) || 
    u.username?.toLowerCase().includes(nameSearch.toLowerCase())
  );

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Rumah Dinas</h1>
          <p className="text-slate-500 text-sm">Kelola unit, penghuni, dan dokumen perjanjian Yayasan Dar El Iman</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? "bg-blue-600 text-white shadow-lg" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {TAB_ICONS[tab]} {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
      ) : (
        <>
          {/* ── DASHBOARD ── */}
          {activeTab === "Dashboard" && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Total Unit", value: stats.totalUnits, sub: "Unit tersedia", color: "bg-blue-500", icon: <Home className="text-white" /> },
                  { label: "Ditempati", value: stats.occupiedUnits, sub: `${Math.round((stats.occupiedUnits / stats.totalUnits) * 100 || 0)}% terisi`, color: "bg-emerald-500", icon: <Users className="text-white" /> },
                  { label: "Kosong", value: stats.vacantUnits, sub: "Siap huni", color: "bg-amber-500", icon: <Building className="text-white" /> },
                  { label: "MOU Aktif", value: stats.activeMOUs, sub: `${stats.expiringMOUs} akan berakhir`, color: "bg-purple-500", icon: <FileText className="text-white" /> },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`${s.color} p-3 rounded-xl shadow-lg ring-4 ring-opacity-10 ring-white`}>{s.icon}</div>
                      <div className="text-2xl font-bold text-slate-800">{s.value}</div>
                    </div>
                    <div className="font-semibold text-sm text-slate-600">{s.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-amber-500" /> Pemeliharaan Aktif
                  </h3>
                  <div className="space-y-4">
                    {stats.activeMaintenance?.length > 0 ? stats.activeMaintenance.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div>
                          <div className="font-semibold text-slate-800">{m.title}</div>
                          <div className="text-xs text-slate-500 mt-1">Unit {m.unit?.code} • {m.priority}</div>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusColor(m.status)}`}>{m.status.replace('_', ' ')}</span>
                      </div>
                    )) : (
                      <div className="text-center py-6 text-slate-400 text-sm italic">Tidak ada pemeliharaan aktif</div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <FileText size={20} className="text-blue-500" /> Status Perjanjian (MOU)
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: "Aktif", count: stats.activeMOUs, color: "bg-emerald-500" },
                      { label: "Akan Berakhir (90 Hari)", count: stats.expiringMOUs, color: "bg-amber-500" },
                      { label: "Sudah Berakhir (Kadaluarsa)", count: stats.expiredMOUs, color: "bg-red-500" }
                    ].map(s => (
                      <div key={s.label} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${s.color}`}></div>
                          <span className="text-sm font-medium text-slate-600">{s.label}</span>
                        </div>
                        <span className="font-bold text-slate-800">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DATA UNIT ── */}
          {activeTab === "Data Unit" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input placeholder="Cari unit..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={() => openModal("unit")} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20">
                  <Plus size={18} /> Tambah Unit
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {units.map(u => (
                  <div key={u.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-lg font-bold text-slate-800">{u.name || `Unit ${u.code}`}</div>
                        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">{u.code}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusColor(u.status)}`}>{u.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Blok</div>
                        <div className="text-sm font-semibold text-slate-700">{u.blok || "-"}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Luas</div>
                        <div className="text-sm font-semibold text-slate-700">{u.luas} m²</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Lantai</div>
                        <div className="text-sm font-semibold text-slate-700">{u.lantai}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Penghuni</div>
                        <div className="text-sm font-semibold text-slate-700">{u.residents?.[0]?.name || "Kosong"}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openModal("unit", u)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors">
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => handleDelete("unit", u.id)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors">
                        <Trash2 size={14} /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DATA PENGHUNI ── */}
          {activeTab === "Data Penghuni" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input placeholder="Cari penghuni..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={() => openModal("resident")} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20">
                  <Plus size={18} /> Tambah Penghuni
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-bold">Nama & NIY</th>
                      <th className="px-6 py-4 font-bold">Unit</th>
                      <th className="px-6 py-4 font-bold">Kontak</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {residents.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{r.name}</div>
                          <div className="text-xs text-slate-400">{r.nik || r.niy || "-"}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{r.unit?.code}</td>
                        <td className="px-6 py-4 text-slate-600">{r.phone || "-"}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusColor(r.status)}`}>{r.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openModal("resident", r)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete("resident", r.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── MOU ── */}
          {activeTab === "MOU" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input placeholder="Cari MOU..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={() => openModal("mou")} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20">
                  <Plus size={18} /> Buat MOU Baru
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {mous.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{m.mouNumber}</div>
                        <div className="text-xs text-slate-400 mt-1">Unit {m.unit?.code} • {m.residentName}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusColor(m.status)}`}>{m.status}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-1">Mulai</span>
                        <span className="font-semibold text-slate-700">{new Date(m.startDate).toLocaleDateString("id-ID")}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Berakhir</span>
                        <span className="font-semibold text-slate-700">{new Date(m.endDate).toLocaleDateString("id-ID")}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownloadPDF(m)} disabled={pdfLoading === m.id} className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50">
                        {pdfLoading === m.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div> : <Download size={14} />} PDF
                      </button>
                      <button onClick={() => openModal("mou", m)} className="flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete("mou", m.id)} className="flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PEMELIHARAAN ── */}
          {activeTab === "Pemeliharaan" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input placeholder="Cari laporan..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={() => openModal("maintenance")} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20">
                  <Plus size={18} /> Lapor Pemeliharaan
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-bold">Judul Laporan</th>
                      <th className="px-6 py-4 font-bold">Unit</th>
                      <th className="px-6 py-4 font-bold">Tanggal Lapor</th>
                      <th className="px-6 py-4 font-bold">Prioritas</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maintenance.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{m.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1 max-w-xs">{m.description}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{m.unit?.code}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(m.reportedDate).toLocaleDateString("id-ID")}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusColor(m.priority)}`}>{m.priority}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusColor(m.status)}`}>{m.status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openModal("maintenance", m)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete("maintenance", m.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── LAPORAN ── */}
          {activeTab === "Laporan" && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><BarChart3 size={24} /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Laporan Manajemen Rumah Dinas</h3>
                  <p className="text-sm text-slate-500">Ringkasan operasional dan utilisasi aset rumah dinas.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 border border-slate-200 rounded-2xl">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Building size={18} className="text-blue-500"/> Okupansi Unit</h4>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600 text-sm">Ditempati ({stats.occupiedUnits})</span>
                    <span className="font-bold text-slate-800 text-sm">{Math.round((stats.occupiedUnits / stats.totalUnits) * 100 || 0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(stats.occupiedUnits / stats.totalUnits) * 100 || 0}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600 text-sm">Kosong ({stats.vacantUnits})</span>
                    <span className="font-bold text-slate-800 text-sm">{Math.round((stats.vacantUnits / stats.totalUnits) * 100 || 0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
                    <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${(stats.vacantUnits / stats.totalUnits) * 100 || 0}%` }}></div>
                  </div>
                </div>
                <div className="p-6 border border-slate-200 rounded-2xl">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} className="text-emerald-500"/> Status Pemeliharaan</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm text-slate-600">Menunggu Penanganan</span>
                      <span className="font-bold text-amber-600">{maintenance.filter(m => m.status === 'MENUNGGU').length}</span>
                    </li>
                    <li className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm text-slate-600">Dalam Pengerjaan</span>
                      <span className="font-bold text-blue-600">{maintenance.filter(m => m.status === 'DALAM_PENGERJAAN').length}</span>
                    </li>
                    <li className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm text-slate-600">Selesai (Keseluruhan)</span>
                      <span className="font-bold text-emerald-600">{maintenance.filter(m => m.status === 'SELESAI').length}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="flex justify-end">
                <button className="bg-slate-800 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
                  <Download size={18} /> Unduh Laporan Lengkap (PDF)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {form.id ? 'Edit Data' : 'Tambah Baru'}
                </h3>
                <p className="text-sm text-slate-400 capitalize">{showModal.replace('-', ' ')}</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              {showModal === "unit" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Kode Unit</label>
                    <input value={form.code || ""} onChange={e => setForm({...form, code: e.target.value})} placeholder="Contoh: RD-001" className={ic} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Blok</label>
                      <input value={form.blok || ""} onChange={e => setForm({...form, blok: e.target.value})} placeholder="A" className={ic} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Lantai</label>
                      <input type="number" value={form.lantai || 1} onChange={e => setForm({...form, lantai: e.target.value})} className={ic} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Luas (m²)</label>
                    <input type="number" value={form.luas || ""} onChange={e => setForm({...form, luas: e.target.value})} className={ic} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Status</label>
                    <select value={form.status || "KOSONG"} onChange={e => setForm({...form, status: e.target.value})} className={ic}>
                      <option value="KOSONG">Kosong</option>
                      <option value="DITEMPATI">Ditempati</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                </>
              )}

              {showModal === "resident" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Nama Lengkap</label>
                      <input 
                        value={nameSearch || form.name || ""} 
                        onChange={e => {
                          setNameSearch(e.target.value);
                          setShowNameDropdown(true);
                          setForm({...form, name: e.target.value});
                        }} 
                        onFocus={() => setShowNameDropdown(true)}
                        placeholder="Ketik cari nama..."
                        className={ic} 
                      />
                      {showNameDropdown && nameSearch && (
                        <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {filteredUsers.length > 0 ? filteredUsers.map(u => (
                            <button 
                              key={u.id} 
                              onClick={() => onUserSelect(u)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                            >
                              <div className="font-bold text-slate-800">{u.name}</div>
                              <div className="text-[10px] text-slate-400">{u.nip || u.username}</div>
                            </button>
                          )) : (
                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">Tidak ditemukan</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">NIY</label>
                      <input value={form.nik || ""} onChange={e => setForm({...form, nik: e.target.value})} className={ic} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Unit Rumah</label>
                      <select value={form.unitId || ""} onChange={e => setForm({...form, unitId: e.target.value})} className={ic}>
                        <option value="">Pilih Unit...</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name || "Unit"}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">No. HP / WA</label>
                      <input value={form.phone || ""} onChange={e => setForm({...form, phone: e.target.value})} className={ic} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Tanggal Masuk</label>
                      <input type="date" value={form.startDate ? form.startDate.split('T')[0] : ""} onChange={e => setForm({...form, startDate: e.target.value})} className={ic} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Status</label>
                      <select value={form.status || "AKTIF"} onChange={e => setForm({...form, status: e.target.value})} className={ic}>
                        <option value="AKTIF">Aktif</option>
                        <option value="NON_AKTIF">Non-Aktif</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {showModal === "mou" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Nomor MOU</label>
                      <input 
                        value={form.mouNumber || ""} 
                        onChange={e => setForm({...form, mouNumber: e.target.value})} 
                        placeholder="(Otomatis)" 
                        className={ic} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Unit Rumah</label>
                      <select value={form.unitId || ""} onChange={e => setForm({...form, unitId: e.target.value})} className={ic}>
                        <option value="">Pilih Unit...</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Nama Penghuni</label>
                      <input 
                        value={nameSearch || form.residentName || ""} 
                        onChange={e => {
                          setNameSearch(e.target.value);
                          setShowNameDropdown(true);
                          setForm({...form, residentName: e.target.value});
                        }} 
                        onFocus={() => setShowNameDropdown(true)}
                        placeholder="Ketik cari nama..."
                        className={ic} 
                      />
                      {showNameDropdown && nameSearch && (
                        <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {filteredUsers.length > 0 ? filteredUsers.map(u => (
                            <button 
                              key={u.id} 
                              onClick={() => {
                                setForm({
                                  ...form,
                                  residentName: u.name,
                                  residentPosition: u.nip || u.username
                                });
                                setNameSearch(u.name);
                                setShowNameDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                            >
                              <div className="font-bold text-slate-800">{u.name}</div>
                              <div className="text-[10px] text-slate-400">{u.nip || u.username}</div>
                            </button>
                          )) : (
                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">Tidak ditemukan</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">NIY</label>
                      <input 
                        value={form.residentPosition || ""} 
                        onChange={e => setForm({...form, residentPosition: e.target.value})} 
                        className={ic} 
                        placeholder="Otomatis atau isi manual..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Tgl Mulai</label>
                      <input type="date" value={form.startDate ? form.startDate.split('T')[0] : ""} onChange={e => setForm({...form, startDate: e.target.value})} className={ic} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Tgl Selesai</label>
                      <input type="date" value={form.endDate ? form.endDate.split('T')[0] : ""} onChange={e => setForm({...form, endDate: e.target.value})} className={ic} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Durasi (Thn)</label>
                      <input type="number" value={form.durationYears || 1} onChange={e => setForm({...form, durationYears: e.target.value})} className={ic} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Hak & Fasilitas</label>
                    <textarea rows={2} value={form.rights || ""} onChange={e => setForm({...form, rights: e.target.value})} className={ic}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Kewajiban</label>
                    <textarea rows={2} value={form.obligations || ""} onChange={e => setForm({...form, obligations: e.target.value})} className={ic}></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Status MOU</label>
                      <select value={form.status || "AKTIF"} onChange={e => setForm({...form, status: e.target.value})} className={ic}>
                        <option value="AKTIF">Aktif</option>
                        <option value="DIPERPANJANG">Diperpanjang</option>
                        <option value="KADALUARSA">Kadaluarsa</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Tanggal TTD</label>
                      <input type="date" value={form.signedDate ? form.signedDate.split('T')[0] : ""} onChange={e => setForm({...form, signedDate: e.target.value})} className={ic} />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-6">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        <span className="text-sm font-bold text-emerald-800">Tanda Tangan Digital Pihak Pertama</span>
                      </div>
                      <p className="text-xs text-emerald-600 ml-7">Tanda tangan Kepala Bidang Sarpras akan otomatis berupa QR Code verifikasi pada dokumen PDF.</p>
                    </div>
                    <SignaturePad label="Tanda Tangan Pihak Kedua (Penghuni)" value={form.signatureParty2} onChange={val => setForm({...form, signatureParty2: val})} />
                  </div>
                </>
              )}

              {showModal === "maintenance" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Judul Laporan</label>
                    <input value={form.title || ""} onChange={e => setForm({...form, title: e.target.value})} placeholder="Contoh: Atap Bocor di Kamar Utama" className={ic} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Unit Rumah</label>
                      <select value={form.unitId || ""} onChange={e => setForm({...form, unitId: e.target.value})} className={ic}>
                        <option value="">Pilih Unit...</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Tingkat Prioritas</label>
                      <select value={form.priority || "SEDANG"} onChange={e => setForm({...form, priority: e.target.value})} className={ic}>
                        <option value="RENDAH">Rendah</option>
                        <option value="SEDANG">Sedang</option>
                        <option value="TINGGI">Tinggi</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Deskripsi Kerusakan</label>
                    <textarea rows={3} value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} className={ic}></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Status Pengerjaan</label>
                      <select value={form.status || "MENUNGGU"} onChange={e => setForm({...form, status: e.target.value})} className={ic}>
                        <option value="MENUNGGU">Menunggu</option>
                        <option value="DALAM_PENGERJAAN">Dalam Pengerjaan</option>
                        <option value="SELESAI">Selesai</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Teknisi / Vendor</label>
                      <input value={form.technician || ""} onChange={e => setForm({...form, technician: e.target.value})} placeholder="Opsional" className={ic} />
                    </div>
                  </div>
                  {form.status === "SELESAI" && (
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Tanggal Selesai</label>
                      <input type="date" value={form.resolvedDate ? form.resolvedDate.split('T')[0] : ""} onChange={e => setForm({...form, resolvedDate: e.target.value})} className={ic} />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 mt-10">
              <button onClick={closeModal} className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-colors">Batal</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">Simpan Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
