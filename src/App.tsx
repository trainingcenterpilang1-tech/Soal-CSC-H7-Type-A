import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ParticipantLogin } from './components/ParticipantLogin';
import { ExamScreen } from './components/ExamScreen';
import { ResultScreen } from './components/ResultScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { ParticipantManagement } from './components/ParticipantManagement';
import { AdminLoginModal } from './components/AdminLoginModal';
import { Participant, Question, ExamResult, ExamConfig, SheetSyncStatus } from './types';
import { DEFAULT_EXAM_CONFIG, SPREADSHEET_URL } from './data/defaultData';
import {
  initAuth,
  googleSignIn,
} from './lib/firebase';
import {
  fetchDataPesertaFromSheet,
  fetchDataLoginFromSheet,
  fetchQuestionsFromSheet,
  fetchResultsFromSheet,
  getCachedParticipants,
  getCachedDataPeserta,
  getCachedDataLogin,
  saveCachedDataPeserta,
  saveCachedDataLogin,
  saveCachedParticipants,
  getCachedQuestions,
  getCachedResults,
  getCachedConfig,
  saveCachedQuestions,
  saveCachedResults,
  saveCachedConfig,
  clearCachedResults,
  clearAllResultsFromSheet,
  deleteSingleResultFromSheet,
  getRunningDatePasswords,
  syncServerSpreadsheetConfig,
  SYNC_EVENT_NAME,
} from './lib/sheetsService';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Lock, Smartphone } from 'lucide-react';

export default function App() {
  // Mode: Participant vs Admin
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<'dashboard' | 'peserta' | 'juara'>('dashboard');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  // Participant & Exam Session
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [isExamActive, setIsExamActive] = useState<boolean>(false);
  const [activeResult, setActiveResult] = useState<ExamResult | null>(null);
  const [resultDeliveredToSheet, setResultDeliveredToSheet] = useState<boolean>(false);

  // App Data
  const [dataPeserta, setDataPeserta] = useState<Participant[]>(getCachedDataPeserta());
  const [dataLogin, setDataLogin] = useState<Participant[]>(getCachedDataLogin());
  const [participants, setParticipants] = useState<Participant[]>(getCachedParticipants());
  const [questions, setQuestions] = useState<Question[]>(getCachedQuestions());
  const [results, setResults] = useState<ExamResult[]>(getCachedResults());
  const [config, setConfig] = useState<ExamConfig>(getCachedConfig());

  // Google Sheets Connection & Sync Status
  const [syncStatus, setSyncStatus] = useState<SheetSyncStatus>({
    isConnected: false,
    userEmail: null,
    lastSynced: null,
    isLoading: false,
    error: null,
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync with Google Sheets:
  // - Data_Peserta -> Aktivitas & Status Peserta
  // - Data_Login   -> Menu Data Peserta
  // - Soal_Test    -> Bank Soal
  // - Hasil_Jawaban -> Skor & Peringkat Juara
  const syncDataFromSheets = useCallback(async (silent: boolean = false) => {
    setSyncStatus((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [fetchedPeserta, fetchedLogin, fetchedQuestions, fetchedResults] = await Promise.all([
        fetchDataPesertaFromSheet(),
        fetchDataLoginFromSheet(),
        fetchQuestionsFromSheet(),
        fetchResultsFromSheet(),
      ]);

      // Synchronize both dataPeserta and dataLogin from Supabase Data_Peserta
      const activePesertaList = fetchedLogin.length > 0 ? fetchedLogin : fetchedPeserta;
      if (activePesertaList.length > 0) {
        setDataPeserta(activePesertaList);
        saveCachedDataPeserta(activePesertaList);
        setDataLogin(activePesertaList);
        saveCachedDataLogin(activePesertaList);
        setParticipants(activePesertaList);
        saveCachedParticipants(activePesertaList);
      }

      if (fetchedQuestions.length > 0) {
        setQuestions(fetchedQuestions);
        saveCachedQuestions(fetchedQuestions);
      }

      // Hasil_Jawaban: Merge fetched results with local CBT cache and respect reset timestamp
      const lastResetStr = localStorage.getItem('stm_last_reset_timestamp');
      const lastResetTime = lastResetStr ? Number(lastResetStr) : 0;

      // Filter out sheet results that are from before the last reset
      const validFetchedResults = fetchedResults.filter((r) => {
        if (!lastResetTime) return true;
        try {
          if (r.timestamp) {
            const rowTime = new Date(r.timestamp).getTime();
            if (!isNaN(rowTime) && rowTime < lastResetTime) {
              return false;
            }
          }
        } catch {}
        return true;
      });

      // Merge: Keep sheet results + retain locally completed results (pending sync)
      const currentLocal = getCachedResults();
      const resultMap = new Map<string, ExamResult>();

      validFetchedResults.forEach((r) => {
        resultMap.set(r.nik, { ...r, syncedToSheet: true });
      });

      currentLocal.forEach((lr) => {
        if (!resultMap.has(lr.nik)) {
          resultMap.set(lr.nik, { ...lr, syncedToSheet: lr.syncedToSheet ?? false });
        }
      });

      const mergedResultsList = Array.from(resultMap.values());
      setResults(mergedResultsList);
      saveCachedResults(mergedResultsList);

      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncStatus((prev) => ({
        ...prev,
        isLoading: false,
        lastSynced: now,
      }));
      if (!silent) {
        showToast('Data berhasil disinkronkan dari Google Spreadsheet!', 'success');
      }
    } catch (err: any) {
      console.warn('Sync failed:', err);
      setSyncStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message,
      }));
    }
  }, []);

  // Fetch live sheets data immediately on mount and setup auto-sync
  useEffect(() => {
    syncServerSpreadsheetConfig();
    syncDataFromSheets(true);

    // 1. Periodic background polling every 8 seconds
    const pollInterval = setInterval(() => {
      syncDataFromSheets(true);
    }, 8000);

    // 2. Trigger sync on window focus & tab visibility change
    const handleFocus = () => syncDataFromSheets(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncDataFromSheets(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Custom real-time sync event across window / tabs
    const handleSyncEvent = () => {
      syncDataFromSheets(true);
    };
    window.addEventListener(SYNC_EVENT_NAME, handleSyncEvent);

    // 4. Cross-tab BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('stm_sync_channel');
        bc.onmessage = () => {
          syncDataFromSheets(true);
        };
      } catch {
        // Fallback
      }
    }

    // 5. Cross-tab storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'stm_last_sync_timestamp' || e.key === 'stm_results_cache') {
        syncDataFromSheets(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(SYNC_EVENT_NAME, handleSyncEvent);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [syncDataFromSheets]);

  // Initialize Auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setSyncStatus((prev) => ({
          ...prev,
          isConnected: true,
          userEmail: user.email,
        }));
        if (token) {
          fetch('/api/sheets/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }).catch(() => {});
        }
        syncDataFromSheets(false);
      },
      () => {
        setSyncStatus((prev) => ({
          ...prev,
          isConnected: false,
          userEmail: null,
        }));
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [syncDataFromSheets]);

  // Connect Google via OAuth popup
  const handleConnectGoogle = async () => {
    setSyncStatus((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await googleSignIn();
      if (result) {
        setSyncStatus({
          isConnected: true,
          userEmail: result.user.email,
          lastSynced: new Date().toLocaleTimeString(),
          isLoading: false,
          error: null,
        });
        // Forward token to server so server can append to Google Sheets API for all participants!
        if (result.accessToken) {
          fetch('/api/sheets/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: result.accessToken }),
          }).catch(() => {});
        }
        showToast(`Terhubung dengan akun Google: ${result.user.email}`, 'success');
        await syncDataFromSheets();
      }
    } catch (error: any) {
      console.error('Sign-in failed', error);
      const isDomainError =
        error.code === 'auth/unauthorized-domain' ||
        error.message?.includes('unauthorized-domain') ||
        error.message?.includes('Authorized Domains');
      
      const errorMessage = isDomainError
        ? `Domain "${window.location.hostname}" belum diizinkan di Firebase Authentication. Tambahkan domain ini ke Authorized Domains di Firebase Console.`
        : error.message || 'Gagal menghubungkan akun Google';

      setSyncStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      showToast(
        isDomainError
          ? 'Domain belum diizinkan di Firebase. Lihat panduan di tab Status Google Spreadsheet.'
          : errorMessage,
        'error'
      );
    }
  };

  // Participant login callback
  const handleLoginSuccess = (participant: Participant) => {
    setCurrentParticipant(participant);
    setActiveResult(null);
    setIsExamActive(true);
  };

  // Exam completion callback
  const handleFinishExam = (result: ExamResult, deliveredToSheet: boolean = false) => {
    setIsExamActive(false);
    setActiveResult(result);
    setResultDeliveredToSheet(deliveredToSheet);
    setResults((prev) => {
      const filtered = prev.filter((r) => r.nik !== result.nik);
      return [result, ...filtered];
    });
    if (result.isAutoSubmittedCheating) {
      showToast(
        `Ujian dihentikan otomatis oleh Sistem Anti-Kecurangan! Nilai Anda: ${result.skor}`,
        'error'
      );
    } else if (deliveredToSheet) {
      showToast('Jawaban Anda berhasil masuk ke sheet Hasil_Jawaban Google Spreadsheet!', 'success');
    } else {
      showToast(`Jawaban Anda berhasil disimpan! Skor: ${result.skor}`, 'success');
    }
  };

  // Logout participant
  const handleLogoutParticipant = () => {
    setCurrentParticipant(null);
    setIsExamActive(false);
    setActiveResult(null);
  };

  // Delete single participant exam result
  const handleDeleteSingleResult = async (nik: string) => {
    try {
      const res = await deleteSingleResultFromSheet(nik, results);
      setResults((prev) => prev.filter((r) => r.nik !== nik));
      showToast(res.message, 'success');
    } catch {
      setResults((prev) => prev.filter((r) => r.nik !== nik));
      showToast(`Hasil ujian NIP ${nik} berhasil dihapus.`, 'success');
    }
  };

  // Reset all exam results (kosongkan data pengerjaan & hapus semua nilai di sistem dan sheet)
  const handleResetResults = async () => {
    const previousResults = [...results];
    setResults([]);
    try {
      const res = await clearAllResultsFromSheet(previousResults);
      showToast(res.message, 'success');
    } catch {
      clearCachedResults();
      showToast('Seluruh nilai ujian berhasil direset ke 0 (semua peserta kembali ke status Belum Ujian).', 'success');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-200 max-w-md w-full px-4">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={() => {
          setIsAdminModalOpen(false);
          setIsAdmin(true);
          setAdminTab('dashboard');
          showToast('Mode Admin aktif: Dashboard & Papan Juara tersedia', 'success');
        }}
      />

      {/* Header */}
      <Header
        isAdmin={isAdmin}
        adminTab={adminTab}
        setAdminTab={setAdminTab}
        onLogoutAdmin={() => {
          setIsAdmin(false);
          showToast('Kembali ke tampilan peserta', 'info');
        }}
        onOpenAdminLogin={() => setIsAdminModalOpen(true)}
        currentParticipant={currentParticipant}
        onLogoutParticipant={handleLogoutParticipant}
        syncStatus={syncStatus}
        onSyncWithSheets={syncDataFromSheets}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full">
        {/* ===================== PARTICIPANT VIEW ===================== */}
        {!isAdmin && (
          <div className="w-full flex-1 flex flex-col justify-center items-center">
            {isExamActive && currentParticipant ? (
              /* 1. Exam Screen */
              <div className="w-full">
                <ExamScreen
                  participant={currentParticipant}
                  questions={questions}
                  config={config}
                  onFinishExam={handleFinishExam}
                  onCancelExam={() => {
                    if (confirm('Batalkan ujian dan kembali ke menu login?')) {
                      setIsExamActive(false);
                    }
                  }}
                />
              </div>
            ) : activeResult ? (
              /* 2. Real-time Result Screen */
              <div className="w-full">
                <ResultScreen
                  result={activeResult}
                  questions={questions}
                  config={config}
                  deliveredToSheet={resultDeliveredToSheet}
                  onGoToLeaderboard={() => {}}
                  onRetakeExam={() => {
                    if (currentParticipant) {
                      setIsExamActive(true);
                      setActiveResult(null);
                    }
                  }}
                  onBackToLogin={() => {
                    setCurrentParticipant(null);
                    setActiveResult(null);
                  }}
                />
              </div>
            ) : (
              /* 3. Initial View: Login Menu */
              <div className="w-full max-w-lg mx-auto py-6 sm:py-10 px-4">
                <ParticipantLogin
                  participants={participants}
                  dataLogin={dataLogin}
                  onLoginSuccess={handleLoginSuccess}
                  examConfig={config}
                  totalQuestions={questions.length}
                  existingResults={results}
                  onViewResult={(r) => setActiveResult(r)}
                  onOpenAdminLogin={() => setIsAdminModalOpen(true)}
                />
              </div>
            )}
          </div>
        )}

        {/* ===================== ADMIN VIEW ===================== */}
        {isAdmin && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            {adminTab === 'dashboard' ? (
              /* Aktivitas & Status Peserta mengambil data dari database Data_Peserta (Supabase) */
              <AdminDashboard
                participants={dataLogin}
                questions={questions}
                results={results}
                config={config}
                onUpdateConfig={(newConfig) => {
                  setConfig(newConfig);
                  saveCachedConfig(newConfig);
                  showToast('Konfigurasi ujian berhasil disimpan!', 'success');
                }}
                onUpdateQuestions={(newQuestions) => {
                  setQuestions(newQuestions);
                  saveCachedQuestions(newQuestions);
                  showToast('Bank soal berhasil diperbarui!', 'success');
                }}
                syncStatus={syncStatus}
                onSyncWithSheets={syncDataFromSheets}
                onConnectGoogle={handleConnectGoogle}
                onResetResults={handleResetResults}
                onDeleteResult={handleDeleteSingleResult}
              />
            ) : adminTab === 'peserta' ? (
              /* Menu Data Peserta (NIK, Nama, Password) mengambil data dari sheet Data_Login */
              <ParticipantManagement
                participants={dataLogin}
                results={results}
                onUpdateParticipants={(newLoginData) => {
                  setDataLogin(newLoginData);
                  saveCachedDataLogin(newLoginData);
                  showToast('Data akun peserta berhasil diperbarui!', 'success');
                }}
                syncStatus={syncStatus}
                onSyncWithSheets={syncDataFromSheets}
                onLoginAsParticipant={(p) => {
                  setIsAdmin(false);
                  const enriched = participants.find((item) => item.nik === p.nik) || p;
                  handleLoginSuccess(enriched);
                  showToast(`Login sebagai ${p.nama} (${p.nik})`, 'success');
                }}
              />
            ) : (
              <LeaderboardScreen
                results={results}
                onResetResults={handleResetResults}
                onDeleteResult={handleDeleteSingleResult}
              />
            )}
          </div>
        )}
      </main>

      {/* Responsive Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-4 sm:px-6 text-xs text-slate-500 mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto text-center sm:text-left">
          <span>Bang Ajiib &copy; 2026 Training CSCI - Indomaret</span>
          {!isAdmin ? (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 font-medium transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAdmin(false)}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Mode Peserta
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
