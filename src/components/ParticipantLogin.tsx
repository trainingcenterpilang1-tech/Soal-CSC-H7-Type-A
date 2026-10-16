import React, { useState } from 'react';
import {
  User,
  KeyRound,
  LogIn,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  BookOpen,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Participant, ExamConfig, ExamResult } from '../types';
import { getRunningDatePasswords, verifyDailyDatePassword } from '../lib/sheetsService';

interface ParticipantLoginProps {
  participants: Participant[];
  dataLogin?: Participant[];
  onLoginSuccess: (participant: Participant) => void;
  examConfig: ExamConfig;
  totalQuestions: number;
  existingResults: ExamResult[];
  onViewResult: (result: ExamResult) => void;
  onOpenAdminLogin: () => void;
}

export const ParticipantLogin: React.FC<ParticipantLoginProps> = ({
  participants,
  dataLogin = [],
  onLoginSuccess,
  examConfig,
  existingResults,
  onViewResult,
  onOpenAdminLogin,
}) => {
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<Participant | null>(null);

  // Participant selection for Jabatan: "CALON STORE CREW BOY (SCB)" or "CALON STORE CREW GRIL (SCG)"
  const [selectedJabatan, setSelectedJabatan] = useState<'CALON STORE CREW BOY (SCB)' | 'CALON STORE CREW GRIL (SCG)' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNik = nik.trim();
    const cleanPass = password.trim();

    if (!cleanNik || !cleanPass) {
      setErrorMsg('Harap masukkan NIP dan Password Anda.');
      return;
    }

    // Match participant in sheet data (prioritize Data_Login first, then merged participants)
    const foundInLogin = dataLogin.find(
      (p) => p.nik.toString().trim() === cleanNik
    );
    const foundByNik = foundInLogin || participants.find(
      (p) => p.nik.toString().trim() === cleanNik
    );

    if (foundByNik) {
      // Password validation: dynamic running date password (format: Tahun, Bulan, Tanggal) or custom password from sheet
      const isDailyPass = verifyDailyDatePassword(cleanPass);
      const isCustomPass = Boolean(foundByNik.password && foundByNik.password.trim() === cleanPass);
      if (isDailyPass || isCustomPass) {
        // Enforce verified details: NIP and Nama from Data_Login, Kode: "TC", Nama Toko: "Training Center", Cabang: "SBY"
        const verifiedUser: Participant = {
          ...foundByNik,
          kodeToko: 'TC',
          namaToko: 'Training Center',
          cabang: 'SBY',
          toko: 'TC - Training Center',
        };
        setAuthenticatedUser(verifiedUser);

        const rawJab = foundByNik.jabatan?.toUpperCase() || '';
        const defaultJab = rawJab.includes('GIRL') || rawJab.includes('GRIL') || rawJab === 'SCG'
          ? 'CALON STORE CREW GRIL (SCG)'
          : 'CALON STORE CREW BOY (SCB)';
        setSelectedJabatan(defaultJab);
        setValidationError(null);
      } else {
        setErrorMsg(
          'Password yang Anda masukkan salah. Silakan tanyakan password yang benar kepada trainer pengajar.'
        );
      }
    } else {
      setErrorMsg(
        `NIP "${cleanNik}" belum terdaftar dalam database Data_Peserta. Pastikan NIP sudah sesuai atau hubungi trainer.`
      );
    }
  };

  const handleStartExam = (type: 'Pre Test' | 'Post Test') => {
    if (!authenticatedUser) return;

    if (!selectedJabatan) {
      setValidationError('Harap pilih Jabatan (CALON STORE CREW BOY (SCB) atau CALON STORE CREW GRIL (SCG)) terlebih dahulu.');
      return;
    }

    setValidationError(null);
    onLoginSuccess({
      ...authenticatedUser,
      kodeToko: 'TC',
      namaToko: 'Training Center',
      cabang: 'SBY',
      toko: 'TC - Training Center',
      jabatan: selectedJabatan,
      tipeUjian: type,
    });
  };

  // Check if authenticated user already has submitted result
  const userResult = authenticatedUser
    ? existingResults.find((r) => r.nik === authenticatedUser.nik)
    : null;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3 sm:py-6">
      {/* Mobile Top Welcome Card */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-5 text-white shadow-md mb-5 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 rounded-full bg-blue-400/20 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-32 h-32 rounded-full bg-amber-400/15 blur-xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-700/60 border border-blue-400/30 text-[11px] font-semibold text-blue-200 mb-2.5 backdrop-blur-xs">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Portal Training CSCI</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2 leading-snug">
            {examConfig.judulUjian || 'Training CSCI'}
          </h1>

          <p className="text-xs text-blue-100/90 leading-relaxed mb-3">
            Selamat datang di sistem kompetensi Training CSCI. Silakan login menggunakan NIP dan Password ( yang diinfokan sama trainer pengajar )
          </p>

          <div className="inline-flex items-center gap-1.5 bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-600/40 text-xs font-semibold text-amber-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Durasi: <strong>{examConfig.durasiMenit} Menit</strong></span>
          </div>
        </div>
      </div>

      {/* Main Container - Mobile Centered Card */}
      {!authenticatedUser ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Login Peserta Ujian</h2>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Gagal Masuk:</span> {errorMsg}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="nik-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Nomor Induk Pegawai (NIP)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="nik-input"
                  type="text"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  placeholder="Masukkan NIP Anda"
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5">
                <label
                  htmlFor="password-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  PASSWORD (tanyakan pada trainer pengajar)
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="submit-login-btn"
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Ruang Ujian</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Authenticated Participant Confirmation Card (READONLY DATA DISPLAY) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Verifikasi Peserta Berhasil</h2>
              <p className="text-[11px] text-slate-500">Data terverifikasi dari sheet Data_Login (Readonly)</p>
            </div>
          </div>

          {/* Profile Details (Nama Lengkap, NIP, Kode Toko "TC", Nama Toko "Training Center", Cabang "SBY" - READONLY) */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 mb-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <span className="text-slate-500 font-medium">Nama Peserta</span>
              <span className="font-bold text-slate-900 text-right">{authenticatedUser.nama}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <span className="text-slate-500 font-medium">Nomor Induk Pegawai (NIP)</span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {authenticatedUser.nik}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <span className="text-slate-500 font-medium">Kode Toko</span>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                TC
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <span className="text-slate-500 font-medium">Nama Toko</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1.5 text-right">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Training Center</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Cabang</span>
              <span className="font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>SBY</span>
              </span>
            </div>
          </div>

          {/* Pilihan Jabatan: CALON STORE CREW BOY (SCB) & CALON STORE CREW GRIL (SCG) */}
          <div className="space-y-2.5 mb-5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700">
              Pilih Jabatan Peserta <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedJabatan('CALON STORE CREW BOY (SCB)');
                  if (validationError) setValidationError(null);
                }}
                className={`py-3 px-3.5 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center gap-3 transition-all cursor-pointer text-left ${
                  selectedJabatan === 'CALON STORE CREW BOY (SCB)'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-white'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedJabatan === 'CALON STORE CREW BOY (SCB)' ? 'border-white bg-white' : 'border-slate-400 bg-transparent'
                  }`}
                >
                  {selectedJabatan === 'CALON STORE CREW BOY (SCB)' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                </div>
                <span className="leading-tight">CALON STORE CREW BOY (SCB)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedJabatan('CALON STORE CREW GRIL (SCG)');
                  if (validationError) setValidationError(null);
                }}
                className={`py-3 px-3.5 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center gap-3 transition-all cursor-pointer text-left ${
                  selectedJabatan === 'CALON STORE CREW GRIL (SCG)'
                    ? 'border-pink-600 bg-pink-600 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-pink-300 hover:bg-white'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedJabatan === 'CALON STORE CREW GRIL (SCG)' ? 'border-white bg-white' : 'border-slate-400 bg-transparent'
                  }`}
                >
                  {selectedJabatan === 'CALON STORE CREW GRIL (SCG)' && <div className="w-2 h-2 rounded-full bg-pink-600" />}
                </div>
                <span className="leading-tight">CALON STORE CREW GRIL (SCG)</span>
              </button>
            </div>

            {validationError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2 mt-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* If participant already finished exam */}
          {userResult && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-amber-900">
                  Anda Sudah Mengerjakan Ujian Ini
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    userResult.statusKelulusan === 'LULUS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {userResult.statusKelulusan}
                </span>
              </div>
              <p className="text-amber-800 mb-2.5">
                Skor Anda: <strong>{userResult.skor}/100</strong> dengan durasi pengerjaan <strong>{userResult.durasiFormatted}</strong>.
              </p>
              <button
                onClick={() => onViewResult(userResult)}
                className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs cursor-pointer"
              >
                Lihat Laporan Hasil Nilai
              </button>
            </div>
          )}

          {/* Aturan Anti-Kecurangan (Peringatan sebelum mulai ujian) */}
          <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 text-left mb-4 shadow-2xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-1">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>SISTEM PENGAWASAN ANTI-KECURANGAN</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Selama ujian berlangsung, <strong>dilarang keras membuka aplikasi lain, melakukan multitasking, berpindah tab browser, atau keluar dari web</strong>. Jika terdeteksi, <strong>jawaban otomatis terkirim dan nilai langsung muncul & terkunci</strong>!
            </p>
          </div>

          {/* If participant was flagged by anti-cheating, block retake */}
          {userResult?.isAutoSubmittedCheating ? (
            <div className="space-y-3 pt-2">
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 text-xs text-left shadow-xs">
                <div className="flex items-center gap-2 font-black text-rose-800 text-sm mb-1.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Akses Ujian Terkunci (Anti-Kecurangan)</span>
                </div>
                <p className="leading-relaxed mb-3">
                  Sistem mencatat ujian Anda sebelumnya telah <strong>dihentikan dan dikirim secara otomatis</strong> karena terdeteksi keluar dari web / multitasking / membuka aplikasi lain. Anda <strong>tidak diizinkan melanjutkan atau mengulang</strong> ujian.
                </p>
                <button
                  type="button"
                  onClick={() => onViewResult(userResult)}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Lihat Laporan Hasil Nilai Akhir</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAuthenticatedUser(null);
                  setNik('');
                  setPassword('');
                  setValidationError(null);
                }}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Bukan akun Anda? Ganti NIP
              </button>
            </div>
          ) : (
            /* 2 Tombol Pilihan: Pre Test dan Post Test */
            <div className="space-y-3 pt-1">
              <span className="block text-xs font-bold text-slate-700 text-center">
                Pilih Jenis Ujian untuk Mulai Mengerjakan:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  id="btn-pre-test"
                  type="button"
                  onClick={() => handleStartExam('Pre Test')}
                  className="w-full py-3.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-indigo-200" />
                  <span>Mulai Pre Test</span>
                </button>

                <button
                  id="btn-post-test"
                  type="button"
                  onClick={() => handleStartExam('Post Test')}
                  className="w-full py-3.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Mulai Post Test</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAuthenticatedUser(null);
                  setNik('');
                  setPassword('');
                  setValidationError(null);
                }}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Bukan akun Anda? Ganti NIP
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin Login Discreet Trigger at Bottom */}
      <div className="text-center pt-2 pb-6">
        <button
          onClick={onOpenAdminLogin}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors py-2 px-3 rounded-lg hover:bg-slate-200/60 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Akses Admin / Panitia Pelatihan</span>
        </button>
      </div>
    </div>
  );
};
