import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  UserCheck,
  UserX,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Participant, ExamResult, SheetSyncStatus } from '../types';
import {
  addLoginAccountToSheet,
  addParticipantToSheet,
  saveCachedDataLogin,
  saveCachedParticipants,
  getSpreadsheetUrl,
  getRunningDatePasswords,
} from '../lib/sheetsService';

interface ParticipantManagementProps {
  participants: Participant[];
  results: ExamResult[];
  onUpdateParticipants: (newParticipants: Participant[]) => void;
  syncStatus: SheetSyncStatus;
  onSyncWithSheets: () => void;
  onLoginAsParticipant?: (participant: Participant) => void;
}

export const ParticipantManagement: React.FC<ParticipantManagementProps> = ({
  participants,
  results,
  onUpdateParticipants,
  syncStatus,
  onSyncWithSheets,
  onLoginAsParticipant,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [deletingParticipant, setDeletingParticipant] = useState<Participant | null>(null);

  const todayPasswordInfo = getRunningDatePasswords();

  // New Participant Form State
  const [newNik, setNewNik] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newPassword, setNewPassword] = useState(todayPasswordInfo.primary);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Map of results by NIK
  const resultMap = new Map<string, ExamResult>();
  results.forEach((r) => resultMap.set(r.nik, r));

  // Filter participants
  const filteredParticipants = participants.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.nik.toLowerCase().includes(term) ||
      p.nama.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNik = newNik.trim();
    const cleanNama = newNama.trim();
    const cleanPass = newPassword.trim() || '123';

    if (!cleanNik || !cleanNama) {
      setFormError('NIP dan Nama Lengkap wajib diisi!');
      return;
    }

    // Check duplicate NIP
    if (participants.some((p) => p.nik === cleanNik)) {
      setFormError(`NIP ${cleanNik} sudah terdaftar dalam sistem!`);
      return;
    }

    const newP: Participant = {
      nik: cleanNik,
      nama: cleanNama,
      password: cleanPass,
      toko: 'Indomaret',
      jabatan: 'Store Crew',
      cabang: 'Cabang Indomaret',
      status: 'Belum Ujian',
    };

    setIsSaving(true);
    const updatedList = [newP, ...participants];
    onUpdateParticipants(updatedList);
    saveCachedParticipants(updatedList);
    saveCachedDataLogin(updatedList);

    // Sync to Google Sheet if connected
    if (syncStatus.isConnected) {
      await addLoginAccountToSheet({
        nik: cleanNik,
        nama: cleanNama,
        password: cleanPass,
      });
      await addParticipantToSheet(newP);
    }

    setIsSaving(false);
    setNewNik('');
    setNewNama('');
    setNewPassword('123');
    setIsAddModalOpen(false);
  };

  const handleDeleteParticipant = (nikToDelete: string, nama: string) => {
    if (confirm(`Yakin ingin menghapus akun ${nama} (NIP: ${nikToDelete})?`)) {
      const updated = participants.filter((p) => p.nik !== nikToDelete);
      onUpdateParticipants(updated);
      saveCachedParticipants(updated);
      saveCachedDataLogin(updated);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Title */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Menu Data Peserta (Data Akun Login)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Password Hari Ini: {todayPasswordInfo.primary}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Password seluruh peserta otomatis mengikuti tanggal berjalan format <strong>Tahun, Bulan, Tanggal (YYYYMMDD)</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSyncWithSheets}
              disabled={syncStatus.isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Sinkronkan Sheet</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Peserta</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] text-slate-500 block">Total Peserta</span>
            <span className="text-lg font-black text-slate-900">{participants.length}</span>
            <span className="text-[10px] text-slate-400 block">Orang terdaftar</span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="text-[11px] text-emerald-700 block">Sudah Ujian</span>
            <span className="text-lg font-black text-emerald-800">{results.length}</span>
            <span className="text-[10px] text-emerald-600 block">Nilai terekam</span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
            <span className="text-[11px] text-amber-700 block">Belum Ujian</span>
            <span className="text-lg font-black text-amber-800">
              {Math.max(0, participants.length - results.length)}
            </span>
            <span className="text-[10px] text-amber-600 block">Menunggu tes</span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
            <span className="text-[11px] text-blue-700 block">Password Standar</span>
            <span className="text-lg font-black text-blue-800 font-mono">123</span>
            <span className="text-[10px] text-blue-600 block">Sesuai spreadsheet</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Cari NIP atau Nama Peserta..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => setShowPasswords(!showPasswords)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            {showPasswords ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
            <span>{showPasswords ? 'Sembunyikan Password' : 'Lihat Semua Password'}</span>
          </button>

          <a
            href={getSpreadsheetUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buka Google Sheet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Participants Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-4">NIP Peserta</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Password Login</th>
                <th className="py-3 px-4 text-center">Status Ujian</th>
                <th className="py-3 px-4 text-center">Nilai</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ditemukan peserta dengan kata kunci "{searchTerm}".
                  </td>
                </tr>
              ) : (
                paginatedParticipants.map((p, idx) => {
                  const result = resultMap.get(p.nik);
                  const isDone = Boolean(result);

                  return (
                    <tr
                      key={p.nik}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {p.nik}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {p.nama}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/70 font-mono text-blue-900 text-[11px] font-bold border border-blue-200">
                          <KeyRound className="w-3 h-3 text-amber-600" />
                          {showPasswords ? (p.password || todayPasswordInfo.primary) : '••••••'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <UserCheck className="w-3 h-3" />
                            Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            <UserX className="w-3 h-3" />
                            Belum Ujian
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {result ? (
                          <span
                            className={`${
                              result.statusKelulusan === 'LULUS' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {result.skor} / 100
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setDeletingParticipant(p)}
                          title="Hapus peserta"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Menampilkan{' '}
            <span className="font-bold text-slate-900">
              {filteredParticipants.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{' '}
            sampai{' '}
            <span className="font-bold text-slate-900">
              {Math.min(currentPage * pageSize, filteredParticipants.length)}
            </span>{' '}
            dari{' '}
            <span className="font-bold text-blue-700">{filteredParticipants.length}</span> Peserta
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="px-2.5 py-1 font-semibold text-slate-700">
                Halaman {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah Peserta */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tambah Peserta Baru</h3>
                  <p className="text-[11px] text-slate-500">Tersimpan ke Sheet Data_Peserta</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="my-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddParticipant} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Induk Pegawai (NIP) *
                </label>
                <input
                  type="text"
                  value={newNik}
                  onChange={(e) => setNewNik(e.target.value)}
                  placeholder="Contoh: 2011025555"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Peserta *
                </label>
                <input
                  type="text"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value.toUpperCase())}
                  placeholder="Contoh: AHMAD MAULANA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password Login (Default: 123) *
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="123"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Password ujian peserta mengikuti tanggal berjalan format YYYYMMDD.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Peserta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Peserta */}
      {deletingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Akun Peserta</h3>
                <p className="text-[11px] text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Apakah Anda yakin ingin menghapus akun <span className="font-bold text-slate-900">{deletingParticipant.nama}</span> (NIP: <span className="font-mono font-bold text-slate-900">{deletingParticipant.nik}</span>)?
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingParticipant(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = participants.filter((p) => p.nik !== deletingParticipant.nik);
                  onUpdateParticipants(updated);
                  saveCachedParticipants(updated);
                  saveCachedDataLogin(updated);
                  setDeletingParticipant(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
