import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  Flag,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Send,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Participant, Question, ExamConfig, ExamResult } from '../types';
import { submitResultToSheet } from '../lib/sheetsService';
import { submitToGoogleForm, getPrefilledGFormUrl } from '../lib/gformService';
import { RichOptionContent, RichQuestionContent } from './RichMediaContent';

interface ExamScreenProps {
  participant: Participant;
  questions: Question[];
  config: ExamConfig;
  onFinishExam: (result: ExamResult, deliveredToSheet?: boolean) => void;
  onCancelExam: () => void;
}

export const ExamScreen: React.FC<ExamScreenProps> = ({
  participant,
  questions,
  config,
  onFinishExam,
  onCancelExam,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Anti-cheating detection state & overlay
  const [cheatingOverlay, setCheatingOverlay] = useState<{
    active: boolean;
    reason: string;
  }>({ active: false, reason: '' });



  // Time tracking
  const totalSeconds = config.durasiMenit * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const startTimeRef = useRef<Date>(new Date());
  const timerIntervalRef = useRef<any>(null);

  // Storage key for recovery during active session
  const activeSessionKey = `evabul_session_${participant.nik}`;

  // Restore saved state if page refreshed accidentally
  useEffect(() => {
    try {
      const saved = localStorage.getItem(activeSessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.answers) {
          setAnswers(parsed.answers);
          answersRef.current = parsed.answers;
        }
        if (parsed.flagged) setFlagged(parsed.flagged);
        if (parsed.startTime) {
          const started = new Date(parsed.startTime);
          startTimeRef.current = started;
          const elapsed = Math.floor((new Date().getTime() - started.getTime()) / 1000);
          const remaining = Math.max(0, totalSeconds - elapsed);
          setSecondsRemaining(remaining);
        }
      } else {
        startTimeRef.current = new Date();
        localStorage.setItem(
          activeSessionKey,
          JSON.stringify({
            startTime: startTimeRef.current.toISOString(),
            answers: {},
            flagged: {},
          })
        );
      }
    } catch (e) {
      console.warn('Session cache read error', e);
    }
  }, [participant.nik, totalSeconds]);

  // Persist answers changes
  const saveAnswersState = (newAnswers: Record<number, string>, newFlagged: Record<number, boolean>) => {
    try {
      localStorage.setItem(
        activeSessionKey,
        JSON.stringify({
          startTime: startTimeRef.current.toISOString(),
          answers: newAnswers,
          flagged: newFlagged,
        })
      );
    } catch (e) {
      // ignore
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId: number, optionLetter: string) => {
    const updatedAnswers = { ...answers, [questionId]: optionLetter };
    answersRef.current = updatedAnswers;
    setAnswers(updatedAnswers);
    saveAnswersState(updatedAnswers, flagged);
  };

  const handleToggleFlag = (questionId: number) => {
    const updatedFlagged = { ...flagged, [questionId]: !flagged[questionId] };
    setFlagged(updatedFlagged);
    saveAnswersState(answers, updatedFlagged);
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  const currentQuestion = questions[currentIndex] || questions[0];

  const handleAttemptFinish = () => {
    if (unansweredCount > 0) {
      setShowIncompleteModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  // Stable refs for bulletproof detection without closure stalls or state reset
  const hasSubmittedRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const monitoringActiveRef = useRef<boolean>(false);
  const isFullscreenTransitionRef = useRef<boolean>(false);
  const answersRef = useRef<Record<number, string>>(answers);
  answersRef.current = answers;
  const flaggedRef = useRef<Record<number, boolean>>(flagged);
  flaggedRef.current = flagged;
  const questionsRef = useRef<Question[]>(questions);
  questionsRef.current = questions;
  const configRef = useRef<ExamConfig>(config);
  configRef.current = config;
  const participantRef = useRef<Participant>(participant);
  participantRef.current = participant;
  const onFinishExamRef = useRef(onFinishExam);
  onFinishExamRef.current = onFinishExam;
  const secondsRemainingRef = useRef<number>(secondsRemaining);
  secondsRemainingRef.current = secondsRemaining;
  const unansweredCountRef = useRef<number>(unansweredCount);
  unansweredCountRef.current = unansweredCount;

  // Submit exam (supports normal submit, timeout auto-submit, or anti-cheat auto-submit)
  const submitExam = useCallback(async (forceAutoSubmit = false, cheatingReason?: string) => {
    if (hasSubmittedRef.current && !forceAutoSubmit) return;
    if (isSubmittingRef.current && !forceAutoSubmit) return;

    // Requirement: Normal participant submit requires all questions answered
    if (!forceAutoSubmit && unansweredCountRef.current > 0 && secondsRemainingRef.current > 0) {
      setShowConfirmModal(false);
      setShowIncompleteModal(true);
      return;
    }

    hasSubmittedRef.current = true;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const currentParticipant = participantRef.current;
    const currentQuestions = questionsRef.current;
    const currentConfig = configRef.current;
    const currentAnswers = answersRef.current;

    const endTime = new Date();
    const durationSeconds = Math.max(
      1,
      Math.floor((endTime.getTime() - startTimeRef.current.getTime()) / 1000)
    );
    const durationFormatted = formatTimer(durationSeconds);

    // Calculate score
    let correctAnswersCount = 0;
    const detailList: string[] = [];
    const answerMap: Record<number, string> = {};

    currentQuestions.forEach((q) => {
      const selected = currentAnswers[q.id] || '-';
      const isCorrect = selected === q.kunciJawaban;
      if (isCorrect) {
        correctAnswersCount += 1;
      }
      detailList.push(`${q.id}:${selected}`);
      answerMap[q.id] = selected;
    });

    const finalScore = currentQuestions.length > 0
      ? Math.round((correctAnswersCount / currentQuestions.length) * 100)
      : 0;

    const isPassed = finalScore >= currentConfig.passingGrade;

    const currentKode = currentParticipant.kodeToko || (currentParticipant.toko?.includes('-') ? currentParticipant.toko.split('-')[0].trim() : currentParticipant.toko);
    const currentNamaToko = currentParticipant.namaToko || (currentParticipant.toko?.includes('-') ? currentParticipant.toko.split('-')[1].trim() : currentParticipant.toko);

    const isCheating = Boolean(cheatingReason);

    const result: ExamResult = {
      id: `res-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      nik: currentParticipant.nik,
      nama: currentParticipant.nama,
      kodeToko: currentKode,
      namaToko: currentNamaToko,
      toko: currentKode && currentNamaToko ? `${currentKode} - ${currentNamaToko}` : currentParticipant.toko,
      jabatan: currentParticipant.jabatan || 'SCB',
      skor: finalScore,
      totalSoal: currentQuestions.length,
      jumlahBenar: correctAnswersCount,
      jumlahSalah: currentQuestions.length - correctAnswersCount,
      waktuMulai: startTimeRef.current.toTimeString().substring(0, 8),
      waktuSelesai: endTime.toTimeString().substring(0, 8),
      durasiDetik: durationSeconds,
      durasiFormatted: durationFormatted,
      statusKelulusan: isPassed ? 'LULUS' : 'TIDAK LULUS',
      detailJawaban: detailList.join(', '),
      jawabanPerSoal: answerMap,
      namaCOS: currentParticipant.namaCOS,
      namaTrainer: currentParticipant.namaTrainer,
      tipeUjian: currentParticipant.tipeUjian || 'Post Test',
      isAutoSubmittedCheating: isCheating,
      cheatingReason: cheatingReason || undefined,
    };

    // Clear active session storage immediately so participant cannot resume
    try {
      localStorage.removeItem(activeSessionKey);
    } catch {}

    // Submit directly to connected Google Spreadsheet (Hasil_Jawaban) only (Do NOT submit to GForm automatically to avoid blank records)
    let submitRes: any = { deliveredToSheet: false };
    try {
      submitRes = await submitResultToSheet(result);
      result.deliveredToGForm = true;
      result.gformUrl = getPrefilledGFormUrl(result);
    } catch (e) {
      console.warn('Failed to submit result to sheet:', e);
    }

    // Callback to display real-time result screen with delivery status
    onFinishExamRef.current(result, submitRes?.deliveredToSheet);
  }, [activeSessionKey]);

  const handleFinalSubmit = (forceAutoSubmit = false) => {
    submitExam(forceAutoSubmit);
  };

  // Countdown timer
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          submitExam(true); // Auto-submit on time up
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [submitExam]);

  // Anti-Cheating System: Detect Multitasking, Switching Apps, Opening Other Windows, or Leaving Web Page
  useEffect(() => {
    // 300ms initial grace period after mount for initial render to settle
    const graceTimer = setTimeout(() => {
      monitoringActiveRef.current = true;
    }, 300);

    const triggerCheatingAutoSubmit = (reason: string) => {
      if (isFullscreenTransitionRef.current) return;
      if (!monitoringActiveRef.current || hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;

      setCheatingOverlay({
        active: true,
        reason,
      });

      // Execute auto-submit immediately with reason and terminate exam
      submitExam(true, reason);
    };

    // 1. Visibility change: Minimizing browser, switching tabs, tapping Home/Recents, locking screen
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        triggerCheatingAutoSubmit(
          'Terdeteksi keluar dari tampilan web ujian / berpindah tab / membuka aplikasi lain (Multitasking).'
        );
      }
    };

    // 2. Window Blur: Losing focus to other apps, opening split screen, floating apps
    const handleWindowBlur = () => {
      triggerCheatingAutoSubmit(
        'Terdeteksi membuka aplikasi lain atau kehilangan fokus layar ujian (Multitasking).'
      );
    };

    // 3. Before Unload: Attempting to reload, close tab, or navigate away
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      triggerCheatingAutoSubmit('Terdeteksi mencoba memuat ulang atau meninggalkan tampilan ujian.');
    };

    // 4. Disable right-click context menu (prevent inspect/copy)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 5. Block inspect & copy/paste shortcut keys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && ['c', 'v', 'x', 'u', 'a', 's', 'p'].includes(e.key.toLowerCase())) ||
        (e.metaKey && ['c', 'v', 'x', 'u', 'a', 's', 'p'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(graceTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [submitExam]);

  // Fullscreen helper
  const toggleFullscreen = async () => {
    try {
      isFullscreenTransitionRef.current = true;
      setTimeout(() => {
        isFullscreenTransitionRef.current = false;
      }, 1000);

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      isFullscreenTransitionRef.current = false;
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-4 px-3 sm:px-6 select-none">
      {/* Top Exam App Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Participant & Store Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
            {participant.nama.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
              <span>{participant.nama}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
                NIP: {participant.nik}
              </span>
              {participant.tipeUjian && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  participant.tipeUjian === 'Pre Test'
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {participant.tipeUjian}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2">
              <span>Kode: <strong>{participant.kodeToko || (participant.toko?.includes('-') ? participant.toko.split('-')[0].trim() : participant.toko)}</strong></span>
              {(participant.namaToko || participant.toko?.includes('-')) && (
                <span>&bull; Toko: <strong>{participant.namaToko || participant.toko?.split('-')[1]?.trim()}</strong></span>
              )}
              {participant.namaCOS && <span>&bull; COS: {participant.namaCOS}</span>}
              {participant.namaTrainer && <span>&bull; Trainer: {participant.namaTrainer}</span>}
            </div>
          </div>
        </div>

        {/* Progress & Countdown Timer & Anti-Cheat Badge */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Anti-Cheating Active Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Anti-Kecurangan Aktif</span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 px-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors hidden sm:flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Fokus)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Normal' : 'Layar Penuh'}</span>
          </button>

          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-500">Progress Ujian</div>
            <div className="text-xs font-bold text-slate-800">
              {answeredCount} / {questions.length} Terjawab
            </div>
          </div>

          {/* Timer Display */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-mono font-bold text-sm shadow-xs ${
              secondsRemaining <= 180
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-900 text-amber-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>

          {/* Finish Button in Header */}
          <button
            id="finish-exam-top-btn"
            onClick={handleAttemptFinish}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Selesai Ujian</span>
          </button>
        </div>
      </div>

      {/* Anti-Cheating Warning Strip */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5 mb-4 flex items-center justify-between text-xs text-amber-950 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-relaxed">
            <strong>Peringatan Anti-Kecurangan:</strong> Dilarang keras membuka aplikasi lain, meminimalisir layar, atau berganti tab web. Jawaban akan <strong>otomatis terkirim dan dinilai seketika</strong> jika Anda meninggalkan layar ujian.
          </span>
        </div>
      </div>

      {/* Main Exam Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Question Box */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
            {/* Question Header & Category */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-extrabold text-sm">
                  {currentIndex + 1}
                </span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Dari {questions.length} Soal
                </span>
              </div>

              <div className="flex items-center gap-2">
                {currentQuestion.kategori && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200/60 hidden sm:inline-block">
                    {currentQuestion.kategori}
                  </span>
                )}
                {/* Ragu-ragu / Flag toggle */}
                <button
                  onClick={() => handleToggleFlag(currentQuestion.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    flagged[currentQuestion.id]
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5 fill-current" />
                  <span>{flagged[currentQuestion.id] ? 'Ditandai' : 'Ragu-ragu'}</span>
                </button>
              </div>
            </div>

            {/* Question Text & Media */}
            <div className="mb-6">
              <RichQuestionContent content={currentQuestion.pertanyaan} />
            </div>

            {/* Multiple Choice Options */}
            <div className="space-y-3 mb-6">
              {[
                { key: 'A', text: currentQuestion.pilihanA },
                { key: 'B', text: currentQuestion.pilihanB },
                { key: 'C', text: currentQuestion.pilihanC },
                { key: 'D', text: currentQuestion.pilihanD },
                ...(currentQuestion.pilihanE ? [{ key: 'E', text: currentQuestion.pilihanE }] : []),
              ].map(({ key, text }) => {
                const isSelected = answers[currentQuestion.id] === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectOption(currentQuestion.id, key)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-start gap-3 cursor-pointer group ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs transition-colors mt-0.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700'
                      }`}
                    >
                      {key}
                    </div>
                    <div className="text-sm sm:text-base text-slate-800 leading-snug flex-1">
                      <RichOptionContent content={text} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span>Berikutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAttemptFinish}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kirim Jawaban</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Question Palette / Navigation */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 sticky top-20">
            <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Nomor Soal</span>
              <span className="text-xs font-normal text-slate-500">
                {answeredCount}/{questions.length} Terjawab
              </span>
            </h3>

            {/* Palette Grid */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id]);
                const isFlagged = Boolean(flagged[q.id]);
                const isCurrent = idx === currentIndex;

                let btnClass = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                if (isAnswered) {
                  btnClass = 'bg-blue-600 border-blue-600 text-white font-bold';
                }
                if (isFlagged) {
                  btnClass = 'bg-amber-400 border-amber-500 text-slate-950 font-bold';
                }
                if (isCurrent) {
                  btnClass += ' ring-2 ring-blue-500 ring-offset-1';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-semibold border flex items-center justify-center transition-all cursor-pointer relative ${btnClass}`}
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && (
                      <span className="absolute bottom-1 right-1 text-[9px] leading-none opacity-80">
                        {answers[q.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-600 shrink-0" />
                <span>Sudah Dijawab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-400 shrink-0" />
                <span>Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-white border border-slate-300 shrink-0" />
                <span>Belum Dijawab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded ring-2 ring-blue-500 bg-white shrink-0" />
                <span>Sedang Aktif</span>
              </div>
            </div>

            {/* Final Submit CTA */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAttemptFinish}
                className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Kumpulkan Semua Jawaban</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete Questions Modal (Requirement: Cannot submit if any question is unanswered) */}
      {showIncompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 mb-1.5">
              Soal Belum Lengkap Terjawab!
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Anda <strong>tidak diizinkan mengumpulkan hasil ujian</strong> karena masih ada{' '}
              <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {unansweredCount} soal yang belum dijawab
              </span>{' '}
              dari total {questions.length} butir soal. Anda wajib menjawab seluruh soal terlebih dahulu.
            </p>

            {/* List of unanswered question numbers */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 mb-5 text-left">
              <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                Nomor Soal Yang Masih Kosong (Klik nomor untuk langsung menjawab):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {questions.map((q, idx) => {
                  const isAnswered = Boolean(answers[q.id]);
                  if (isAnswered) return null;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowIncompleteModal(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-mono font-bold text-xs border border-rose-300 transition-colors cursor-pointer flex items-center gap-1"
                      title={`Klik untuk langsung mengerjakan Soal No. ${idx + 1}`}
                    >
                      <span>No. {idx + 1}</span>
                      <ArrowRight className="w-3 h-3 text-rose-500" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const firstUnanswered = questions.findIndex((q) => !answers[q.id]);
                  if (firstUnanswered !== -1) {
                    setCurrentIndex(firstUnanswered);
                  }
                  setShowIncompleteModal(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Lanjutkan Menjawab Soal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-slate-900 mb-1">
              Konfirmasi Selesai Ujian?
            </h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Seluruh {questions.length} soal telah terjawab lengkap. Setelah dikirim, jawaban Anda akan langsung tersimpan ke Google Spreadsheet sheet <strong className="text-blue-600">Hasil_Jawaban</strong> dan skor akhir Anda akan ditampilkan secara real-time.
            </p>

            {/* Stats Overview */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 mb-5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Total Soal:</span>
                <span className="font-bold">{questions.length} Soal</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Soal Terjawab:</span>
                <span className="font-bold">{answeredCount} Soal (Lengkap 100%)</span>
              </div>
              {flaggedCount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Masih Ditandai Ragu-ragu:</span>
                  <span className="font-bold">{flaggedCount} Soal</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cek Kembali
              </button>
              <button
                id="confirm-submit-exam-btn"
                type="button"
                disabled={isSubmitting}
                onClick={() => handleFinalSubmit(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ya, Kumpulkan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-Cheating Violation Auto-Submit Overlay Modal */}
      {cheatingOverlay.active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center border-2 border-rose-500 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ShieldAlert className="w-9 h-9 animate-bounce text-rose-600" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black uppercase tracking-wider mb-2.5">
              Pelanggaran Anti-Kecurangan Terdeteksi
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-2">
              Layar Ujian Ditinggalkan!
            </h3>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              {cheatingOverlay.reason}
            </p>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 flex items-center justify-center gap-2.5">
              <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Ujian seketika dihentikan. Jawaban otomatis dikirim dan nilai Anda sedang diproses...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
