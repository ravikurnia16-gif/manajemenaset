import React, { useState } from 'react';
import {
    Printer, Camera, Sparkles, Loader2, Bot, Check, Edit3,
    RefreshCw, CheckCircle2, AlertTriangle, FileText, ChevronDown
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../lib/axios';
import { getMediaUrl } from '../../../lib/media';

/**
 * Format markdown lines for print and screen rendering
 */
const formatInlineMarkdown = (str) => {
    return str
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
};

const renderFormattedAiText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
        <div className="space-y-2 text-xs leading-relaxed text-slate-800">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1" />;

                // Headings
                if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                    const cleanTitle = trimmed.replace(/^#+\s*/, '');
                    return (
                        <h6 key={idx} className="font-black text-slate-900 text-xs tracking-wide uppercase pt-2.5 border-b border-slate-200 pb-1">
                            {cleanTitle}
                        </h6>
                    );
                }

                // Bullet points
                if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                    const content = trimmed.substring(2);
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                            <span className="text-indigo-600 font-bold mt-0.5">•</span>
                            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(content) }} />
                        </div>
                    );
                }

                // Numbered lists
                const matchNum = trimmed.match(/^(\d+\.)\s*(.*)/);
                if (matchNum) {
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                            <span className="text-indigo-700 font-black font-mono text-[11px] mt-0.5">{matchNum[1]}</span>
                            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(matchNum[2]) }} />
                        </div>
                    );
                }

                return (
                    <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
                );
            })}
        </div>
    );
};

export default function WeeklyPdfTab({
    weeklyStartDate,
    setWeeklyStartDate,
    weeklyEndDate,
    setWeeklyEndDate,
    customKabidNiy,
    setCustomKabidNiy,
    weeklyData,
    loading,
    user,
    setLightboxPhoto
}) {
    // AI Analysis States
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [includeAiInPdf, setIncludeAiInPdf] = useState(true);
    const [includePhotosInPdf, setIncludePhotosInPdf] = useState(false);
    const [aiMode, setAiMode] = useState('STAFF_NARRATIVE'); // 'STAFF_NARRATIVE' | 'WEEKLY_EXECUTIVE' | 'TEAM_PERFORMANCE' | 'OBSTACLE_SOLUTIONS'
    const [isEditingAi, setIsEditingAi] = useState(false);

    // Helper to identify and strictly exclude Kepala Bidang Sarana reports
    const isKabidNameOrPos = (name = '', pos = '') => {
        const n = (name || '').toLowerCase();
        const p = (pos || '').toLowerCase();
        return (
            p.includes('kepala bidang') ||
            p.includes('kabid') ||
            n.includes('ravi kurnia') ||
            (user?.name && n.includes(user.name.toLowerCase()) && (p.includes('kepala') || p.includes('kabid')))
        );
    };

    // Compute or retrieve position-based summary without staff personal names (excluding Kabid)
    const positionSummaries = React.useMemo(() => {
        if (weeklyData?.positionSummary && weeklyData.positionSummary.length > 0) {
            return weeklyData.positionSummary.filter(p => !isKabidNameOrPos('', p.position));
        }
        const posMap = {};
        (weeklyData?.dailyDivisionBreakdown || []).forEach(day => {
            (day.activities || []).forEach(act => {
                const pos = act.position || 'Staf Sarana & Prasarana';
                const staff = act.staffName || act.userName || '';
                if (isKabidNameOrPos(staff, pos)) return;

                if (!posMap[pos]) {
                    posMap[pos] = {
                        position: pos,
                        totalCompleted: 0,
                        totalInProgress: 0,
                        totalObstacles: 0,
                        totalActivities: 0,
                        keyTasks: new Set(),
                        categories: new Set()
                    };
                }
                posMap[pos].totalActivities++;
                if (act.status === 'COMPLETED') posMap[pos].totalCompleted++;
                else if (act.status === 'IN_PROGRESS') posMap[pos].totalInProgress++;
                else if (act.status === 'OBSTACLE') posMap[pos].totalObstacles++;
                if (act.categoryTag) posMap[pos].categories.add(act.categoryTag);
                if (act.activity && act.activity.trim() && !act.activity.includes('Dokumentasi Foto')) {
                    posMap[pos].keyTasks.add(act.activity.trim());
                }
            });
        });
        return Object.values(posMap).map(p => ({
            ...p,
            keyTasks: Array.from(p.keyTasks),
            categories: Array.from(p.categories)
        })).sort((a, b) => b.totalActivities - a.totalActivities);
    }, [weeklyData, user]);

    // Compute or retrieve individual staff report points (strictly excluding Kabid Sarana)
    const staffSummaries = React.useMemo(() => {
        if (weeklyData?.staffSummary && weeklyData.staffSummary.length > 0) {
            return weeklyData.staffSummary
                .filter(s => !isKabidNameOrPos(s.staffName, s.position))
                .sort((a, b) => a.staffName.localeCompare(b.staffName));
        }

        const sMap = {};
        (weeklyData?.dailyDivisionBreakdown || []).forEach(day => {
            (day.activities || []).forEach(act => {
                const staffName = act.staffName || act.userName || 'Staf Sarana';
                const pos = act.position || 'Staf Sarana & Prasarana';
                if (isKabidNameOrPos(staffName, pos)) return;

                if (!sMap[staffName]) {
                    sMap[staffName] = {
                        staffName,
                        position: pos,
                        points: [],
                        totalActivities: 0,
                        totalCompleted: 0,
                        totalInProgress: 0,
                        totalObstacles: 0
                    };
                }

                if (act.activity && act.activity.trim() && !act.activity.includes('Dokumentasi Foto')) {
                    sMap[staffName].totalActivities++;
                    if (act.status === 'COMPLETED') sMap[staffName].totalCompleted++;
                    else if (act.status === 'IN_PROGRESS') sMap[staffName].totalInProgress++;
                    else if (act.status === 'OBSTACLE') sMap[staffName].totalObstacles++;

                    sMap[staffName].points.push({
                        date: day.date || day.dateShort || '',
                        dateShort: day.dateShort || '',
                        text: act.activity.trim(),
                        status: act.status || 'COMPLETED',
                        categoryTag: act.categoryTag || 'UMUM',
                        obstacleNote: act.obstacleNote || ''
                    });
                }
            });
        });

        return Object.values(sMap)
            .filter(s => s.points.length > 0)
            .sort((a, b) => a.staffName.localeCompare(b.staffName));
    }, [weeklyData, user]);

    // Filtered obstacle list excluding Kabid Sarana
    const filteredObstacleList = React.useMemo(() => {
        return (weeklyData?.obstacleList || []).filter(obs => 
            !isKabidNameOrPos(obs.staffName, obs.position)
        );
    }, [weeklyData, user]);

    // Narrative generator fallback per staff position without percentages or completed/in-progress counts
    const getDefaultNarrativeForPosition = (pos) => {
        const tasks = pos.keyTasks || [];
        const cats = (pos.categories && pos.categories.length > 0) ? pos.categories.join(', ') : 'sarana dan prasarana yayasan';
        if (tasks.length === 0) {
            return `Sepanjang periode laporan ini, ${pos.position} melaksanakan tugas rutin pemantauan fasilitas, kesiapsiagaan teknis harian, dan perawatan berkala guna mendukung kelancaran operasional di lingkungan Yayasan Dar el Iman.`;
        }
        const sampleTasks = tasks.slice(0, 4).join(', ');
        const moreText = tasks.length > 4 ? ` serta penanganan agenda pemeliharaan teknis operasional pendukung lainnya` : '';
        return `Selama periode laporan ini, ${pos.position} fokus menjalankan pemeliharaan dan pengawalan sarana di bidang ${cats}. Pekerjaan utama mencakup ${sampleTasks}${moreText}. Seluruh rangkaian penugasan diarahkan untuk memastikan fasilitas yayasan selalu dalam kondisi prima, aman, dan siap menunjang kelancaran program dakwah dan pendidikan Yayasan Dar el Iman.`;
    };

    const handleGenerateAI = async () => {
        try {
            setAiLoading(true);
            const res = await api.post('/laporan/ai/analyze', {
                startDate: weeklyStartDate,
                endDate: weeklyEndDate,
                mode: aiMode
            });
            if (res.data?.analysis) {
                setAiAnalysis(res.data.analysis);
                setIncludeAiInPdf(true);
                return res.data.analysis;
            }
            return null;
        } catch (error) {
            console.error('Failed to generate AI analysis:', error);
            alert(error.response?.data?.error || 'Gagal menghasilkan analisis AI. Pastikan rentang tanggal telah dipilih.');
            return null;
        } finally {
            setAiLoading(false);
        }
    };

    const handlePrintPdf = async () => {
        if (loading) {
            alert('Mohon tunggu sebentar, data laporan mingguan sedang disinkronkan dari server...');
            return;
        }
        if (!weeklyData) {
            alert('Data laporan mingguan belum selesai dimuat. Pastikan tanggal telah dipilih.');
            return;
        }
        if (!aiAnalysis) {
            const confirmGen = window.confirm(
                "Rangkuman narasi AI belum digenerate. Apakah Anda ingin meng-generate Rangkuman Narasi Staf dengan AI terlebih dahulu sebelum mencetak dokumen PDF?"
            );
            if (confirmGen) {
                const res = await handleGenerateAI();
                if (res) {
                    setTimeout(() => window.print(), 500);
                    return;
                }
            }
        }
        window.print();
    };

    const handleExportDOC = () => {
        if (!weeklyData) {
            alert('Data laporan belum selesai dimuat.');
            return;
        }

        const now = dayjs();
        const periodStr = weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`;

        // Build Staff Points HTML
        const staffPointsHtml = staffSummaries.map((staff, sIdx) => {
            const pointsList = staff.points.map(pt => {
                const dateBadge = pt.dateShort ? ` <span style="color:#64748b; font-size:9pt;">(${pt.dateShort})</span>` : '';
                const catBadge = (pt.categoryTag && pt.categoryTag !== 'UMUM') ? ` <span style="color:#475569; font-size:8pt; background:#f1f5f9; padding:2px 4px;">[${pt.categoryTag}]</span>` : '';
                const obsText = pt.obstacleNote ? `<br/><em style="color:#b91c1c; font-size:9pt; margin-left:14px;">Kendala: ${pt.obstacleNote}</em>` : '';
                return `<li style="margin-bottom: 4px; font-size: 10pt; line-height: 1.4;">${pt.text}${dateBadge}${catBadge}${obsText}</li>`;
            }).join('');

            return `
                <div style="margin-bottom: 14px; padding: 10px; border: 1px solid #e2e8f0; background-color: #f8fafc;">
                    <div style="font-weight: bold; font-size: 10.5pt; color: #0f172a; margin-bottom: 6px;">
                        ${sIdx + 1}. ${staff.staffName} <span style="font-size: 9pt; color: #4338ca; font-weight: normal; margin-left: 8px;">(${staff.position})</span>
                    </div>
                    <ul style="margin: 0; padding-left: 18px;">
                        ${pointsList}
                    </ul>
                </div>
            `;
        }).join('');

        // Build Obstacles HTML
        const obstaclesHtml = filteredObstacleList.length > 0 ? `
            <h4 style="font-size: 11pt; color: #1e293b; margin-top: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
                IV. Catatan Kendala & Hambatan Operasional Lapangan
            </h4>
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5pt;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Tanggal</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Staf / Posisi</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Pekerjaan</th>
                        <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Uraian Kendala</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredObstacleList.map(obs => `
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${obs.date || '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${obs.staffName || obs.position || '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${obs.activity || '-'}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; color: #b91c1c;">${obs.obstacleNote || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '';

        // Narasi HTML
        let narasiHtml = '';
        if (aiAnalysis) {
            narasiHtml = `
                <div style="margin-top: 8px; font-size: 10pt; line-height: 1.5; color: #1e293b;">
                    ${aiAnalysis.split('\n').map(l => l.trim() ? `<p style="margin: 6px 0;">${l}</p>` : '').join('')}
                </div>
            `;
        } else {
            narasiHtml = positionSummaries.map(pos => `
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: bold; font-size: 10.5pt; color: #0f172a;">${pos.position}</div>
                    <p style="margin: 4px 0 8px 0; font-size: 10pt; line-height: 1.4; color: #334155; text-align: justify;">
                        ${getDefaultNarrativeForPosition(pos)}
                    </p>
                </div>
            `).join('');
        }

        const docContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>Laporan Mingguan Staf Sarana</title>
                <style>
                    body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #0f172a; margin: 20px; }
                    h2 { font-size: 14pt; margin: 0; }
                    h3 { font-size: 12pt; margin: 2px 0; }
                    h4 { font-size: 11pt; }
                </style>
            </head>
            <body>
                <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 16px;">
                    <h2 style="letter-spacing: 1px;">YAYASAN DAR EL IMAN</h2>
                    <h3 style="letter-spacing: 2px; color: #1e1b4b;">BIDANG SARANA</h3>
                    <div style="font-size: 9pt; color: #475569;">Jl. Gunung Juaro, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat</div>
                </div>

                <div style="text-align: center; margin-bottom: 16px;">
                    <h4 style="text-decoration: underline; margin: 0; text-transform: uppercase;">LAPORAN KINERJA & AKTIVITAS MINGGUAN</h4>
                    <div style="font-size: 9.5pt; color: #475569; font-weight: bold; margin-top: 2px;">Periode: ${periodStr}</div>
                </div>

                <h4 style="font-size: 11pt; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 16px;">
                    I. Pengantar & Lingkup Laporan Kinerja
                </h4>
                <p style="font-size: 10pt; line-height: 1.5; text-align: justify; color: #334155;">
                    Laporan ini menyajikan rangkuman narasi capaian kinerja operasional dan pemeliharaan fasilitas di lingkungan Yayasan Dar el Iman untuk periode ${periodStr}. Seluruh laporan disusun berdasarkan rekapitulasi penugasan per staf tanpa memuat format persentase capaian, guna memberikan gambaran deskriptif yang lugas dan berorientasi pada kesiapan sarana yayasan.
                </p>

                <h4 style="font-size: 11pt; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px;">
                    II. Rangkuman Narasi Kinerja per Posisi Staf Bidang Sarana
                </h4>
                ${narasiHtml}

                <h4 style="font-size: 11pt; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px;">
                    III. Rincian Poin Laporan Aktivitas Masing-Masing Staf
                </h4>
                ${staffPointsHtml || '<p style="color:#64748b;">Belum ada poin laporan staf pada periode ini.</p>'}

                ${obstaclesHtml}
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff', docContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Staff_${weeklyStartDate}_sd_${weeklyEndDate}_${now.format('YYYYMMDD')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const hasAiSection = includeAiInPdf && Boolean(aiAnalysis);

    return (
        <div className="space-y-6 animate-in fade-in duration-300 print:p-0 print:m-0 print:space-y-0 print:animate-none">
            {/* ISOLATED STRICT PRINT STYLES FOR SAFE BROWSER PRINTING */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    /* Sembunyikan seluruh elemen di luar dokumen PDF cetak */
                    body * {
                        visibility: hidden !important;
                    }
                    /* Tampilkan hanya lembar dokumen laporan mingguan */
                    #weekly-pdf-sheet, #weekly-pdf-sheet * {
                        visibility: visible !important;
                    }
                    #weekly-pdf-sheet {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 10mm 14mm !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: #0f172a !important;
                        display: block !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print, .print-hidden, header, nav, aside, footer {
                        display: none !important;
                    }
                    html, body, #root, main, .flex-1 {
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .break-inside-avoid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 8mm 6mm;
                    }
                }
            `}} />

            {/* Control Bar (Hidden in Print) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 print:hidden no-print">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <Printer className="text-indigo-600" size={20} /> Generator Laporan Mingguan Kepala Bidang Sarana
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">Format resmi siap cetak / simpan PDF untuk laporan ke Pimpinan Yayasan.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                            <span>Dari:</span>
                            <input type="date" value={weeklyStartDate} onChange={(e) => setWeeklyStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                            <span>Sampai:</span>
                            <input type="date" value={weeklyEndDate} onChange={(e) => setWeeklyEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                            <span>NIY:</span>
                            <input
                                type="text"
                                value={customKabidNiy}
                                onChange={(e) => setCustomKabidNiy(e.target.value)}
                                placeholder="NIY Kepala..."
                                className="w-28 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-xs outline-none"
                                title="Nomor Induk Yayasan (NIY) Kepala Bidang Sarana"
                            />
                        </div>
                        <button
                            onClick={handleExportDOC}
                            disabled={loading}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                            title="Unduh Laporan Versi Microsoft Word (.doc)"
                        >
                            <FileText size={15} />
                            <span>Cetak Laporan DOC</span>
                        </button>
                        <button
                            onClick={handlePrintPdf}
                            disabled={loading || aiLoading}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                            {loading ? 'Memuat Data...' : 'Cetak / Unduh PDF'}
                        </button>
                    </div>
                </div>

                {/* AI Analysis Toolbar */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/60">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <Sparkles size={14} className="text-amber-300" />
                            </div>
                            <div>
                                <span className="text-xs font-black text-slate-800 block">Analisis AI Eksekutif</span>
                                <span className="text-[10px] text-slate-500">Kecerdasan buatan menyusun narasi evaluasi kinerja untuk pimpinan</span>
                            </div>
                        </div>

                        {/* Mode Selector */}
                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
                            <span className="text-[11px] font-bold text-slate-400">Mode:</span>
                            <select
                                value={aiMode}
                                onChange={(e) => setAiMode(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 text-xs outline-none cursor-pointer"
                            >
                                <option value="STAFF_NARRATIVE">📝 Rangkuman Narasi per Posisi Staf (AI)</option>
                                <option value="WEEKLY_EXECUTIVE">🎯 Ikhtisar Eksekutif & Strategis</option>
                                <option value="TEAM_PERFORMANCE">📊 Evaluasi Produktivitas Tim</option>
                                <option value="OBSTACLE_SOLUTIONS">⚠️ Solusi Kendala & Mitigasi</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                            <input
                                type="checkbox"
                                checked={includeAiInPdf}
                                onChange={(e) => setIncludeAiInPdf(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Gunakan Narasi AI (Gemini)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                            <input
                                type="checkbox"
                                checked={includePhotosInPdf}
                                onChange={(e) => setIncludePhotosInPdf(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Preview Foto Lapangan ({weeklyData?.documentationPhotos?.length || 0})</span>
                        </label>

                        <button
                            onClick={handleGenerateAI}
                            disabled={aiLoading || loading}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {aiLoading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Menganalisis Data...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} className="text-amber-300" />
                                    <span>{aiAnalysis ? 'Perbarui Analisis AI' : 'Generate Analisis AI'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading Indicator (Hidden in Print) */}
            {loading && (
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-center gap-3 text-slate-600 print:hidden animate-pulse">
                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                    <span className="text-xs font-bold">Menyinkronkan data laporan mingguan dari server...</span>
                </div>
            )}

            {/* PRINTABLE DOCUMENT CONTAINER */}
            <div id="weekly-pdf-sheet" className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8 max-w-4xl mx-auto text-slate-800 print:border-none print:shadow-none print:p-0">
                {/* KOP SURAT YAYASAN */}
                <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                    <h2 className="text-xl font-black tracking-wider text-slate-900 uppercase">YAYASAN DAR EL IMAN</h2>
                    <h3 className="text-base font-black text-indigo-950 uppercase tracking-widest">BIDANG SARANA</h3>
                    <p className="text-[11px] text-slate-600">Jl. Gunung Juaro, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat</p>
                </div>

                {/* TITLE */}
                <div className="text-center space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-wider underline">LAPORAN KINERJA & AKTIVITAS MINGGUAN</h4>
                    <p className="text-xs font-bold text-slate-600">Periode: {weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`}</p>
                </div>

                {/* I. PENGANTAR & LINGKUP LAPORAN KINERJA */}
                <div className="space-y-2 break-inside-avoid">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-800"></span>
                        I. Pengantar & Lingkup Laporan Kinerja
                    </h5>
                    <p className="text-xs text-slate-700 leading-relaxed text-justify">
                        Laporan ini menyajikan rangkuman narasi capaian kinerja operasional dan pemeliharaan fasilitas di lingkungan Yayasan Dar el Iman untuk periode {weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`}. Seluruh laporan disusun berdasarkan rekapitulasi penugasan per posisi staf tanpa memuat format tabel dan persentase capaian, guna memberikan gambaran deskriptif yang lugas dan berorientasi pada kesiapan sarana yayasan.
                    </p>
                    {/* Ringkasan metrik hanya ditampilkan di layar preview, disembunyikan saat dicetak sesuai arahan pimpinan */}
                    <div className="grid grid-cols-3 gap-3 text-center pt-1 print:hidden">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Pekerjaan Selesai</span>
                            <span className="text-xl font-black text-emerald-700">{weeklyData?.stats?.totalCompleted || 0}</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Dalam Proses</span>
                            <span className="text-xl font-black text-amber-700">{weeklyData?.stats?.totalInProgress || 0}</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Kendala Ditangani</span>
                            <span className="text-xl font-black text-rose-700">{weeklyData?.stats?.totalObstacles || 0}</span>
                        </div>
                    </div>
                </div>

                {/* II. RANGKUMAN NARASI KINERJA PER POSISI STAF (AI GENERATED) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 print:bg-slate-800"></span>
                            II. Rangkuman Narasi Kinerja per Posisi Staf Bidang Sarana
                        </h5>
                        <div className="flex items-center gap-2 print:hidden">
                            {aiAnalysis && (
                                <button
                                    onClick={() => setIsEditingAi(!isEditingAi)}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200"
                                >
                                    <Edit3 size={12} /> {isEditingAi ? 'Tutup Editor' : 'Sesuaikan Narasi AI'}
                                </button>
                            )}
                        </div>
                    </div>

                    {isEditingAi ? (
                        <div className="space-y-2 print:hidden">
                            <textarea
                                value={aiAnalysis}
                                onChange={(e) => setAiAnalysis(e.target.value)}
                                rows={14}
                                className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                                placeholder="Ketik atau sesuaikan narasi kinerja per posisi staf..."
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsEditingAi(false)}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                                >
                                    <Check size={13} /> Selesai Mengedit Narasi
                                </button>
                            </div>
                        </div>
                    ) : (hasAiSection && aiAnalysis) ? (
                        <div className="space-y-3 bg-slate-50/40 print:bg-transparent p-4 print:p-0 rounded-2xl border border-slate-200 print:border-none">
                            {renderFormattedAiText(aiAnalysis)}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(!positionSummaries || positionSummaries.length === 0) ? (
                                <p className="text-xs text-slate-400 italic py-2">Belum ada rangkuman kinerja posisi staf tercatat pada rentang tanggal ini.</p>
                            ) : (
                                <div className="space-y-4">
                                    {positionSummaries.map((pos, pIdx) => (
                                        <div key={pIdx} className="space-y-1.5 break-inside-avoid border-l-2 border-slate-800 pl-3.5 py-0.5">
                                            <div className="flex items-center justify-between">
                                                <h6 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                                    {pos.position}
                                                </h6>
                                                {pos.categories && pos.categories.length > 0 && (
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded print:text-slate-600">
                                                        {pos.categories.join(' • ')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs leading-relaxed text-slate-700 text-justify">
                                                {getDefaultNarrativeForPosition(pos)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-indigo-900 print:hidden">
                                <div>
                                    <span className="font-bold block">Tingkatkan Narasi dengan AI Gemini</span>
                                    <span className="text-[11px] text-indigo-700">Narasi di atas merupakan ringkasan sistem. Klik tombol di kanan untuk menyusun narasi eksekutif AI yang lebih mengalir dan formal.</span>
                                </div>
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={aiLoading || loading}
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer text-xs shrink-0 shadow-xs"
                                >
                                    {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-amber-300" />}
                                    Hasilkan Narasi AI Sekarang
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* III. RINCIAN POIN LAPORAN AKTIVITAS MASING-MASING STAF */}
                <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 print:bg-slate-800"></span>
                            III. Rincian Poin Laporan Aktivitas Masing-Masing Staf
                        </h5>
                        <span className="text-[10px] font-bold text-slate-400 print:hidden">
                            {staffSummaries.length} Staf Lapangan
                        </span>
                    </div>

                    {(!staffSummaries || staffSummaries.length === 0) ? (
                        <p className="text-xs text-slate-400 italic py-2">
                            Belum ada poin laporan staf yang tercatat pada rentang tanggal ini.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {staffSummaries.map((staff, sIdx) => (
                                <div
                                    key={sIdx}
                                    className="p-3.5 bg-slate-50/70 print:bg-transparent rounded-2xl border border-slate-200/80 print:border-l-2 print:border-slate-800 print:border-t-0 print:border-r-0 print:border-b-0 print:rounded-none print:p-0 print:pl-3.5 space-y-2 break-inside-avoid"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-200/60 pb-1.5 print:border-b-0 print:pb-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900 tracking-tight">
                                                {sIdx + 1}. {staff.staffName}
                                            </span>
                                            <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 print:bg-slate-100 text-indigo-700 print:text-slate-700 px-2 py-0.5 rounded-md border border-indigo-200/50 print:border-slate-200">
                                                {staff.position}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 font-mono">
                                            {staff.points.length} Poin Laporan
                                        </span>
                                    </div>

                                    <ul className="space-y-1.5 text-xs text-slate-700 pt-0.5">
                                        {staff.points.map((pt, pIdx) => {
                                            const isObstacle = pt.status === 'OBSTACLE';
                                            return (
                                                <li key={pIdx} className="flex items-start gap-2 leading-relaxed">
                                                    <span className="text-indigo-600 print:text-slate-800 font-bold text-xs shrink-0 mt-0.5">
                                                        •
                                                    </span>
                                                    <div className="flex-1 space-y-0.5">
                                                        <div className="flex flex-wrap items-baseline gap-1.5">
                                                            <span className="text-slate-900 font-medium text-[11.5px]">
                                                                {pt.text}
                                                            </span>
                                                            {pt.dateShort && (
                                                                <span className="text-[10px] text-slate-500 font-medium font-mono">
                                                                    ({pt.dateShort})
                                                                </span>
                                                            )}
                                                            {pt.categoryTag && pt.categoryTag !== 'UMUM' && (
                                                                <span className="text-[9px] font-semibold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.2 rounded print:text-slate-600">
                                                                    {pt.categoryTag}
                                                                </span>
                                                            )}
                                                            {isObstacle && (
                                                                <span className="text-[9px] font-bold text-rose-600 uppercase">
                                                                    [Kendala Lapangan]
                                                                </span>
                                                            )}
                                                        </div>
                                                        {pt.obstacleNote && (
                                                            <p className="text-[10.5px] text-rose-700 print:text-slate-900 italic">
                                                                Uraian Hambatan: {pt.obstacleNote}
                                                            </p>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* IV. CATATAN KENDALA & HAMBATAN OPERASIONAL */}
                {filteredObstacleList && filteredObstacleList.length > 0 && (
                    <div className="space-y-2.5 break-inside-avoid pt-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-800"></span>
                            IV. Catatan Kendala & Hambatan Operasional Lapangan
                        </h5>
                        <div className="space-y-2 text-xs">
                            {filteredObstacleList.map((obs, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 bg-slate-50/80 print:bg-transparent rounded-xl border border-slate-200 print:border-l-2 print:border-slate-400 print:border-t-0 print:border-r-0 print:border-b-0 print:rounded-none print:p-0 print:pl-3 space-y-1 break-inside-avoid"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900">
                                            {obs.staffName ? `${obs.staffName} (${obs.position || 'Staf Sarana'})` : (obs.position || 'Staf Sarana')}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            {obs.date}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 text-[11px] leading-relaxed">
                                        <span className="font-semibold text-slate-800">Pekerjaan Lapangan:</span> {obs.activity}
                                    </p>
                                    <p className="text-rose-700 print:text-slate-900 text-[11px] leading-relaxed italic">
                                        <span className="font-semibold not-italic text-slate-800">Uraian Hambatan:</span> {obs.obstacleNote}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SIGNATURE BLOCK (DIGITAL TTE KEPALA BIDANG SARANA) */}
                <div className="pt-8 flex justify-end break-inside-avoid">
                    <div className="text-center w-72 space-y-2">
                        <div>
                            <p className="text-xs font-medium text-slate-600">Padang, {dayjs().format('DD MMMM YYYY')}</p>
                            <p className="text-xs font-bold uppercase mt-0.5 text-slate-900">Kepala Bidang Sarana</p>
                        </div>

                        {/* TTE Digital Seal / Badge */}
                        <div className="p-3 my-2 rounded-xl border border-emerald-300 bg-emerald-50/60 flex items-center gap-2.5 text-left shadow-2xs">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
                                <CheckCircle2 size={24} />
                            </div>
                            <div className="space-y-0.5 leading-tight">
                                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                                    Ditandatangani Digital (TTE)
                                </span>
                                <span className="text-[9px] text-slate-600 block">
                                    Dokumen Sah & Terverifikasi
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono block">
                                    E-Office Yayasan Dar el Iman
                                </span>
                            </div>
                        </div>

                        <div className="space-y-0.5 pt-1">
                            <p className="text-xs font-bold text-slate-900 underline">{weeklyData?.kabid?.name || user?.name || 'Ravi Kurnia, S.T.'}</p>
                            <p className="text-[10px] text-slate-600 font-mono">
                                NIY. {customKabidNiy || weeklyData?.kabid?.niy || user?.nip || user?.username || 'Yayasan Dar el Iman'}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-500">
                                Kepala Bidang Sarana
                            </p>
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* PREVIEW FOTO DOKUMENTASI (HANYA DITAMPILKAN DI LAYAR BILA DIAKTIFKAN, DISEMBUNYIKAN SAAT DICETAK) */}
                {/* ============================================================== */}
                {includePhotosInPdf && (
                    <div className="pt-10 mt-10 border-t-2 border-dashed border-slate-300 print:hidden no-print">
                        {/* KOP LAMPIRAN */}
                        <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
                            <h3 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">LAMPIRAN DOKUMENTASI LAPANGAN (PREVIEW WEB)</h3>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                FOTO BUKTI AKTIVITAS HARIAN STAF BIDANG SARANA
                            </h4>
                            <p className="text-xs font-bold text-slate-600">
                                Periode: {weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`}
                            </p>
                            <p className="text-[10px] text-amber-600 italic">
                                *Halaman dokumentasi foto ini secara otomatis tidak disertakan dalam cetakan PDF resmi sesuai format ringkasan pimpinan.
                            </p>
                        </div>

                        {/* DAFTAR FOTO DOKUMENTASI */}
                        {weeklyData?.documentationPhotos && weeklyData.documentationPhotos.length > 0 ? (
                            <div className="pt-6 space-y-4">
                                <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                                    <span className="font-bold">Total Foto Terlampir: {weeklyData.documentationPhotos.length} Foto Dokumentasi</span>
                                    <span className="text-[10px] text-slate-400 italic">*Foto diunggah langsung oleh staf sarana saat pelaporan harian</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {weeklyData.documentationPhotos.map((doc, pIdx) => (
                                        <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-2 flex flex-col justify-between break-inside-avoid shadow-2xs">
                                            <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                                                <img
                                                    src={getMediaUrl(doc.photoUrl)}
                                                    alt={doc.activity}
                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                    onClick={() => setLightboxPhoto(getMediaUrl(doc.photoUrl))}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'https://placehold.co/400x300?text=Foto+Dokumentasi';
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                        {doc.dateShort}
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600">
                                                        {doc.categoryTag}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-black text-slate-800 line-clamp-1">
                                                    {doc.position || doc.staffName}
                                                </p>
                                                <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-tight">
                                                    {doc.activity}
                                                </p>
                                                {doc.obstacleNote && (
                                                    <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1 rounded">
                                                        ⚠️ {doc.obstacleNote}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="pt-12 pb-12 text-center text-slate-400 space-y-2">
                                <Camera size={36} className="mx-auto text-slate-300" />
                                <p className="text-xs italic">Tidak ada lampiran foto dokumentasi lapangan pada rentang tanggal ini.</p>
                            </div>
                        )}

                        {/* Catatan Kaki Lampiran */}
                        <div className="pt-8 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 mt-6">
                            <span>Sistem Informasi Manajemen Aset & Sarpras Yayasan Dar El Iman Padang</span>
                            <span>Halaman Dokumentasi Foto Lapangan</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
