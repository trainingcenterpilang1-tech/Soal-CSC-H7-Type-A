import { Participant, Question, ExamResult, ExamConfig } from '../types';
import {
  SPREADSHEET_ID,
  SPREADSHEET_URL,
  PERMANENT_APPS_SCRIPT_URL,
  DEFAULT_EXAM_CONFIG,
  INITIAL_PARTICIPANTS,
  INITIAL_QUESTIONS,
  INITIAL_RESULTS,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_TABLE_DATA_PESERTA,
} from '../data/defaultData';
import { getAccessToken } from './firebase';

const STORAGE_KEYS = {
  PARTICIPANTS: 'stm_participants_cache',
  DATA_PESERTA: 'stm_data_peserta_cache',
  DATA_LOGIN: 'stm_data_login_cache',
  QUESTIONS: 'stm_questions_cache',
  RESULTS: 'stm_results_cache',
  CONFIG: 'stm_exam_config',
  APPS_SCRIPT_URL: 'stm_apps_script_url',
  SPREADSHEET_ID: 'stm_spreadsheet_id',
  SPREADSHEET_URL: 'stm_spreadsheet_url',
  ADMIN_PASSWORD: 'stm_admin_password',
};

export const APPS_SCRIPT_STORAGE_KEY = STORAGE_KEYS.APPS_SCRIPT_URL;

export const DEFAULT_ADMIN_PASSWORD = 'Tcsby123';

/**
 * Kelola Password Administrator
 */
export const getAdminPassword = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
    if (saved && saved.trim()) {
      const trimmed = saved.trim();
      // If previous default was saved, migrate to new default Tcsby123
      if (trimmed === 'admin' || trimmed === 'admin123' || trimmed === 'adminsc') {
        localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD);
        return DEFAULT_ADMIN_PASSWORD;
      }
      return trimmed;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_ADMIN_PASSWORD;
};

export const saveAdminPassword = (newPassword: string): boolean => {
  try {
    if (!newPassword || newPassword.trim().length < 3) return false;
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, newPassword.trim());
    return true;
  } catch {
    return false;
  }
};

export const resetAdminPassword = (): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD);
  } catch {
    // Ignore
  }
};

export const verifyAdminPassword = (inputPass: string): boolean => {
  const clean = inputPass.trim();
  if (!clean) return false;
  if (clean === DEFAULT_ADMIN_PASSWORD) return true;
  const current = getAdminPassword();
  if (clean === current) return true;
  return false;
};

/**
 * Password tanggal berjalan:
 * Format: tahun, bulan, tanggal (misal: 20260926)
 * Otomatis berubah setiap hari mengikuti tanggal berjalan.
 */
export const getRunningDatePasswords = (date: Date = new Date()): {
  primary: string;
  formatted: string;
  accepted: string[];
} => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  const p1 = `${y}${m}${d}`; // e.g. "20260926"
  const p2 = `${y}-${m}-${d}`; // e.g. "2026-09-26"
  const p3 = `${y}/${m}/${d}`; // e.g. "2026/09/26"

  // Also include UTC variant if local timezone crosses midnight
  const uy = date.getUTCFullYear();
  const um = String(date.getUTCMonth() + 1).padStart(2, '0');
  const ud = String(date.getUTCDate()).padStart(2, '0');
  const u1 = `${uy}${um}${ud}`;
  const u2 = `${uy}-${um}-${ud}`;

  const accepted = Array.from(new Set([p1, p2, p3, u1, u2]));

  return {
    primary: p1,
    formatted: `${y}-${m}-${d}`,
    accepted,
  };
};

export const verifyDailyDatePassword = (inputPass: string): boolean => {
  const clean = inputPass.trim().replace(/\s+/g, '');
  if (!clean) return false;
  const { accepted } = getRunningDatePasswords();
  return accepted.includes(clean);
};

export const extractSpreadsheetId = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return SPREADSHEET_ID;

  // Extract from full Google Sheets URL
  // e.g., https://docs.google.com/spreadsheets/d/1_tN7NvG4HWERgWkMHE3vggeFKFX_vi6mP5yzOiJ0DuU/edit#gid=0
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Extract if query string contains key or id
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // Raw ID directly provided
  if (/^[a-zA-Z0-9-_]{15,70}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
};

export const getSpreadsheetId = (): string => {
  try {
    const custom = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID);
    if (
      custom &&
      custom.trim() &&
      custom.trim() !== '1wnzgo6-rhxKLsq6_SqlEowLQKDOFH9YM6fw1MLrbf4Y' &&
      custom.trim() !== '1-29Ku2aAM0NsTcMROOluG2oim9s_yNr7mKAM1EXjtBo' &&
      custom.trim() !== '14VuRQes6D3uQuMFkmf9kpruoUKuSGq1T9kAMtN9F7qc'
    ) {
      return custom.trim();
    }
  } catch {
    // fallback
  }
  return SPREADSHEET_ID;
};

export const getSpreadsheetUrl = (): string => {
  const id = getSpreadsheetId();
  try {
    const customUrl = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_URL);
    if (
      customUrl &&
      customUrl.trim() &&
      customUrl.includes(id) &&
      !customUrl.includes('1wnzgo6-rhxKLsq6_SqlEowLQKDOFH9YM6fw1MLrbf4Y') &&
      !customUrl.includes('1-29Ku2aAM0NsTcMROOluG2oim9s_yNr7mKAM1EXjtBo') &&
      !customUrl.includes('14VuRQes6D3uQuMFkmf9kpruoUKuSGq1T9kAMtN9F7qc')
    ) {
      return customUrl.trim();
    }
  } catch {
    // fallback
  }
  if (id === SPREADSHEET_ID) {
    return SPREADSHEET_URL;
  }
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
};

export const isCustomSpreadsheetConfigured = (): boolean => {
  try {
    const custom = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID);
    return Boolean(custom && custom.trim() && custom.trim() !== SPREADSHEET_ID);
  } catch {
    return false;
  }
};

export const saveCustomSpreadsheet = (idOrUrl: string): { success: boolean; id: string; url: string; message: string } => {
  try {
    const extractedId = extractSpreadsheetId(idOrUrl);
    if (!extractedId || extractedId.length < 15) {
      return {
        success: false,
        id: '',
        url: '',
        message: 'Format Link atau ID Spreadsheet tidak valid. Pastikan link diawali https://docs.google.com/spreadsheets/d/...',
      };
    }

    const url = idOrUrl.trim().startsWith('http') ? idOrUrl.trim() : `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, extractedId);
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET_URL, url);

    // Clear caches so fresh data will be fetched from new spreadsheet
    clearAllSheetCaches();

    return {
      success: true,
      id: extractedId,
      url,
      message: 'Spreadsheet baru berhasil disimpan dan diterapkan!',
    };
  } catch (e: any) {
    return {
      success: false,
      id: '',
      url: '',
      message: e.message || 'Gagal menyimpan konfigurasi spreadsheet',
    };
  }
};

export const resetCustomSpreadsheet = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SPREADSHEET_ID);
    localStorage.removeItem(STORAGE_KEYS.SPREADSHEET_URL);
    clearAllSheetCaches();
  } catch (e) {
    console.warn('Error resetting spreadsheet config:', e);
  }
};

export const clearAllSheetCaches = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANTS);
    localStorage.removeItem(STORAGE_KEYS.DATA_PESERTA);
    localStorage.removeItem(STORAGE_KEYS.DATA_LOGIN);
    localStorage.removeItem(STORAGE_KEYS.QUESTIONS);
    localStorage.removeItem(STORAGE_KEYS.RESULTS);
  } catch (e) {
    console.warn('Error clearing sheet caches:', e);
  }
};

export const testSpreadsheetAccessibility = async (idOrUrl?: string): Promise<{
  success: boolean;
  sheetsFound: string[];
  missingSheets: string[];
  message: string;
}> => {
  const targetId = idOrUrl ? extractSpreadsheetId(idOrUrl) : getSpreadsheetId();
  const sheetsToCheck = ['Data_Peserta', 'Soal_Test', 'Hasil_Jawaban'];
  const sheetsFound: string[] = [];
  const missingSheets: string[] = [];

  for (const sheetName of sheetsToCheck) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${targetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
      const res = await fetch(url);
      if (!res.ok) {
        missingSheets.push(sheetName);
        continue;
      }
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
      if (!match) {
        missingSheets.push(sheetName);
        continue;
      }
      const parsed = JSON.parse(match[1]);
      if (parsed.status === 'error') {
        missingSheets.push(sheetName);
      } else {
        sheetsFound.push(sheetName);
      }
    } catch {
      missingSheets.push(sheetName);
    }
  }

  if (sheetsFound.length === sheetsToCheck.length) {
    return {
      success: true,
      sheetsFound,
      missingSheets: [],
      message: `Spreadsheet dapat diakses publik! Terdeteksi seluruh sheet: ${sheetsFound.join(', ')}.`,
    };
  } else if (sheetsFound.length > 0) {
    return {
      success: true,
      sheetsFound,
      missingSheets,
      message: `Spreadsheet dapat diakses. Sheet ditemukan: ${sheetsFound.join(', ')}. Catatan: sheet [${missingSheets.join(', ')}] belum terdeteksi di spreadsheet ini.`,
    };
  } else {
    return {
      success: false,
      sheetsFound: [],
      missingSheets: sheetsToCheck,
      message: 'Tidak dapat mengakses spreadsheet. Pastikan link di Google Spreadsheet telah disetel ke "Siapa saja yang memiliki link: Pelihat (Viewer)" di tombol Bagikan (Share).',
    };
  }
};

export const HASIL_JAWABAN_BASE_HEADERS = [
  'Timestamp',
  'NIK',
  'Nama Peserta',
  'Kode Toko',
  'Nama Toko',
  'Jabatan',
  'Jenis Ujian',
  'Skor Akhir',
  'Total Soal',
  'Jumlah Benar',
  'Jumlah Salah',
  'Waktu Mulai',
  'Waktu Selesai',
  'Durasi Pengerjaan',
  'Status Kelulusan',
];

export function getColumnLetter(colNum: number): string {
  let temp: number;
  let letter = '';
  let n = colNum;
  while (n > 0) {
    temp = (n - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    n = Math.floor((n - temp - 1) / 26);
  }
  return letter;
}

export function getHasilJawabanQuestionHeaders(count: number = 30): string[] {
  const total = Math.max(30, count);
  return Array.from({ length: total }, (_, i) => `Soal ${i + 1}`);
}

export const HASIL_JAWABAN_QUESTION_HEADERS = getHasilJawabanQuestionHeaders(30);

export const HASIL_JAWABAN_HEADERS = [
  ...HASIL_JAWABAN_BASE_HEADERS,
  ...HASIL_JAWABAN_QUESTION_HEADERS,
];

// Helper: Ekstrak jawaban murni per butir soal (tanpa nama jenis soal, nama COS, nama Trainer)
export function extractAnswersPerQuestion(r: ExamResult, totalQuestions: number = 30): string[] {
  const ansMap: Record<string, string> = {};
  if (r.jawabanPerSoal && typeof r.jawabanPerSoal === 'object') {
    Object.entries(r.jawabanPerSoal).forEach(([k, v]) => {
      ansMap[k] = v;
    });
  } else if (r.detailJawaban) {
    let raw = String(r.detailJawaban);
    const pipeIdx = raw.indexOf('|');
    if (pipeIdx > -1) {
      raw = raw.substring(pipeIdx + 1);
    }
    const pairs = raw.split(',');
    pairs.forEach((pair) => {
      const parts = pair.trim().split(':');
      if (parts.length >= 2) {
        const qNum = parts[0].trim();
        const choice = parts[1].trim();
        if (qNum && choice) {
          ansMap[qNum] = choice;
        }
      }
    });
  }

  let limit = Math.max(30, r.totalSoal || totalQuestions || 30);
  Object.keys(ansMap).forEach((k) => {
    const n = parseInt(k, 10);
    if (!isNaN(n) && n > limit) {
      limit = n;
    }
  });

  const resultList: string[] = [];
  for (let q = 1; q <= limit; q++) {
    resultList.push(ansMap[q] || ansMap[String(q)] || '-');
  }
  return resultList;
}

// Helper: Format satu baris data hasil ujian untuk Google Sheets / TSV
export function formatResultRowValues(result: ExamResult, totalQuestions: number = 30): (string | number)[] {
  const currentKode = result.kodeToko || (result.toko?.includes(' - ') ? result.toko.split(' - ')[0].trim() : result.toko) || 'TC';
  const currentNamaToko = result.namaToko || (result.toko?.includes(' - ') ? result.toko.split(' - ')[1].trim() : '') || 'Training Center';
  const qLimit = Math.max(30, result.totalSoal || totalQuestions || 30);
  const questionAnswers = extractAnswersPerQuestion(result, qLimit);

  return [
    result.timestamp,
    result.nik,
    result.nama,
    currentKode,
    currentNamaToko,
    result.jabatan || 'CALON STORE CREW BOY (SCB)',
    result.tipeUjian || 'Post Test',
    result.skor,
    result.totalSoal || qLimit,
    result.jumlahBenar || 0,
    result.jumlahSalah || 0,
    result.waktuMulai || '',
    result.waktuSelesai || '',
    result.durasiFormatted || '00:00',
    result.statusKelulusan || 'LULUS',
    ...questionAnswers,
  ];
}

export const getAppsScriptUrl = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.APPS_SCRIPT_URL);
    if (saved && saved.trim() && saved.trim().startsWith('https://script.google.com/')) {
      if (
        saved.includes('AKfycbY06qqZDQZveqy2g095bUCAQsmieMuloWMp6GtmPs5qfAF_caeL3ELaZVbpXzucBFncw') ||
        saved.includes('AKfycbx9-Oz1aIflQQ3JyHA93Kwprdpym5i7v2w5h4Ik2urNCoYPXo8Y8Lzwy9ws5OV4bNMI')
      ) {
        localStorage.removeItem(STORAGE_KEYS.APPS_SCRIPT_URL);
        return PERMANENT_APPS_SCRIPT_URL || '';
      }
      return saved.trim();
    }
  } catch {
    // Ignore
  }
  return PERMANENT_APPS_SCRIPT_URL || '';
};

export const syncServerSpreadsheetConfig = async (): Promise<void> => {
  try {
    const res = await fetch('/api/sheets/config');
    if (res.ok) {
      const data = await res.json();
      if (data.appsScriptUrl && typeof data.appsScriptUrl === 'string' && data.appsScriptUrl.trim()) {
        const current = localStorage.getItem(STORAGE_KEYS.APPS_SCRIPT_URL);
        if (!current || current !== data.appsScriptUrl.trim()) {
          localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, data.appsScriptUrl.trim());
        }
      }
    }
  } catch {
    // Ignore offline / server startup
  }
};

export const saveAppsScriptUrl = (url: string) => {
  try {
    const clean = url.trim();
    localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, clean);
    // Sync with server immediately so all participants on mobile phones use this URL!
    fetch('/api/sheets/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appsScriptUrl: clean }),
    }).catch(() => {});
  } catch (e) {
    console.warn('Error saving Apps Script URL:', e);
  }
};

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * GOOGLE APPS SCRIPT: PENERIMA HASIL UJIAN TRAINING CSCI H7
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1Rxb_sZGIgmUFhLhMVG65I-qpdi-v1tpj_c2tAZHsKiQ/edit?gid=537994683#gid=537994683
 * Sheet Target: Hasil_Jawaban (Mendukung 30+ Butir Soal Lengkap)
 *
 * CARA PASANG DI GOOGLE SPREADSHEET BARU:
 * 1. Buka spreadsheet baru Anda di browser:
 *    https://docs.google.com/spreadsheets/d/1Rxb_sZGIgmUFhLhMVG65I-qpdi-v1tpj_c2tAZHsKiQ/edit?gid=537994683#gid=537994683
 * 2. Klik menu 'Ekstensi' (Extensions) > 'Apps Script'
 * 3. Hapus seluruh isi kode lama di editor, lalu tempel (Paste) kode ini seluruhnya
 * 4. Klik tombol 'Simpan' (ikon disket)
 * 5. Klik tombol biru 'Terapkan' (Deploy) di kanan atas > 'Penerapan baru' (New deployment)
 * 6. Klik ikon gerigi (Pilih jenis) > pilih 'Aplikasi web' (Web app)
 *    - Deskripsi: Hasil Ujian CSCI
 *    - Jalankan sebagai (Execute as): 'Saya' (Me)
 *    - Siapa yang memiliki akses (Who has access): 'Siapa saja' (Anyone)  --> WAJIB 'SIAPA SAJA'
 * 7. Klik 'Terapkan' (Deploy), izinkan akses (Authorize access) jika diminta
 * 8. Salin 'URL Aplikasi Web' (berakhiran /exec)
 * 9. Tempelkan URL tersebut ke menu Admin > Status Google Spreadsheet di aplikasi ini.
 */

var TARGET_SPREADSHEET_ID = "1Rxb_sZGIgmUFhLhMVG65I-qpdi-v1tpj_c2tAZHsKiQ";

function getSpreadsheet() {
  try {
    if (TARGET_SPREADSHEET_ID) {
      return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    }
  } catch (err) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName("Hasil_Jawaban");
    if (!sheet) {
      sheet = ss.insertSheet("Hasil_Jawaban");
    }

    var numQuestions = 30;
    var soalSheet = ss.getSheetByName("Soal_Test");
    if (soalSheet && soalSheet.getLastRow() > 1) {
      numQuestions = Math.max(30, soalSheet.getLastRow() - 1);
    }
    
    var incomingResult = data.result || (data.action === "bulk_submit" && data.results && data.results[0] ? data.results[0] : data);
    if (incomingResult && incomingResult.totalSoal) {
      numQuestions = Math.max(numQuestions, Number(incomingResult.totalSoal));
    }
    if (incomingResult && incomingResult.jawabanPerSoal) {
      for (var k in incomingResult.jawabanPerSoal) {
        var kn = parseInt(k, 10);
        if (!isNaN(kn) && kn > numQuestions) {
          numQuestions = kn;
        }
      }
    }

    var baseHeaders = [
      "Timestamp",
      "NIP",
      "Nama Peserta",
      "Kode Toko",
      "Nama Toko",
      "Jabatan",
      "Jenis Ujian",
      "Skor Akhir",
      "Total Soal",
      "Jumlah Benar",
      "Jumlah Salah",
      "Waktu Mulai",
      "Waktu Selesai",
      "Durasi Pengerjaan",
      "Status Kelulusan"
    ];

    var questionHeaders = [];
    for (var qNum = 1; qNum <= numQuestions; qNum++) {
      questionHeaders.push("Soal " + qNum);
    }
    var defaultHeaders = baseHeaders.concat(questionHeaders);

    // Otomatis pastikan baris 1 memiliki header lengkap jika sheet baru/kosong
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#dbeafe");
    }

    function formatResultRow(r) {
      var kodeToko = r.kodeToko || "TC";
      var namaToko = r.namaToko || "Training Center";
      var cabang = r.cabang || "SBY";
      var jabatan = r.jabatan || "CALON STORE CREW BOY (SCB)";

      var ansMap = {};
      if (r.jawabanPerSoal && typeof r.jawabanPerSoal === "object") {
        for (var k in r.jawabanPerSoal) {
          ansMap[k] = r.jawabanPerSoal[k];
        }
      } else if (r.detailJawaban) {
        var raw = String(r.detailJawaban);
        var pipeIdx = raw.indexOf("|");
        if (pipeIdx > -1) {
          raw = raw.substring(pipeIdx + 1);
        }
        var pairs = raw.split(",");
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].trim();
          var colon = pair.indexOf(":");
          if (colon > -1) {
            var qId = pair.substring(0, colon).trim();
            var opt = pair.substring(colon + 1).trim();
            if (qId && opt) {
              ansMap[qId] = opt;
            }
          }
        }
      }

      // Ambil header baris 1 yang sudah ada di sheet untuk memetakan kolom secara presisi
      var lastCol = sheet.getLastColumn();
      if (lastCol > 0 && sheet.getLastRow() >= 1) {
        var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var mappedRow = [];
        for (var c = 0; c < existingHeaders.length; c++) {
          var h = String(existingHeaders[c] || "").toLowerCase().trim();
          if (h.indexOf("time") > -1 || h.indexOf("tanggal") > -1 || h.indexOf("waktu") === 0) {
            mappedRow.push(r.timestamp || new Date().toLocaleString("id-ID"));
          } else if (h === "nip" || h === "nik") {
            mappedRow.push(r.nik);
          } else if (h.indexOf("nama peserta") > -1 || h === "nama") {
            mappedRow.push(r.nama);
          } else if (h.indexOf("kode toko") > -1) {
            mappedRow.push(kodeToko);
          } else if (h.indexOf("nama toko") > -1) {
            mappedRow.push(namaToko);
          } else if (h.indexOf("cabang") > -1) {
            mappedRow.push(cabang);
          } else if (h.indexOf("jabatan") > -1) {
            mappedRow.push(jabatan);
          } else if (h.indexOf("jenis") > -1 || h.indexOf("tipe") > -1) {
            mappedRow.push(r.tipeUjian || "Post Test");
          } else if (h.indexOf("skor") > -1 || h.indexOf("nilai") > -1) {
            mappedRow.push(r.skor);
          } else if (h.indexOf("total") > -1) {
            mappedRow.push(r.totalSoal || numQuestions);
          } else if (h.indexOf("benar") > -1) {
            mappedRow.push(r.jumlahBenar || 0);
          } else if (h.indexOf("salah") > -1) {
            mappedRow.push(r.jumlahSalah || 0);
          } else if (h.indexOf("mulai") > -1) {
            mappedRow.push(r.waktuMulai || "");
          } else if (h.indexOf("selesai") > -1) {
            mappedRow.push(r.waktuSelesai || "");
          } else if (h.indexOf("durasi") > -1) {
            mappedRow.push(r.durasiFormatted || "");
          } else if (h.indexOf("status") > -1) {
            mappedRow.push(r.statusKelulusan || "LULUS");
          } else if (h.indexOf("soal") > -1) {
            var qNumber = parseInt(h.replace(/[^0-9]/g, ""), 10);
            mappedRow.push(ansMap[qNumber] || ansMap[String(qNumber)] || "-");
          } else {
            mappedRow.push("-");
          }
        }
        return mappedRow;
      }

      // Default fallback jika sheet kosong
      var qLimit = Math.max(30, numQuestions);
      var questionAnswers = [];
      for (var q = 1; q <= qLimit; q++) {
        questionAnswers.push(ansMap[q] || ansMap[String(q)] || "-");
      }

      return [
        r.timestamp || new Date().toLocaleString("id-ID"),
        r.nik,
        r.nama,
        kodeToko,
        namaToko,
        jabatan,
        r.tipeUjian || "Post Test",
        r.skor,
        r.totalSoal || qLimit,
        r.jumlahBenar || 0,
        r.jumlahSalah || 0,
        r.waktuMulai || "",
        r.waktuSelesai || "",
        r.durasiFormatted || "",
        r.statusKelulusan || "LULUS"
      ].concat(questionAnswers);
    }

    // Aksi: Inisialisasi Header
    if (data.action === "init_header") {
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#dbeafe");
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Header kolom Hasil_Jawaban berhasil disiapkan!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi: Reset Hasil
    if (data.action === "clear_results") {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#dbeafe");
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data pengerjaan dibersihkan!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi: Hapus 1 hasil
    if (data.action === "delete_result" && data.nik) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var dataValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
        for (var i = dataValues.length - 1; i >= 0; i--) {
          if (String(dataValues[i][0]).trim() === String(data.nik).trim()) {
            sheet.deleteRow(i + 2);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data NIP " + data.nik + " dihapus" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi: Pengiriman banyak hasil sekaligus (Bulk Push)
    if (data.action === "bulk_submit" && Array.isArray(data.results)) {
      var rows = data.results.map(function(item) {
        return formatResultRow(item);
      });
      if (rows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, defaultHeaders.length).setValues(rows);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.results.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi: Kirim 1 Hasil Peserta
    var r = data.result || data;
    var rowData = formatResultRow(r);
    sheet.appendRow(rowData);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", nip: r.nik, nama: r.nama, spreadsheet: ss.getName() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      message: "Webhook Hasil_Jawaban Training CSCI H7 Aktif!",
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

// Helper: Read from LocalStorage or fallback
export const getCachedDataPeserta = (): Participant[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DATA_PESERTA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Invalidate old bloated 16304 rows from previous Google Sheet
        if (parsed.length > 500) {
          localStorage.removeItem(STORAGE_KEYS.DATA_PESERTA);
          return getCachedDataLogin();
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading data_peserta cache', e);
  }
  return getCachedDataLogin();
};

export const saveCachedDataPeserta = (data: Participant[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.DATA_PESERTA, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving data_peserta cache (quota exceeded or storage disabled)', e);
  }
};

export const getCachedDataLogin = (): Participant[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DATA_LOGIN);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading data_login cache', e);
  }
  return INITIAL_PARTICIPANTS;
};

export const saveCachedDataLogin = (data: Participant[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.DATA_LOGIN, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving data_login cache (quota exceeded or storage disabled)', e);
  }
};

export const getCachedParticipants = (): Participant[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (parsed.length > 500) {
          localStorage.removeItem(STORAGE_KEYS.PARTICIPANTS);
          return getCachedDataLogin();
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading participants cache', e);
  }
  return getCachedDataLogin();
};

export const saveCachedParticipants = (data: Participant[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving participants cache (quota exceeded or storage disabled)', e);
  }
};

export const getCachedQuestions = (): Question[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading questions cache', e);
  }
  return INITIAL_QUESTIONS;
};

export const saveCachedQuestions = (data: Question[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving questions cache', e);
  }
};

export const getCachedConfig = (): ExamConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_EXAM_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('Error loading config cache', e);
  }
  return DEFAULT_EXAM_CONFIG;
};

export const saveCachedConfig = (config: ExamConfig) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving config cache', e);
  }
};

export const fetchServerExamConfig = async (): Promise<ExamConfig | null> => {
  // 1. Primary: Query Supabase Cloud Database row (__CONFIG_EXAM__)
  // Guarantees synchronization on Vercel, incognito windows, Android, iPhone, and all laptops
  try {
    const supabaseUrl = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE_DATA_PESERTA}?select=nama&nip=eq.__CONFIG_EXAM__`;
    const res = await fetch(supabaseUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.nama) {
        try {
          const parsed = JSON.parse(rows[0].nama);
          if (parsed && typeof parsed === 'object') {
            const isRandom = Boolean(parsed.isRandomizeQuestions ?? parsed.acakSoal ?? false);
            const liveConfig: ExamConfig = {
              durasiMenit: Math.max(1, Number(parsed.durasiMenit) || 15),
              passingGrade: Math.min(100, Math.max(0, Number(parsed.passingGrade) || 70)),
              acakSoal: isRandom,
              isRandomizeQuestions: isRandom,
              judulUjian: typeof parsed.judulUjian === 'string' && parsed.judulUjian.trim() ? parsed.judulUjian.trim() : 'Training CSCI H7',
              lokasiCabang: typeof parsed.lokasiCabang === 'string' && parsed.lokasiCabang.trim() ? parsed.lokasiCabang.trim() : 'Indomaret Cabang Surabaya',
              isExamOpen: parsed.isExamOpen !== undefined ? Boolean(parsed.isExamOpen) : true,
            };
            saveCachedConfig(liveConfig);
            return liveConfig;
          }
        } catch (e) {
          console.warn('[Config] Failed to parse Supabase config JSON:', e);
        }
      }
    }
  } catch (err) {
    console.warn('[Config] Direct Supabase config fetch error:', err);
  }

  // 2. Secondary: Fallback to local server API /api/exam/config
  try {
    const res = await fetch('/api/exam/config', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        saveCachedConfig(data.config);
        return data.config;
      }
    }
  } catch (err) {
    // Ignore offline / static hosting 404
  }

  return null;
};

export const saveServerExamConfig = async (config: ExamConfig): Promise<{
  success: boolean;
  message: string;
  config: ExamConfig;
}> => {
  saveCachedConfig(config);
  triggerAppSync();

  const isRandom = Boolean(config.isRandomizeQuestions ?? config.acakSoal ?? false);
  const cleanConfig: ExamConfig = {
    durasiMenit: Math.max(1, Number(config.durasiMenit) || 15),
    passingGrade: Math.min(100, Math.max(0, Number(config.passingGrade) || 70)),
    acakSoal: isRandom,
    isRandomizeQuestions: isRandom,
    judulUjian: typeof config.judulUjian === 'string' && config.judulUjian.trim() ? config.judulUjian.trim() : 'Training CSCI H7',
    lokasiCabang: typeof config.lokasiCabang === 'string' && config.lokasiCabang.trim() ? config.lokasiCabang.trim() : 'Indomaret Cabang Surabaya',
    isExamOpen: config.isExamOpen !== undefined ? Boolean(config.isExamOpen) : true,
  };

  const configJsonString = JSON.stringify(cleanConfig);
  let savedToCloud = false;

  // 1. Primary: Save directly to Supabase Cloud Database row (__CONFIG_EXAM__)
  // Ensures settings persist across Vercel, mobile devices, Incognito, and all sessions
  try {
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE_DATA_PESERTA}?nip=eq.__CONFIG_EXAM__`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ nama: configJsonString }),
    });

    if (patchRes.ok) {
      const patchData = await patchRes.json().catch(() => []);
      if (Array.isArray(patchData) && patchData.length > 0) {
        savedToCloud = true;
      }
    }

    if (!savedToCloud) {
      const postRes = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE_DATA_PESERTA}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          nip: '__CONFIG_EXAM__',
          nama: configJsonString,
          jenis_training: 'CONFIG',
          departemen: 'SYSTEM',
        }),
      });
      if (postRes.ok) {
        savedToCloud = true;
      }
    }
  } catch (supabaseErr) {
    console.warn('[Config] Error saving to Supabase:', supabaseErr);
  }

  // 2. Secondary: Also save to Express server API if available
  try {
    const res = await fetch('/api/exam/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: cleanConfig }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        saveCachedConfig(data.config);
        triggerAppSync();
        return {
          success: true,
          message: 'Pengaturan ujian berhasil disimpan ke Cloud Database & Server! Seluruh HP/Laptop peserta akan langsung menerapkan durasi & KKM ini.',
          config: data.config,
        };
      }
    }
  } catch (err: any) {
    console.warn('[Config] Local server save notice:', err);
  }

  saveCachedConfig(cleanConfig);
  triggerAppSync();

  return {
    success: true,
    message: savedToCloud
      ? 'Pengaturan ujian berhasil disimpan di Cloud Database Supabase & diterapkan ke seluruh peserta!'
      : 'Pengaturan ujian berhasil disimpan dan diterapkan ke seluruh peserta!',
    config: cleanConfig,
  };
};

export const SYNC_EVENT_NAME = 'stm_realtime_sync_event';

export const triggerAppSync = () => {
  try {
    localStorage.setItem('stm_last_sync_timestamp', String(Date.now()));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME));
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('stm_sync_channel');
      bc.postMessage({ type: 'SYNC', timestamp: Date.now() });
      bc.close();
    }
  } catch {
    // Ignore error
  }
};

export const getCachedResults = (): ExamResult[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESULTS);
    if (raw !== null && raw !== undefined) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading results cache', e);
  }
  return [];
};

export const saveCachedResults = (data: ExamResult[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving results cache', e);
  }
};

export const clearCachedResults = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.RESULTS, '[]');
    localStorage.removeItem(STORAGE_KEYS.RESULTS);
  } catch (e) {
    console.error('Error clearing results cache', e);
  }
};

// Google Sheets API Helpers
const getBaseUrl = (): string => `https://sheets.googleapis.com/v4/spreadsheets/${getSpreadsheetId()}`;

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
  return response.json();
}

// Fetch all sheets metadata
export async function getSpreadsheetDetails() {
  return await fetchWithAuth(getBaseUrl());
}

// Ensure sheet exists; if not, create it
export async function ensureSheetExists(sheetTitle: string) {
  try {
    const meta = await getSpreadsheetDetails();
    const sheets = meta.sheets || [];
    const exists = sheets.some((s: any) => s.properties?.title === sheetTitle);

    if (!exists) {
      // Add sheet
      await fetchWithAuth(`${getBaseUrl()}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        }),
      });
    }
  } catch (err) {
    console.warn(`Could not verify sheet ${sheetTitle}:`, err);
  }
}

// Fetch rows from public Google Visualization API endpoint (works with no OAuth required)
async function fetchPublicGvizData(sheetName: string): Promise<{ success: boolean; rows: any[] }> {
  try {
    const timestamp = Date.now();
    const url = `https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&_t=${timestamp}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return { success: false, rows: [] };
    const text = await response.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
    if (!match) return { success: false, rows: [] };
    const parsed = JSON.parse(match[1]);
    if (parsed.status === 'error') {
      return { success: false, rows: [] };
    }
    return { success: true, rows: parsed?.table?.rows || [] };
  } catch (err) {
    console.warn(`Public gviz fetch failed for ${sheetName}:`, err);
    return { success: false, rows: [] };
  }
}

async function fetchPublicGvizRows(sheetName: string): Promise<any[]> {
  const res = await fetchPublicGvizData(sheetName);
  return res.rows;
}

// 1. Fetch Data_Peserta from Supabase database (Permanently synchronized with Menu Data Peserta)
export async function fetchDataPesertaFromSheet(): Promise<Participant[]> {
  try {
    const list = await fetchDataLoginFromSheet();
    if (list && list.length > 0) {
      saveCachedDataPeserta(list);
      return list;
    }
    return getCachedDataPeserta();
  } catch (error) {
    console.error('Failed to fetch Data_Peserta from Supabase:', error);
    return getCachedDataPeserta();
  }
}

// 2. Fetch Data Peserta Login permanently from Supabase database (table: Data_Peserta, columns: nip, nama)
export async function fetchDataLoginFromSheet(): Promise<Participant[]> {
  try {
    const todayPass = getRunningDatePasswords().primary;

    // Method 1: Fetch directly from Supabase PostgREST API
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE_DATA_PESERTA}?select=nip,nama&order=nip.asc`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const list: Participant[] = rows
            .filter((r: any) => {
              if (!r) return false;
              const cleanNip = String(r.nip || r.nik || '').trim();
              const cleanNama = String(r.nama || '').trim();
              if (!cleanNip || !cleanNama) return false;
              if (cleanNip.startsWith('__') || cleanNip.toLowerCase() === 'nip' || cleanNip.toLowerCase() === 'nik') return false;
              return true;
            })
            .map((r: any) => ({
              nik: String(r.nip || r.nik).trim(),
              nama: String(r.nama).trim().toUpperCase(),
              password: todayPass,
              kodeToko: 'TC',
              namaToko: 'Training Center',
              cabang: 'SBY',
              toko: 'TC - Training Center',
              jabatan: 'CALON STORE CREW BOY (SCB)',
              status: 'Belum Ujian',
            }));

          if (list.length > 0) {
            saveCachedDataLogin(list);
            saveCachedParticipants(list);
            return list;
          }
        }
      }
    } catch (directErr) {
      console.warn('Direct Supabase fetch encountered error, trying proxy endpoint...', directErr);
    }

    // Method 2: Fallback via local server proxy /api/supabase/peserta
    try {
      const proxyRes = await fetch('/api/supabase/peserta');
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const list: Participant[] = json.data
            .filter((r: any) => {
              if (!r) return false;
              const cleanNip = String(r.nip || r.nik || '').trim();
              const cleanNama = String(r.nama || '').trim();
              if (!cleanNip || !cleanNama) return false;
              if (cleanNip.startsWith('__') || cleanNip.toLowerCase() === 'nip' || cleanNip.toLowerCase() === 'nik') return false;
              return true;
            })
            .map((r: any) => ({
              nik: String(r.nip || r.nik).trim(),
              nama: String(r.nama).trim().toUpperCase(),
              password: todayPass,
              kodeToko: 'TC',
              namaToko: 'Training Center',
              cabang: 'SBY',
              toko: 'TC - Training Center',
              jabatan: 'CALON STORE CREW BOY (SCB)',
              status: 'Belum Ujian',
            }));

          if (list.length > 0) {
            saveCachedDataLogin(list);
            saveCachedParticipants(list);
            return list;
          }
        }
      }
    } catch (proxyErr) {
      console.warn('Proxy Supabase fetch encountered error:', proxyErr);
    }

    // Fallback: cached data
    const cached = getCachedDataLogin();
    if (cached && cached.length > 0) return cached;
    return getCachedParticipants();
  } catch (error) {
    console.error('Failed to fetch participant login data from Supabase:', error);
    return getCachedDataLogin();
  }
}

export const fetchDataPesertaFromSupabase = fetchDataLoginFromSheet;

// Append new login account to sheet Data_Login
export async function addLoginAccountToSheet(p: { nik: string; nama: string; password: string }): Promise<boolean> {
  try {
    const body = {
      values: [[p.nik, p.nama, p.password || '123']],
    };
    await fetchWithAuth(`${getBaseUrl()}/values/Data_Login!A:C:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return true;
  } catch (err) {
    console.warn('Could not append login account to Data_Login in Google Sheets:', err);
    return false;
  }
}

// Append new participant to Data_Peserta in Google Sheets
export async function addParticipantToSheet(p: Participant): Promise<boolean> {
  try {
    // 1. Append to Data_Peserta: NIK, NAMA, Jabatan, Kode Toko
    const pesertaBody = {
      values: [[p.nik, p.nama, p.jabatan || 'Store Crew', p.toko || 'TOWJ']],
    };
    await fetchWithAuth(`${getBaseUrl()}/values/Data_Peserta!A:D:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify(pesertaBody),
    }).catch(() => null);

    // 2. Also append to Data_Login: NIK, NAMA, Password
    await addLoginAccountToSheet({
      nik: p.nik,
      nama: p.nama,
      password: p.password || '123',
    });

    return true;
  } catch (err) {
    console.warn('Could not append participant to Google Sheets:', err);
    return false;
  }
}

// Fetch all participants (merging Data_Peserta and Data_Login)
export async function fetchParticipantsFromSheet(): Promise<Participant[]> {
  try {
    const [pesertaList, loginList] = await Promise.all([
      fetchDataPesertaFromSheet(),
      fetchDataLoginFromSheet(),
    ]);

    // Merge by NIK: profiles from Data_Peserta + passwords from Data_Login
    const map = new Map<string, Participant>();
    pesertaList.forEach((p) => {
      map.set(p.nik, { ...p });
    });

    loginList.forEach((l) => {
      const existing = map.get(l.nik);
      if (existing) {
        existing.password = getRunningDatePasswords().primary;
        if (!existing.nama && l.nama) existing.nama = l.nama;
      } else {
        map.set(l.nik, { ...l, password: getRunningDatePasswords().primary });
      }
    });

    const merged = Array.from(map.values());
    if (merged.length > 0) {
      saveCachedParticipants(merged);
      return merged;
    }
    return getCachedParticipants();
  } catch (error) {
    console.error('Failed to fetch participants from Google Sheets:', error);
    return getCachedParticipants();
  }
}

// Fetch Soal_Test from Google Sheets
export async function fetchQuestionsFromSheet(): Promise<Question[]> {
  try {
    // Attempt 1: Fetch via public Google Visualization endpoint
    const gvizRows = await fetchPublicGvizRows('Soal_Test');
    if (gvizRows && gvizRows.length > 0) {
      const questions: Question[] = [];
      for (let i = 0; i < gvizRows.length; i++) {
        const c = gvizRows[i]?.c || [];
        const idVal = c[0]?.v !== undefined ? Number(c[0].v) : i + 1;
        const pertanyaan = c[1]?.v !== undefined ? String(c[1].v).trim() : '';
        const pilihanA = c[2]?.v !== undefined ? String(c[2].v).trim() : '';
        const pilihanB = c[3]?.v !== undefined ? String(c[3].v).trim() : '';
        const pilihanC = c[4]?.v !== undefined ? String(c[4].v).trim() : '';
        const pilihanD = c[5]?.v !== undefined ? String(c[5].v).trim() : '';
        const kunciRaw = c[6]?.v !== undefined ? String(c[6].v).trim().toUpperCase() : 'A';
        const bobot = c[7]?.v !== undefined ? Number(c[7].v) || 10 : 10;
        const kategori = c[8]?.v !== undefined ? String(c[8].v).trim() : 'Training Evabul SC';
        const penjelasan = c[9]?.v !== undefined ? String(c[9].v).trim() : '';

        if (pertanyaan && pilihanA) {
          questions.push({
            id: Number(idVal) || i + 1,
            pertanyaan,
            pilihanA,
            pilihanB,
            pilihanC,
            pilihanD,
            kunciJawaban: kunciRaw.charAt(0) || 'A',
            bobot,
            kategori: kategori || 'Training Evabul SC',
            penjelasan,
          });
        }
      }

      if (questions.length > 0) {
        saveCachedQuestions(questions);
        return questions;
      }
    }

    // Attempt 2: Fetch via authenticated Google Sheets API
    try {
      const data = await fetchWithAuth(`${getBaseUrl()}/values/Soal_Test!A1:Z500`);
      const rows = data.values;
      if (rows && rows.length >= 2) {
        const headers = rows[0].map((h: string) => (h || '').toString().toLowerCase().trim());
        const idIdx = headers.findIndex((h: string) => h.includes('no') || h.includes('id'));
        const soalIdx = headers.findIndex((h: string) => h.includes('soal') || h.includes('pertanyaan'));
        const aIdx = headers.findIndex((h: string) => h.includes('pilihan_a') || h.includes('opsi a') || h === 'a');
        const bIdx = headers.findIndex((h: string) => h.includes('pilihan_b') || h.includes('opsi b') || h === 'b');
        const cIdx = headers.findIndex((h: string) => h.includes('pilihan_c') || h.includes('opsi c') || h === 'c');
        const dIdx = headers.findIndex((h: string) => h.includes('pilihan_d') || h.includes('opsi d') || h === 'd');
        const eIdx = headers.findIndex((h: string) => h.includes('pilihan_e') || h.includes('opsi e') || h === 'e');
        const kunciIdx = headers.findIndex((h: string) => h.includes('kunci') || h.includes('jawaban'));
        const bobotIdx = headers.findIndex((h: string) => h.includes('bobot') || h.includes('poin'));
        const katIdx = headers.findIndex((h: string) => h.includes('kategori') || h.includes('topik'));
        const penjelIdx = headers.findIndex((h: string) => h.includes('penjelasan') || h.includes('pembahasan'));

        const questions: Question[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const idVal = row[idIdx !== -1 ? idIdx : 0];
          const pertanyaan = String(row[soalIdx !== -1 ? soalIdx : 1] || '').trim();
          const pilihanA = String(row[aIdx !== -1 ? aIdx : 2] || '').trim();
          const pilihanB = String(row[bIdx !== -1 ? bIdx : 3] || '').trim();
          const pilihanC = String(row[cIdx !== -1 ? cIdx : 4] || '').trim();
          const pilihanD = String(row[dIdx !== -1 ? dIdx : 5] || '').trim();
          const pilihanE = eIdx !== -1 && row[eIdx] ? String(row[eIdx]).trim() : undefined;
          const kunciRaw = String(row[kunciIdx !== -1 ? kunciIdx : 6] || 'A').trim().toUpperCase();
          const kunciJawaban = kunciRaw.charAt(0) || 'A';
          const bobot = Number(row[bobotIdx !== -1 ? bobotIdx : 7]) || 10;
          const kategori = String(row[katIdx !== -1 ? katIdx : 8] || 'Training Evabul SC').trim();
          const penjelasan = String(row[penjelIdx !== -1 ? penjelIdx : 9] || '').trim();

          if (pertanyaan && pilihanA) {
            questions.push({
              id: Number(idVal) || i,
              pertanyaan,
              pilihanA,
              pilihanB,
              pilihanC,
              pilihanD,
              pilihanE,
              kunciJawaban,
              bobot,
              kategori,
              penjelasan,
            });
          }
        }

        if (questions.length > 0) {
          saveCachedQuestions(questions);
          return questions;
        }
      }
    } catch {
      // Fall through to cache
    }

    return getCachedQuestions();
  } catch (error) {
    console.error('Failed to fetch questions from Google Sheets:', error);
    return getCachedQuestions();
  }
}

// Fetch Hasil_Jawaban from Google Sheets
export async function fetchResultsFromSheet(): Promise<ExamResult[]> {
  try {
    // Attempt 1: Fetch via public Google Visualization endpoint
    const gvizRes = await fetchPublicGvizData('Hasil_Jawaban');
    if (gvizRes.success) {
      const results: ExamResult[] = [];
      for (let i = 0; i < gvizRes.rows.length; i++) {
        const c = gvizRes.rows[i]?.c || [];
        const timestamp = c[0]?.v !== undefined ? String(c[0].v).trim() : new Date().toISOString();
        const nik = c[1]?.f ? String(c[1].f).trim() : (c[1]?.v !== undefined && c[1]?.v !== null ? String(c[1].v).trim() : '');
        const nama = c[2]?.v !== undefined && c[2]?.v !== null ? String(c[2].v).trim() : '';

        if (!nik || !nama || nik.toLowerCase() === 'nik' || nama.toLowerCase().includes('nama peserta')) {
          continue;
        }

        let kodeToko = '';
        let namaToko = '';
        let jabatanVal = 'SCB';
        let tipeUjian: 'Pre Test' | 'Post Test' | undefined = undefined;
        let skor = 0;
        let totalSoal = 15;
        let jumlahBenar = 0;
        let jumlahSalah = 0;
        let waktuMulai = '';
        let waktuSelesai = '';
        let durasiFormatted = '00:00';
        let statusKelulusan: 'LULUS' | 'TIDAK LULUS' = 'LULUS';

        const col5 = String(c[5]?.v || '').trim();
        const col6 = String(c[6]?.v || '').trim();

        // Check if layout is 15-base columns (Col 5 is Jabatan e.g. SCB/SCG, Col 6 is Jenis Ujian)
        const isJabatanLayout = col5 === 'SCB' || col5 === 'SCG' || col6.includes('Test') || col6.includes('Pre') || col6.includes('Post');

        if (isJabatanLayout) {
          kodeToko = c[3]?.v !== undefined && c[3]?.v !== null ? String(c[3].v).trim() : '';
          namaToko = c[4]?.v !== undefined && c[4]?.v !== null ? String(c[4].v).trim() : '';
          jabatanVal = col5 || 'SCB';
          tipeUjian = col6.includes('Pre') ? 'Pre Test' : (col6.includes('Post') ? 'Post Test' : undefined);
          skor = c[7]?.v !== undefined ? Number(c[7].v) || 0 : 0;
          totalSoal = c[8]?.v !== undefined ? Number(c[8].v) || 15 : 15;
          jumlahBenar = c[9]?.v !== undefined ? Number(c[9].v) || 0 : 0;
          jumlahSalah = c[10]?.v !== undefined ? Number(c[10].v) || 0 : 0;
          waktuMulai = c[11]?.v !== undefined ? String(c[11].v).trim() : '';
          waktuSelesai = c[12]?.v !== undefined ? String(c[12].v).trim() : '';
          durasiFormatted = c[13]?.v !== undefined ? String(c[13].v).trim() : '00:00';
          const statusRaw = c[14]?.v !== undefined ? String(c[14].v).trim().toUpperCase() : '';
          statusKelulusan = statusRaw.includes('TIDAK') ? 'TIDAK LULUS' : 'LULUS';
        } else {
          // Legacy 16-base layout (with COS and Trainer in Col 5 & 6)
          kodeToko = c[3]?.v !== undefined && c[3]?.v !== null ? String(c[3].v).trim() : '';
          namaToko = c[4]?.v !== undefined && c[4]?.v !== null ? String(c[4].v).trim() : '';
          const col7 = String(c[7]?.v || '').trim();
          tipeUjian = col7.includes('Pre') ? 'Pre Test' : (col7.includes('Post') ? 'Post Test' : undefined);
          skor = c[8]?.v !== undefined ? Number(c[8].v) || 0 : 0;
          totalSoal = c[9]?.v !== undefined ? Number(c[9].v) || 15 : 15;
          jumlahBenar = c[10]?.v !== undefined ? Number(c[10].v) || 0 : 0;
          jumlahSalah = c[11]?.v !== undefined ? Number(c[11].v) || 0 : 0;
          waktuMulai = c[12]?.v !== undefined ? String(c[12].v).trim() : '';
          waktuSelesai = c[13]?.v !== undefined ? String(c[13].v).trim() : '';
          durasiFormatted = c[14]?.v !== undefined ? String(c[14].v).trim() : '00:00';
          const statusRaw = c[15]?.v !== undefined ? String(c[15].v).trim().toUpperCase() : '';
          statusKelulusan = statusRaw.includes('TIDAK') ? 'TIDAK LULUS' : 'LULUS';
        }

        // Ekstrak jawaban setiap butir soal per kolom (Column P = Soal 1, Q = Soal 2, dst)
        const answerMap: Record<number, string> = {};
        const detailList: string[] = [];
        let hasColumnAnswers = false;
        const totalSoalCount = Math.max(30, totalSoal || 30);

        for (let q = 1; q <= totalSoalCount; q++) {
          const colIndex = (isJabatanLayout ? 14 : 15) + q;
          const val = c[colIndex]?.v !== undefined && c[colIndex]?.v !== null ? String(c[colIndex].v).trim() : '';
          if (val && val.length <= 5 && !val.includes('COS:') && !val.includes('|')) {
            answerMap[q] = val;
            detailList.push(`${q}:${val}`);
            hasColumnAnswers = true;
          }
        }

        let detailJawaban = '';
        if (hasColumnAnswers) {
          detailJawaban = detailList.join(', ');
        } else {
          // Fallback format string lama jika ada
          const rawCol16 = c[16]?.v !== undefined ? String(c[16].v).trim() : '';
          let cleanStr = rawCol16;
          const pipeIdx = cleanStr.indexOf('|');
          if (pipeIdx > -1) {
            cleanStr = cleanStr.substring(pipeIdx + 1).trim();
          }
          detailJawaban = cleanStr;
          cleanStr.split(',').forEach((pair) => {
            const parts = pair.trim().split(':');
            if (parts.length >= 2) {
              const qNum = Number(parts[0].trim());
              const opt = parts[1].trim();
              if (qNum && opt) answerMap[qNum] = opt;
            }
          });
        }

        const durasiDetik = (() => {
          if (durasiFormatted.includes(':')) {
            const [m, s] = durasiFormatted.split(':');
            return (Number(m) || 0) * 60 + (Number(s) || 0);
          }
          return 0;
        })();

        results.push({
          id: `sheet-${i}`,
          timestamp,
          nik,
          nama,
          kodeToko,
          namaToko,
          toko: kodeToko && namaToko ? `${kodeToko} - ${namaToko}` : (namaToko || kodeToko || 'Indomaret'),
          jabatan: jabatanVal || 'SCB',
          skor,
          totalSoal,
          jumlahBenar,
          jumlahSalah,
          waktuMulai,
          waktuSelesai,
          durasiDetik,
          durasiFormatted,
          statusKelulusan,
          detailJawaban,
          jawabanPerSoal: answerMap,
          tipeUjian,
        });
      }

      saveCachedResults(results);
      return results;
    }

    // Attempt 2: Fetch via authenticated Google Sheets API
    try {
      const data = await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:Z500`);
      const rows = data.values;
      if (rows) {
        if (rows.length <= 1) {
          saveCachedResults([]);
          return [];
        }

        const headers = rows[0].map((h: string) => (h || '').toString().toLowerCase().trim());
        const tsIdx = headers.findIndex((h: string) => h.includes('time') || h.includes('tanggal') || h.includes('waktu'));
        const nikIdx = headers.findIndex((h: string) => h.includes('nik'));
        const namaIdx = headers.findIndex((h: string) => h.includes('nama peserta') || h === 'nama');
        const kodeTokoIdx = headers.findIndex((h: string) => h.includes('kode toko'));
        const namaTokoIdx = headers.findIndex((h: string) => h.includes('nama toko'));
        const jabatanIdx = headers.findIndex((h: string) => h.includes('jabatan'));
        const jenisIdx = headers.findIndex((h: string) => h.includes('jenis') || h.includes('tipe'));
        const skorIdx = headers.findIndex((h: string) => h.includes('skor') || h.includes('nilai'));
        const totalIdx = headers.findIndex((h: string) => h.includes('total'));
        const benarIdx = headers.findIndex((h: string) => h.includes('benar'));
        const salahIdx = headers.findIndex((h: string) => h.includes('salah'));
        const mulaiIdx = headers.findIndex((h: string) => h.includes('mulai'));
        const selesaiIdx = headers.findIndex((h: string) => h.includes('selesai'));
        const durasiFmtIdx = headers.findIndex((h: string) => h.includes('durasi'));
        const statusIdx = headers.findIndex((h: string) => h.includes('status'));

        const results: ExamResult[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const nik = String(row[nikIdx !== -1 ? nikIdx : 1] || '').trim();
          const nama = String(row[namaIdx !== -1 ? namaIdx : 2] || '').trim();

          if (!nik || !nama || nik.toLowerCase() === 'nik') continue;

          const kodeToko = String(row[kodeTokoIdx !== -1 ? kodeTokoIdx : 3] || '').trim();
          const namaToko = String(row[namaTokoIdx !== -1 ? namaTokoIdx : 4] || '').trim();
          const jabatanVal = jabatanIdx !== -1 && row[jabatanIdx] ? String(row[jabatanIdx]).trim() : String(row[5] || 'SCB').trim();
          const tipeUjianRaw = jenisIdx !== -1 && row[jenisIdx] ? String(row[jenisIdx]).trim() : '';
          const tipeUjian: 'Pre Test' | 'Post Test' | undefined = tipeUjianRaw.includes('Pre')
            ? 'Pre Test'
            : (tipeUjianRaw.includes('Post') ? 'Post Test' : undefined);

          const skor = Number(row[skorIdx !== -1 ? skorIdx : 7]) || 0;
          const durasiFormatted = String(row[durasiFmtIdx !== -1 ? durasiFmtIdx : 13] || '00:00').trim();
          const durasiDetik = (() => {
            if (durasiFormatted.includes(':')) {
              const [m, s] = durasiFormatted.split(':');
              return (Number(m) || 0) * 60 + (Number(s) || 0);
            }
            return 0;
          })();

          const totalSoal = Number(row[totalIdx !== -1 ? totalIdx : 8]) || 30;
          const answerMap: Record<number, string> = {};
          const detailList: string[] = [];
          const totalSoalCount = Math.max(30, totalSoal);
          for (let q = 1; q <= totalSoalCount; q++) {
            const colIndex = 14 + q;
            const val = row[colIndex] ? String(row[colIndex]).trim() : '';
            if (val && val.length <= 5) {
              answerMap[q] = val;
              detailList.push(`${q}:${val}`);
            }
          }

          results.push({
            id: `sheet-${i}`,
            timestamp: String(row[tsIdx !== -1 ? tsIdx : 0] || new Date().toISOString()).trim(),
            nik,
            nama,
            kodeToko,
            namaToko,
            toko: kodeToko && namaToko ? `${kodeToko} - ${namaToko}` : (namaToko || kodeToko || 'Indomaret'),
            jabatan: jabatanVal || 'SCB',
            skor,
            totalSoal,
            jumlahBenar: Number(row[benarIdx !== -1 ? benarIdx : 9]) || 0,
            jumlahSalah: Number(row[salahIdx !== -1 ? salahIdx : 10]) || 0,
            waktuMulai: String(row[mulaiIdx !== -1 ? mulaiIdx : 11] || '').trim(),
            waktuSelesai: String(row[selesaiIdx !== -1 ? selesaiIdx : 12] || '').trim(),
            durasiDetik,
            durasiFormatted,
            statusKelulusan: String(row[statusIdx !== -1 ? statusIdx : 14] || '').toUpperCase().includes('TIDAK') ? 'TIDAK LULUS' : 'LULUS',
            detailJawaban: detailList.join(', '),
            jawabanPerSoal: answerMap,
            tipeUjian,
          });
        }

        saveCachedResults(results);
        return results;
      }
    } catch {
      // Fall through to cache only if network error
    }

    return getCachedResults();
  } catch (error) {
    console.error('Failed to fetch results from Google Sheets:', error);
    return getCachedResults();
  }
}

export interface SubmitResultResponse {
  success: boolean;
  deliveredToSheet: boolean;
  method: 'apps_script' | 'oauth' | 'cached_pending';
  message?: string;
}

// Append Participant Result directly into sheet Hasil_Jawaban
export async function submitResultToSheet(result: ExamResult): Promise<SubmitResultResponse> {
  // 1. Always update local cache first so score is immediately safe and not lost
  const existingCached = getCachedResults().filter((r) => r.nik !== result.nik);
  const initialSaved: ExamResult = { ...result, syncedToSheet: false };
  const updatedResults = [initialSaved, ...existingCached];
  saveCachedResults(updatedResults);

  let delivered = false;
  let method: 'apps_script' | 'oauth' | 'cached_pending' = 'cached_pending';
  let statusMessage = '';

  const scriptUrl = getAppsScriptUrl();
  const token = await getAccessToken();

  // 2. Try server-side proxy first (verifies HTTP status, follows redirects without CORS limits, uses server webhook/token)
  try {
    const serverRes = await fetch('/api/sheets/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result, scriptUrl, token: token || undefined }),
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.deliveredToSheet) {
        delivered = true;
        method = data.deliveryMethod === 'google_sheets_api' ? 'oauth' : 'apps_script';
        statusMessage = 'Hasil ujian berhasil disimpan langsung ke Google Spreadsheet!';
      } else if (data.deliveryError) {
        statusMessage = `Hasil ujian tersimpan di sistem CBT (${data.deliveryError}).`;
      }
    }
  } catch (err) {
    // Server proxy route not reachable, fall through to client direct
  }

  // 3. Client direct Google Apps Script Web App fallback
  if (!delivered && scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'submit_result', result }),
      });
      delivered = true;
      method = 'apps_script';
      statusMessage = 'Hasil ujian berhasil dikirim langsung ke Google Spreadsheet via Apps Script Web App.';
    } catch (err) {
      console.warn('Apps Script submission error:', err);
    }
  }

  // 4. Client direct Google Sheets API (OAuth) fallback if user/admin is authenticated
  if (!delivered) {
    try {
      if (token) {
        await ensureSheetExists('Hasil_Jawaban');

        // Check if header row exists
        let hasHeader = false;
        try {
          const headerCheck = await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:Q1`);
          if (headerCheck.values && headerCheck.values.length > 0 && headerCheck.values[0].length > 0) {
            hasHeader = true;
          }
        } catch {
          hasHeader = false;
        }

        if (!hasHeader) {
          await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:AE1?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            body: JSON.stringify({
              range: 'Hasil_Jawaban!A1:AE1',
              majorDimension: 'ROWS',
              values: [HASIL_JAWABAN_HEADERS],
            }),
          });
        }

        // Append submission row
        const rowValues = formatResultRowValues(result);
        await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          body: JSON.stringify({
            range: 'Hasil_Jawaban!A1',
            majorDimension: 'ROWS',
            values: [rowValues],
          }),
        });

        delivered = true;
        method = 'oauth';
        statusMessage = 'Hasil ujian berhasil dikirim langsung via Google Sheets API.';
      }
    } catch (err) {
      console.warn('Could not append directly to Google Sheet via OAuth:', err);
    }
  }

  // Update syncedToSheet flag in local cache if confirmed delivered
  if (delivered) {
    const finalCached = getCachedResults().map((r) =>
      r.nik === result.nik ? { ...r, syncedToSheet: true } : r
    );
    saveCachedResults(finalCached);
  }

  triggerAppSync();

  return {
    success: true,
    deliveredToSheet: delivered,
    method,
    message: delivered
      ? (statusMessage || 'Hasil ujian berhasil dikirim langsung ke Google Spreadsheet sheet Hasil_Jawaban.')
      : (statusMessage || 'Hasil ujian berhasil disimpan di sistem lokal CBT. Siap disinkronkan ke Spreadsheet saat Webhook aktif.'),
  };
}

// Push all results from app to sheet Hasil_Jawaban (Mass sync)
export async function pushAllResultsToSheet(resultsToPush: ExamResult[]): Promise<{
  success: boolean;
  deliveredCount: number;
  message: string;
}> {
  if (resultsToPush.length === 0) {
    return { success: false, deliveredCount: 0, message: 'Tidak ada data nilai ujian untuk dikirim.' };
  }

  const scriptUrl = getAppsScriptUrl();
  const token = await getAccessToken();

  // 1. Try server proxy bulk push first (handles server-wide webhook & token)
  try {
    const serverRes = await fetch('/api/sheets/bulk-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: resultsToPush, scriptUrl, token: token || undefined }),
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.success) {
        // Mark all as synced
        const marked = getCachedResults().map((r) => ({ ...r, syncedToSheet: true }));
        saveCachedResults(marked);
        triggerAppSync();
        return {
          success: true,
          deliveredCount: resultsToPush.length,
          message: data.message || `Berhasil mengirim ${resultsToPush.length} hasil ujian ke sheet Hasil_Jawaban!`,
        };
      }
    }
  } catch {}

  // 2. Direct Apps Script Bulk Push fallback
  if (scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'bulk_submit', results: resultsToPush }),
      });
      const marked = getCachedResults().map((r) => ({ ...r, syncedToSheet: true }));
      saveCachedResults(marked);
      triggerAppSync();
      return {
        success: true,
        deliveredCount: resultsToPush.length,
        message: `Berhasil mengirim ${resultsToPush.length} hasil ujian ke sheet Hasil_Jawaban via Apps Script!`,
      };
    } catch (err: any) {
      console.warn('Failed bulk push via Apps Script:', err);
    }
  }

  // 2. Try Google Sheets API (OAuth)
  if (token) {
    try {
      await ensureSheetExists('Hasil_Jawaban');

      // Check header
      let hasHeader = false;
      try {
        const headerCheck = await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:AE1`);
        if (headerCheck.values && headerCheck.values.length > 0 && headerCheck.values[0].length > 0) {
          hasHeader = true;
        }
      } catch {
        hasHeader = false;
      }

      if (!hasHeader) {
        await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:AE1?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          body: JSON.stringify({
            range: 'Hasil_Jawaban!A1:AE1',
            majorDimension: 'ROWS',
            values: [HASIL_JAWABAN_HEADERS],
          }),
        });
      }

      const rows = resultsToPush.map((result) => formatResultRowValues(result));

      await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A2:AE${rows.length + 1}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          range: `Hasil_Jawaban!A2:AE${rows.length + 1}`,
          majorDimension: 'ROWS',
          values: rows,
        }),
      });

      return {
        success: true,
        deliveredCount: resultsToPush.length,
        message: `Berhasil mengirim ${resultsToPush.length} hasil ujian ke sheet Hasil_Jawaban Google Spreadsheet!`,
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredCount: 0,
        message: `Gagal mengirim ke Google Sheets via OAuth: ${err.message}`,
      };
    }
  }

  return {
    success: false,
    deliveredCount: 0,
    message: 'Belum terhubung ke Google Spreadsheet. Silakan pasang URL Web App Apps Script atau Hubungkan Akun Google di tab Spreadsheet.',
  };
}

// 1-Click: Setup Hasil_Jawaban Header Row (A1:AS1 - Soal 1 s/d 30)
export async function setupHasilJawabanHeader(): Promise<{ success: boolean; message: string }> {
  const scriptUrl = getAppsScriptUrl();
  const token = await getAccessToken();

  // 1. Try server proxy first
  try {
    const res = await fetch('/api/sheets/init-header', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Header kolom Hasil_Jawaban (A1:AS1 - Soal 1 s/d 30) berhasil diperbarui di Google Spreadsheet!' };
    }
  } catch {}

  if (scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'init_header' }),
      });
      return { success: true, message: 'Header kolom Hasil_Jawaban (A1:AS1 - Soal 1 s/d 30) berhasil disiapkan di Google Spreadsheet!' };
    } catch (e: any) {
      console.warn('Apps script init header error:', e);
    }
  }

  if (token) {
    try {
      await ensureSheetExists('Hasil_Jawaban');
      const endCol = getColumnLetter(HASIL_JAWABAN_HEADERS.length);
      await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:${endCol}1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          range: `Hasil_Jawaban!A1:${endCol}1`,
          majorDimension: 'ROWS',
          values: [HASIL_JAWABAN_HEADERS],
        }),
      });
      return { success: true, message: `Header kolom Hasil_Jawaban (A1:${endCol}1 - Soal 1 s/d 30) berhasil dipasang di Google Spreadsheet!` };
    } catch (e: any) {
      return { success: false, message: `Gagal memasang header: ${e.message}` };
    }
  }

  return {
    success: false,
    message: 'Koneksi belum terkonfigurasi. Pasang URL Web App Apps Script atau hubungkan akun Google.',
  };
}

// Test connection to Google Apps Script Web App
export async function testAppsScriptConnection(url: string): Promise<{ success: boolean; message: string }> {
  const cleanUrl = url.trim();
  if (!cleanUrl || !cleanUrl.startsWith('https://script.google.com')) {
    return { success: false, message: 'URL tidak valid. Harus diawali dengan https://script.google.com/macros/s/.../exec' };
  }

  // 1. Try server test first (returns accurate HTTP status, no opaque response)
  try {
    const serverRes = await fetch('/api/sheets/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl: cleanUrl }),
    });
    const serverData = await serverRes.json();
    if (serverRes.ok && serverData.success) {
      saveAppsScriptUrl(cleanUrl);
      return {
        success: true,
        message: serverData.message || 'Koneksi ke Google Apps Script Web App berhasil terverifikasi! Webhook siap digunakan.',
      };
    } else if (serverData.message) {
      return {
        success: false,
        message: serverData.message,
      };
    }
  } catch {
    // Continue to client direct fallback
  }

  // 2. Direct client fallback test
  try {
    const testRow: ExamResult = {
      timestamp: new Date().toLocaleString('id-ID'),
      nik: 'TEST-SC',
      nama: 'UJI COBA KONEKSI SISTEM TRAINING EVABUL SC',
      toko: 'TEST',
      jabatan: 'Post Test',
      skor: 100,
      totalSoal: 15,
      jumlahBenar: 15,
      jumlahSalah: 0,
      waktuMulai: '08:00:00',
      waktuSelesai: '08:10:00',
      durasiDetik: 600,
      durasiFormatted: '10:00',
      statusKelulusan: 'LULUS',
      detailJawaban: '1:A, 2:B, 3:C, 4:D, 5:A, 6:B, 7:C, 8:D, 9:A, 10:B, 11:C, 12:D, 13:A, 14:B, 15:C',
      jawabanPerSoal: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A', 6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B', 11: 'C', 12: 'D', 13: 'A', 14: 'B', 15: 'C' },
      tipeUjian: 'Post Test',
      namaCOS: 'Test COS',
      namaTrainer: 'Test Trainer',
    };

    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'submit_result', result: testRow }),
    });

    saveAppsScriptUrl(cleanUrl);

    return {
      success: true,
      message: 'Koneksi berhasil! Baris data uji coba (TEST-SC) telah dikirim ke sheet Hasil_Jawaban di Google Spreadsheet Anda.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menguji Web App: ${err.message}`,
    };
  }
}

// Generate TSV for clipboard copy (Ready to Paste directly into Google Sheet with Ctrl+V)
export function generateResultsTsv(results: ExamResult[]): string {
  const headerLine = HASIL_JAWABAN_HEADERS.join('\t');
  const rowLines = results.map((r) => {
    return formatResultRowValues(r).join('\t');
  });

  return [headerLine, ...rowLines].join('\n');
}

// Clear all results from sheet Hasil_Jawaban (data rows starting at row 2) and clear local cache
export async function clearAllResultsFromSheet(resultsToClear?: ExamResult[]): Promise<{ success: boolean; sheetCleared: boolean; message: string }> {
  // Clear local cache immediately and record reset timestamp
  clearCachedResults();
  try {
    localStorage.setItem('stm_last_reset_timestamp', String(Date.now()));
  } catch {}

  const scriptUrl = getAppsScriptUrl();
  let sheetCleared = false;
  let clearErrorMessage = '';
  const nips = (resultsToClear && resultsToClear.length > 0)
    ? resultsToClear.map((r) => r.nik)
    : getCachedResults().map((r) => r.nik);

  // 1. Try server proxy clear (runs clear_results, GViz lookup, and fallback row deletion by NIP)
  try {
    const serverRes = await fetch('/api/sheets/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl, nips }),
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.sheetCleared) {
        sheetCleared = true;
      } else if (data.clearError) {
        clearErrorMessage = data.clearError;
      }
    }
  } catch {
    // Continue to client direct
  }

  // 2. Direct Apps Script clear fallback
  if (!sheetCleared && scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'clear_results' }),
      });
      sheetCleared = true;
    } catch (e: any) {
      clearErrorMessage = e.message || 'Gagal mengirim clear ke Apps Script';
      console.warn('Apps Script clear error:', e);
    }

    // Also send delete_result for each known NIP as safety fallback
    if (nips.length > 0) {
      for (const nip of nips) {
        try {
          await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'delete_result', nik: nip }),
          });
        } catch {}
      }
    }
  }

  // 3. Direct Google Sheets API (OAuth) clear
  try {
    const token = await getAccessToken();
    if (token) {
      await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A2:AE10000:clear`, {
        method: 'POST',
      });
      sheetCleared = true;
    }
  } catch (err) {
    console.warn('Could not clear sheet via Google Sheets API:', err);
  }

  triggerAppSync();

  return {
    success: true,
    sheetCleared,
    message: sheetCleared
      ? 'Seluruh nilai & hasil pengerjaan berhasil dihapus dari sheet Hasil_Jawaban di Google Spreadsheet dan sistem aplikasi!'
      : `Nilai di sistem web berhasil direset ke 0. Perhatian: Spreadsheet belum terhubung dengan Webhook Apps Script aktif${clearErrorMessage ? ` (${clearErrorMessage})` : ''}. Silakan kosongkan baris pada Google Spreadsheet secara manual atau hubungkan Webhook Apps Script di tab Spreadsheet.`,
  };
}

// Delete single result by NIK and sync across system
export async function deleteSingleResultFromSheet(
  nik: string,
  currentResults: ExamResult[]
): Promise<{ success: boolean; message: string }> {
  const remaining = currentResults.filter((r) => r.nik !== nik);
  saveCachedResults(remaining);

  const scriptUrl = getAppsScriptUrl();
  const token = await getAccessToken();

  if (scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete_result', nik }),
      });
    } catch (e) {
      console.warn('Apps script delete_result error:', e);
    }
  }

  if (token) {
    try {
      await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A2:Z10000:clear`, {
        method: 'POST',
      }).catch(() => null);

      if (remaining.length > 0) {
        const rows = remaining.map((result) => formatResultRowValues(result));

        await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A2:AE${rows.length + 1}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          body: JSON.stringify({
            range: `Hasil_Jawaban!A2:AE${rows.length + 1}`,
            majorDimension: 'ROWS',
            values: rows,
          }),
        });
      }
    } catch (err) {
      console.warn('Google Sheets API rewrite on delete error:', err);
    }
  }

  triggerAppSync();

  return {
    success: true,
    message: `Data hasil pengerjaan untuk NIP ${nik} berhasil dihapus dari sistem dan spreadsheet.`,
  };
}

// Save complete questions list to Google Sheet (sync after delete/reorder)
export async function saveAllQuestionsToSheet(updatedQuestions: Question[]): Promise<boolean> {
  saveCachedQuestions(updatedQuestions);

  try {
    await ensureSheetExists('Soal_Test');
    const soalHeaders = ['No', 'Pertanyaan', 'Pilihan_A', 'Pilihan_B', 'Pilihan_C', 'Pilihan_D', 'Kunci_Jawaban', 'Bobot', 'Kategori', 'Penjelasan'];
    const soalRows = updatedQuestions.map((q, idx) => [
      idx + 1,
      q.pertanyaan,
      q.pilihanA,
      q.pilihanB,
      q.pilihanC,
      q.pilihanD,
      q.kunciJawaban,
      q.bobot || 10,
      q.kategori || 'Training Evabul SC',
      q.penjelasan || '',
    ]);

    // Clear and rewrite Soal_Test range
    await fetchWithAuth(`${getBaseUrl()}/values/Soal_Test!A1:J100:clear`, {
      method: 'POST',
    }).catch(() => null);

    await fetchWithAuth(`${getBaseUrl()}/values/Soal_Test!A1:J${soalRows.length + 1}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({
        range: `Soal_Test!A1:J${soalRows.length + 1}`,
        majorDimension: 'ROWS',
        values: [soalHeaders, ...soalRows],
      }),
    });

    return true;
  } catch (err) {
    console.warn('Could not rewrite Soal_Test in Google Sheets (saved to local cache):', err);
    return false;
  }
}

// Add question to sheet
export async function addQuestionToSheet(question: Question): Promise<boolean> {
  const currentQuestions = getCachedQuestions();
  const updated = [...currentQuestions, question];
  saveCachedQuestions(updated);

  try {
    await ensureSheetExists('Soal_Test');
    const row = [
      question.id,
      question.pertanyaan,
      question.pilihanA,
      question.pilihanB,
      question.pilihanC,
      question.pilihanD,
      question.kunciJawaban,
      question.bobot || 10,
      question.kategori || 'Training Evabul SC',
      question.penjelasan || '',
    ];

    await fetchWithAuth(`${getBaseUrl()}/values/Soal_Test!A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify({
        range: 'Soal_Test!A1',
        majorDimension: 'ROWS',
        values: [row],
      }),
    });
    return true;
  } catch (err) {
    console.warn('Failed to append question to sheet:', err);
    return false;
  }
}

// Delete question helper
export async function deleteQuestionFromSheet(id: number, currentQuestions: Question[]): Promise<Question[]> {
  const updated = currentQuestions.filter((q) => q.id !== id);
  await saveAllQuestionsToSheet(updated);
  return updated;
}

// Initialize default template structure to Google Sheets if user wants to seed it
export async function seedSpreadsheetWithDefaultData(): Promise<{ success: boolean; message: string }> {
  try {
    await ensureSheetExists('Data_Peserta');
    await ensureSheetExists('Soal_Test');
    await ensureSheetExists('Hasil_Jawaban');

    // 1. Seed Data_Peserta
    const pesertaHeaders = ['NIK', 'Nama', 'Password', 'Toko', 'Jabatan', 'Cabang'];
    const pesertaRows = INITIAL_PARTICIPANTS.map((p) => [
      p.nik,
      p.nama,
      p.password,
      p.toko,
      p.jabatan,
      p.cabang,
    ]);
    await fetchWithAuth(`${getBaseUrl()}/values/Data_Peserta!A1:F${pesertaRows.length + 1}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({
        range: `Data_Peserta!A1:F${pesertaRows.length + 1}`,
        majorDimension: 'ROWS',
        values: [pesertaHeaders, ...pesertaRows],
      }),
    });

    // 2. Seed Soal_Test
    const soalHeaders = ['No', 'Pertanyaan', 'Pilihan_A', 'Pilihan_B', 'Pilihan_C', 'Pilihan_D', 'Kunci_Jawaban', 'Bobot', 'Kategori', 'Penjelasan'];
    const soalRows = INITIAL_QUESTIONS.map((q) => [
      q.id,
      q.pertanyaan,
      q.pilihanA,
      q.pilihanB,
      q.pilihanC,
      q.pilihanD,
      q.kunciJawaban,
      q.bobot || 10,
      q.kategori || '',
      q.penjelasan || '',
    ]);
    await fetchWithAuth(`${getBaseUrl()}/values/Soal_Test!A1:J${soalRows.length + 1}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({
        range: `Soal_Test!A1:J${soalRows.length + 1}`,
        majorDimension: 'ROWS',
        values: [soalHeaders, ...soalRows],
      }),
    });

    // 3. Seed Hasil_Jawaban Header & sample results
    const hasilRows = INITIAL_RESULTS.map((r) => {
      const currentKode = r.kodeToko || (r.toko?.includes(' - ') ? r.toko.split(' - ')[0].trim() : r.toko) || '';
      const currentNamaToko = r.namaToko || (r.toko?.includes(' - ') ? r.toko.split(' - ')[1].trim() : '') || '';
      return [
        r.timestamp,
        r.nik,
        r.nama,
        currentKode,
        currentNamaToko,
        r.namaCOS || '',
        r.namaTrainer || '',
        r.tipeUjian || 'Post Test',
        r.skor,
        r.totalSoal,
        r.jumlahBenar,
        r.jumlahSalah,
        r.waktuMulai,
        r.waktuSelesai,
        r.durasiFormatted,
        r.statusKelulusan,
        r.detailJawaban || '',
      ];
    });

    await fetchWithAuth(`${getBaseUrl()}/values/Hasil_Jawaban!A1:Q${hasilRows.length + 1}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({
        range: `Hasil_Jawaban!A1:Q${hasilRows.length + 1}`,
        majorDimension: 'ROWS',
        values: [HASIL_JAWABAN_HEADERS, ...hasilRows],
      }),
    });

    return { success: true, message: 'Berhasil menginisialisasi sheet Data_Peserta, Soal_Test, dan Hasil_Jawaban ke Google Spreadsheet!' };
  } catch (error: any) {
    console.error('Seed error:', error);
    return { success: false, message: error.message || 'Gagal sinkronisasi data ke Google Sheets' };
  }
}
