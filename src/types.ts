export interface Participant {
  nik: string;
  nama: string;
  password: string;
  kodeToko?: string;
  namaToko?: string;
  toko: string;
  jabatan?: string;
  cabang?: string;
  status?: 'Belum Ujian' | 'Sedang Ujian' | 'Selesai';
  namaCOS?: string;
  namaTrainer?: string;
  tipeUjian?: 'Pre Test' | 'Post Test';
}

export interface Question {
  id: number;
  pertanyaan: string;
  pilihanA: string;
  pilihanB: string;
  pilihanC: string;
  pilihanD: string;
  pilihanE?: string;
  kunciJawaban: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  bobot?: number;
  kategori?: string;
  penjelasan?: string;
}

export interface ParticipantAnswer {
  questionId: number;
  selectedOption: string;
  isCorrect: boolean;
}

export interface ExamResult {
  id?: string;
  timestamp: string;
  nik: string;
  nama: string;
  kodeToko?: string;
  namaToko?: string;
  toko: string;
  jabatan: string;
  skor: number; // 0 - 100
  totalSoal: number;
  jumlahBenar: number;
  jumlahSalah: number;
  waktuMulai: string;
  waktuSelesai: string;
  durasiDetik: number;
  durasiFormatted: string; // e.g. "14:20"
  statusKelulusan: 'LULUS' | 'TIDAK LULUS';
  detailJawaban?: string; // stringified or formatted "1:A, 2:B"
  jawabanPerSoal?: Record<number, string>; // { 1: 'A', 2: 'B', ... }
  namaCOS?: string;
  namaTrainer?: string;
  tipeUjian?: 'Pre Test' | 'Post Test';
  syncedToSheet?: boolean;
  deliveredToGForm?: boolean;
  gformUrl?: string;
  isAutoSubmittedCheating?: boolean;
  cheatingReason?: string;
}

export interface ExamConfig {
  durasiMenit: number;
  passingGrade: number; // KKM, e.g. 75
  acakSoal: boolean;
  judulUjian: string;
  lokasiCabang: string;
  isExamOpen: boolean;
}

export interface SheetSyncStatus {
  isConnected: boolean;
  userEmail: string | null;
  lastSynced: string | null;
  isLoading: boolean;
  error: string | null;
}
