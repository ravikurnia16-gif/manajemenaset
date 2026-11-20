import { useEffect, useState } from 'react';
import api from '../../../lib/axios';

/**
 * Mengambil pengaturan PIC default (Kayu/Besi) dan daftar staff Unit 21 / Workshop
 * sekali pakai untuk seluruh form & modal Workshop Baru.
 */
export const useWorkshopPicOptions = () => {
    const [picDefaults, setPicDefaults] = useState({ KAYU: '', BESI: '' });
    const [staffList, setStaffList] = useState([]);
    const [loadingStaff, setLoadingStaff] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await api.get('/workshop/settings-unit');
                if (cancelled) return;
                const s = res.data?.settings || {};
                const u21 = Array.isArray(res.data?.unit21Users) ? res.data.unit21Users : [];
                setPicDefaults({
                    KAYU: s.workshopPicKayu || '',
                    BESI: s.workshopPicBesi || ''
                });
                setStaffList(u21);
            } catch (err) {
                console.error('Failed to load workshop PIC options:', err);
            } finally {
                if (!cancelled) setLoadingStaff(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    return { picDefaults, staffList, loadingStaff };
};

export const getDefaultWorkshopPic = (workshopType, picDefaults) => {
    if (workshopType === 'KAYU') return picDefaults?.KAYU || '';
    if (workshopType === 'BESI') return picDefaults?.BESI || '';
    return '';
};
