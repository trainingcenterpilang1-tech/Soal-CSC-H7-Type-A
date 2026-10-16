import React from 'react';
import {
  Award,
  ShieldCheck,
  FileSpreadsheet,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Participant, SheetSyncStatus } from '../types';

interface HeaderProps {
  isAdmin: boolean;
  adminTab: 'dashboard' | 'peserta' | 'juara';
  setAdminTab: (tab: 'dashboard' | 'peserta' | 'juara') => void;
  onLogoutAdmin: () => void;
  onOpenAdminLogin: () => void;
  currentParticipant: Participant | null;
  onLogoutParticipant: () => void;
  syncStatus: SheetSyncStatus;
  onSyncWithSheets: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAdmin,
  adminTab,
  setAdminTab,
  onLogoutAdmin,
  onOpenAdminLogin,
  currentParticipant,
  onLogoutParticipant,
  syncStatus,
  onSyncWithSheets,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Indomaret Iconic Top Strip: Blue, Yellow, Red */}
      <div className="h-1.5 w-full flex">
        <div className="w-1/3 bg-[#005ba9]" />
        <div className="w-1/3 bg-[#ffcc00]" />
        <div className="w-1/3 bg-[#ed1c24]" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-8 sm:h-9 px-1.5 py-0.5 bg-white rounded-lg border border-slate-200 flex items-center justify-center shadow-xs">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/4/44/Indomaret.svg?utm_source=su.wikipedia.org&utm_campaign=index&utm_content=original"
                alt="Indomaret Logo"
                className="h-6 sm:h-7 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                  TRAINING CSCI
                </span>
                {isAdmin ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-amber-300">
                    Admin
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Online Test
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">
                {isAdmin ? 'Portal Panitia & Manajemen Peserta' : 'Prodsus H7'}
              </p>
            </div>
          </div>

          {/* Right Header Status / Controls */}
          <div className="flex items-center space-x-2">
            {/* Sync indicator */}
            {syncStatus.isConnected && (
              <button
                onClick={onSyncWithSheets}
                disabled={syncStatus.isLoading}
                title="Sinkronisasi Google Sheets"
                className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1 text-[11px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <RefreshCw className={`w-3 h-3 ${syncStatus.isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* If Admin logged in: show Exit Admin button */}
            {isAdmin ? (
              <button
                onClick={onLogoutAdmin}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Kembali ke Mode Peserta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Admin</span>
              </button>
            ) : currentParticipant ? (
              <button
                onClick={onLogoutParticipant}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-medium transition-colors"
                title="Keluar akun peserta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout ({currentParticipant.nama.split(' ')[0]})</span>
                <span className="sm:hidden">Keluar</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* ADMIN ONLY TABS: Only shown when logged in as Admin! */}
        {isAdmin && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 sm:gap-2">
            <button
              id="admin-tab-dashboard"
              onClick={() => setAdminTab('dashboard')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                adminTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              id="admin-tab-peserta"
              onClick={() => setAdminTab('peserta')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                adminTab === 'peserta'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Data Peserta</span>
            </button>

            <button
              id="admin-tab-juara"
              onClick={() => setAdminTab('juara')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                adminTab === 'juara'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Papan Juara</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
