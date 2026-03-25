import { useState, useRef, useEffect, useCallback } from "react";

/* ── Signature Pad Component ─────────────────────────────────────── */
function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  // Restore saved signature on mount / value change
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
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 hover:border-green-400 transition cursor-crosshair"
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

  // Header strip
  doc.setFillColor(20, 90, 50);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  text("YAYASAN DAR EL IMAN", W / 2, 15, "bold", "center"); y = 15;
  line();
  text("SURAT PERJANJIAN PENGGUNAAN RUMAH DINAS", W / 2, 9, "normal", "center");
  doc.setTextColor(0, 0, 0);
  y = 36;

  // Sub-title
  text("Memorandum of Understanding (MOU)", W / 2, 10, "italic", "center"); line();
  doc.setDrawColor(20, 90, 50); doc.setLineWidth(0.5); hline(); line();

  // Nomor & tanggal
  text(`Nomor  : ${mou.nomorMOU}`, margin, 10, "bold"); line();
  text(`Tanggal Tanda Tangan  : ${mou.tglTandaTangan}`, margin, 10); line(3);

  hline(); line(2);

  // Pembukaan
  const intro = `Pada hari ini, telah dibuat perjanjian antara Yayasan Dar El Iman, berkedudukan di Kota Padang, selanjutnya disebut PIHAK PERTAMA, dengan ${mou.penghuni}, selaku ${mou.jabatan}, selanjutnya disebut PIHAK KEDUA, mengenai penggunaan Rumah Dinas Unit ${mou.unitId}.`;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  const introLines = doc.splitTextToSize(intro, W - margin * 2);
  doc.text(introLines, margin, y); y += introLines.length * 5 + 4;

  // Pasal-pasal
  const pasal = [
    { judul: "Pasal 1 – Objek Perjanjian", isi: `Pihak Pertama memberikan hak penggunaan Rumah Dinas Unit ${mou.unitId} kepada Pihak Kedua selama masa perjanjian berlaku, terhitung mulai ${mou.tglMulai} sampai dengan ${mou.tglBerakhir} (${mou.durasiTahun} tahun).` },
    { judul: "Pasal 2 – Hak Pihak Kedua", isi: mou.hak },
    { judul: "Pasal 3 – Kewajiban Pihak Kedua", isi: mou.kewajiban },
    { judul: "Pasal 4 – Berakhirnya Perjanjian", isi: `Perjanjian ini berakhir pada tanggal ${mou.tglBerakhir}. Pihak Kedua wajib mengembalikan unit dalam kondisi baik selambat-lambatnya 14 hari setelah berakhirnya perjanjian.` },
    { judul: "Pasal 5 – Ketentuan Lain", isi: mou.catatan !== "-" ? mou.catatan : "Hal-hal yang belum diatur dalam perjanjian ini akan diselesaikan secara musyawarah dan mufakat." },
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

  // Draw signatures
  const sigH = 22;
  if (mou.ttdPertama) {
    try { doc.addImage(mou.ttdPertama, "PNG", margin, sigY + 2, 55, sigH); } catch (e) {}
  }
  if (mou.ttdKedua) {
    try { doc.addImage(mou.ttdKedua, "PNG", W / 2 + 10, sigY + 2, 55, sigH); } catch (e) {}
  }

  const nameY = sigY + sigH + 6;
  doc.line(margin, nameY, margin + 65, nameY);
  doc.line(W / 2 + 10, nameY, W / 2 + 75, nameY);
  doc.setFontSize(9);
  doc.text("Yayasan Dar El Iman", margin, nameY + 5);
  doc.text(mou.penghuni, W / 2 + 10, nameY + 5);

  // Footer
  const fY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7); doc.setTextColor(140);
  doc.text(`Dokumen ini dicetak secara digital oleh Sistem Manajemen Rumah Dinas Yayasan Dar El Iman`, W / 2, fY, { align: "center" });

  doc.save(`MOU_${mou.nomorMOU.replace(/\//g, "-")}.pdf`);
}

/* ── Data ─────────────────────────────────────────────────────────── */
const initialUnits = [
  { id: 1, kode: "RD-001", blok: "A", nama: "Unit A-1", luas: 72, lantai: 1, status: "Ditempati", fasilitas: ["AC", "Air PDAM", "Listrik 1300VA"] },
  { id: 2, kode: "RD-002", blok: "A", nama: "Unit A-2", luas: 72, lantai: 1, status: "Ditempati", fasilitas: ["AC", "Air PDAM", "Listrik 1300VA"] },
  { id: 3, kode: "RD-003", blok: "A", nama: "Unit A-3", luas: 72, lantai: 2, status: "Kosong", fasilitas: ["AC", "Air PDAM", "Listrik 1300VA"] },
  { id: 4, kode: "RD-004", blok: "B", nama: "Unit B-1", luas: 90, lantai: 1, status: "Ditempati", fasilitas: ["AC", "Air PDAM", "Listrik 2200VA", "Garasi"] },
  { id: 5, kode: "RD-005", blok: "B", nama: "Unit B-2", luas: 90, lantai: 1, status: "Maintenance", fasilitas: ["AC", "Air PDAM", "Listrik 2200VA", "Garasi"] },
  { id: 6, kode: "RD-006", blok: "B", nama: "Unit B-3", luas: 90, lantai: 2, status: "Ditempati", fasilitas: ["AC", "Air PDAM", "Listrik 2200VA", "Garasi"] },
];
const initialPenghuni = [
  { id: 1, nik: "1471010101800001", nama: "Ustadz H. Ahmad Fauzi, Lc", jabatan: "Kepala Sekolah", unit: "RD-001", tglMasuk: "2022-01-15", noHp: "081234567890", status: "Aktif" },
  { id: 2, nik: "1471010201850002", nama: "Ust. Muhammad Rizki, S.Pd", jabatan: "Wakil Kepala Sekolah", unit: "RD-002", tglMasuk: "2022-03-01", noHp: "082345678901", status: "Aktif" },
  { id: 3, nik: "1471010301900003", nama: "Ust. Abdurrahman Hakim", jabatan: "Guru Tahfidz", unit: "RD-004", tglMasuk: "2023-07-20", noHp: "083456789012", status: "Aktif" },
  { id: 4, nik: "1471010401880004", nama: "Ust. Ibrahim Syafi'i, M.Pd", jabatan: "Guru Fiqih", unit: "RD-006", tglMasuk: "2021-08-10", noHp: "084567890123", status: "Aktif" },
];
const initialMaintenance = [
  { id: 1, unitId: "RD-005", judul: "Atap Bocor", deskripsi: "Atap kamar utama bocor saat hujan", prioritas: "Tinggi", status: "Dalam Pengerjaan", tglLapor: "2026-03-01", tglSelesai: "-", petugas: "Tim Teknik" },
  { id: 2, unitId: "RD-003", judul: "Cat Dinding Mengelupas", deskripsi: "Cat dinding ruang tamu mengelupas", prioritas: "Rendah", status: "Menunggu", tglLapor: "2026-03-05", tglSelesai: "-", petugas: "-" },
  { id: 3, unitId: "RD-002", judul: "AC Tidak Dingin", deskripsi: "AC kamar tidur tidak berfungsi normal", prioritas: "Sedang", status: "Selesai", tglLapor: "2026-02-15", tglSelesai: "2026-02-20", petugas: "Teknisi AC" },
];
const initialMOU = [
  { id: 1, nomorMOU: "MOU/DEI/001/2022", unitId: "RD-001", penghuni: "Ustadz H. Ahmad Fauzi, Lc", jabatan: "Kepala Sekolah", tglMulai: "2022-01-15", tglBerakhir: "2026-06-14", durasiTahun: 2, status: "Diperpanjang", kewajiban: "Menjaga kebersihan dan ketertiban unit, tidak mengalihkan hak hunian.", hak: "Menempati unit RD-001 selama masa perjanjian berlaku.", catatan: "Sudah diperpanjang hingga 2026", tglTandaTangan: "2022-01-10", ttdPertama: "", ttdKedua: "" },
  { id: 2, nomorMOU: "MOU/DEI/002/2022", unitId: "RD-002", penghuni: "Ust. Muhammad Rizki, S.Pd", jabatan: "Wakil Kepala Sekolah", tglMulai: "2022-03-01", tglBerakhir: "2025-02-28", durasiTahun: 3, status: "Aktif", kewajiban: "Menjaga kebersihan dan ketertiban unit, tidak mengalihkan hak hunian.", hak: "Menempati unit RD-002 selama masa perjanjian berlaku.", catatan: "-", tglTandaTangan: "2022-02-25", ttdPertama: "", ttdKedua: "" },
  { id: 3, nomorMOU: "MOU/DEI/003/2023", unitId: "RD-004", penghuni: "Ust. Abdurrahman Hakim", jabatan: "Guru Tahfidz", tglMulai: "2023-07-20", tglBerakhir: "2025-07-19", durasiTahun: 2, status: "Aktif", kewajiban: "Menjaga kebersihan dan ketertiban unit, tidak mengalihkan hak hunian.", hak: "Menempati unit RD-004 selama masa perjanjian berlaku.", catatan: "-", tglTandaTangan: "2023-07-15", ttdPertama: "", ttdKedua: "" },
  { id: 4, nomorMOU: "MOU/DEI/004/2021", unitId: "RD-006", penghuni: "Ust. Ibrahim Syafi'i, M.Pd", jabatan: "Guru Fiqih", tglMulai: "2021-08-10", tglBerakhir: "2023-08-09", durasiTahun: 2, status: "Kadaluarsa", kewajiban: "Menjaga kebersihan dan ketertiban unit, tidak mengalihkan hak hunian.", hak: "Menempati unit RD-006 selama masa perjanjian berlaku.", catatan: "Perlu pembaruan MOU", tglTandaTangan: "2021-08-05", ttdPertama: "", ttdKedua: "" },
];

const TABS = ["Dashboard", "Data Unit", "Data Penghuni", "MOU", "Pemeliharaan", "Laporan"];
const TAB_ICONS = { "Dashboard": "🏠", "Data Unit": "🏢", "Data Penghuni": "👥", "MOU": "📄", "Pemeliharaan": "🔧", "Laporan": "📊" };

const statusColor = (s) => {
  const map = { "Ditempati": "bg-emerald-100 text-emerald-700", "Kosong": "bg-blue-100 text-blue-700", "Maintenance": "bg-amber-100 text-amber-700", "Aktif": "bg-emerald-100 text-emerald-700", "Non-Aktif": "bg-red-100 text-red-700", "Selesai": "bg-emerald-100 text-emerald-700", "Dalam Pengerjaan": "bg-blue-100 text-blue-700", "Menunggu": "bg-amber-100 text-amber-700", "Tinggi": "bg-red-100 text-red-700", "Sedang": "bg-amber-100 text-amber-700", "Rendah": "bg-green-100 text-green-700", "Diperpanjang": "bg-purple-100 text-purple-700", "Kadaluarsa": "bg-red-100 text-red-700" };
  return map[s] || "bg-gray-100 text-gray-700";
};
const getDaysUntilExpiry = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

/* ── Main App ─────────────────────────────────────────────────────── */
export default function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [units, setUnits] = useState(initialUnits);
  const [penghuni, setPenghuni] = useState(initialPenghuni);
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [mou, setMou] = useState(initialMOU);
  const [showModal, setShowModal] = useState(null);
  const [viewMOU, setViewMOU] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState("");
  const [pdfLoading, setPdfLoading] = useState(null);

  const totalUnit = units.length;
  const unitDitempati = units.filter(u => u.status === "Ditempati").length;
  const unitKosong = units.filter(u => u.status === "Kosong").length;
  const unitMaintenance = units.filter(u => u.status === "Maintenance").length;
  const mouAktif = mou.filter(m => m.status === "Aktif" || m.status === "Diperpanjang").length;
  const mouKadaluarsa = mou.filter(m => m.status === "Kadaluarsa").length;
  const mouSegera = mou.filter(m => { const d = getDaysUntilExpiry(m.tglBerakhir); return d > 0 && d <= 90 && m.status !== "Kadaluarsa"; }).length;

  const openModal = (type, data = {}) => { setShowModal(type); setForm({ ...data }); };
  const closeModal = () => { setShowModal(null); setForm({}); };

  const handleSave = {
    unit: () => { form.id ? setUnits(units.map(u => u.id === form.id ? { ...u, ...form } : u)) : setUnits([...units, { ...form, id: Date.now(), fasilitas: [] }]); closeModal(); },
    penghuni: () => { form.id ? setPenghuni(penghuni.map(p => p.id === form.id ? { ...p, ...form } : p)) : setPenghuni([...penghuni, { ...form, id: Date.now() }]); closeModal(); },
    maintenance: () => { form.id ? setMaintenance(maintenance.map(m => m.id === form.id ? { ...m, ...form } : m)) : setMaintenance([...maintenance, { ...form, id: Date.now(), tglLapor: new Date().toISOString().slice(0, 10), tglSelesai: "-", petugas: "-" }]); closeModal(); },
    mou: () => { form.id ? setMou(mou.map(m => m.id === form.id ? { ...m, ...form } : m)) : setMou([...mou, { ...form, id: Date.now(), ttdPertama: form.ttdPertama || "", ttdKedua: form.ttdKedua || "" }]); closeModal(); },
  };

  const handleDownloadPDF = async (m) => {
    setPdfLoading(m.id);
    try { await downloadMOUPdf(m); }
    catch (e) { alert("Gagal membuat PDF: " + e.message); }
    setPdfLoading(null);
  };

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white";

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow">
              <span className="text-green-700 font-bold text-lg">دار</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Yayasan Dar El Iman</h1>
              <p className="text-green-200 text-sm">Sistem Manajemen Rumah Dinas</p>
            </div>
          </div>
          <div className="text-sm text-green-200 hidden md:block">
            📅 {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${activeTab === tab ? "bg-white text-green-800 shadow" : "text-green-200 hover:text-white hover:bg-green-700"}`}>
                {TAB_ICONS[tab]} {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── DASHBOARD ── */}
        {activeTab === "Dashboard" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Unit", value: totalUnit, sub: "Unit rumah dinas", color: "from-green-500 to-green-700", icon: "🏠" },
                { label: "Ditempati", value: unitDitempati, sub: `${Math.round(unitDitempati / totalUnit * 100)}% terisi`, color: "from-blue-500 to-blue-700", icon: "👨‍👩‍👧" },
                { label: "Total Penghuni", value: penghuni.length, sub: "Penghuni aktif", color: "from-purple-500 to-purple-700", icon: "👥" },
                { label: "MOU Aktif", value: mouAktif, sub: `${mouKadaluarsa} kadaluarsa`, color: "from-amber-500 to-amber-700", icon: "📄" },
              ].map((s, i) => (
                <div key={i} className={`bg-gradient-to-br ${s.color} text-white rounded-2xl p-5 shadow-lg`}>
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="font-semibold text-sm opacity-90">{s.label}</div>
                  <div className="text-xs opacity-75 mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-gray-700 mb-4 text-lg">📊 Status Unit Rumah</h3>
                {[{ label: "Ditempati", val: unitDitempati, color: "bg-emerald-500" }, { label: "Kosong", val: unitKosong, color: "bg-blue-400" }, { label: "Maintenance", val: unitMaintenance, color: "bg-amber-400" }].map(s => (
                  <div key={s.label} className="mb-3">
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{s.label}</span><span className="font-bold">{s.val} unit</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-3"><div className={`${s.color} h-3 rounded-full`} style={{ width: `${(s.val / totalUnit) * 100}%` }}></div></div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-gray-700 mb-4 text-lg">📄 Status MOU</h3>
                {[{ label: "MOU Aktif", val: mou.filter(m => m.status === "Aktif").length, color: "bg-emerald-50 text-emerald-700" }, { label: "MOU Diperpanjang", val: mou.filter(m => m.status === "Diperpanjang").length, color: "bg-purple-50 text-purple-700" }, { label: "Akan Berakhir (90 hari)", val: mouSegera, color: "bg-amber-50 text-amber-700" }, { label: "MOU Kadaluarsa", val: mouKadaluarsa, color: "bg-red-50 text-red-700" }].map(s => (
                  <div key={s.label} className={`flex justify-between items-center px-4 py-2 rounded-xl mb-2 ${s.color}`}>
                    <span className="text-sm font-medium">{s.label}</span><span className="font-bold text-lg">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-gray-700 mb-4 text-lg">🔧 Pemeliharaan Aktif</h3>
              {maintenance.filter(m => m.status !== "Selesai").map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 mb-2">
                  <div><span className="font-semibold text-gray-800">{m.judul}</span><span className="text-gray-400 text-sm ml-2">({m.unitId})</span><div className="text-xs text-gray-400">{m.deskripsi}</div></div>
                  <div className="flex gap-2"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(m.prioritas)}`}>{m.prioritas}</span><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(m.status)}`}>{m.status}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DATA UNIT ── */}
        {activeTab === "Data Unit" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">🏢 Data Unit Rumah Dinas</h2>
              <button onClick={() => openModal("unit")} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 text-sm font-medium shadow">+ Tambah Unit</button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map(u => (
                <div key={u.id} className="bg-white rounded-2xl shadow p-5 border border-gray-100 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div><div className="font-bold text-gray-800 text-lg">{u.nama}</div><div className="text-xs text-gray-400 font-mono">{u.kode}</div></div>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(u.status)}`}>{u.status}</span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1 mb-4">
                    <div>📐 Luas: <span className="text-gray-700 font-medium">{u.luas} m²</span></div>
                    <div>🏗 Blok: <span className="text-gray-700 font-medium">Blok {u.blok}</span></div>
                    <div>🏠 Lantai: <span className="text-gray-700 font-medium">{u.lantai}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">{u.fasilitas.map(f => <span key={f} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{f}</span>)}</div>
                  <div className="flex gap-2">
                    <button onClick={() => openModal("unit", u)} className="flex-1 text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 font-medium">✏️ Edit</button>
                    <button onClick={() => setUnits(units.filter(x => x.id !== u.id))} className="flex-1 text-xs bg-red-50 text-red-500 px-3 py-2 rounded-lg hover:bg-red-100 font-medium">🗑 Hapus</button>
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
              <h2 className="text-2xl font-bold text-gray-800">👥 Data Penghuni</h2>
              <button onClick={() => openModal("penghuni")} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 text-sm font-medium shadow">+ Tambah Penghuni</button>
            </div>
            <input placeholder="🔍 Cari penghuni..." value={search} onChange={e => setSearch(e.target.value)} className="w-full mb-4 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
            <div className="bg-white rounded-2xl shadow overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50 text-green-800">{["No", "Nama", "Jabatan", "Unit", "Tgl Masuk", "No HP", "Status", "Aksi"].map(h => <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>)}</thead>
                <tbody>
                  {penghuni.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.jabatan.toLowerCase().includes(search.toLowerCase())).map((p, i) => (
                    <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{p.nama}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.jabatan}</td>
                      <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono text-xs">{p.unit}</span></td>
                      <td className="px-4 py-3 text-gray-500">{p.tglMasuk}</td>
                      <td className="px-4 py-3 text-gray-500">{p.noHp}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span></td>
                      <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => openModal("penghuni", p)} className="text-blue-500 text-xs px-2 py-1 bg-blue-50 rounded">Edit</button><button onClick={() => setPenghuni(penghuni.filter(x => x.id !== p.id))} className="text-red-400 text-xs px-2 py-1 bg-red-50 rounded">Hapus</button></div></td>
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
              <h2 className="text-2xl font-bold text-gray-800">📄 Manajemen MOU Rumah Dinas</h2>
              <button onClick={() => openModal("mou")} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 text-sm font-medium shadow">+ Buat MOU Baru</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[{ label: "Total MOU", val: mou.length, color: "bg-gray-700" }, { label: "Aktif / Diperpanjang", val: mouAktif, color: "bg-emerald-600" }, { label: "Segera Berakhir", val: mouSegera, color: "bg-amber-500" }, { label: "Kadaluarsa", val: mouKadaluarsa, color: "bg-red-500" }].map(s => (
                <div key={s.label} className={`${s.color} text-white rounded-xl p-4 shadow`}><div className="text-2xl font-bold">{s.val}</div><div className="text-xs opacity-80">{s.label}</div></div>
              ))}
            </div>
            {mouKadaluarsa > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div><div className="font-semibold text-red-700">{mouKadaluarsa} MOU telah kadaluarsa</div><div className="text-sm text-red-500">Segera lakukan pembaruan perjanjian.</div></div>
              </div>
            )}
            <div className="space-y-4">
              {mou.map(m => {
                const daysLeft = getDaysUntilExpiry(m.tglBerakhir);
                const soon = daysLeft > 0 && daysLeft <= 90;
                return (
                  <div key={m.id} className={`bg-white rounded-2xl shadow p-5 border-l-4 ${m.status === "Kadaluarsa" ? "border-red-400" : soon ? "border-amber-400" : m.status === "Diperpanjang" ? "border-purple-400" : "border-emerald-400"}`}>
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-gray-800 text-lg">{m.penghuni}</span>
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(m.status)}`}>{m.status}</span>
                          {soon && <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">⏰ {daysLeft} hari lagi</span>}
                          {m.status === "Kadaluarsa" && <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 font-semibold">Expired {Math.abs(daysLeft)} hari lalu</span>}
                        </div>
                        <div className="text-sm text-gray-500 mb-1">{m.jabatan} • Unit <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-700">{m.unitId}</span></div>
                        <div className="text-xs text-gray-400 font-mono mb-3">{m.nomorMOU}</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                          {[["Mulai", m.tglMulai], ["Berakhir", m.tglBerakhir], ["Durasi", `${m.durasiTahun} tahun`], ["Tanda Tangan", m.tglTandaTangan]].map(([k, v]) => (
                            <div key={k} className="bg-gray-50 rounded-lg p-2"><div className="text-gray-400 mb-0.5">{k}</div><div className="font-medium text-gray-700">{v}</div></div>
                          ))}
                        </div>
                        {/* TTD preview */}
                        <div className="flex gap-3 flex-wrap">
                          {m.ttdPertama && <div className="text-xs text-gray-400">✅ TTD Pihak Pertama <span className="text-emerald-500 font-semibold">tersimpan</span></div>}
                          {m.ttdKedua && <div className="text-xs text-gray-400">✅ TTD Pihak Kedua <span className="text-emerald-500 font-semibold">tersimpan</span></div>}
                        </div>
                        {m.catatan !== "-" && <div className="mt-2 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg inline-block">📌 {m.catatan}</div>}
                      </div>
                      <div className="flex flex-col gap-2 min-w-max">
                        <button onClick={() => setViewMOU(m)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">👁 Lihat Detail</button>
                        <button onClick={() => openModal("mou", m)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium">✏️ Edit</button>
                        <button onClick={() => handleDownloadPDF(m)} disabled={pdfLoading === m.id}
                          className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium flex items-center gap-1 disabled:opacity-60">
                          {pdfLoading === m.id ? "⏳ Membuat..." : "⬇️ Download PDF"}
                        </button>
                        <button onClick={() => setMou(mou.filter(x => x.id !== m.id))} className="text-xs bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg hover:bg-gray-100 font-medium">🗑 Hapus</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PEMELIHARAAN ── */}
        {activeTab === "Pemeliharaan" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">🔧 Pemeliharaan & Maintenance</h2>
              <button onClick={() => openModal("maintenance")} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 text-sm font-medium shadow">+ Lapor Kerusakan</button>
            </div>
            {maintenance.map(m => (
              <div key={m.id} className="bg-white rounded-2xl shadow p-5 border border-gray-100 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1"><span className="font-bold text-gray-800">{m.judul}</span><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">{m.unitId}</span></div>
                    <p className="text-sm text-gray-500 mb-2">{m.deskripsi}</p>
                    <div className="text-xs text-gray-400 flex flex-wrap gap-4"><span>📅 {m.tglLapor}</span><span>✅ {m.tglSelesai}</span><span>👷 {m.petugas}</span></div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(m.status)}`}>{m.status}</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(m.prioritas)}`}>Prioritas {m.prioritas}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openModal("maintenance", m)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100">✏️ Edit</button>
                  <button onClick={() => setMaintenance(maintenance.filter(x => x.id !== m.id))} className="text-xs bg-red-50 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-100">🗑 Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── LAPORAN ── */}
        {activeTab === "Laporan" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Laporan</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-gray-700 mb-4">🏠 Ringkasan Hunian</h3>
                {[["Total Unit", totalUnit], ["Ditempati", unitDitempati], ["Kosong", unitKosong], ["Maintenance", unitMaintenance], ["Tingkat Hunian", `${Math.round(unitDitempati / totalUnit * 100)}%`], ["Total Penghuni", penghuni.length]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-gray-50 text-sm"><span className="text-gray-500">{k}</span><span className="font-semibold text-gray-800">{v}</span></div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-gray-700 mb-4">📄 Ringkasan MOU</h3>
                {[["Total MOU", mou.length], ["Aktif", mou.filter(m => m.status === "Aktif").length], ["Diperpanjang", mou.filter(m => m.status === "Diperpanjang").length], ["Segera Berakhir", mouSegera], ["Kadaluarsa", mouKadaluarsa], ["Sudah Ada TTD", mou.filter(m => m.ttdPertama && m.ttdKedua).length]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-gray-50 text-sm"><span className="text-gray-500">{k}</span><span className={`font-semibold ${k === "Kadaluarsa" && v > 0 ? "text-red-500" : "text-gray-800"}`}>{v}</span></div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow p-6 md:col-span-2">
                <h3 className="font-bold text-gray-700 mb-4">🔧 Ringkasan Pemeliharaan</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[{ l: "Menunggu", f: "Menunggu", c: "bg-amber-100 text-amber-700" }, { l: "Dalam Pengerjaan", f: "Dalam Pengerjaan", c: "bg-blue-100 text-blue-700" }, { l: "Selesai", f: "Selesai", c: "bg-emerald-100 text-emerald-700" }].map(s => (
                    <div key={s.l} className={`${s.c} rounded-xl p-4 text-center`}><div className="text-3xl font-bold">{maintenance.filter(m => m.status === s.f).length}</div><div className="text-sm font-medium mt-1">{s.l}</div></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL DETAIL MOU ── */}
      {viewMOU && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-t-2xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs opacity-70 mb-1">Yayasan Dar El Iman</div>
                  <h2 className="text-xl font-bold">SURAT PERJANJIAN RUMAH DINAS</h2>
                  <div className="text-sm opacity-80">Memorandum of Understanding (MOU)</div>
                </div>
                <button onClick={() => setViewMOU(null)} className="text-3xl opacity-70 hover:opacity-100 leading-none">×</button>
              </div>
            </div>
            <div className="p-6">
              <div className="text-center mb-6 pb-4 border-b border-gray-100">
                <div className="font-mono text-sm text-gray-500">{viewMOU.nomorMOU}</div>
                <div className="text-xs text-gray-400">Ditandatangani pada {viewMOU.tglTandaTangan}</div>
              </div>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">Perjanjian ini dibuat antara <strong>Yayasan Dar El Iman</strong> sebagai Pihak Pertama, dengan <strong>{viewMOU.penghuni}</strong> selaku <strong>{viewMOU.jabatan}</strong> sebagai Pihak Kedua, mengenai hak penggunaan <strong>Rumah Dinas Unit {viewMOU.unitId}</strong>.</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[["Nomor MOU", viewMOU.nomorMOU], ["Unit", viewMOU.unitId], ["Tanggal Mulai", viewMOU.tglMulai], ["Tanggal Berakhir", viewMOU.tglBerakhir], ["Durasi", `${viewMOU.durasiTahun} tahun`], ["Status", viewMOU.status]].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-xl p-3"><div className="text-xs text-gray-400 mb-0.5">{k}</div><div className="font-semibold text-gray-800 text-sm">{v}</div></div>
                ))}
              </div>
              <div className="space-y-4 mb-6">
                <div className="bg-green-50 rounded-xl p-4"><div className="font-semibold text-green-800 mb-2 text-sm">✅ Hak Pihak Kedua</div><p className="text-sm text-gray-600">{viewMOU.hak}</p></div>
                <div className="bg-amber-50 rounded-xl p-4"><div className="font-semibold text-amber-800 mb-2 text-sm">📋 Kewajiban Pihak Kedua</div><p className="text-sm text-gray-600">{viewMOU.kewajiban}</p></div>
                {viewMOU.catatan !== "-" && <div className="bg-blue-50 rounded-xl p-4"><div className="font-semibold text-blue-800 mb-2 text-sm">📌 Catatan</div><p className="text-sm text-gray-600">{viewMOU.catatan}</p></div>}
              </div>
              {/* Tanda Tangan Preview */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                {[["Pihak Pertama", "Yayasan Dar El Iman", viewMOU.ttdPertama], ["Pihak Kedua", viewMOU.penghuni, viewMOU.ttdKedua]].map(([pihak, nama, ttd]) => (
                  <div key={pihak} className="text-center">
                    <div className="text-sm font-semibold text-gray-700 mb-3">{pihak}</div>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl h-24 flex items-center justify-center bg-gray-50 mb-2">
                      {ttd ? <img src={ttd} alt="TTD" className="max-h-20 max-w-full object-contain" /> : <span className="text-gray-300 text-xs">Belum ada tanda tangan</span>}
                    </div>
                    <div className="border-b border-gray-300 mx-4 mb-1"></div>
                    <div className="text-xs text-gray-600">{nama}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setViewMOU(null)} className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">Tutup</button>
                <button onClick={() => { openModal("mou", viewMOU); setViewMOU(null); }} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">✏️ Edit MOU</button>
                <button onClick={() => handleDownloadPDF(viewMOU)} disabled={pdfLoading === viewMOU.id}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-700 disabled:opacity-60">
                  {pdfLoading === viewMOU.id ? "⏳ Membuat..." : "⬇️ Download PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FORMS ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-gray-800 text-lg">
                {showModal === "unit" && (form.id ? "Edit Unit" : "Tambah Unit Baru")}
                {showModal === "penghuni" && (form.id ? "Edit Penghuni" : "Tambah Penghuni")}
                {showModal === "mou" && (form.id ? "Edit MOU" : "Buat MOU Baru")}
                {showModal === "maintenance" && (form.id ? "Edit Laporan" : "Lapor Kerusakan")}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">

              {showModal === "unit" && (<>
                {[["kode", "Kode Unit"], ["nama", "Nama Unit"], ["blok", "Blok"], ["luas", "Luas (m²)"], ["lantai", "Lantai"]].map(([k, l]) => (
                  <div key={k}><label className="text-xs text-gray-500 mb-1 block">{l}</label><input value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} className={ic} /></div>
                ))}
                <div><label className="text-xs text-gray-500 mb-1 block">Status</label><select value={form.status || ""} onChange={e => setForm({ ...form, status: e.target.value })} className={ic}><option>Ditempati</option><option>Kosong</option><option>Maintenance</option></select></div>
              </>)}

              {showModal === "penghuni" && (<>
                {[["nik", "NIK"], ["nama", "Nama Lengkap"], ["jabatan", "Jabatan"], ["unit", "Kode Unit"], ["tglMasuk", "Tanggal Masuk"], ["noHp", "No. HP"]].map(([k, l]) => (
                  <div key={k}><label className="text-xs text-gray-500 mb-1 block">{l}</label><input value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} className={ic} type={k === "tglMasuk" ? "date" : "text"} /></div>
                ))}
                <div><label className="text-xs text-gray-500 mb-1 block">Status</label><select value={form.status || "Aktif"} onChange={e => setForm({ ...form, status: e.target.value })} className={ic}><option>Aktif</option><option>Non-Aktif</option></select></div>
              </>)}

              {showModal === "mou" && (<>
                {[["nomorMOU", "Nomor MOU"], ["unitId", "Kode Unit"], ["penghuni", "Nama Penghuni"], ["jabatan", "Jabatan"], ["tglMulai", "Tanggal Mulai"], ["tglBerakhir", "Tanggal Berakhir"], ["durasiTahun", "Durasi (Tahun)"], ["tglTandaTangan", "Tanggal Tanda Tangan"]].map(([k, l]) => (
                  <div key={k}><label className="text-xs text-gray-500 mb-1 block">{l}</label><input value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} className={ic} type={["tglMulai", "tglBerakhir", "tglTandaTangan"].includes(k) ? "date" : "text"} /></div>
                ))}
                <div><label className="text-xs text-gray-500 mb-1 block">Hak Penghuni</label><textarea value={form.hak || ""} onChange={e => setForm({ ...form, hak: e.target.value })} rows={2} className={ic} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Kewajiban Penghuni</label><textarea value={form.kewajiban || ""} onChange={e => setForm({ ...form, kewajiban: e.target.value })} rows={2} className={ic} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Catatan</label><input value={form.catatan || ""} onChange={e => setForm({ ...form, catatan: e.target.value })} className={ic} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Status</label><select value={form.status || "Aktif"} onChange={e => setForm({ ...form, status: e.target.value })} className={ic}><option>Aktif</option><option>Diperpanjang</option><option>Kadaluarsa</option></select></div>

                {/* ── Signature Pads ── */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-2">✍️ Tanda Tangan Digital</p>
                  <div className="space-y-4">
                    <SignaturePad
                      label="Tanda Tangan Pihak Pertama (Yayasan Dar El Iman)"
                      value={form.ttdPertama || ""}
                      onChange={v => setForm(f => ({ ...f, ttdPertama: v }))}
                    />
                    <SignaturePad
                      label="Tanda Tangan Pihak Kedua (Penghuni)"
                      value={form.ttdKedua || ""}
                      onChange={v => setForm(f => ({ ...f, ttdKedua: v }))}
                    />
                  </div>
                </div>
              </>)}

              {showModal === "maintenance" && (<>
                {[["unitId", "Kode Unit"], ["judul", "Judul Kerusakan"], ["deskripsi", "Deskripsi"]].map(([k, l]) => (
                  <div key={k}><label className="text-xs text-gray-500 mb-1 block">{l}</label>
                    {k === "deskripsi" ? <textarea value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} rows={3} className={ic} /> : <input value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} className={ic} />}
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Prioritas</label><select value={form.prioritas || "Sedang"} onChange={e => setForm({ ...form, prioritas: e.target.value })} className={ic}><option>Tinggi</option><option>Sedang</option><option>Rendah</option></select></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Status</label><select value={form.status || "Menunggu"} onChange={e => setForm({ ...form, status: e.target.value })} className={ic}><option>Menunggu</option><option>Dalam Pengerjaan</option><option>Selesai</option></select></div>
                </div>
                {[["petugas", "Petugas"], ["tglSelesai", "Tanggal Selesai"]].map(([k, l]) => (
                  <div key={k}><label className="text-xs text-gray-500 mb-1 block">{l}</label><input value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} className={ic} type={k === "tglSelesai" ? "date" : "text"} /></div>
                ))}
              </>)}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium">Batal</button>
              <button onClick={handleSave[showModal]} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 text-sm font-medium shadow">💾 Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}