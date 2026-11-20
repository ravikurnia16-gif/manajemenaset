import React, { useState } from 'react';
import { UserCheck, Edit3, Users } from 'lucide-react';
import { getDefaultWorkshopPic } from './workshopPicUtils';

const CUSTOM_OPTION_VALUE = '__CUSTOM_PIC__';

/**
 * Dropdown pemilih PIC Workshop dengan dukungan isi nama manual bila PIC belum terdaftar di Unit 21.
 */
export default function WorkshopPicSelect({
    value = '',
    onChange,
    staffList = [],
    picDefaults = { KAYU: '', BESI: '' },
    workshopType = '',
    allowEmpty = true,
    emptyLabel = '-- Belum Ditugaskan --'
}) {
    // Gabungkan daftar staff Unit 21 dengan PIC default (jika belum ada di daftar) tanpa duplikasi nama
    const optionMap = new Map();
    staffList.forEach((u) => {
        const name = (u?.name || '').trim();
        if (!name) return;
        if (!optionMap.has(name.toLowerCase())) {
            optionMap.set(name.toLowerCase(), {
                value: name,
                label: u.position ? `${name} (${u.position})` : name
            });
        }
    });
    [
        { key: 'KAYU', name: picDefaults?.KAYU, tag: 'Default Kayu' },
        { key: 'BESI', name: picDefaults?.BESI, tag: 'Default Besi' }
    ].forEach((d) => {
        const name = (d.name || '').trim();
        if (name && !optionMap.has(name.toLowerCase())) {
            optionMap.set(name.toLowerCase(), {
                value: name,
                label: `${name} (${d.tag})`
            });
        }
    });

    const options = Array.from(optionMap.values());
    const trimmedValue = (value || '').trim();
    const isKnownOption = !trimmedValue || options.some((opt) => opt.value.toLowerCase() === trimmedValue.toLowerCase());
    const [manualMode, setManualMode] = useState(false);
    const showManualInput = manualMode || (Boolean(trimmedValue) && !isKnownOption);

    const matchedOptionValue = options.find((opt) => opt.value.toLowerCase() === trimmedValue.toLowerCase())?.value || '';
    const defaultForType = getDefaultWorkshopPic(workshopType, picDefaults);

    return (
        <div className="space-y-1.5">
            {!showManualInput ? (
                <div className="relative">
                    <select
                        value={matchedOptionValue}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === CUSTOM_OPTION_VALUE) {
                                setManualMode(true);
                                return;
                            }
                            onChange(val);
                        }}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        {allowEmpty && <option value="">{emptyLabel}</option>}
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                        <option value={CUSTOM_OPTION_VALUE}>+ Ketik Nama PIC Manual...</option>
                    </select>
                </div>
            ) : (
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <UserCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="Ketik nama lengkap PIC..."
                            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setManualMode(false);
                            if (!isKnownOption) onChange('');
                        }}
                        className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-600 shrink-0 flex items-center gap-1"
                        title="Pilih dari daftar staff Workshop"
                    >
                        <Users size={13} /> Daftar
                    </button>
                </div>
            )}

            {defaultForType && trimmedValue.toLowerCase() !== defaultForType.toLowerCase() && (
                <button
                    type="button"
                    onClick={() => {
                        setManualMode(false);
                        onChange(defaultForType);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors"
                >
                    <Edit3 size={10} /> Pakai PIC Default {workshopType}: {defaultForType}
                </button>
            )}
        </div>
    );
}
