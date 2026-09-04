/**
 * Data Lengkap 114 Surah Al-Qur'an dan Pemetaan Juz 1-30
 * Digunakan untuk modul Setoran Hafalan (Ziyadah & Murajaah)
 */

export const JUZ_LIST = Array.from({ length: 30 }, (_, i) => ({
    number: i + 1,
    name: `Juz ${i + 1}`,
    description: i === 29 ? 'Juz 30 (Juz \'Amma)' : i === 28 ? 'Juz 29 (Tabarak)' : `Juz ${i + 1}`
}));

export const QURAN_SURAHS = [
    { number: 1, name: "Al-Fatihah", arabic: "الفاتحة", translation: "Pembukaan", totalVerses: 7, juz: [1] },
    { number: 2, name: "Al-Baqarah", arabic: "البقرة", translation: "Sapi Betina", totalVerses: 286, juz: [1, 2, 3] },
    { number: 3, name: "Ali 'Imran", arabic: "آل عمران", translation: "Keluarga Imran", totalVerses: 200, juz: [3, 4] },
    { number: 4, name: "An-Nisa'", arabic: "النساء", translation: "Wanita", totalVerses: 176, juz: [4, 5, 6] },
    { number: 5, name: "Al-Ma'idah", arabic: "المائدة", translation: "Jamuan (Hidangan)", totalVerses: 120, juz: [6, 7] },
    { number: 6, name: "Al-An'am", arabic: "الأنعام", translation: "Binatang Ternak", totalVerses: 165, juz: [7, 8] },
    { number: 7, name: "Al-A'raf", arabic: "الأعراف", translation: "Tempat Tertinggi", totalVerses: 206, juz: [8, 9] },
    { number: 8, name: "Al-Anfal", arabic: "الأنفال", translation: "Rampasan Perang", totalVerses: 75, juz: [9, 10] },
    { number: 9, name: "At-Taubah", arabic: "التوبة", translation: "Pengampunan", totalVerses: 129, juz: [10, 11] },
    { number: 10, name: "Yunus", arabic: "يونس", translation: "Nabi Yunus", totalVerses: 109, juz: [11] },
    { number: 11, name: "Hud", arabic: "هود", translation: "Nabi Hud", totalVerses: 123, juz: [11, 12] },
    { number: 12, name: "Yusuf", arabic: "يوسف", translation: "Nabi Yusuf", totalVerses: 111, juz: [12, 13] },
    { number: 13, name: "Ar-Ra'd", arabic: "الرعد", translation: "Guruh", totalVerses: 43, juz: [13] },
    { number: 14, name: "Ibrahim", arabic: "إبراهيم", translation: "Nabi Ibrahim", totalVerses: 52, juz: [13] },
    { number: 15, name: "Al-Hijr", arabic: "الحجر", translation: "Gunung Al Hijr", totalVerses: 99, juz: [14] },
    { number: 16, name: "An-Nahl", arabic: "النحل", translation: "Lebah", totalVerses: 128, juz: [14] },
    { number: 17, name: "Al-Isra'", arabic: "الإسراء", translation: "Memperjalankan Malam Hari", totalVerses: 111, juz: [15] },
    { number: 18, name: "Al-Kahf", arabic: "الكهف", translation: "Penghuni Gua", totalVerses: 110, juz: [15, 16] },
    { number: 19, name: "Maryam", arabic: "مريم", translation: "Maryam", totalVerses: 98, juz: [16] },
    { number: 20, name: "Taha", arabic: "طه", translation: "Ta Ha", totalVerses: 135, juz: [16] },
    { number: 21, name: "Al-Anbiya'", arabic: "الأنبياء", translation: "Para Nabi", totalVerses: 112, juz: [17] },
    { number: 22, name: "Al-Hajj", arabic: "الحج", translation: "Haji", totalVerses: 78, juz: [17] },
    { number: 23, name: "Al-Mu'minun", arabic: "المؤمنون", translation: "Orang-Orang Mukmin", totalVerses: 118, juz: [18] },
    { number: 24, name: "An-Nur", arabic: "النور", translation: "Cahaya", totalVerses: 64, juz: [18] },
    { number: 25, name: "Al-Furqan", arabic: "الفرقان", translation: "Pembeda", totalVerses: 77, juz: [18, 19] },
    { number: 26, name: "Asy-Syu'ara'", arabic: "الشعراء", translation: "Penyair", totalVerses: 227, juz: [19] },
    { number: 27, name: "An-Naml", arabic: "النمل", translation: "Semut", totalVerses: 93, juz: [19, 20] },
    { number: 28, name: "Al-Qasas", arabic: "القصص", translation: "Kisah-Kisah", totalVerses: 88, juz: [20] },
    { number: 29, name: "Al-'Ankabut", arabic: "العنكبوت", translation: "Laba-Laba", totalVerses: 69, juz: [20, 21] },
    { number: 30, name: "Ar-Rum", arabic: "الروم", translation: "Bangsa Romawi", totalVerses: 60, juz: [21] },
    { number: 31, name: "Luqman", arabic: "لقمان", translation: "Keluarga Luqman", totalVerses: 34, juz: [21] },
    { number: 32, name: "As-Sajdah", arabic: "السجدة", translation: "Sujud", totalVerses: 30, juz: [21] },
    { number: 33, name: "Al-Ahzab", arabic: "الأحزاب", translation: "Golongan Yang Bersekutu", totalVerses: 73, juz: [21, 22] },
    { number: 34, name: "Saba'", arabic: "سبأ", translation: "Kaum Saba'", totalVerses: 54, juz: [22] },
    { number: 35, name: "Fatir", arabic: "فاطر", translation: "Pencipta", totalVerses: 45, juz: [22] },
    { number: 36, name: "Ya-Sin", arabic: "يس", translation: "Yaasiin", totalVerses: 83, juz: [22, 23] },
    { number: 37, name: "As-Saffat", arabic: "الصافات", translation: "Barisan-Barisan", totalVerses: 182, juz: [23] },
    { number: 38, name: "Sad", arabic: "ص", translation: "Shaad", totalVerses: 88, juz: [23] },
    { number: 39, name: "Az-Zumar", arabic: "الزمر", translation: "Rombongan-Rombongan", totalVerses: 75, juz: [23, 24] },
    { number: 40, name: "Ghafir", arabic: "غافر", translation: "Yang Mengampuni", totalVerses: 85, juz: [24] },
    { number: 41, name: "Fussilat", arabic: "فصلت", translation: "Yang Dijelaskan", totalVerses: 54, juz: [24, 25] },
    { number: 42, name: "Asy-Syura", arabic: "الشورى", translation: "Musyawarah", totalVerses: 53, juz: [25] },
    { number: 43, name: "Az-Zukhruf", arabic: "الزخرف", translation: "Perhiasan", totalVerses: 89, juz: [25] },
    { number: 44, name: "Ad-Dukhan", arabic: "الدخان", translation: "Kabut", totalVerses: 59, juz: [25] },
    { number: 45, name: "Al-Jasiyah", arabic: "الجاثية", translation: "Yang Berlutut", totalVerses: 37, juz: [25] },
    { number: 46, name: "Al-Ahqaf", arabic: "الأحقاف", translation: "Bukit-Bukit Pasir", totalVerses: 35, juz: [26] },
    { number: 47, name: "Muhammad", arabic: "محمد", translation: "Nabi Muhammad", totalVerses: 38, juz: [26] },
    { number: 48, name: "Al-Fath", arabic: "الفتح", translation: "Kemenangan", totalVerses: 29, juz: [26] },
    { number: 49, name: "Al-Hujurat", arabic: "الحجرات", translation: "Kamar-Kamar", totalVerses: 18, juz: [26] },
    { number: 50, name: "Qaf", arabic: "ق", translation: "Qaaf", totalVerses: 45, juz: [26] },
    { number: 51, name: "Az-Zariyat", arabic: "الذاريات", translation: "Angin Yang Menerbangkan", totalVerses: 60, juz: [26, 27] },
    { number: 52, name: "At-Tur", arabic: "الطور", translation: "Bukit", totalVerses: 49, juz: [27] },
    { number: 53, name: "An-Najm", arabic: "النجم", translation: "Bintang", totalVerses: 62, juz: [27] },
    { number: 54, name: "Al-Qamar", arabic: "القمر", translation: "Bulan", totalVerses: 55, juz: [27] },
    { number: 55, name: "Ar-Rahman", arabic: "الرحمن", translation: "Yang Maha Pemurah", totalVerses: 78, juz: [27] },
    { number: 56, name: "Al-Waqi'ah", arabic: "الواقعة", translation: "Hari Kiamat", totalVerses: 96, juz: [27] },
    { number: 57, name: "Al-Hadid", arabic: "الحديد", translation: "Besi", totalVerses: 29, juz: [27] },
    { number: 58, name: "Al-Mujadilah", arabic: "المجادلة", translation: "Gugatan", totalVerses: 22, juz: [28] },
    { number: 59, name: "Al-Hasyr", arabic: "الحشر", translation: "Pengusiran", totalVerses: 24, juz: [28] },
    { number: 60, name: "Al-Mumtahanah", arabic: "الممتحنة", translation: "Wanita Yang Diuji", totalVerses: 13, juz: [28] },
    { number: 61, name: "As-Saff", arabic: "الصف", translation: "Barisan", totalVerses: 14, juz: [28] },
    { number: 62, name: "Al-Jumu'ah", arabic: "الجمعة", translation: "Hari Jum'at", totalVerses: 11, juz: [28] },
    { number: 63, name: "Al-Munafiqun", arabic: "المنافقون", translation: "Orang-Orang Munafik", totalVerses: 11, juz: [28] },
    { number: 64, name: "At-Tagabun", arabic: "التغابن", translation: "Hari Dinampakkan Kesalahan", totalVerses: 18, juz: [28] },
    { number: 65, name: "At-Talaq", arabic: "الطلاق", translation: "Perceraian", totalVerses: 12, juz: [28] },
    { number: 66, name: "At-Tahrim", arabic: "التحريم", translation: "Mengharamkan", totalVerses: 12, juz: [28] },
    { number: 67, name: "Al-Mulk", arabic: "الملك", translation: "Kerajaan", totalVerses: 30, juz: [29] },
    { number: 68, name: "Al-Qalam", arabic: "القلم", translation: "Pena", totalVerses: 52, juz: [29] },
    { number: 69, name: "Al-Haqqah", arabic: "الحاقة", translation: "Hari Kiamat", totalVerses: 52, juz: [29] },
    { number: 70, name: "Al-Ma'arij", arabic: "المعارج", translation: "Tempat Naik", totalVerses: 44, juz: [29] },
    { number: 71, name: "Nuh", arabic: "نوح", translation: "Nabi Nuh", totalVerses: 28, juz: [29] },
    { number: 72, name: "Al-Jinn", arabic: "الجن", translation: "Jin", totalVerses: 28, juz: [29] },
    { number: 73, name: "Al-Muzzammil", arabic: "المزمل", translation: "Orang Yang Berselimut", totalVerses: 20, juz: [29] },
    { number: 74, name: "Al-Muddassir", arabic: "المدثر", translation: "Orang Yang Berkemul", totalVerses: 56, juz: [29] },
    { number: 75, name: "Al-Qiyamah", arabic: "القيامة", translation: "Hari Kiamat", totalVerses: 40, juz: [29] },
    { number: 76, name: "Al-Insan", arabic: "الإنسان", translation: "Manusia", totalVerses: 31, juz: [29] },
    { number: 77, name: "Al-Mursalat", arabic: "المرسلات", translation: "Malaikat-Malaikat Yang Diutus", totalVerses: 50, juz: [29] },
    { number: 78, name: "An-Naba'", arabic: "النبأ", translation: "Berita Besar", totalVerses: 40, juz: [30] },
    { number: 79, name: "An-Nazi'at", arabic: "النازعات", translation: "Malaikat Yang Mencabut", totalVerses: 46, juz: [30] },
    { number: 80, name: "'Abasa", arabic: "عبس", translation: "Ia Bermuka Masam", totalVerses: 42, juz: [30] },
    { number: 81, name: "At-Takwir", arabic: "التكوير", translation: "Menggulung", totalVerses: 29, juz: [30] },
    { number: 82, name: "Al-Infitar", arabic: "الانفطار", translation: "Terbelah", totalVerses: 19, juz: [30] },
    { number: 83, name: "Al-Mutaffifin", arabic: "المطففين", translation: "Orang-Orang Curang", totalVerses: 36, juz: [30] },
    { number: 84, name: "Al-Insyiqaq", arabic: "الانشقاق", translation: "Terbelah", totalVerses: 25, juz: [30] },
    { number: 85, name: "Al-Buruj", arabic: "البروج", translation: "Gugusan Bintang", totalVerses: 22, juz: [30] },
    { number: 86, name: "At-Tariq", arabic: "الطارق", translation: "Yang Datang Di Malam Hari", totalVerses: 17, juz: [30] },
    { number: 87, name: "Al-A'la", arabic: "الأعلى", translation: "Yang Paling Tinggi", totalVerses: 19, juz: [30] },
    { number: 88, name: "Al-Ghasyiyah", arabic: "الغاشية", translation: "Hari Pembalasan", totalVerses: 26, juz: [30] },
    { number: 89, name: "Al-Fajr", arabic: "الفجر", translation: "Fajar", totalVerses: 30, juz: [30] },
    { number: 90, name: "Al-Balad", arabic: "البلد", translation: "Negeri", totalVerses: 20, juz: [30] },
    { number: 91, name: "Asy-Syams", arabic: "الشمس", translation: "Matahari", totalVerses: 15, juz: [30] },
    { number: 92, name: "Al-Lail", arabic: "الليل", translation: "Malam", totalVerses: 21, juz: [30] },
    { number: 93, name: "Ad-Duha", arabic: "الضحى", translation: "Waktu Dhuha", totalVerses: 11, juz: [30] },
    { number: 94, name: "Asy-Syarh", arabic: "الشرح", translation: "Kelapangan", totalVerses: 8, juz: [30] },
    { number: 95, name: "At-Tin", arabic: "التين", translation: "Buah Tin", totalVerses: 8, juz: [30] },
    { number: 96, name: "Al-'Alaq", arabic: "العلق", translation: "Segumpal Darah", totalVerses: 19, juz: [30] },
    { number: 97, name: "Al-Qadr", arabic: "القدر", translation: "Kemuliaan", totalVerses: 5, juz: [30] },
    { number: 98, name: "Al-Bayyinah", arabic: "البينة", translation: "Pembuktian", totalVerses: 8, juz: [30] },
    { number: 99, name: "Az-Zalzalah", arabic: "الزلزلة", translation: "Kegoncangan", totalVerses: 8, juz: [30] },
    { number: 100, name: "Al-'Adiyat", arabic: "العاديات", translation: "Kuda Yang Berlari Kencang", totalVerses: 11, juz: [30] },
    { number: 101, name: "Al-Qari'ah", arabic: "القارعة", translation: "Hari Kiamat", totalVerses: 11, juz: [30] },
    { number: 102, name: "At-Takasur", arabic: "التكاثر", translation: "Bermegah-Megahan", totalVerses: 8, juz: [30] },
    { number: 103, name: "Al-'Asr", arabic: "العصر", translation: "Masa / Waktu Sore", totalVerses: 3, juz: [30] },
    { number: 104, name: "Al-Humazah", arabic: "الهمزة", translation: "Pengumpat", totalVerses: 9, juz: [30] },
    { number: 105, name: "Al-Fil", arabic: "الفيل", translation: "Gajah", totalVerses: 5, juz: [30] },
    { number: 106, name: "Quraisy", arabic: "قريش", translation: "Suku Quraisy", totalVerses: 4, juz: [30] },
    { number: 107, name: "Al-Ma'un", arabic: "الماعون", translation: "Barang-Barang Yang Berguna", totalVerses: 7, juz: [30] },
    { number: 108, name: "Al-Kausar", arabic: "الكوثر", translation: "Nikmat Yang Berlimpah", totalVerses: 3, juz: [30] },
    { number: 109, name: "Al-Kafirun", arabic: "الكافرون", translation: "Orang-Orang Kafir", totalVerses: 6, juz: [30] },
    { number: 110, name: "An-Nasr", arabic: "النصر", translation: "Pertolongan", totalVerses: 3, juz: [30] },
    { number: 111, name: "Al-Lahab", arabic: "اللهب", translation: "Gejolak Api", totalVerses: 5, juz: [30] },
    { number: 112, name: "Al-Ikhlas", arabic: "الإخلاص", translation: "Kemurnian Keesaan Allah", totalVerses: 4, juz: [30] },
    { number: 113, name: "Al-Falaq", arabic: "الفلق", translation: "Waktu Subuh", totalVerses: 5, juz: [30] },
    { number: 114, name: "An-Nas", arabic: "الناس", translation: "Manusia", totalVerses: 6, juz: [30] }
];

/**
 * Mendapatkan surah berdasarkan nomor urut (1-114)
 */
export const getSurahByNumber = (number) => {
    const num = parseInt(number, 10);
    return QURAN_SURAHS.find(s => s.number === num) || null;
};

/**
 * Mendapatkan daftar surah yang berada dalam Juz tertentu (1-30)
 */
export const getSurahsByJuz = (juzNumber) => {
    if (!juzNumber || juzNumber === 'ALL') return QURAN_SURAHS;
    const jNum = parseInt(juzNumber, 10);
    return QURAN_SURAHS.filter(s => s.juz.includes(jNum));
};

/**
 * Validasi rentang ayat (ayat awal dan akhir) berdasarkan surah
 */
export const validateAyatRange = (surahNumber, ayatAwal, ayatAkhir) => {
    const surah = getSurahByNumber(surahNumber);
    if (!surah) return { isValid: false, message: 'Surah tidak valid.' };

    const awal = parseInt(ayatAwal, 10);
    const akhir = parseInt(ayatAkhir, 10);

    if (isNaN(awal) || awal < 1) {
        return { isValid: false, message: 'Ayat awal minimal adalah 1.' };
    }
    if (isNaN(akhir) || akhir < 1) {
        return { isValid: false, message: 'Ayat akhir minimal adalah 1.' };
    }
    if (awal > surah.totalVerses) {
        return { isValid: false, message: `Ayat awal (${awal}) melebihi jumlah total ayat Surah ${surah.name} (${surah.totalVerses} ayat).` };
    }
    if (akhir > surah.totalVerses) {
        return { isValid: false, message: `Ayat akhir (${akhir}) melebihi jumlah total ayat Surah ${surah.name} (${surah.totalVerses} ayat).` };
    }
    if (awal > akhir) {
        return { isValid: false, message: `Ayat awal (${awal}) tidak boleh lebih besar dari ayat akhir (${akhir}).` };
    }

    const totalAyat = akhir - awal + 1;
    return { isValid: true, totalAyat, message: 'Valid' };
};

/**
 * Standar predikat penilaian hafalan
 */
export const PREDIKAT_OPTIONS = [
    { value: 'Mumtaz', label: 'Mumtaz (Sangat Lancar / A)', color: 'emerald', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'Jayyid Jiddan', label: 'Jayyid Jiddan (Lancar / B+)', color: 'blue', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'Jayyid', label: 'Jayyid (Cukup Lancar / B)', color: 'amber', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'Maqbul', label: 'Maqbul (Perlu Diulang / C)', color: 'rose', bg: 'bg-rose-50 text-rose-700 border-rose-200' }
];
