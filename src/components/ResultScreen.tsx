import React, { useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Calendar,
  Check,
  RotateCcw,
  Sparkles,
  Building2,
  User,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ExamResult, Question, ExamConfig } from '../types';

interface ResultScreenProps {
  result: ExamResult;
  questions?: Question[];
  config: ExamConfig;
  deliveredToSheet?: boolean;
  onGoToLeaderboard: () => void;
  onRetakeExam: () => void;
  onBackToLogin: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  config,
  deliveredToSheet,
  onRetakeExam,
  onBackToLogin,
}) => {
  const isPassed = result.skor >= config.passingGrade;

  useEffect(() => {
    if (isPassed) {
      // Fire celebratory confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#005ba9', '#ffcc00', '#ed1c24', '#10b981'],
        });
      } catch (e) {
        // ignore
      }
    }
  }, [isPassed]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 mb-8 text-center relative overflow-hidden">
        <div className="h-1.5 w-full absolute top-0 left-0 flex">
          <div className="w-1/3 bg-[#005ba9]" />
          <div className="w-1/3 bg-[#ffcc00]" />
          <div className="w-1/3 bg-[#ed1c24]" />
        </div>

        {result.isAutoSubmittedCheating && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 mb-5 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 shadow-xs text-left">
            <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-extrabold text-sm sm:text-base text-rose-900 uppercase tracking-wide">
                  Ujian Dihentikan & Dikirim Otomatis oleh Sistem Anti-Kecurangan
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900 border border-rose-300">
                  Multitasking Terdeteksi
                </span>
              </div>
              <p className="text-xs sm:text-sm text-rose-800 leading-relaxed">
                {result.cheatingReason || 'Sistem mendeteksi Anda keluar dari halaman web ujian atau membuka aplikasi lain saat mengerjakan.'} Sesuai regulasi training, ujian langsung dihentikan dan seluruh jawaban yang telah terisi otomatis dikirim dan dinilai seketika.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Hasil Ujian Berhasil Disimpan & Dikirim</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Terintegrasi ke Google Form (GForm)</span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6">
          Laporan Hasil Nilai Peserta
        </h1>

        {/* Score Ring / Hero Metric */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 my-4 pb-6 border-b border-slate-100">
          <div className="relative flex items-center justify-center">
            {/* Visual Circular Score */}
            <div
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center border-8 shadow-inner ${
                isPassed
                  ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900'
                  : 'border-rose-500 bg-rose-50/60 text-rose-900'
              }`}
            >
              <span className="text-4xl font-black tracking-tight">{result.skor}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Skor Akhir
              </span>
            </div>
            {isPassed && (
              <div className="absolute -top-2 -right-1 bg-amber-400 text-slate-950 p-2 rounded-full shadow-xs">
                <Sparkles className="w-5 h-5 fill-current" />
              </div>
            )}
          </div>

          <div className="text-left space-y-2">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Status Kelulusan
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-lg font-black px-3 py-1 rounded-lg ${
                    isPassed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {result.statusKelulusan}
                </span>
                <span className="text-xs text-slate-500">
                  (KKM: {config.passingGrade} Poin)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <span className="text-[11px] text-slate-500">Jumlah Jawaban Benar</span>
                <div className="text-base font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  <span>{result.jumlahBenar} / {result.totalSoal} Soal</span>
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Durasi Pengerjaan</span>
                <div className="text-base font-bold text-slate-800 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{result.durasiFormatted}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Participant Identification Card */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-left max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <User className="w-4 h-4 text-blue-600 shrink-0" />
            <span><strong>Peserta:</strong> {result.nama} (NIP: {result.nik})</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-semibold text-slate-600">Kode Toko:</span>
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {result.kodeToko || 'TC'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong className="text-slate-600 font-semibold">Nama Toko:</strong>{' '}
              <span className="font-bold text-emerald-900">
                {result.namaToko || 'Training Center'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-semibold text-slate-600">Cabang:</span>
            <span className="font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
              SBY
            </span>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2 text-slate-700 pt-1 border-t border-slate-200/60">
            <span className="font-semibold text-slate-600">Jabatan:</span>
            <span className={`px-2.5 py-0.5 rounded font-bold text-xs ${
              result.jabatan?.includes('GRIL') || result.jabatan?.includes('GIRL') || result.jabatan === 'SCG'
                ? 'bg-pink-100 text-pink-800 border border-pink-200'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}>
              {result.jabatan || 'CALON STORE CREW BOY (SCB)'}
            </span>
          </div>
          {result.tipeUjian && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <span className="text-slate-500">Jenis Ujian:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                result.tipeUjian === 'Pre Test'
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {result.tipeUjian}
              </span>
            </div>
          )}
          {result.isAutoSubmittedCheating && (
            <div className="sm:col-span-2 flex items-center gap-2 text-rose-800 font-semibold bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Status Ujian: <strong>Dihentikan & Dikirim Otomatis (Terdeteksi Multitasking / Buka Aplikasi Lain)</strong></span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-500 sm:col-span-2 pt-1 border-t border-slate-200/60">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Waktu Pengerjaan: {result.waktuMulai} s/d {result.waktuSelesai} &bull; {result.timestamp}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-5">
          {!result.isAutoSubmittedCheating ? (
            <button
              onClick={onRetakeExam}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Kerjakan Ulang Ujian</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Akses Ujian Dikunci (Tidak dapat mengulang atau melanjutkan pengerjaan)</span>
            </div>
          )}

          <a
            href={result.gformUrl || 'https://docs.google.com/forms/d/e/1FAIpQLSfzDkuspFeo7AeQmTmrQbhk3Mpd6mP0Wtg3m119qL8z72QT9A/viewform'}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Buka Salinan di GForm</span>
          </a>

          <button
            onClick={onBackToLogin}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            <span>Selesai & Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
