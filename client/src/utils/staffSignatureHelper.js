/**
 * Utility to generate and retrieve official draft signature for Staff Gudang dan Logistik
 */

export const getStaffGudangDraftSignature = (staffName = 'Jeri Saputra') => {
  if (typeof document === 'undefined') return '';

  // Check custom saved draft in localStorage
  try {
    const saved = localStorage.getItem('staff_gudang_draft_sig');
    if (saved && saved.startsWith('data:image/png;base64,')) {
      return saved;
    }
  } catch (e) {}

  const canvas = document.createElement('canvas');
  canvas.width = 380;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#0f2752'; // Deep navy blue ink
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Smooth elegant signature strokes for Jeri Saputra / Staff Logistik
  ctx.beginPath();
  // Capital J flourish with top loop and descent
  ctx.moveTo(65, 75);
  ctx.bezierCurveTo(75, 20, 95, 18, 105, 52);
  ctx.bezierCurveTo(112, 82, 90, 130, 68, 122);
  ctx.bezierCurveTo(50, 116, 60, 90, 95, 76);

  // Connecting 'eri'
  ctx.bezierCurveTo(115, 68, 125, 88, 140, 74);
  ctx.bezierCurveTo(150, 64, 160, 86, 175, 71);
  ctx.bezierCurveTo(185, 61, 195, 91, 210, 66);

  // Flowing 'Saputra' loop and flourish
  ctx.bezierCurveTo(225, 46, 245, 38, 260, 64);
  ctx.bezierCurveTo(270, 84, 255, 114, 220, 104);
  ctx.bezierCurveTo(185, 94, 280, 78, 325, 84);

  // Dynamic sweeping underline
  ctx.moveTo(80, 110);
  ctx.bezierCurveTo(155, 98, 240, 101, 310, 94);

  ctx.stroke();

  // Subtle accent dot
  ctx.beginPath();
  ctx.arc(142, 54, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = '#0f2752';
  ctx.fill();

  return canvas.toDataURL('image/png');
};

/**
 * Simpan draft tanda tangan kustom ke localStorage
 */
export const saveStaffGudangDraftSignature = (dataUrl) => {
  try {
    if (dataUrl && (dataUrl.startsWith('data:image/png;base64,') || dataUrl.startsWith('data:image/jpeg;base64,'))) {
      localStorage.setItem('staff_gudang_draft_sig', dataUrl);
      return true;
    }
  } catch (e) {
    console.error('Failed to save draft signature:', e);
  }
  return false;
};

/**
 * Hapus draft kustom dan kembalikan ke spesimen bawaan sistem
 */
export const resetStaffGudangDraftSignature = () => {
  try {
    localStorage.removeItem('staff_gudang_draft_sig');
    return true;
  } catch (e) {
    console.error('Failed to reset draft signature:', e);
  }
  return false;
};

/**
 * Cek apakah saat ini menggunakan tanda tangan kustom hasil simpan pengguna
 */
export const hasCustomStaffGudangDraftSignature = () => {
  try {
    const saved = localStorage.getItem('staff_gudang_draft_sig');
    return !!(saved && (saved.startsWith('data:image/png;base64,') || saved.startsWith('data:image/jpeg;base64,')));
  } catch (e) {
    return false;
  }
};

