const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Daftar Hari Libur Nasional & Cuti Bersama Indonesia (SKB 3 Menteri)
 * Format key: 'YYYY-MM-DD'
 */
const INDONESIA_HOLIDAYS = {
    // === 2024 ===
    '2024-01-01': 'Tahun Baru 2024 Masehi',
    '2024-02-08': 'Isra Mikraj Nabi Muhammad SAW',
    '2024-02-09': 'Cuti Bersama Tahun Baru Imlek 2575 Kongzili',
    '2024-02-10': 'Tahun Baru Imlek 2575 Kongzili',
    '2024-03-11': 'Hari Suci Nyepi (Tahun Baru Saka 1946)',
    '2024-03-12': 'Cuti Bersama Hari Suci Nyepi',
    '2024-03-29': 'Wafat Yesus Kristus',
    '2024-03-31': 'Hari Kebangkitan Yesus Kristus (Paskah)',
    '2024-04-08': 'Cuti Bersama Hari Raya Idul Fitri 1445 H',
    '2024-04-09': 'Cuti Bersama Hari Raya Idul Fitri 1445 H',
    '2024-04-10': 'Hari Raya Idul Fitri 1445 H',
    '2024-04-11': 'Hari Raya Idul Fitri 1445 H',
    '2024-04-12': 'Cuti Bersama Hari Raya Idul Fitri 1445 H',
    '2024-04-15': 'Cuti Bersama Hari Raya Idul Fitri 1445 H',
    '2024-05-01': 'Hari Buruh Internasional',
    '2024-05-09': 'Kenaikan Yesus Kristus',
    '2024-05-10': 'Cuti Bersama Kenaikan Yesus Kristus',
    '2024-05-23': 'Hari Raya Waisak 2568 BE',
    '2024-05-24': 'Cuti Bersama Hari Raya Waisak',
    '2024-06-01': 'Hari Lahir Pancasila',
    '2024-06-17': 'Hari Raya Idul Adha 1445 H',
    '2024-06-18': 'Cuti Bersama Hari Raya Idul Adha 1445 H',
    '2024-07-07': 'Tahun Baru Islam 1446 H',
    '2024-08-17': 'Hari Proklamasi Kemerdekaan RI',
    '2024-09-16': 'Maulid Nabi Muhammad SAW',
    '2024-12-25': 'Hari Raya Natal',
    '2024-12-26': 'Cuti Bersama Hari Raya Natal',

    // === 2025 ===
    '2025-01-01': 'Tahun Baru 2025 Masehi',
    '2025-01-27': 'Isra Mikraj Nabi Muhammad SAW',
    '2025-01-28': 'Cuti Bersama Tahun Baru Imlek 2576 Kongzili',
    '2025-01-29': 'Tahun Baru Imlek 2576 Kongzili',
    '2025-03-28': 'Cuti Bersama Hari Suci Nyepi',
    '2025-03-29': 'Hari Suci Nyepi (Tahun Baru Saka 1947)',
    '2025-03-31': 'Hari Raya Idul Fitri 1446 H',
    '2025-04-01': 'Hari Raya Idul Fitri 1446 H',
    '2025-04-02': 'Cuti Bersama Hari Raya Idul Fitri 1446 H',
    '2025-04-03': 'Cuti Bersama Hari Raya Idul Fitri 1446 H',
    '2025-04-04': 'Cuti Bersama Hari Raya Idul Fitri 1446 H',
    '2025-04-07': 'Cuti Bersama Hari Raya Idul Fitri 1446 H',
    '2025-04-18': 'Wafat Yesus Kristus',
    '2025-04-20': 'Kebangkitan Yesus Kristus (Paskah)',
    '2025-05-01': 'Hari Buruh Internasional',
    '2025-05-12': 'Hari Raya Waisak 2569 BE',
    '2025-05-13': 'Cuti Bersama Hari Raya Waisak',
    '2025-05-29': 'Kenaikan Yesus Kristus',
    '2025-05-30': 'Cuti Bersama Kenaikan Yesus Kristus',
    '2025-06-01': 'Hari Lahir Pancasila',
    '2025-06-06': 'Hari Raya Idul Adha 1446 H',
    '2025-06-09': 'Cuti Bersama Hari Raya Idul Adha 1446 H',
    '2025-06-27': '1 Muharam Tahun Baru Islam 1447 H',
    '2025-08-17': 'Proklamasi Kemerdekaan RI',
    '2025-09-05': 'Maulid Nabi Muhammad SAW',
    '2025-12-25': 'Kelahiran Yesus Kristus (Natal)',
    '2025-12-26': 'Cuti Bersama Kelahiran Yesus Kristus',

    // === 2026 ===
    '2026-01-01': 'Tahun Baru 2026 Masehi',
    '2026-01-16': 'Isra Mikraj Nabi Muhammad SAW',
    '2026-02-16': 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili',
    '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
    '2026-03-18': 'Cuti Bersama Hari Suci Nyepi',
    '2026-03-19': 'Hari Suci Nyepi (Tahun Baru Saka 1948)',
    '2026-03-20': 'Cuti Bersama Hari Raya Idul Fitri 1447 H',
    '2026-03-21': 'Hari Raya Idul Fitri 1447 H',
    '2026-03-22': 'Hari Raya Idul Fitri 1447 H',
    '2026-03-23': 'Cuti Bersama Hari Raya Idul Fitri 1447 H',
    '2026-03-24': 'Cuti Bersama Hari Raya Idul Fitri 1447 H',
    '2026-04-03': 'Wafat Yesus Kristus',
    '2026-04-05': 'Hari Kebangkitan Yesus Kristus (Paskah)',
    '2026-05-01': 'Hari Buruh Internasional',
    '2026-05-14': 'Kenaikan Yesus Kristus',
    '2026-05-15': 'Cuti Bersama Kenaikan Yesus Kristus',
    '2026-05-27': 'Hari Raya Idul Adha 1447 H',
    '2026-05-28': 'Cuti Bersama Hari Raya Idul Adha 1447 H',
    '2026-05-31': 'Hari Raya Waisak 2570 BE',
    '2026-06-01': 'Hari Lahir Pancasila',
    '2026-06-16': '1 Muharam 1448 H (Tahun Baru Islam)',
    '2026-08-17': 'Hari Proklamasi Kemerdekaan RI',
    '2026-08-25': 'Maulid Nabi Muhammad SAW',
    '2026-12-24': 'Cuti Bersama Hari Raya Natal',
    '2026-12-25': 'Kelahiran Yesus Kristus (Natal)',

    // === 2027 ===
    '2027-01-01': 'Tahun Baru 2027 Masehi',
    '2027-01-05': 'Isra Mikraj Nabi Muhammad SAW 1448 H',
    '2027-02-05': 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili',
    '2027-02-06': 'Tahun Baru Imlek 2578 Kongzili',
    '2027-03-08': 'Hari Suci Nyepi (Tahun Baru Saka 1949)',
    '2027-03-09': 'Cuti Bersama Hari Raya Idul Fitri 1448 H',
    '2027-03-10': 'Hari Raya Idul Fitri 1448 H',
    '2027-03-11': 'Hari Raya Idul Fitri 1448 H',
    '2027-03-12': 'Cuti Bersama Hari Raya Idul Fitri 1448 H',
    '2027-03-15': 'Cuti Bersama Hari Raya Idul Fitri 1448 H',
    '2027-03-26': 'Wafat Yesus Kristus',
    '2027-03-28': 'Kebangkitan Yesus Kristus (Paskah)',
    '2027-05-01': 'Hari Buruh Internasional',
    '2027-05-06': 'Kenaikan Yesus Kristus',
    '2027-05-17': 'Hari Raya Idul Adha 1448 H',
    '2027-05-20': 'Hari Raya Waisak 2571 BE',
    '2027-06-01': 'Hari Lahir Pancasila',
    '2027-06-06': '1 Muharam Tahun Baru Islam 1449 H',
    '2027-08-15': 'Maulid Nabi Muhammad SAW',
    '2027-08-17': 'Hari Proklamasi Kemerdekaan RI',
    '2027-12-24': 'Cuti Bersama Hari Raya Natal',
    '2027-12-25': 'Kelahiran Yesus Kristus (Natal)',
    '2027-12-26': 'Isra Mikraj Nabi Muhammad SAW 1449 H',

    // === 2028 ===
    '2028-01-01': 'Tahun Baru 2028 Masehi',
    '2028-01-24': 'Isra Mikraj Nabi Muhammad SAW',
    '2028-01-26': 'Tahun Baru Imlek 2579 Kongzili',
    '2028-02-27': 'Hari Raya Idul Fitri 1449 H',
    '2028-02-28': 'Hari Raya Idul Fitri 1449 H',
    '2028-03-26': 'Hari Suci Nyepi (Tahun Baru Saka 1950)',
    '2028-04-14': 'Wafat Yesus Kristus',
    '2028-05-01': 'Hari Buruh Internasional',
    '2028-05-05': 'Hari Raya Idul Adha 1449 H',
    '2028-05-09': 'Hari Raya Waisak 2572 BE',
    '2028-05-25': 'Kenaikan Yesus Kristus',
    '2028-06-01': 'Hari Lahir Pancasila',
    '2028-08-17': 'Hari Proklamasi Kemerdekaan RI',
    '2028-12-25': 'Kelahiran Yesus Kristus (Natal)'
};

/**
 * Hari libur nasional tahunan berulang dengan tanggal tetap (MM-DD)
 */
const FIXED_ANNUAL_HOLIDAYS = {
    '01-01': 'Tahun Baru Masehi',
    '05-01': 'Hari Buruh Internasional',
    '06-01': 'Hari Lahir Pancasila',
    '08-17': 'Hari Proklamasi Kemerdekaan RI',
    '12-25': 'Kelahiran Yesus Kristus (Natal)'
};

/**
 * Cek apakah sebuah tanggal adalah hari Sabtu atau Ahad/Minggu.
 * @param {dayjs.Dayjs | Date | string} date
 * @returns {boolean}
 */
const isWeekend = (date) => {
    const d = dayjs(date).tz('Asia/Jakarta');
    const day = d.day(); // 0 = Sunday (Ahad), 6 = Saturday (Sabtu)
    return day === 0 || day === 6;
};

/**
 * Mendapatkan nama hari libur nasional atau cuti bersama untuk tanggal tertentu (sinkronus).
 * @param {dayjs.Dayjs | Date | string} date
 * @returns {string | null}
 */
const getNationalHoliday = (date) => {
    const d = dayjs(date).tz('Asia/Jakarta');
    const ymd = d.format('YYYY-MM-DD');
    const md = d.format('MM-DD');

    // 1. Cek tabel tanggal spesifik
    if (INDONESIA_HOLIDAYS[ymd]) {
        return INDONESIA_HOLIDAYS[ymd];
    }

    // 2. Cek hari libur nasional tetap tahunan (fallback jika tahun belum terdaftar di tabel)
    if (FIXED_ANNUAL_HOLIDAYS[md]) {
        return FIXED_ANNUAL_HOLIDAYS[md];
    }

    return null;
};

/**
 * Cek apakah sebuah tanggal adalah hari libur (Sabtu, Ahad, Libur Nasional, atau Cuti Bersama).
 * Opsi: dapat memeriksa database SarprasCalendarEvent untuk event libur yayasan/internal jika prisma disediakan.
 *
 * @param {dayjs.Dayjs | Date | string} date
 * @param {any} [prismaClient] Optional prisma client instance
 * @returns {Promise<{ isOffDay: boolean, isWeekend: boolean, isHoliday: boolean, reason: string | null }>}
 */
const isHolidayOrWeekend = async (date = new Date(), prismaClient = null) => {
    const d = dayjs(date).tz('Asia/Jakarta');
    const dayOfWeek = d.day();

    // 1. Cek Hari Libur Nasional & Cuti Bersama (SKB 3 Menteri)
    const nationalHoliday = getNationalHoliday(d);
    if (nationalHoliday) {
        return {
            isOffDay: true,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            isHoliday: true,
            reason: nationalHoliday
        };
    }

    // 2. Cek Akhir Pekan (Sabtu & Ahad)
    if (dayOfWeek === 6) {
        return {
            isOffDay: true,
            isWeekend: true,
            isHoliday: false,
            reason: 'Hari Sabtu'
        };
    }
    if (dayOfWeek === 0) {
        return {
            isOffDay: true,
            isWeekend: true,
            isHoliday: false,
            reason: 'Hari Ahad'
        };
    }

    // 3. Cek Agenda Kalender Sarpras (jika ada event kategori Libur di DB)
    if (prismaClient && prismaClient.sarprasCalendarEvent) {
        try {
            const startOfDay = d.startOf('day').toDate();
            const endOfDay = d.endOf('day').toDate();
            const calEvent = await prismaClient.sarprasCalendarEvent.findFirst({
                where: {
                    date: { gte: startOfDay, lte: endOfDay },
                    OR: [
                        { category: { in: ['Libur', 'Libur Nasional', 'Cuti Bersama', 'LIBUR', 'Holiday'] } },
                        { title: { contains: 'Libur' } },
                        { title: { contains: 'Cuti Bersama' } },
                        { description: { contains: 'Libur Nasional' } }
                    ]
                }
            });

            if (calEvent) {
                return {
                    isOffDay: true,
                    isWeekend: false,
                    isHoliday: true,
                    reason: calEvent.title || 'Hari Libur Kalender Sarpras'
                };
            }
        } catch (dbErr) {
            // Ignore DB error, jangan sampai menggagalkan alur sistem
            console.warn('[holidayHelper] Warning reading sarprasCalendarEvent:', dbErr.message);
        }
    }

    return {
        isOffDay: false,
        isWeekend: false,
        isHoliday: false,
        reason: null
    };
};

/**
 * Cek apakah hari ini adalah hari kerja normal (Senin-Jumat, bukan hari libur nasional).
 * @param {dayjs.Dayjs | Date | string} date
 * @returns {boolean}
 */
const isWorkingDay = (date = new Date()) => {
    if (isWeekend(date)) return false;
    if (getNationalHoliday(date)) return false;
    return true;
};

module.exports = {
    isWeekend,
    getNationalHoliday,
    isHolidayOrWeekend,
    isWorkingDay,
    INDONESIA_HOLIDAYS,
    FIXED_ANNUAL_HOLIDAYS
};
