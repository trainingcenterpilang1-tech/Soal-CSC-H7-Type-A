import React, { useState } from 'react';
import {
  Users,
  BookOpen,
  Settings,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Clock,
  Sparkles,
  AlertCircle,
  Search,
  Database,
  Sliders,
  Award,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  RotateCcw,
  Send,
  Download,
  Code,
  HelpCircle,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Image as ImageIcon,
} from 'lucide-react';
import { Participant, Question, ExamResult, ExamConfig, SheetSyncStatus } from '../types';
import { RichOptionContent, RichQuestionContent, parseImageContent } from './RichMediaContent';
import {
  addQuestionToSheet,
  deleteQuestionFromSheet,
  seedSpreadsheetWithDefaultData,
  getAppsScriptUrl,
  saveAppsScriptUrl,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  testAppsScriptConnection,
  pushAllResultsToSheet,
  setupHasilJawabanHeader,
  generateResultsTsv,
  getSpreadsheetId,
  getSpreadsheetUrl,
  saveCustomSpreadsheet,
  resetCustomSpreadsheet,
  isCustomSpreadsheetConfigured,
  extractSpreadsheetId,
  testSpreadsheetAccessibility,
  getAdminPassword,
  saveAdminPassword,
  resetAdminPassword,
  verifyAdminPassword,
} from '../lib/sheetsService';
import { FIREBASE_PROJECT_ID } from '../lib/firebase';
import { getCustomGFormUrl, saveCustomGFormUrl, resetCustomGFormUrl } from '../lib/gformService';

interface AdminDashboardProps {
  participants: Participant[];
  questions: Question[];
  results: ExamResult[];
  config: ExamConfig;
  onUpdateConfig: (config: ExamConfig) => void;
  onUpdateQuestions: (questions: Question[]) => void;
  syncStatus: SheetSyncStatus;
  onSyncWithSheets: () => void;
  onConnectGoogle: () => void;
  onResetResults?: () => void;
  onDeleteResult?: (nik: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  participants,
  questions,
  results,
  config,
  onUpdateConfig,
  onUpdateQuestions,
  syncStatus,
  onSyncWithSheets,
  onConnectGoogle,
  onResetResults,
  onDeleteResult,
}) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'monitoring' | 'bank_soal' | 'spreadsheet' | 'pengaturan' | 'password_admin'>('monitoring');
  const [participantSearch, setParticipantSearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const activityPageSize = 25;
  const [showResetResultsModal, setShowResetResultsModal] = useState(false);
  const [showImageGuide, setShowImageGuide] = useState(false);

  // Admin Password Management State
  const [currentAdminPassword, setCurrentAdminPassword] = useState<string>(getAdminPassword());
  const [oldPasswordInput, setOldPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [showOldPassword, setShowOldPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleChangeAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    const oldClean = oldPasswordInput.trim();
    const newClean = newPasswordInput.trim();
    const confirmClean = confirmPasswordInput.trim();

    if (!verifyAdminPassword(oldClean)) {
      setPasswordFeedback({
        success: false,
        message: 'Password saat ini / lama yang Anda masukkan tidak sesuai!',
      });
      return;
    }

    if (!newClean || newClean.length < 4) {
      setPasswordFeedback({
        success: false,
        message: 'Password baru minimal harus terdiri dari 4 karakter.',
      });
      return;
    }

    if (newClean !== confirmClean) {
      setPasswordFeedback({
        success: false,
        message: 'Konfirmasi password baru tidak cocok. Harap periksa kembali!',
      });
      return;
    }

    const saved = saveAdminPassword(newClean);
    if (saved) {
      setCurrentAdminPassword(newClean);
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordFeedback({
        success: true,
        message: 'Password Administrator berhasil diubah! Gunakan password baru ini untuk login berikutnya.',
      });
    } else {
      setPasswordFeedback({
        success: false,
        message: 'Gagal menyimpan password baru.',
      });
    }
  };

  const handleResetAdminPassword = () => {
    if (confirm('Kembalikan password admin ke bawaan sistem ("Tcsby123")?')) {
      resetAdminPassword();
      setCurrentAdminPassword('Tcsby123');
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordFeedback({
        success: true,
        message: 'Password Administrator telah dikembalikan ke bawaan sistem: "Tcsby123".',
      });
    }
  };

  // Add Question Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<Question>>({
    pertanyaan: '',
    pilihanA: '',
    pilihanB: '',
    pilihanC: '',
    pilihanD: '',
    kunciJawaban: 'A',
    bobot: 10,
    kategori: 'Training Evabul SC',
    penjelasan: '',
  });

  // Delete Question state (replaces window.confirm)
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  // Seed status message
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedFeedback, setSeedFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Spreadsheet Dynamic Configuration States
  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState<string>(getSpreadsheetId());
  const [currentSpreadsheetUrl, setCurrentSpreadsheetUrl] = useState<string>(getSpreadsheetUrl());
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(getSpreadsheetUrl());
  const [isTestingSpreadsheet, setIsTestingSpreadsheet] = useState<boolean>(false);
  const [spreadsheetFeedback, setSpreadsheetFeedback] = useState<{
    success: boolean;
    message: string;
    sheetsFound?: string[];
    missingSheets?: string[];
  } | null>(null);
  const [isCustomSheet, setIsCustomSheet] = useState<boolean>(isCustomSpreadsheetConfigured());

  const handleSaveSpreadsheet = async () => {
    if (!spreadsheetInput.trim()) {
      setSpreadsheetFeedback({
        success: false,
        message: 'Masukkan Link atau ID Google Spreadsheet.',
      });
      return;
    }

    const res = saveCustomSpreadsheet(spreadsheetInput);
    if (!res.success) {
      setSpreadsheetFeedback({
        success: false,
        message: res.message,
      });
      return;
    }

    setCurrentSpreadsheetId(res.id);
    setCurrentSpreadsheetUrl(res.url);
    setIsCustomSheet(true);

    // Test access to the new spreadsheet
    setIsTestingSpreadsheet(true);
    try {
      const testRes = await testSpreadsheetAccessibility(res.id);
      setSpreadsheetFeedback({
        success: testRes.success,
        message: `${res.message} ${testRes.message}`,
        sheetsFound: testRes.sheetsFound,
        missingSheets: testRes.missingSheets,
      });
    } catch {
      setSpreadsheetFeedback({
        success: true,
        message: 'Spreadsheet baru tersimpan! Menarik data dari spreadsheet baru...',
      });
    } finally {
      setIsTestingSpreadsheet(false);
    }

    // Trigger sync with the new spreadsheet
    onSyncWithSheets();
  };

  const handleResetSpreadsheet = () => {
    resetCustomSpreadsheet();
    const defId = getSpreadsheetId();
    const defUrl = getSpreadsheetUrl();
    setCurrentSpreadsheetId(defId);
    setCurrentSpreadsheetUrl(defUrl);
    setSpreadsheetInput(defUrl);
    setIsCustomSheet(false);
    setSpreadsheetFeedback({
      success: true,
      message: 'Tautan Google Spreadsheet dikembalikan ke default bawaan sistem.',
    });
    onSyncWithSheets();
  };

  const handleTestSpreadsheetAccess = async () => {
    setIsTestingSpreadsheet(true);
    setSpreadsheetFeedback(null);
    try {
      const testRes = await testSpreadsheetAccessibility(spreadsheetInput);
      setSpreadsheetFeedback(testRes);
    } catch (err: any) {
      setSpreadsheetFeedback({
        success: false,
        message: err.message || 'Gagal menguji akses ke spreadsheet.',
      });
    } finally {
      setIsTestingSpreadsheet(false);
    }
  };



  // Google Form Dynamic Configuration State
  const [gformInput, setGformInput] = useState<string>(getCustomGFormUrl());
  const [gformFeedback, setGformFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleSaveGForm = () => {
    const res = saveCustomGFormUrl(gformInput);
    setGformFeedback(res);
    if (res.success) {
      setTimeout(() => setGformFeedback(null), 4000);
    }
  };

  const handleResetGForm = () => {
    if (confirm('Kembalikan Link GForm ke tautan bawaan sistem?')) {
      resetCustomGFormUrl();
      const defaultUrl = getCustomGFormUrl();
      setGformInput(defaultUrl);
      setGformFeedback({
        success: true,
        message: 'Link Google Form berhasil dikembalikan ke bawaan sistem.',
      });
    }
  };

  // Apps Script Web App States
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState<string>(getAppsScriptUrl());
  const [isTestingScript, setIsTestingScript] = useState<boolean>(false);
  const [scriptFeedback, setScriptFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedTsv, setCopiedTsv] = useState<boolean>(false);
  const [isPushingResults, setIsPushingResults] = useState<boolean>(false);
  const [pushFeedback, setPushFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isSettingHeader, setIsSettingHeader] = useState<boolean>(false);

  const handleSaveAppsScriptUrl = () => {
    saveAppsScriptUrl(appsScriptUrlInput);
    setScriptFeedback({
      success: true,
      message: 'URL Web App Apps Script berhasil disimpan ke sistem.',
    });
  };

  const handleTestAppsScript = async () => {
    if (!appsScriptUrlInput.trim()) {
      setScriptFeedback({
        success: false,
        message: 'Silakan masukkan URL Web App Google Apps Script terlebih dahulu.',
      });
      return;
    }
    setIsTestingScript(true);
    setScriptFeedback(null);
    try {
      const res = await testAppsScriptConnection(appsScriptUrlInput);
      setScriptFeedback(res);
    } catch (e: any) {
      setScriptFeedback({
        success: false,
        message: e.message || 'Gagal menguji koneksi Web App.',
      });
    } finally {
      setIsTestingScript(false);
    }
  };

  const handlePushAllResults = async () => {
    setIsPushingResults(true);
    setPushFeedback(null);
    try {
      const res = await pushAllResultsToSheet(results);
      setPushFeedback(res);
    } catch (e: any) {
      setPushFeedback({
        success: false,
        message: e.message || 'Gagal mengirim hasil ujian ke spreadsheet.',
      });
    } finally {
      setIsPushingResults(false);
    }
  };

  const handleSetupHeader = async () => {
    setIsSettingHeader(true);
    setPushFeedback(null);
    try {
      const res = await setupHasilJawabanHeader();
      setPushFeedback(res);
    } catch (e: any) {
      setPushFeedback({
        success: false,
        message: e.message || 'Gagal memasang baris header.',
      });
    } finally {
      setIsSettingHeader(false);
    }
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleCopyTsv = () => {
    const tsv = generateResultsTsv(results);
    navigator.clipboard.writeText(tsv);
    setCopiedTsv(true);
    setTimeout(() => setCopiedTsv(false), 3000);
  };

  const handleDownloadCsv = () => {
    const tsv = generateResultsTsv(results);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(tsv.replace(/\t/g, ','));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Hasil_Jawaban_CSCI_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics calculation
  const totalParticipants = participants.length;
  const completedCount = results.length;
  const passedCount = results.filter((r) => r.skor >= config.passingGrade).length;
  const averageScore =
    completedCount > 0
      ? Math.round(results.reduce((acc, r) => acc + r.skor, 0) / completedCount)
      : 0;
  const highestScore =
    completedCount > 0 ? Math.max(...results.map((r) => r.skor)) : 0;

  // Filtered participants with exam status
  const participantActivityList = participants
    .map((p) => {
      const exam = results.find((r) => r.nik === p.nik);
      return {
        ...p,
        examResult: exam || null,
        status: exam ? ('Selesai' as const) : ('Belum Ujian' as const),
      };
    })
    .filter((p) => {
      const q = participantSearch.toLowerCase();
      return (
        p.nama.toLowerCase().includes(q) ||
        p.nik.toLowerCase().includes(q) ||
        p.toko.toLowerCase().includes(q)
      );
    });

  const totalActivityPages = Math.max(1, Math.ceil(participantActivityList.length / activityPageSize));
  const currentActivityPage = Math.min(activityPage, totalActivityPages);
  const paginatedActivityList = participantActivityList.slice(
    (currentActivityPage - 1) * activityPageSize,
    currentActivityPage * activityPageSize
  );

  // Handle adding new question
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.pertanyaan || !newQuestion.pilihanA || !newQuestion.pilihanB) {
      alert('Harap lengkapi pertanyaan dan minimal pilihan A dan B.');
      return;
    }

    setIsSavingQuestion(true);
    const nextId = questions.length > 0 ? Math.max(...questions.map((q) => q.id)) + 1 : 1;

    const questionToAdd: Question = {
      id: nextId,
      pertanyaan: newQuestion.pertanyaan!,
      pilihanA: newQuestion.pilihanA!,
      pilihanB: newQuestion.pilihanB!,
      pilihanC: newQuestion.pilihanC || '-',
      pilihanD: newQuestion.pilihanD || '-',
      kunciJawaban: newQuestion.kunciJawaban || 'A',
      bobot: Number(newQuestion.bobot) || 10,
      kategori: newQuestion.kategori || 'Operasional Toko',
      penjelasan: newQuestion.penjelasan || '',
    };

    // Save to Google Sheets sheet Soal_Test & local state
    await addQuestionToSheet(questionToAdd);
    onUpdateQuestions([...questions, questionToAdd]);

    setIsSavingQuestion(false);
    setShowAddModal(false);
    setNewQuestion({
      pertanyaan: '',
      pilihanA: '',
      pilihanB: '',
      pilihanC: '',
      pilihanD: '',
      kunciJawaban: 'A',
      bobot: 10,
      kategori: 'Operasional Toko & Display',
      penjelasan: '',
    });
  };

  const handleConfirmDeleteQuestion = async () => {
    if (!deletingQuestion) return;
    setIsDeletingQuestion(true);
    try {
      const updated = await deleteQuestionFromSheet(deletingQuestion.id, questions);
      onUpdateQuestions(updated);
      setDeleteFeedback(`Soal #${deletingQuestion.id} berhasil dihapus dari sistem dan spreadsheet.`);
      setTimeout(() => setDeleteFeedback(null), 3500);
      setDeletingQuestion(null);
    } catch (err) {
      console.error('Failed to delete question:', err);
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  const handleSeedTemplate = async () => {
    if (!syncStatus.isConnected) {
      alert('Silakan hubungkan akun Google terlebih dahulu untuk mengisi data ke Google Spreadsheet.');
      return;
    }

    if (
      confirm(
        'Tindakan ini akan membuat/memperbarui sheet Data_Peserta, Soal_Test, dan Hasil_Jawaban di Google Spreadsheet Anda dengan format standar. Lanjutkan?'
      )
    ) {
      setSeedLoading(true);
      setSeedFeedback(null);
      const res = await seedSpreadsheetWithDefaultData();
      setSeedFeedback(res);
      setSeedLoading(false);
      if (res.success) {
        onSyncWithSheets();
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-slate-100 mb-2">
            <Settings className="w-3.5 h-3.5 text-blue-400" />
            <span>Dashboard Administrator Training CSCI</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Manajemen Evaluasi & Bank Soal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pantau partisipasi peserta, kelola bank soal di Google Sheets, dan atur parameter ujian.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {onResetResults && (
            <button
              onClick={() => setShowResetResultsModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Reset semua nilai ujian dan hapus semua data pengerjaan peserta"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Reset Semua Nilai {results.length > 0 ? `(${results.length})` : '(0)'}</span>
            </button>
          )}

          <button
            onClick={onSyncWithSheets}
            disabled={syncStatus.isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isLoading ? 'animate-spin' : ''}`} />
            <span>{syncStatus.isLoading ? 'Menyinkronkan...' : 'Sinkronkan Sheets'}</span>
          </button>

          <a
            href={currentSpreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Buka Google Sheets</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Peserta
          </div>
          <div className="text-2xl font-black text-slate-900">{totalParticipants}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Database Data_Peserta</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sudah Selesai
            </div>
            {onResetResults && results.length > 0 && (
              <button
                onClick={() => setShowResetResultsModal(true)}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Reset seluruh nilai pengerjaan"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
          <div className="text-2xl font-black text-blue-600">{completedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0}% Partisipasi
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Rata-rata Skor
          </div>
          <div className="text-2xl font-black text-slate-900">{averageScore}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Dari skala 100</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Nilai Tertinggi
          </div>
          <div className="text-2xl font-black text-amber-600">{highestScore}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Juara 1 Klasemen</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Tingkat Kelulusan
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {passedCount} dari {completedCount} Lulus (KKM: {config.passingGrade})
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-slate-200 mb-6 space-x-2 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveAdminSubTab('monitoring')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeAdminSubTab === 'monitoring'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Monitoring Aktivitas Peserta</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('bank_soal')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeAdminSubTab === 'bank_soal'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bank Soal Test ({questions.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('spreadsheet')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeAdminSubTab === 'spreadsheet'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Status Google Spreadsheet</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('pengaturan')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeAdminSubTab === 'pengaturan'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Pengaturan Ujian</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('password_admin')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeAdminSubTab === 'password_admin'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Ubah Password Admin</span>
        </button>
      </div>

      {/* Sub Tab 1: Monitoring Aktivitas Peserta */}
      {activeAdminSubTab === 'monitoring' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Aktivitas & Status Peserta
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Database: Data_Peserta
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Data profil, NIP, dan nama peserta bersumber langsung dari database{' '}
                <span className="font-bold text-blue-700">Data_Peserta</span>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => {
                    setParticipantSearch(e.target.value);
                    setActivityPage(1);
                  }}
                  placeholder="Cari Peserta / NIP / Toko..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {onResetResults && (
                <button
                  onClick={() => setShowResetResultsModal(true)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title="Reset semua nilai ujian dan hapus data hasil pengerjaan"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Reset Nilai</span>
                </button>
              )}
            </div>
          </div>

          {/* Real-time sync status banner */}
          {completedCount === 0 ? (
            <div className="mx-4 sm:mx-5 my-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Status tersinkron dengan spreadsheet: Sheet <strong className="font-semibold">Hasil_Jawaban</strong> saat ini kosong (0 jawaban). Seluruh <strong className="font-semibold">{totalParticipants.toLocaleString('id-ID')} peserta</strong> berstatus <strong className="font-semibold text-emerald-800">Belum Ujian</strong>.
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                0 Selesai (100% Belum Ujian)
              </span>
            </div>
          ) : (
            <div className="mx-4 sm:mx-5 my-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Terdata <strong>{completedCount} peserta</strong> telah menyelesaikan ujian. Data aman tersimpan di sistem CBT.
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handlePushAllResults}
                  disabled={isPushingResults || results.length === 0}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
                >
                  <Send className={`w-3 h-3 ${isPushingResults ? 'animate-spin' : ''}`} />
                  <span>{isPushingResults ? 'Mengirim...' : 'Kirim ke Sheet Hasil_Jawaban'}</span>
                </button>
                {onResetResults && (
                  <button
                    onClick={() => setShowResetResultsModal(true)}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Reset Hasil
                  </button>
                )}
              </div>
            </div>
          )}

          {pushFeedback && (
            <div
              className={`mx-4 sm:mx-5 mb-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                pushFeedback.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {pushFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{pushFeedback.message}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">NIP</th>
                  <th className="py-3 px-4">Nama Peserta</th>
                  <th className="py-3 px-4">Kode Toko</th>
                  <th className="py-3 px-4">Nama Toko</th>
                  <th className="py-3 px-4 text-center">Jabatan</th>
                  <th className="py-3 px-4">Jenis Ujian</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Skor Akhir</th>
                  <th className="py-3 px-4 text-center">Durasi Pengerjaan</th>
                  <th className="py-3 px-4 text-right">Waktu Submit</th>
                  {onDeleteResult && <th className="py-3 px-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {paginatedActivityList.length > 0 ? (
                  paginatedActivityList.map((row) => {
                    const kode = row.kodeToko || (row.toko?.includes(' - ') ? row.toko.split(' - ')[0].trim() : row.toko) || '-';
                    const namaToko = row.namaToko || (row.toko?.includes(' - ') ? row.toko.split(' - ')[1].trim() : '') || '-';
                    const tipeUjian = row.examResult?.tipeUjian || row.tipeUjian;
                    const jabatan = row.examResult?.jabatan || row.jabatan || 'SCB';

                    return (
                      <tr key={row.nik} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {row.nik}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {row.nama}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {kode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {namaToko}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded font-bold text-xs ${
                            jabatan === 'SCG'
                              ? 'bg-pink-100 text-pink-800 border border-pink-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {jabatan}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {tipeUjian ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tipeUjian === 'Pre Test'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {tipeUjian}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.status === 'Selesai' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Selesai
                              </span>
                              {row.examResult?.isAutoSubmittedCheating && (
                                <span className="block text-[9px] font-extrabold text-rose-600 mt-0.5">
                                  Auto-Kecurangan
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              Belum Ujian
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          {row.examResult ? (
                            <span
                              className={`text-sm ${
                                row.examResult.skor >= config.passingGrade
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {row.examResult.skor} / 100
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.examResult ? (
                            <span className="font-mono text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                              {row.examResult.durasiFormatted}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-[11px] text-slate-500 font-mono">
                          {row.examResult ? row.examResult.waktuSelesai : '-'}
                        </td>
                        {onDeleteResult && (
                          <td className="py-3 px-3 text-center">
                            {row.examResult ? (
                              <button
                                onClick={() => {
                                  if (confirm(`Hapus hasil pengerjaan ${row.nama} (${row.nik}) dan kembalikan ke status Belum Ujian?`)) {
                                    onDeleteResult(row.nik);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Hapus nilai peserta ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-200">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={onDeleteResult ? 11 : 10} className="py-8 text-center text-xs text-slate-400">
                      Tidak ada data peserta ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Activity Table Pagination Controls */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Menampilkan{' '}
              <span className="font-bold text-slate-900">
                {participantActivityList.length === 0
                  ? 0
                  : (currentActivityPage - 1) * activityPageSize + 1}
              </span>{' '}
              sampai{' '}
              <span className="font-bold text-slate-900">
                {Math.min(currentActivityPage * activityPageSize, participantActivityList.length)}
              </span>{' '}
              dari{' '}
              <span className="font-bold text-blue-700">
                {participantActivityList.length}
              </span>{' '}
              Peserta
            </div>

            {totalActivityPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  disabled={currentActivityPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <span className="px-2.5 py-1 font-semibold text-slate-700">
                  Halaman {currentActivityPage} / {totalActivityPages}
                </span>

                <button
                  onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                  disabled={currentActivityPage === totalActivityPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub Tab 2: Kelola Bank Soal (Soal_Test) */}
      {activeAdminSubTab === 'bank_soal' && (
        <div className="space-y-4">
          {deleteFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deleteFeedback}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Daftar Soal Ujian ({questions.length} Butir)
              </h3>
              <p className="text-xs text-slate-500">
                Tersinkronisasi dengan sheet <span className="font-mono text-blue-600">Soal_Test</span> di Google Spreadsheet
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  placeholder="Cari materi soal..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                id="add-question-btn"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Soal</span>
              </button>
            </div>
          </div>

          {/* Banner Panduan Soal & Jawaban Gambar */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200 rounded-xl p-3.5 mb-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold text-blue-900">
                  Cara Memasukkan Gambar ke Soal &amp; Jawaban A, B, C, D:
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowImageGuide(!showImageGuide)}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                {showImageGuide ? 'Sembunyikan Panduan' : 'Lihat Cara Pasang'}
              </button>
            </div>

            {showImageGuide && (
              <div className="mt-3 pt-3 border-t border-blue-200/80 space-y-2 text-slate-700 leading-relaxed text-[11px]">
                <p>
                  Sistem mendukung gambar otomatis baik di kolom <strong>Soal</strong> maupun di pilihan jawaban <strong>A, B, C, dan D</strong>. Anda cukup menempelkan link gambar di sheet <code>Soal_Test</code> atau saat menambah soal:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div className="p-2.5 bg-white rounded-lg border border-blue-100 space-y-1">
                    <span className="font-bold text-blue-900 block">Metode 1: Menggunakan Google Drive (Paling Mudah)</span>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600">
                      <li>Upload foto gambar ke Google Drive Anda.</li>
                      <li>Klik kanan gambar &gt; <strong>Bagikan (Share)</strong> &gt; ubah Akses Umum menjadi <strong>Siapa saja yang memiliki link</strong>.</li>
                      <li>Salin link (contoh: <code>https://drive.google.com/file/d/.../view</code>).</li>
                      <li>Tempelkan link tersebut ke kolom pilihan A, B, C, atau D di sheet <code>Soal_Test</code>.</li>
                    </ol>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-blue-100 space-y-1">
                    <span className="font-bold text-blue-900 block">Metode 2: Menggunakan Link Gambar Web / Hosting</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-600">
                      <li>Bisa menggunakan URL gambar langsung berakhiran <code>.png</code>, <code>.jpg</code>, <code>.webp</code>.</li>
                      <li>Bisa menggunakan layanan hosting gambar gratis seperti Imgur, Postimages, atau ImgBB.</li>
                      <li>Bisa teks + gambar sekaligus (contoh: <code>Segitiga Pengaman https://drive.google.com/...</code>).</li>
                      <li>Peserta dapat mengklik tombol <strong>Perbesar</strong> saat ujian untuk melihat gambar secara detail.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {questions
              .filter((q) =>
                q.pertanyaan.toLowerCase().includes(questionSearch.toLowerCase()) ||
                (q.kategori && q.kategori.toLowerCase().includes(questionSearch.toLowerCase()))
              )
              .map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {q.kategori && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {q.kategori}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        Bobot: {q.bobot || 10} poin
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Kunci: Pilihan {q.kunciJawaban}
                      </span>
                      <button
                        onClick={() => setDeletingQuestion(q)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Hapus soal ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <RichQuestionContent content={q.pertanyaan} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                    <div className={`p-2.5 rounded-lg border ${q.kunciJawaban === 'A' ? 'bg-emerald-50 border-emerald-300 font-semibold' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="font-bold text-slate-800 mb-1">A:</div>
                      <RichOptionContent content={q.pilihanA} />
                    </div>
                    <div className={`p-2.5 rounded-lg border ${q.kunciJawaban === 'B' ? 'bg-emerald-50 border-emerald-300 font-semibold' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="font-bold text-slate-800 mb-1">B:</div>
                      <RichOptionContent content={q.pilihanB} />
                    </div>
                    <div className={`p-2.5 rounded-lg border ${q.kunciJawaban === 'C' ? 'bg-emerald-50 border-emerald-300 font-semibold' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="font-bold text-slate-800 mb-1">C:</div>
                      <RichOptionContent content={q.pilihanC} />
                    </div>
                    <div className={`p-2.5 rounded-lg border ${q.kunciJawaban === 'D' ? 'bg-emerald-50 border-emerald-300 font-semibold' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="font-bold text-slate-800 mb-1">D:</div>
                      <RichOptionContent content={q.pilihanD} />
                    </div>
                  </div>

                  {q.penjelasan && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <strong>Pembahasan:</strong> {q.penjelasan}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Sub Tab 3: Status Google Spreadsheet */}
      {activeAdminSubTab === 'spreadsheet' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Konfigurasi Google Spreadsheet</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Aplikasi ini terhubung langsung ke Google Sheets yang ditentukan pada parameter tugas.
            </p>

            {/* Error Guidance Card if Google Auth failed */}
            {syncStatus.error && (
              <div className="mb-5 p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-xs space-y-2.5 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-rose-900">Kendala Hubungkan Akun Google</p>
                    <p className="text-rose-700 mt-0.5 leading-relaxed">{syncStatus.error}</p>
                  </div>
                </div>

                {(syncStatus.error.includes('Authorized Domains') ||
                  syncStatus.error.includes('unauthorized-domain') ||
                  syncStatus.error.includes('diizinkan')) && (
                  <div className="mt-3 pt-3 border-t border-rose-200/60 bg-white p-3.5 rounded-lg border border-slate-200 space-y-2 text-slate-700">
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-100">
                      <span className="font-bold text-slate-900">Domain Website Anda Saat Ini:</span>
                      <div className="flex items-center gap-1.5">
                        <code className="px-2 py-0.5 bg-blue-50 text-blue-800 font-mono font-bold rounded border border-blue-200">
                          {typeof window !== 'undefined' ? window.location.hostname : 'evabul-sc.app'}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              navigator.clipboard.writeText(window.location.hostname);
                              setCopiedDomain(true);
                              setTimeout(() => setCopiedDomain(false), 2000);
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                          <span>{copiedDomain ? 'Tersalin!' : 'Salin Domain'}</span>
                        </button>
                      </div>
                    </div>

                    <p className="font-bold text-slate-800 pt-1">
                      Langkah Mengizinkan Domain di Firebase Console (Hanya 1x):
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                      <li>
                        Buka{' '}
                        <a
                          href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-bold underline inline-flex items-center gap-0.5"
                        >
                          Firebase Console Authentication Settings
                          <ExternalLink className="w-3 h-3 inline ml-0.5" />
                        </a>
                      </li>
                      <li>
                        Pilih menu / tab <strong>Authorized domains</strong> (Domain yang diizinkan)
                      </li>
                      <li>
                        Klik tombol <strong>Add domain</strong> (Tambahkan domain)
                      </li>
                      <li>
                        Tempel domain{' '}
                        <span className="font-mono font-bold text-slate-900">
                          {typeof window !== 'undefined' ? window.location.hostname : 'evabul-sc.app'}
                        </span>
                      </li>
                      <li>
                        Klik <strong>Save</strong> (Simpan), lalu klik kembali tombol <strong>Hubungkan Akun Google</strong> di bawah.
                      </li>
                    </ol>

                    <div className="mt-2.5 p-2.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-[11px] leading-relaxed">
                      💡 <strong>Catatan:</strong> Sinkronisasi 5.011 peserta, bank soal, pengerjaan ujian peserta, dan rekap hasil nilai <strong>tetap berfungsi normal</strong> tanpa harus menghubungkan akun Google.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GANTI LINK SPREADSHEET (PENGGANTIAN SPREADSHEET BARU) */}
            <div className="bg-white rounded-xl p-5 border-2 border-blue-200 shadow-xs mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Ganti Link Google Spreadsheet
                    </h4>
                    <p className="text-xs text-slate-500">
                      Ganti ke file spreadsheet baru kapan saja tanpa perlu deploy ulang kode.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isCustomSheet ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      Spreadsheet Baru Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                      Spreadsheet Bawaan (Default)
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex flex-wrap items-center justify-between gap-1">
                  <span>Tempel Link Lengkap atau ID Google Spreadsheet Baru:</span>
                  <span className="text-[11px] font-normal text-slate-500 font-mono">
                    ID Terdeteksi: <strong className="text-slate-800">{extractSpreadsheetId(spreadsheetInput) || '-'}</strong>
                  </span>
                </label>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="text"
                    value={spreadsheetInput}
                    onChange={(e) => setSpreadsheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    className="flex-1 px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-900 shadow-2xs"
                  />
                  <button
                    onClick={handleSaveSpreadsheet}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan &amp; Terapkan</span>
                  </button>
                  <button
                    onClick={handleTestSpreadsheetAccess}
                    disabled={isTestingSpreadsheet}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSpreadsheet ? 'animate-spin' : ''}`} />
                    <span>{isTestingSpreadsheet ? 'Menguji...' : 'Uji Akses'}</span>
                  </button>
                  {isCustomSheet && (
                    <button
                      onClick={handleResetSpreadsheet}
                      className="px-3 py-2.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      title="Kembalikan ke spreadsheet bawaan"
                    >
                      <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                      <span>Reset Default</span>
                    </button>
                  )}
                </div>

                {spreadsheetFeedback && (
                  <div
                    className={`mt-2 p-3 rounded-lg text-xs flex flex-col gap-1.5 ${
                      spreadsheetFeedback.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {spreadsheetFeedback.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="font-semibold">{spreadsheetFeedback.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Info & Persyaratan Spreadsheet */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Spreadsheet Terpasang:</span>
                    <a
                      href={currentSpreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <span>Buka File Spreadsheet</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="font-mono text-[11px] text-slate-700 break-all bg-white p-2 rounded border border-slate-200 select-all">
                    {currentSpreadsheetId}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                    <span>Status Akun Google:</span>
                    <span className="font-semibold text-slate-800">
                      {syncStatus.isConnected ? (
                        <span className="text-emerald-700 font-bold">Terhubung ({syncStatus.userEmail})</span>
                      ) : (
                        <span className="text-amber-700">Belum Terhubung (Public Read-Only Aktif)</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                    <span>Petunjuk Spreadsheet Baru:</span>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] space-y-0.5 text-amber-800 leading-relaxed pl-0.5">
                    <li>Di Google Sheets baru Anda, klik tombol <strong>Bagikan (Share)</strong> di kanan atas.</li>
                    <li>Ubah <em>Akses umum</em> menjadi <strong>"Siapa saja yang memiliki link: Pelihat (Viewer)"</strong>.</li>
                    <li>Pastikan memiliki tab sheet: <code>Data_Peserta</code>, <code>Soal_Test</code>, dan <code>Hasil_Jawaban</code>.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* GANTI LINK GOOGLE FORM (GFORM CONFIGURATION) */}
            <div className="bg-white rounded-xl p-5 border-2 border-indigo-200 shadow-xs mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Konfigurasi Link Google Form (GForm)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Ubah URL Google Form tujuan pengiriman jawaban ujian peserta jika link form berubah.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  Aktif & Terintegrasi Otomatis
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex flex-wrap items-center justify-between gap-1">
                  <span>Tempel Link Lengkap Google Form Baru (/viewform):</span>
                  <a
                    href={gformInput}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline text-[11px] font-mono font-semibold"
                  >
                    Buka GForm Aktif ↗
                  </a>
                </label>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="text"
                    value={gformInput}
                    onChange={(e) => setGformInput(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    className="flex-1 px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono bg-white text-slate-900 shadow-2xs"
                  />
                  <button
                    onClick={handleSaveGForm}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Link GForm</span>
                  </button>
                  <button
                    onClick={handleResetGForm}
                    className="px-3 py-2.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    title="Kembalikan ke Link GForm bawaan"
                  >
                    <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                    <span>Reset Default</span>
                  </button>
                </div>

                {gformFeedback && (
                  <div
                    className={`mt-2 p-3 rounded-lg text-xs flex items-center gap-2 ${
                      gformFeedback.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {gformFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-semibold">{gformFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {!syncStatus.isConnected && (
                <button
                  onClick={onConnectGoogle}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Hubungkan Akun Google</span>
                </button>
              )}

              <button
                onClick={onSyncWithSheets}
                disabled={syncStatus.isLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isLoading ? 'animate-spin' : ''}`} />
                <span>Tarik Data Terbaru Sekarang</span>
              </button>

              <button
                onClick={handleSeedTemplate}
                disabled={seedLoading}
                className="px-4 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{seedLoading ? 'Sedang Inisialisasi...' : 'Inisialisasi Sample ke Spreadsheet'}</span>
              </button>
            </div>

            {seedFeedback && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  seedFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {seedFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{seedFeedback.message}</span>
              </div>
            )}

            {/* KONEKSI OTOMATIS: GOOGLE APPS SCRIPT WEBHOOK UNTUK SHEET HASIL_JAWABAN */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Penerima Hasil Ujian Otomatis (Google Apps Script Webhook)
                      </h4>
                      <p className="text-xs text-slate-600">
                        Solusi agar seluruh peserta (dari HP / Laptop manapun) dapat mengirim skor ujian langsung masuk ke sheet <strong>Hasil_Jawaban</strong> secara real-time.
                      </p>
                    </div>
                  </div>
                  <div>
                    {appsScriptUrlInput.trim() ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Webhook Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Belum Terpasang
                      </span>
                    )}
                  </div>
                </div>

                {/* Panduan Singkat 4 Langkah */}
                <div className="bg-white rounded-lg p-3.5 border border-blue-100 mb-4 text-xs text-slate-700 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Cara Pasang / Perbarui Kode Apps Script (Mendukung 30+ Soal):</span>
                    <button
                      onClick={handleCopyAppsScript}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'Kode Berhasil Disalin!' : 'Salin Kode Apps Script Baru'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] leading-relaxed">
                    <strong>PENTING:</strong> Kode Apps Script telah ditingkatkan untuk memasukkan seluruh <strong>30 butir soal</strong> (Kolom Soal 1 s/d 30) ke sheet <code>Hasil_Jawaban</code> secara otomatis.
                    Jika sebelumnya Anda sudah memasang script versi 15 soal, ikuti langkah 1-3 di bawah ini agar pembaruan langsung aktif.
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                    <li>
                      Buka Google Spreadsheet Anda &gt; klik menu <strong>Ekstensi</strong> &gt; <strong>Apps Script</strong>.
                    </li>
                    <li>
                      Hapus semua kode lama di editor, klik tombol <strong>Salin Kode Apps Script Baru</strong> di atas, lalu tempel (Paste).
                    </li>
                    <li>
                      Klik <strong>Simpan (ikon disket)</strong>.
                    </li>
                    <li>
                      Klik menu <strong>Terapkan (Deploy)</strong> di kanan atas &gt; pilih <strong>Kelola penerapan (Manage deployments)</strong>.
                    </li>
                    <li>
                      Klik ikon pensil <strong>Edit</strong> pada penerapan aktif &gt; pada bagian <strong>Versi (Version)</strong>, pilih <strong>Versi baru (New version)</strong> &gt; klik <strong>Terapkan (Deploy)</strong>.
                    </li>
                  </ol>
                </div>

                {/* Form Input Webhook URL */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    URL Aplikasi Web Apps Script:
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                      type="url"
                      value={appsScriptUrlInput}
                      onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                    />
                    <button
                      onClick={handleSaveAppsScriptUrl}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      Simpan URL
                    </button>
                    <button
                      onClick={handleTestAppsScript}
                      disabled={isTestingScript}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Send className={`w-3.5 h-3.5 ${isTestingScript ? 'animate-spin' : ''}`} />
                      <span>{isTestingScript ? 'Sedang Menguji...' : 'Uji Kirim Baris TEST ke Sheet'}</span>
                    </button>
                  </div>

                  {scriptFeedback && (
                    <div
                      className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        scriptFeedback.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {scriptFeedback.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{scriptFeedback.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SINKRONISASI & EKSPOR HASIL JAWABAN (BATCH PUSH & DOWNLOAD) */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Kelola &amp; Kirim Data ke Sheet Hasil_Jawaban</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Total <strong>{results.length}</strong> peserta telah menyelesaikan ujian dan nilainya tersimpan di sistem.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handlePushAllResults}
                    disabled={isPushingResults || results.length === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 ${isPushingResults ? 'animate-spin' : ''}`} />
                    <span>{isPushingResults ? 'Sedang Mengirim...' : `Kirim ${results.length} Data ke Sheet Hasil_Jawaban`}</span>
                  </button>

                  <button
                    onClick={handleSetupHeader}
                    disabled={isSettingHeader}
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className={`w-3.5 h-3.5 ${isSettingHeader ? 'animate-spin' : ''}`} />
                    <span>Pasang / Perbarui Header Kolom Hasil_Jawaban (A1:AS1 - Soal 1 s/d 30)</span>
                  </button>

                  <button
                    onClick={handleCopyTsv}
                    disabled={results.length === 0}
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedTsv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTsv ? 'Data Berhasil Disalin!' : 'Salin Data untuk Paste ke Spreadsheet (Ctrl+V)'}</span>
                  </button>

                  <button
                    onClick={handleDownloadCsv}
                    disabled={results.length === 0}
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>

                {pushFeedback && (
                  <div
                    className={`mt-3.5 p-3 rounded-lg text-xs flex items-center gap-2 ${
                      pushFeedback.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {pushFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{pushFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reset / Hapus Seluruh Nilai Ujian (Hasil_Jawaban) */}
            {onResetResults && (
              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-rose-50/70 border border-rose-200 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Reset & Hapus Semua Nilai (Sheet: Hasil_Jawaban)</span>
                    </h4>
                    <p className="text-xs text-rose-700/90 leading-relaxed">
                      Mengosongkan seluruh perolehan skor ujian, catatan jawaban, dan mereset status semua peserta menjadi <strong>Belum Ujian</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowResetResultsModal(true)}
                    className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset Semua Nilai {results.length > 0 ? `(${results.length})` : '(0)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub Tab 4: Pengaturan Ujian */}
      {activeAdminSubTab === 'pengaturan' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Konfigurasi Parameter Ujian
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Atur durasi waktu pengerjaan dan ambang batas kelulusan (KKM)
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Judul Sesi Pelatihan / Evaluasi
              </label>
              <input
                type="text"
                value={config.judulUjian || 'Training Evabul SC'}
                onChange={(e) => onUpdateConfig({ ...config, judulUjian: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Durasi Pengerjaan (Menit)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={config.durasiMenit}
                    onChange={(e) =>
                      onUpdateConfig({ ...config, durasiMenit: Number(e.target.value) || 20 })
                    }
                    className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Standar Kelulusan / KKM (Skor)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={config.passingGrade}
                    onChange={(e) =>
                      onUpdateConfig({ ...config, passingGrade: Number(e.target.value) || 75 })
                    }
                    className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Award className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isExamOpen}
                  onChange={(e) => onUpdateConfig({ ...config, isExamOpen: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Buka Pintu Ujian (Peserta dapat langsung mulai mengerjakan)
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab 5: Ubah Password Admin */}
      {activeAdminSubTab === 'password_admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ubah Password Portal Admin
              </h3>
              <p className="text-xs text-slate-500">
                Atur kata sandi baru untuk login ke sistem Administrator
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            {passwordFeedback && (
              <div
                className={`p-3.5 rounded-xl border mb-5 text-xs font-semibold flex items-start gap-2.5 ${
                  passwordFeedback.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {passwordFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangeAdminPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password Saat Ini / Lama
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPasswordInput}
                    onChange={(e) => setOldPasswordInput(e.target.value)}
                    placeholder="Masukkan password admin saat ini"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Ketik ulang password baru"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Simpan Password Baru</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetAdminPassword}
                  className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  title="Kembalikan ke password default 'Tcsby123'"
                >
                  <span>Reset Ke Bawaan ('Tcsby123')</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Question */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Tambah Soal Baru ke Sheet Soal_Test
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Kategori / Topik Soal
                </label>
                <input
                  type="text"
                  value={newQuestion.kategori}
                  onChange={(e) => setNewQuestion({ ...newQuestion, kategori: e.target.value })}
                  placeholder="Contoh: Operasional Toko & Display"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-xs">
                    Pertanyaan Soal
                  </label>
                  <span className="text-[11px] text-blue-600 font-medium">
                    💡 Bisa teks pertanyaan + Link Gambar
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={newQuestion.pertanyaan}
                  onChange={(e) => setNewQuestion({ ...newQuestion, pertanyaan: e.target.value })}
                  placeholder="Tuliskan pertanyaan ujian... (Jika ada diagram/gambar, tempel link Google Drive atau URL di sini)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs"
                  required
                />
                {newQuestion.pertanyaan && parseImageContent(newQuestion.pertanyaan).imageUrl && (
                  <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Pratinjau Gambar Soal:</span>
                    <RichQuestionContent content={newQuestion.pertanyaan} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-xs">
                    Pilihan Jawaban (A, B, C, D)
                  </label>
                  <span className="text-[11px] text-blue-600 font-medium">
                    💡 Bisa teks atau Link Gambar (Drive/URL)
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 font-bold text-center text-xs">A:</span>
                      <input
                        type="text"
                        value={newQuestion.pilihanA}
                        onChange={(e) => setNewQuestion({ ...newQuestion, pilihanA: e.target.value })}
                        placeholder="Teks pilihan A atau tempel link gambar (Google Drive / URL)"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>
                    {newQuestion.pilihanA && parseImageContent(newQuestion.pilihanA).imageUrl && (
                      <div className="ml-8 mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block mb-1">Pratinjau Gambar A:</span>
                        <RichOptionContent content={newQuestion.pilihanA} />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 font-bold text-center text-xs">B:</span>
                      <input
                        type="text"
                        value={newQuestion.pilihanB}
                        onChange={(e) => setNewQuestion({ ...newQuestion, pilihanB: e.target.value })}
                        placeholder="Teks pilihan B atau tempel link gambar (Google Drive / URL)"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>
                    {newQuestion.pilihanB && parseImageContent(newQuestion.pilihanB).imageUrl && (
                      <div className="ml-8 mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block mb-1">Pratinjau Gambar B:</span>
                        <RichOptionContent content={newQuestion.pilihanB} />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 font-bold text-center text-xs">C:</span>
                      <input
                        type="text"
                        value={newQuestion.pilihanC}
                        onChange={(e) => setNewQuestion({ ...newQuestion, pilihanC: e.target.value })}
                        placeholder="Teks pilihan C atau tempel link gambar (Google Drive / URL)"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>
                    {newQuestion.pilihanC && parseImageContent(newQuestion.pilihanC).imageUrl && (
                      <div className="ml-8 mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block mb-1">Pratinjau Gambar C:</span>
                        <RichOptionContent content={newQuestion.pilihanC} />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 font-bold text-center text-xs">D:</span>
                      <input
                        type="text"
                        value={newQuestion.pilihanD}
                        onChange={(e) => setNewQuestion({ ...newQuestion, pilihanD: e.target.value })}
                        placeholder="Teks pilihan D atau tempel link gambar (Google Drive / URL)"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>
                    {newQuestion.pilihanD && parseImageContent(newQuestion.pilihanD).imageUrl && (
                      <div className="ml-8 mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-semibold block mb-1">Pratinjau Gambar D:</span>
                        <RichOptionContent content={newQuestion.pilihanD} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Kunci Jawaban Benar
                  </label>
                  <select
                    value={newQuestion.kunciJawaban}
                    onChange={(e) => setNewQuestion({ ...newQuestion, kunciJawaban: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-emerald-700"
                  >
                    <option value="A">Pilihan A</option>
                    <option value="B">Pilihan B</option>
                    <option value="C">Pilihan C</option>
                    <option value="D">Pilihan D</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Bobot Poin
                  </label>
                  <input
                    type="number"
                    value={newQuestion.bobot}
                    onChange={(e) => setNewQuestion({ ...newQuestion, bobot: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Pembahasan / Penjelasan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={newQuestion.penjelasan}
                  onChange={(e) => setNewQuestion({ ...newQuestion, penjelasan: e.target.value })}
                  placeholder="Keterangan singkat materi SOP..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuestion}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSavingQuestion ? 'Menyimpan...' : 'Simpan ke Bank Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Butir Soal #{deletingQuestion.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini akan menghapus soal dari database & spreadsheet
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 mb-5">
              <span className="font-semibold text-slate-900 block mb-1">Pertanyaan:</span>
              <p className="line-clamp-3 text-slate-600">{deletingQuestion.pertanyaan}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingQuestion(null)}
                disabled={isDeletingQuestion}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteQuestion}
                disabled={isDeletingQuestion}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingQuestion ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Soal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Confirm Reset All Results */}
      {showResetResultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reset & Hapus Semua Nilai Ujian?
                </h3>
                <p className="text-xs text-slate-500">
                  Mengosongkan seluruh perolehan nilai dan mengembalikan status peserta ke Belum Ujian
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 mb-5 space-y-2.5">
              <p>
                Saat ini terdapat <strong className="text-slate-900">{results.length} data nilai pengerjaan</strong> tersimpan di aplikasi.
              </p>
              {appsScriptUrlInput.trim() ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Webhook Apps Script Aktif:</strong> Perintah reset akan dikirim otomatis ke Google Spreadsheet untuk menghapus seluruh baris data pada sheet <strong>Hasil_Jawaban</strong>.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Webhook Apps Script Belum Terpasang:</span>
                    <p className="mt-0.5 text-slate-600">
                      Seluruh nilai di web akan langsung dibersihkan menjadi 0. Untuk membersihkan baris di Google Spreadsheet secara manual, buka spreadsheet melalui tombol di bawah.
                    </p>
                  </div>
                </div>
              )}
              <a
                href={getSpreadsheetUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Google Spreadsheet Target</span>
              </a>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowResetResultsModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onResetResults) {
                    onResetResults();
                  }
                  setShowResetResultsModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Semua Nilai</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
