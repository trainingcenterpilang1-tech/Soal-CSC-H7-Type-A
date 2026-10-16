import React, { useState } from 'react';
import { ZoomIn, X, ExternalLink, Image as ImageIcon } from 'lucide-react';

export interface ParsedContent {
  text: string;
  imageUrl: string | null;
}

export function parseImageContent(content?: string | null): ParsedContent {
  if (!content || typeof content !== 'string') {
    return { text: '', imageUrl: null };
  }
  const str = content.trim();

  // 1. Google Sheets =IMAGE("...") formula
  const formulaMatch = str.match(/^=IMAGE\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (formulaMatch) {
    return { text: '', imageUrl: formatImageUrl(formulaMatch[1]) };
  }

  // 2. Markdown ![alt](url)
  const mdMatch = str.match(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/i);
  if (mdMatch) {
    const textPart = str.replace(mdMatch[0], '').trim();
    return { text: textPart || mdMatch[1], imageUrl: formatImageUrl(mdMatch[2]) };
  }

  // 3. Google Drive file link
  const driveUrlRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/[a-zA-Z0-9_-]+[^\s]*|open\?[^\s]*|uc\?[^\s]*)/i;
  const driveMatch = str.match(driveUrlRegex);
  if (driveMatch) {
    const matchedUrl = driveMatch[0];
    const idMatch = matchedUrl.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
    const fileId = idMatch ? idMatch[1] : '';
    const textPart = str.replace(matchedUrl, '').trim();
    return {
      text: textPart,
      imageUrl: fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : matchedUrl,
    };
  }

  // 4. Direct image url or known image hosting service
  const urlMatch = str.match(/(https?:\/\/[^\s]+(?:\.(?:png|jpe?g|gif|webp|svg|bmp)|lh3\.googleusercontent\.com|imgur\.com|postimg\.cc|cloudinary\.com|unsplash\.com|ibb\.co)[^\s]*)/i);
  if (urlMatch) {
    const textPart = str.replace(urlMatch[0], '').trim();
    return { text: textPart, imageUrl: formatImageUrl(urlMatch[0]) };
  }

  // 5. Standalone URL
  if (/^https?:\/\/[^\s]+$/i.test(str)) {
    return { text: '', imageUrl: str };
  }

  return { text: str, imageUrl: null };
}

export function formatImageUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  const idMatch = trimmed.match(/https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }
  return trimmed;
}

// Lightbox modal for zooming into images
export const ImageLightbox: React.FC<{
  imageUrl: string;
  title?: string;
  onClose: () => void;
}> = ({ imageUrl, title, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-white">
          <span className="text-xs font-semibold text-slate-300 truncate max-w-md">
            {title || 'Perbesar Gambar'}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Buka di tab baru"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-2 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)] bg-slate-950">
          <img
            src={imageUrl}
            alt={title || 'Pratinjau Gambar'}
            className="max-h-[80vh] max-w-full object-contain rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};

// Component to render Option text and/or Image
export const RichOptionContent: React.FC<{
  content?: string;
  className?: string;
  imageClassName?: string;
}> = ({ content, className = '', imageClassName = '' }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { text, imageUrl } = parseImageContent(content);

  if (!content) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {text && <div className="leading-snug">{text}</div>}

      {imageUrl && !imageError && (
        <div className="relative group inline-block max-w-full">
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-2xs hover:border-blue-400 transition-all">
            <img
              src={imageUrl}
              alt={text || 'Gambar Pilihan Jawaban'}
              className={`max-h-40 sm:max-h-48 max-w-full object-contain rounded-md block bg-white ${imageClassName}`}
              loading="lazy"
              onError={() => setImageError(true)}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              className="absolute bottom-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 text-white rounded-md text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Klik untuk memperbesar gambar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Perbesar</span>
            </button>
          </div>

          {lightboxOpen && (
            <ImageLightbox
              imageUrl={imageUrl}
              title={text || 'Gambar Pilihan Jawaban'}
              onClose={() => setLightboxOpen(false)}
            />
          )}
        </div>
      )}

      {imageUrl && imageError && (
        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Gambar tidak dapat dimuat.</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 underline font-semibold flex items-center gap-0.5 ml-auto"
          >
            Buka link <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};

// Component to render Question text and/or embedded Question Image
export const RichQuestionContent: React.FC<{
  content?: string;
  className?: string;
}> = ({ content, className = '' }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { text, imageUrl } = parseImageContent(content);

  if (!content) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {text && (
        <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
          {text}
        </p>
      )}

      {imageUrl && !imageError && (
        <div className="relative group inline-block max-w-full my-2">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xs hover:border-blue-400 transition-all">
            <img
              src={imageUrl}
              alt={text || 'Gambar Soal Ujian'}
              className="max-h-64 sm:max-h-80 max-w-full object-contain rounded-lg block bg-white"
              loading="lazy"
              onError={() => setImageError(true)}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-xs transition-opacity cursor-pointer shadow-sm"
              title="Klik untuk memperbesar gambar soal"
            >
              <ZoomIn className="w-4 h-4" />
              <span>Perbesar Gambar Soal</span>
            </button>
          </div>

          {lightboxOpen && (
            <ImageLightbox
              imageUrl={imageUrl}
              title={text || 'Gambar Soal Ujian'}
              onClose={() => setLightboxOpen(false)}
            />
          )}
        </div>
      )}

      {imageUrl && imageError && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Gambar soal tidak dapat dimuat langsung.</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 underline font-semibold flex items-center gap-1 ml-auto"
          >
            Buka gambar di tab baru <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
};
