const fs = require('fs');
let file = fs.readFileSync('client/src/pages/VehicleDashboard.jsx', 'utf8');

const regex = /\/\*\s*Status Ketersediaan Armada \+ Peringkat Efisiensi\s*\*\/[\s\S]*?(?=\{\/\*\s*Modal Konfirmasi Pembayaran Pajak\s*\*\/)/;

const newLayout = `
            {/* -------------------- BENTO ROW 1: Tren Jarak & Status Ketersediaan -------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                {/* Tren Jarak Tempuh - ALL VEHICLES (Lebar 3/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight italic">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div> Tren Jarak Tempuh Bulanan (KM)
                    </h3>
                    <div className="flex-1 min-h-[300px] max-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data?.mileageTrends} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => value.toLocaleString('id-ID')} />
                                <Tooltip formatter={(value) => \`\${value.toLocaleString('id-ID')} km\`} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 'bold' }} iconType="circle" />
                                {(data?.allVehicleNames || []).map((vName, idx) => (
                                    <Line key={vName} type="monotone" dataKey={vName} stroke={COLORS[idx % COLORS.length]} strokeWidth={4} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} animationDuration={1500} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut - Ketersediaan (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col justify-between">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight italic mb-4 flex items-center gap-3">
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={16} /></div> Ketersediaan
                    </h3>
                    <div className="flex-1 flex flex-col justify-center min-h-[200px]">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={availData}
                                    cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={80}
                                    dataKey="value"
                                    strokeWidth={3}
                                    stroke="#fff"
                                >
                                    {availData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v) => \`\${v} Unit\`} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-3 mt-4">
                            {availData.map((d, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{d.name}</span>
                                    </div>
                                    <span className="font-black text-slate-800">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* -------------------- BENTO ROW 2: Matriks Performa & Peringkat Efisiensi -------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                {/* Performance Matrix (Lebar 3/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3">
                                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><Activity size={20} /></div> Matriks Performa
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest pl-10">
                                {data?.isSummary ? \`Rata-Rata 30 Hari Terakhir\` : \`Bulan \${new Date(filter.year, filter.month-1).toLocaleString('id-ID', {month: 'long', year: 'numeric'})}\`}
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kendaraan</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Efisiensi (KM/L)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Utilisasi (%)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Cost / KM</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Total Jarak</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                {data?.vStats?.map((v, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 text-sm whitespace-nowrap">{v.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono font-bold">{v.plate}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center justify-center gap-1.5 w-full max-w-[120px] mx-auto">
                                                <span className={\`text-sm font-black \${v.kml > 10 ? 'text-emerald-600' : 'text-slate-700'}\`}>{v.kml?.toFixed(1) || '-'}</span>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                    <div className={\`h-full \${v.kml > 10 ? 'bg-emerald-500' : 'bg-orange-400'}\`} style={{ width: \`\${Math.min((v.kml || 0) * 5, 100)}%\` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1.5 w-full max-w-[120px] mx-auto">
                                                <span className="text-sm font-black text-slate-800">{v.utilization?.toFixed(0)}%</span>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                    <div className={\`h-full shadow-md \${v.utilization > 50 ? 'bg-indigo-500' : 'bg-slate-300'}\`} style={{ width: \`\${v.utilization}%\` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-sm">
                                            <span className="bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-slate-700 whitespace-nowrap">Rp {Math.round(v.cpkm).toLocaleString('id-ID')}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-indigo-600 text-sm italic whitespace-nowrap">
                                            {v.totalKm?.toLocaleString('id-ID')} KM
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Peringkat Efisiensi Kendaraan (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight italic mb-4 flex items-center gap-3">
                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Trophy size={16} /></div> Peringkat Biaya
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[450px]">
                        {efficiencyRanking.map((v, i) => {
                            const maxCost = efficiencyRanking[efficiencyRanking.length - 1]?.fuelCpkm || 1;
                            const pct = maxCost > 0 ? (v.fuelCpkm / maxCost) * 100 : 0;
                            const isTop = i === 0;
                            const isBottom = i === efficiencyRanking.length - 1 && efficiencyRanking.length > 1;
                            const costVal = Math.round(v.fuelCpkm);
                            return (
                                <div key={v.id || i} className={\`flex items-start gap-3 p-3 rounded-2xl transition-all \${isTop ? 'bg-emerald-50 border border-emerald-100' : isBottom ? 'bg-red-50/50 border border-red-100' : 'bg-slate-50/50 border border-slate-100 hover:bg-slate-50'}\`}>
                                    <div className={\`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-black mt-0.5 \${isTop ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : isBottom ? 'bg-red-400 text-white' : 'bg-slate-200 text-slate-500'}\`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-slate-800 truncate pr-2">{v.name}</span>
                                            <span className={\`text-[10px] font-black whitespace-nowrap \${costVal < 1000 ? 'text-emerald-600' : costVal < 3000 ? 'text-amber-600' : 'text-red-500'}\`}>Rp {costVal.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden shadow-inner mb-1.5">
                                            <div
                                                className={\`h-full rounded-full transition-all duration-1000 \${isTop ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : isBottom ? 'bg-gradient-to-r from-red-300 to-red-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}\`}
                                                style={{ width: \`\${pct}%\` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] text-slate-400 font-mono font-bold tracking-tight">{v.plate}</span>
                                            {isTop && <span className="text-[8px] font-black text-emerald-600 bg-white/60 px-1.5 py-0.5 rounded-full uppercase">Terhemat</span>}
                                            {isBottom && <span className="text-[8px] font-black text-red-500 bg-white/60 px-1.5 py-0.5 rounded-full uppercase">Terboros</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {efficiencyRanking.length === 0 && (
                            <p className="text-center text-slate-400 text-xs py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada data biaya.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* -------------------- BENTO ROW 3: Distribusi Unit, Tren Booking, Riwayat -------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                {/* Analisa Distribusi Jarak per Unit (Lebar 2/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight italic">
                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Navigation2 size={16} /></div> Jarak Berdasarkan Unit
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 h-full max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {data?.vStats?.filter(v => v.unitUsage?.length > 0).map(v => (
                            <div key={v.id} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex flex-col">
                                <h4 className="font-black text-slate-800 mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Car size={14} className="text-slate-400"/> <span className="text-sm truncate max-w-[100px]">{v.name}</span></span>
                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{v.plate}</span>
                                </h4>
                                <div className="space-y-2 flex-1 relative">
                                    <div className="absolute left-[7px] top-4 bottom-4 w-px bg-slate-100 -z-0"></div>
                                    {v.unitUsage.map((u, idx) => (
                                        <div key={idx} className="relative z-10 flex justify-between items-center group bg-white/50 hover:bg-slate-50 p-1.5 -mx-1.5 rounded-lg transition-colors text-xs">
                                            <div className="font-bold text-slate-600 flex items-center gap-2.5">
                                                <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                </div>
                                                <span className="group-hover:text-purple-700 transition-colors truncate max-w-[90px]" title={u.unit}>{u.unit}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-black text-indigo-600 tracking-tight">{u.distance.toLocaleString('id-ID')} <span className="text-[9px]">km</span></div>
                                                {u.fuelCost > 0 && <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Rp {Math.round(u.fuelCost).toLocaleString('id-ID')}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {data?.vStats?.filter(v => v.unitUsage?.length > 0).length === 0 && (
                            <div className="col-span-full h-full flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-center text-slate-400 text-xs py-8">Belum ada data perjalanan unit.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tren Peminjaman (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-6 uppercase tracking-tight italic flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={16} /></div> Tren Sewa
                    </h3>
                    <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.bookingTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} dy={5} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    cursor={{ fill: '#f8fafc' }}
                                    formatter={(v) => \`\${v} Perjalanan\`}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={25}>
                                    {data?.bookingTrends?.map((entry, index) => (
                                        <Cell key={\`cell-\${index}\`} fill={index === data.bookingTrends.length - 1 ? '#4f46e5' : '#c7d2fe'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Riwayat Peminjaman Terbaru (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-6 uppercase tracking-tight italic flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Clock size={16} /></div> Riwayat
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[350px]">
                        {data?.recentBookings?.length > 0 ? data.recentBookings.map((b, i) => {
                            const statusInfo = BOOKING_STATUS_MAP[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-500' };
                            return (
                                <div key={b.id || i} className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className="text-[11px] font-black text-slate-800 truncate group-hover:text-blue-700 transition-colors">{b.vehicle?.name || '-'}</span>
                                            <span className={\`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex-shrink-0 tracking-widest \${statusInfo.color}\`}>{statusInfo.label}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                                                <User size={10} className="text-slate-400" /> <span className="truncate">{b.user?.name || b.user?.username || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                                                <MapPin size={10} className="text-slate-400" /> <span className="truncate">{b.destination || '-'}</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold pt-1 border-t border-slate-50 mt-1.5 block">
                                                {new Date(b.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-center text-slate-400 text-xs py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada riwayat.</p>
                        )}
                    </div>
                </div>
            </div>
`;

file = file.replace(regex, newLayout + "\n");
fs.writeFileSync('d:/MANAJEMEN ASET/client/src/pages/VehicleDashboard.jsx', file);
