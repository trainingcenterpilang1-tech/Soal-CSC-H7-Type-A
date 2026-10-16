import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

const RESULTS_BACKUP_FILE = path.resolve('/tmp', 'cbt_exam_results_backup.json');

const CONFIG_FILE = path.resolve('/tmp', 'cbt_server_config.json');

interface ServerConfig {
  appsScriptUrl: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  googleAuthToken?: string;
}

const DEFAULT_SPREADSHEET_ID = '1Rxb_sZGIgmUFhLhMVG65I-qpdi-v1tpj_c2tAZHsKiQ';
const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1Rxb_sZGIgmUFhLhMVG65I-qpdi-v1tpj_c2tAZHsKiQ/edit?gid=537994683#gid=537994683';
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmif0OC750DvnqekRcCSJ1JLNCmu--5Pe-pSaig78OL9oOPaFPxB9Cek45GyB8Mfx4/exec';

function readServerConfig(): ServerConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const isOldId = parsed.spreadsheetId === '14VuRQes6D3uQuMFkmf9kpruoUKuSGq1T9kAMtN9F7qc';
      const isOldScript = parsed.appsScriptUrl?.includes('AKfycbx9-Oz1aIflQQ3JyHA93Kwprdpym5i7v2w5h4Ik2urNCoYPXo8Y8Lzwy9ws5OV4bNMI');
      return {
        appsScriptUrl: (isOldScript || !parsed.appsScriptUrl) ? DEFAULT_APPS_SCRIPT_URL : parsed.appsScriptUrl,
        spreadsheetId: (isOldId || !parsed.spreadsheetId) ? DEFAULT_SPREADSHEET_ID : parsed.spreadsheetId,
        spreadsheetUrl: (isOldId || !parsed.spreadsheetUrl) ? DEFAULT_SPREADSHEET_URL : parsed.spreadsheetUrl,
        googleAuthToken: parsed.googleAuthToken || undefined,
      };
    }
  } catch (e) {
    console.warn('[Server] Error reading config file:', e);
  }
  return {
    appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
  };
}

let serverConfig: ServerConfig = readServerConfig();

function saveServerConfig(cfg: Partial<ServerConfig>): void {
  try {
    serverConfig = { ...serverConfig, ...cfg };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(serverConfig, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Server] Error saving config file:', e);
  }
}

function resolveScriptUrl(url?: string): string {
  if (url && typeof url === 'string' && url.trim().startsWith('https://script.google.com/')) {
    if (url.includes('AKfycbY06qqZDQZveqy2g095bUCAQsmieMuloWMp6GtmPs5qfAF_caeL3ELaZVbpXzucBFncw')) {
      return DEFAULT_APPS_SCRIPT_URL;
    }
    return url.trim();
  }
  if (serverConfig.appsScriptUrl && serverConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
    return serverConfig.appsScriptUrl.trim();
  }
  return DEFAULT_APPS_SCRIPT_URL;
}

// Helper: Format one result row for Google Sheets API (matches Hasil_Jawaban headers)
function formatExamRow(result: any): any[] {
  const currentKode = result.kodeToko || 'TC';
  const currentNamaToko = result.namaToko || 'Training Center';
  const totalQuestions = Math.max(30, Number(result.totalSoal) || 30);
  const ansMap = result.jawabanPerSoal || {};
  const questionAnswers: string[] = [];
  for (let q = 1; q <= totalQuestions; q++) {
    questionAnswers.push(ansMap[q] || ansMap[String(q)] || '-');
  }
  return [
    result.timestamp || new Date().toLocaleString('id-ID'),
    result.nik,
    result.nama,
    currentKode,
    currentNamaToko,
    result.jabatan || 'CALON STORE CREW BOY (SCB)',
    result.tipeUjian || 'Post Test',
    result.skor,
    totalQuestions,
    result.jumlahBenar || 0,
    result.jumlahSalah || 0,
    result.waktuMulai || '',
    result.waktuSelesai || '',
    result.durasiFormatted || '00:00',
    result.statusKelulusan || 'LULUS',
    ...questionAnswers,
  ];
}

// Helper: Append row to Google Sheets via Sheets API v4
async function appendViaGoogleSheetsApi(spreadsheetId: string, token: string, rowValues: any[]): Promise<boolean> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/Hasil_Jawaban!A:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'Hasil_Jawaban!A1',
      majorDimension: 'ROWS',
      values: [rowValues],
    }),
  });
  return res.ok;
}

// Helper: Read backup results from server disk
function readServerResults(): any[] {
  try {
    if (fs.existsSync(RESULTS_BACKUP_FILE)) {
      const raw = fs.readFileSync(RESULTS_BACKUP_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[Server] Error reading backup results:', e);
  }
  return [];
}

// Helper: Save backup results to server disk
function saveServerResults(results: any[]): void {
  try {
    fs.writeFileSync(RESULTS_BACKUP_FILE, JSON.stringify(results, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Server] Error saving backup results:', e);
  }
}

// API Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    hasWebhook: Boolean(resolveScriptUrl()),
    hasToken: Boolean(serverConfig.googleAuthToken),
  });
});

// API: Get Server Spreadsheet Config
app.get('/api/sheets/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    appsScriptUrl: serverConfig.appsScriptUrl || '',
    spreadsheetId: serverConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: serverConfig.spreadsheetUrl || DEFAULT_SPREADSHEET_URL,
    hasWebhook: Boolean(serverConfig.appsScriptUrl),
    hasGoogleAuthToken: Boolean(serverConfig.googleAuthToken),
  });
});

// API: Save Server Spreadsheet Config (Synchronizes across all devices/participants)
app.post('/api/sheets/config', (req: Request, res: Response) => {
  const { appsScriptUrl, spreadsheetId, spreadsheetUrl } = req.body;
  const updates: Partial<ServerConfig> = {};
  if (typeof appsScriptUrl === 'string') {
    updates.appsScriptUrl = appsScriptUrl.trim();
  }
  if (typeof spreadsheetId === 'string' && spreadsheetId.trim()) {
    updates.spreadsheetId = spreadsheetId.trim();
  }
  if (typeof spreadsheetUrl === 'string' && spreadsheetUrl.trim()) {
    updates.spreadsheetUrl = spreadsheetUrl.trim();
  }
  saveServerConfig(updates);
  return res.json({
    success: true,
    message: 'Konfigurasi Google Spreadsheet berhasil diperbarui di server dan berlaku untuk semua peserta!',
    config: {
      appsScriptUrl: serverConfig.appsScriptUrl,
      spreadsheetId: serverConfig.spreadsheetId,
      spreadsheetUrl: serverConfig.spreadsheetUrl,
    },
  });
});

// API: Save Google Auth Token (From Admin Google Sign-In)
app.post('/api/sheets/token', (req: Request, res: Response) => {
  const { token } = req.body;
  if (typeof token === 'string' && token.trim()) {
    saveServerConfig({ googleAuthToken: token.trim() });
    return res.json({ success: true, message: 'Token akses Google Sheets berhasil disimpan di server.' });
  }
  return res.status(400).json({ success: false, message: 'Token tidak valid.' });
});

// API: Get Server Backup Results
app.get('/api/sheets/results', (req: Request, res: Response) => {
  const list = readServerResults();
  res.json({ success: true, count: list.length, results: list });
});

// API: Permanent Supabase Data_Peserta proxy (retrieves NIP and Nama for login)
const PERMANENT_SUPABASE_URL = 'https://dzsxnkcuzioydvsmqwcn.supabase.co';
const PERMANENT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6c3hua2N1emlveWR2c21xd2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNjc3NDYsImV4cCI6MjEwNjY0Mzc0Nn0.ck4rpDWVzK-Pxe_c6LD8aKIbS0-kCTMRbHOVL-CQKoY';

app.get('/api/supabase/peserta', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${PERMANENT_SUPABASE_URL}/rest/v1/Data_Peserta?select=nip,nama&order=nip.asc`, {
      headers: {
        'apikey': PERMANENT_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${PERMANENT_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      const data = await response.json();
      const filtered = Array.isArray(data)
        ? data.filter((item: any) => {
            if (!item) return false;
            const nip = String(item.nip || '').trim();
            const nama = String(item.nama || '').trim();
            return nip && nama && !nip.startsWith('__') && nip.toLowerCase() !== 'nip';
          })
        : [];
      return res.json({ success: true, count: filtered.length, data: filtered });
    }
    return res.status(response.status).json({ success: false, message: 'Gagal mengambil data dari Supabase' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API: Test Google Apps Script Web App Connection
app.post('/api/sheets/test', async (req: Request, res: Response) => {
  const { scriptUrl } = req.body;
  const targetScriptUrl = resolveScriptUrl(scriptUrl);

  if (!targetScriptUrl) {
    return res.status(400).json({
      success: false,
      message: 'URL Google Apps Script belum dimasukkan. Masukkan URL Web App (berakhiran /exec).',
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetScriptUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain, */*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.status === 404) {
      return res.status(400).json({
        success: false,
        message: 'URL Web App mengembalikan HTTP 404. Pastikan script telah di-Deploy sebagai "Aplikasi Web" dengan akses "Siapa saja (Anyone)".',
      });
    }

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: `Google Apps Script mengembalikan status HTTP ${response.status}. Periksa konfigurasi Deployment script Anda.`,
      });
    }

    // Automatically persist tested working scriptUrl on server!
    saveServerConfig({ appsScriptUrl: targetScriptUrl });

    const text = await response.text();

    return res.json({
      success: true,
      message: 'Koneksi ke Google Apps Script Web App berhasil terverifikasi! Webhook aktif dan tersimpan di server untuk semua peserta.',
      raw: text.substring(0, 200),
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        message: 'Koneksi ke Google Apps Script timeout (lebih dari 12 detik). Pastikan URL deployment valid dan dapat diakses publik.',
      });
    }
    return res.status(500).json({
      success: false,
      message: `Gagal menghubungi Google Apps Script: ${err.message || 'Network error'}`,
    });
  }
});

// API: Submit Participant Exam Result to Google Form
const GFORM_RESPONSE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfzDkuspFeo7AeQmTmrQbhk3Mpd6mP0Wtg3m119qL8z72QT9A/formResponse';
const GFORM_ENTRY_IDS = {
  namaLengkap: 'entry.205349234',
  nik: 'entry.49005209',
  cabang: 'entry.1399581306',
  namaToko: 'entry.149171947',
  kodeToko: 'entry.997612142',
  jabatan: 'entry.2063893036',
  tanggalTest: 'entry.2048644142',
  jenisTest: 'entry.578389698',
  questions: {
    1: 'entry.2075241481',
    2: 'entry.1079212932',
    3: 'entry.903750346',
    4: 'entry.1751990565',
    5: 'entry.476677321',
    6: 'entry.1878333472',
    7: 'entry.1151811125',
    8: 'entry.2146043607',
    9: 'entry.1954368537',
    10: 'entry.2039919471',
    11: 'entry.432258187',
    12: 'entry.1762189',
    13: 'entry.578211796',
    14: 'entry.837041970',
    15: 'entry.415099477',
  } as Record<number, string>,
};

function mapJabatanToGForm(jabatan?: string): string {
  const clean = (jabatan || '').toUpperCase();
  if (clean.includes('GRIL') || clean.includes('GIRL') || clean === 'SCG') return 'SCG';
  if (clean.includes('MDP')) return 'MDP OPR';
  if (clean.includes('SDP')) return 'SDP OPR';
  if (clean.includes('CADANGAN')) return 'CADANGAN OPR';
  return 'SCB';
}

function mapJenisTestToGForm(tipeUjian?: string): string {
  const clean = (tipeUjian || '').toUpperCase();
  if (clean.includes('PRE')) return 'PRE TEST';
  if (clean.includes('REMEDIAL 1')) return 'REMEDIAL 1';
  if (clean.includes('REMEDIAL 2')) return 'REMEDIAL 2';
  return 'POST TEST';
}

app.post('/api/gform/submit', async (req: Request, res: Response) => {
  const { result, responseUrl } = req.body;
  if (!result || !result.nik) {
    return res.status(400).json({ success: false, message: 'Data hasil ujian tidak lengkap.' });
  }

  try {
    const params = new URLSearchParams();
    params.append(GFORM_ENTRY_IDS.namaLengkap, result.nama || '-');
    params.append(GFORM_ENTRY_IDS.nik, String(result.nik || '').trim());
    params.append(GFORM_ENTRY_IDS.cabang, 'SBY');
    params.append(GFORM_ENTRY_IDS.namaToko, result.namaToko || 'Training Center');
    params.append(GFORM_ENTRY_IDS.kodeToko, result.kodeToko || 'TC');
    params.append(GFORM_ENTRY_IDS.jabatan, mapJabatanToGForm(result.jabatan));

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    params.append(`${GFORM_ENTRY_IDS.tanggalTest}_year`, year);
    params.append(`${GFORM_ENTRY_IDS.tanggalTest}_month`, month);
    params.append(`${GFORM_ENTRY_IDS.tanggalTest}_day`, day);
    params.append(GFORM_ENTRY_IDS.tanggalTest, `${year}-${month}-${day}`);
    params.append(GFORM_ENTRY_IDS.jenisTest, mapJenisTestToGForm(result.tipeUjian));

    const ansMap = result.jawabanPerSoal || {};
    for (let q = 1; q <= 15; q++) {
      const entryKey = GFORM_ENTRY_IDS.questions[q];
      if (entryKey) {
        let rawAns = (ansMap[q] || ansMap[String(q)] || '').toUpperCase().trim();
        if (!['A', 'B', 'C', 'D'].includes(rawAns)) {
          rawAns = 'A';
        }
        params.append(entryKey, rawAns);
      }
    }

    const targetResponseUrl = (responseUrl && typeof responseUrl === 'string' && responseUrl.trim().startsWith('http'))
      ? responseUrl.trim()
      : GFORM_RESPONSE_URL;

    const response = await fetch(targetResponseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: params.toString(),
      redirect: 'follow',
    });

    return res.json({
      success: true,
      statusCode: response.status,
      message: 'Hasil ujian berhasil dikirim otomatis ke Google Form!',
    });
  } catch (err: any) {
    console.error('[Server] GForm submit error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal mengirim ke Google Form',
    });
  }
});

// API: Submit Participant Exam Result to Sheet & Local Backup
app.post('/api/sheets/submit', async (req: Request, res: Response) => {
  const { result, scriptUrl, token } = req.body;
  if (!result || !result.nik) {
    return res.status(400).json({ success: false, message: 'Data hasil ujian tidak lengkap (NIP kosong).' });
  }

  // 1. Always save in server disk backup immediately so no data is ever lost
  const current = readServerResults();
  const filtered = current.filter((r) => r.nik !== result.nik);
  const updated = [result, ...filtered];
  saveServerResults(updated);

  let deliveredToSheet = false;
  let deliveryMethod = 'backup_only';
  let deliveryError = '';

  const targetScriptUrl = resolveScriptUrl(scriptUrl);

  // 2. Try Apps Script Web App (Primary & reliable across all devices)
  if (targetScriptUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'submit_result', result }),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        deliveredToSheet = true;
        deliveryMethod = 'apps_script';
      } else {
        deliveryError = `HTTP ${response.status} dari Google Apps Script`;
      }
    } catch (err: any) {
      deliveryError = err.message || 'Gagal mengirim ke Apps Script';
      console.warn('[Server] Error forwarding to Apps Script:', err);
    }
  }

  // 3. Fallback: Try Google Sheets API v4 if OAuth token is available
  const authToken = token || serverConfig.googleAuthToken;
  if (!deliveredToSheet && authToken) {
    try {
      const rowValues = formatExamRow(result);
      const targetId = serverConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID;
      const ok = await appendViaGoogleSheetsApi(targetId, authToken, rowValues);
      if (ok) {
        deliveredToSheet = true;
        deliveryMethod = 'google_sheets_api';
        deliveryError = '';
      }
    } catch (err: any) {
      console.warn('[Server] Error appending via Sheets API:', err);
    }
  }

  if (!deliveredToSheet && !targetScriptUrl && !authToken) {
    deliveryError = 'Webhook Apps Script belum dikonfigurasi di server dan akun Google belum terhubung.';
  }

  return res.json({
    success: true,
    deliveredToSheet,
    deliveryMethod,
    deliveryError: deliveryError || undefined,
    message: deliveredToSheet
      ? 'Hasil ujian berhasil dicatat langsung ke sheet Hasil_Jawaban di Google Spreadsheet!'
      : 'Hasil ujian telah tersimpan aman di database CBT server. Siap disinkronkan ke Spreadsheet saat Webhook aktif.',
  });
});

// API: Clear All Exam Results (Reset Nilai)
app.post('/api/sheets/clear', async (req: Request, res: Response) => {
  const { scriptUrl } = req.body;

  // 1. Clear server disk backup
  saveServerResults([]);

  // 2. Clear Google Spreadsheet via Apps Script Web App if available
  let sheetCleared = false;
  let clearError = '';
  const targetScriptUrl = resolveScriptUrl(scriptUrl);
  const nipsToClear: string[] = Array.isArray(req.body.nips) ? req.body.nips.map((n: any) => String(n).trim()) : [];

  if (targetScriptUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'clear_results' }),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        try {
          const json = await response.json();
          if (json.status === 'success') {
            sheetCleared = true;
          } else if (json.message) {
            clearError = json.message;
          }
        } catch {
          // not json
        }
      }
    } catch (err: any) {
      clearError = err.message || 'Gagal menghapus via Apps Script';
      console.warn('[Server] Error calling clear_results on Apps Script:', err);
    }

    // Fallback: If clear_results failed (e.g. ReferenceError in deployed script),
    // retrieve all existing rows in Hasil_Jawaban and delete them row-by-row via delete_result!
    if (!sheetCleared) {
      try {
        console.log('[Server] Attempting fallback deletion via delete_result...');
        const uniqueNips = new Set<string>(nipsToClear.filter(Boolean));

        // Query current Hasil_Jawaban via GViz to find any existing NIPs in the sheet
        try {
          const gvizRes = await fetch(
            `https://docs.google.com/spreadsheets/d/${serverConfig.spreadsheetId}/gviz/tq?tqx=out:json&sheet=Hasil_Jawaban`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (gvizRes.ok) {
            const raw = await gvizRes.text();
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start > -1 && end > -1) {
              const data = JSON.parse(raw.substring(start, end + 1));
              const rows = data?.table?.rows || [];
              rows.forEach((r: any) => {
                if (r?.c) {
                  // Usually column 1 (B) is NIP
                  const nipVal = r.c[1]?.v || r.c[1]?.f;
                  if (nipVal && String(nipVal).trim() && String(nipVal).toUpperCase() !== 'NIP' && String(nipVal).toUpperCase() !== 'NIK') {
                    uniqueNips.add(String(nipVal).trim());
                  }
                }
              });
            }
          }
        } catch (gvizErr) {
          console.warn('[Server] GViz query during clear fallback:', gvizErr);
        }

        if (uniqueNips.size > 0) {
          console.log(`[Server] Deleting ${uniqueNips.size} rows from sheet Hasil_Jawaban via delete_result...`);
          for (const nip of uniqueNips) {
            try {
              await fetch(targetScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'delete_result', nik: nip }),
                redirect: 'follow',
                signal: AbortSignal.timeout(8000),
              });
            } catch (delErr) {
              console.warn(`[Server] Error deleting NIP ${nip}:`, delErr);
            }
          }
        }

        // Re-initialize header to ensure row 1 is clean
        await fetch(targetScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'init_header' }),
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });

        sheetCleared = true;
        clearError = '';
      } catch (fbErr: any) {
        console.warn('[Server] Error during fallback deletion:', fbErr);
        clearError = fbErr.message || 'Gagal menghapus baris spreadsheet';
      }
    }
  }

  return res.json({
    success: true,
    sheetCleared,
    clearError: clearError || undefined,
    message: sheetCleared
      ? 'Seluruh nilai & hasil ujian berhasil dihapus dari sheet Hasil_Jawaban di Google Spreadsheet dan sistem aplikasi!'
      : 'Seluruh nilai ujian berhasil direset ke 0 di sistem web. Untuk membersihkan baris di Google Spreadsheet secara otomatis, pastikan Webhook Apps Script aktif terhubung.',
  });
});

// API: Initialize or Update Hasil_Jawaban Headers (A1:AS1 - Soal 1 s/d 30+)
app.post('/api/sheets/init-header', async (req: Request, res: Response) => {
  const { scriptUrl } = req.body;
  const targetScriptUrl = resolveScriptUrl(scriptUrl);

  if (!targetScriptUrl) {
    return res.status(400).json({ success: false, message: 'URL Apps Script belum disetel di server.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'init_header' }),
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      let msg = 'Header kolom Hasil_Jawaban (Soal 1 s/d 30) berhasil diperbarui di Google Spreadsheet!';
      try {
        const json = await response.json();
        if (json.message) msg = json.message;
      } catch {}
      return res.json({ success: true, message: msg });
    }
    return res.status(response.status).json({ success: false, message: `Apps Script return status ${response.status}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Gagal update header' });
  }
});

// API: Bulk Push Results to Google Spreadsheet
app.post('/api/sheets/bulk-submit', async (req: Request, res: Response) => {
  const { results, scriptUrl, token } = req.body;
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada data nilai ujian untuk dikirim.' });
  }

  const targetScriptUrl = resolveScriptUrl(scriptUrl);

  // 1. Try Apps Script bulk submit
  if (targetScriptUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(targetScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'bulk_submit', results }),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return res.json({
          success: true,
          count: results.length,
          message: `Berhasil mengirim ${results.length} hasil ujian ke sheet Hasil_Jawaban di Google Spreadsheet!`,
        });
      }
    } catch (err: any) {
      console.warn('[Server] Error bulk submitting via Apps Script:', err);
    }
  }

  // 2. Try Sheets API bulk append if token available
  const authToken = token || serverConfig.googleAuthToken;
  if (authToken) {
    try {
      const targetId = serverConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID;
      const rows = results.map(formatExamRow);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}/values/Hasil_Jawaban!A:append?valueInputOption=USER_ENTERED`;
      const resApi = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: 'Hasil_Jawaban!A1',
          majorDimension: 'ROWS',
          values: rows,
        }),
      });
      if (resApi.ok) {
        return res.json({
          success: true,
          count: results.length,
          message: `Berhasil mengirim ${results.length} hasil ujian ke sheet Hasil_Jawaban via Google Sheets API!`,
        });
      }
    } catch (err: any) {
      console.warn('[Server] Error bulk appending via Sheets API:', err);
    }
  }

  return res.status(400).json({
    success: false,
    message: 'Gagal mengirim data. Pastikan Webhook Apps Script aktif atau Hubungkan Akun Google di tab Spreadsheet.',
  });
});

// Launch server with Vite in dev or static files in prod
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
