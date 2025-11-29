
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Theme, PhotoWidgetOutputMode, Tab } from './types';
import { trackEvent } from './analytics';

export const Dropzone: React.FC<{ onFileSelect: (file: File, method: 'drag_drop' | 'click') => void; isLoading: boolean; compact?: boolean; theme: Theme; accept?: string; context?: Tab; isMobile?: boolean; }> = ({ onFileSelect, isLoading, compact = false, theme, accept = "image/*", context, isMobile = false }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File | undefined | null, method: 'drag_drop' | 'click') => {
        if (file && (accept === "image/*" || accept.includes(file.type))) {
            onFileSelect(file, method);
        } else if (file) {
            trackEvent('upload_error', {
                feature: context,
                reason: 'unsupported_file_type',
                file_type: file.type
            });
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        handleFile(file, 'drag_drop');
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        handleFile(file, 'click');
        if (event.target) {
            event.target.value = '';
        }
    };

    const dropzoneClasses = isDragging
        ? (theme === 'dark' ? 'border-white bg-nothing-gray-dark' : 'border-black bg-day-gray-light')
        : (theme === 'dark' ? 'border-gray-600 bg-transparent hover:border-gray-400' : 'border-gray-400 bg-transparent hover:border-gray-600');

    const boldText = isMobile ? "Drag & Drop or Click" : "Drag & Drop | Click | Ctrl+V";

    const dropTexts = {
        pfp: {
            bold: boldText,
            normal: "to load an image",
        },
        wallpaper: {
            bold: boldText,
            normal: "to load an image",
        },
        photoWidget: {
            bold: boldText,
            normal: "to load an image",
        },
        valueAliasing: {
            bold: boldText,
            normal: "to load an image",
        },
        glassDots: {
            bold: boldText,
            normal: "to load an image",
        }
    };

    const currentTexts = context && dropTexts[context] 
        ? dropTexts[context] 
        : { bold: "Drag & Drop Image Here", normal: "or click to browse" };

    return (
        <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={`w-full ${!compact ? 'flex-grow' : ''} text-center border-2 border-dashed cursor-pointer transition-colors duration-300 flex items-center justify-center rounded-lg ${compact ? 'py-4' : ''} ${dropzoneClasses}`}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleInputChange}
                accept={accept}
                className="hidden"
            />
            <div className={`flex flex-col items-center justify-center space-y-2 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                 {compact ? (
                    <p className="text-md font-semibold">Replace Image</p>
                ) : (
                    <>
                        <span className="text-6xl" role="img" aria-label="Folder icon">📁</span>
                        <p className={`text-xl font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>{currentTexts.bold}</p>
                        <p className="text-sm">{currentTexts.normal}</p>
                        <p className="text-sm mt-1">(all image processing happens locally)</p>
                    </>
                )}
            </div>
        </div>
    );
};

export const EnhancedSlider: React.FC<{
  label: string;
  labelPrefix?: React.ReactNode;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeCommitted: (value: number) => void;
  onReset: () => void;
  disabled?: boolean;
  theme: Theme;
  isMobile: boolean;
}> = ({ label, labelPrefix, value, min = 0, max = 100, step = 1, onChange, onChangeCommitted, onReset, disabled, theme, isMobile }) => {
    const handleCommit = (val: number) => {
        const clampedValue = Math.max(min, Math.min(max, val));
        onChange(clampedValue);
        onChangeCommitted(clampedValue);
    };
    
    const inputId = `slider-${label.replace(/\s+/g, '-')}`;

    return (
        <div className={`${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} space-y-2`}>
            <label htmlFor={inputId} className="text-sm">{labelPrefix}{label}</label>
            <div className="flex items-center space-x-3">
                <input
                    id={inputId}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    onMouseUp={() => handleCommit(value)}
                    onTouchEnd={() => handleCommit(value)}
                    disabled={disabled}
                    className={`w-full h-2 appearance-none cursor-pointer disabled:opacity-50 rounded-lg ${theme === 'dark' ? 'bg-nothing-gray-dark accent-white' : 'bg-day-gray-light accent-black'} ${isMobile ? 'touch-none' : ''}`}
                />
                <div className="w-16 text-center font-sans text-sm font-semibold tabular-nums">
                    {value}
                </div>
                <button
                  onClick={() => {
                    trackEvent('reset_single_control', { control_name: label });
                    onReset();
                  }}
                  disabled={disabled}
                  className={`${theme === 'dark' ? 'text-nothing-gray-light hover:text-white disabled:hover:text-nothing-gray-light' : 'text-day-gray-dark hover:text-black disabled:hover:text-day-gray-dark'} transition-colors disabled:opacity-50`}
                  aria-label={`Reset ${label}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export const UndoRedoControls: React.FC<{ onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean; theme: Theme }> = ({ onUndo, onRedo, canUndo, canRedo, theme }) => (
  <div className="flex items-center justify-center space-x-4">
    <button
      onClick={onUndo}
      disabled={!canUndo}
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-200 text-day-text hover:bg-gray-300 disabled:hover:bg-gray-200'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="9 14 4 9 9 4"></polyline>
        <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
      </svg>
      <span>Undo</span>
    </button>
    <button
      onClick={onRedo}
      disabled={!canRedo}
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-light hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-gray-200 text-day-text hover:bg-gray-300 disabled:hover:bg-gray-200'}`}
    >
      <span>Redo</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="15 14 20 9 15 4"></polyline>
        <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
      </svg>
    </button>
  </div>
);

export const ToggleSwitch: React.FC<{
    leftLabel: string;
    rightLabel: string;
    isChecked: boolean; // Corresponds to the right label being active
    onToggle: () => void;
    theme: Theme;
    id: string;
}> = ({ leftLabel, rightLabel, isChecked, onToggle, theme, id }) => {
    return (
        <div className="flex items-center justify-between w-full">
            <label htmlFor={id} className={`text-sm font-normal transition-colors cursor-pointer ${!isChecked ? (theme === 'dark' ? 'text-nothing-light' : 'text-day-text') : (theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark')}`}>
                {leftLabel}
            </label>
            <button 
                id={id}
                role="switch" 
                aria-checked={isChecked} 
                onClick={onToggle} 
                className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light'}`}
                aria-label={`Switch between ${leftLabel} and ${rightLabel}, current is ${isChecked ? rightLabel : leftLabel}`}
            >
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isChecked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <label htmlFor={id} className={`text-sm font-normal transition-colors cursor-pointer ${isChecked ? (theme === 'dark' ? 'text-nothing-light' : 'text-day-text') : (theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark')}`}>
                {rightLabel}
            </label>
        </div>
    );
};

export const SegmentedControl: React.FC<{
    options: { key: string; label: React.ReactNode }[];
    selected: string;
    onSelect: (key: string) => void;
    theme: Theme;
}> = ({ options, selected, onSelect, theme }) => {
    const baseButtonClasses = `w-1/2 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none rounded-md flex items-center justify-center space-x-2`;
    const selectedClasses = theme === 'dark' ? 'bg-nothing-light text-nothing-dark font-bold' : 'bg-day-text text-day-bg font-bold';
    const unselectedClasses = theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700 text-nothing-light' : 'bg-day-gray-light hover:bg-gray-300 text-day-text';

    return (
        <div className={`flex space-x-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-gray-200'}`}>
            {options.map(option => (
                <button
                    key={option.key}
                    onClick={() => onSelect(option.key)}
                    className={`${baseButtonClasses} ${selected === option.key ? selectedClasses : unselectedClasses}`}
                    aria-pressed={selected === option.key ? 'true' : 'false'}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export const ToastNotification: React.FC<{
  show: boolean;
  onClose: () => void;
  onShare: (variant: 'default' | 'special') => void;
  theme: Theme;
  isMobile: boolean;
  imageRendered: boolean;
  className?: string;
  variant?: 'default' | 'special';
}> = ({ show, onClose, onShare, theme, isMobile, imageRendered, className = '', variant = 'default' }) => {
  const mobileBottomOffset = imageRendered ? 'bottom-20' : 'bottom-4';
  const isSpecial = variant === 'special';

  const containerClasses = isMobile
    ? `fixed inset-x-4 ${mobileBottomOffset}`
    : 'absolute bottom-8 right-8 w-full max-w-sm';

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef(0);

  const timerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  // Keep the ref updated with the latest onClose callback from props.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Create stable timer control functions using useCallback with an empty dependency array.
  // This ensures they are not recreated on re-renders, preventing the main effect from re-running.
  const startTimer = useCallback(() => {
    // Always clear any existing timer before starting a new one.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      trackEvent('toast_dismiss', { method: 'timeout' });
      // Call the latest onClose function via the ref.
      onCloseRef.current();
    }, 9600);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // This effect now reliably runs only when the `show` prop changes.
  useEffect(() => {
    if (show) {
      startTimer();
    } else {
      clearTimer();
    }
    // Cleanup on unmount.
    return clearTimer;
  }, [show, startTimer, clearTimer]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    clearTimer();
    touchStartRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isSwiping) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current;
    if (deltaX > 0) { // Only allow swiping to the right
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    setIsSwiping(false);
    if (swipeOffset > 100) { // Dismiss threshold
      trackEvent('toast_dismiss', { method: 'swipe' });
      onClose();
    } else {
      setSwipeOffset(0);
      startTimer();
    }
  };
  
  useEffect(() => {
    if (!show) {
      // Allow exit animation to complete before resetting swipe position
      setTimeout(() => {
        setSwipeOffset(0);
      }, 500);
    }
  }, [show]);

  const boldText = isSpecial ? "Yay!! That's your first special theme creation!" : "You seem to love it?!";
  const normalText = isSpecial ? "Keeping the secret to yourself would be too selfish." : "Help spread the word. Share it to the community thread.";
  const buttonClasses = `block w-full text-center px-4 py-2 text-sm font-bold rounded-md transition-colors ${
    isSpecial ? 'easter-egg-glow' :
    theme === 'dark' ? 'bg-nothing-light text-nothing-dark hover:bg-opacity-90' : 'bg-day-text text-day-bg hover:bg-opacity-90'
  }`;

  return (
    <div
      aria-live="polite"
      className={`z-50 transition-all duration-500 ease-in-out ${containerClasses} ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      } ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      <div
        className={`relative w-full rounded-lg shadow-2xl p-4 ${
          theme === 'dark' ? 'bg-nothing-gray-dark text-nothing-light' : 'bg-white text-day-text border border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-4 md:flex-col md:items-stretch md:space-y-3 md:space-x-0">
          <div className="flex-grow">
            <p className="font-semibold">{boldText}</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
              {normalText}
            </p>
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={() => {
                trackEvent('share_community_toast_click', { variant });
                onShare(variant);
                onClose();
              }}
              className={buttonClasses}
            >
              Share Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SharePopup: React.FC<{ show: boolean; onClose: () => void; theme: Theme; communityLink: string; appUrl: string; variant: 'default' | 'special'; }> = ({ show, onClose, theme, communityLink, appUrl, variant = 'default' }) => {
    const [copyText, setCopyText] = useState('Copy');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (show) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [show, onClose]);

    const isSpecial = variant === 'special';

    // Texts for sharing
    const defaultText = `Create your own Nothing style dot-matrix imagery with Matrices: ${appUrl}`;
    const defaultTextWithHashtags = `${defaultText}\n\n#Matrices #NothingCommunity`;

    const specialCopyText = "Have you unlocked the secret theme in Matrices Value Aliasing yet? 🗝️ On desktop, use 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed! https://udaign.github.io/matrices/";
    const specialXText = "#FeelingNothing\n\n 🔑 Have you unlocked the secret theme in Matrices Value Aliasing yet? On desktop, use 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed!\n\nhttps://udaign.github.io/matrices/";
    const specialRedditTitle = "Unlocked the secret theme in Matrices Value Aliasing! 🗝️";
    const specialRedditContent = "On desktop, use 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed!";
    const specialWhatsAppText = "🗝️ Have you unlocked the secret theme in Matrices Value Aliasing yet? On desktop, use 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed! https://udaign.github.io/matrices/";
    const specialEmailSubject = "Secret special theme in Matrices! 🗝️";
    const specialEmailBody = "Upload your image to Value Aliasing and on desktop, use 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed! https://udaign.github.io/matrices/";
    const specialFacebookText = "This community-made tool is just awesome! Have you unlocked the secret theme in Matrices Value Aliasing yet? On desktop, use 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed! #FeelingNothing";
    
    const textToCopy = isSpecial ? specialCopyText : appUrl;
    const encodedUrl = encodeURIComponent(appUrl);

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        trackEvent('share_popup_copy_link', { variant });
        setCopyText('Copied!');
        setTimeout(() => setCopyText('Copy'), 2000);
    };

    const socials = [
        { name: 'Nothing Community', icon: 'nothing', href: communityLink, color: '#2a2b7b' },
        { name: 'X', icon: 'x', href: `https://twitter.com/intent/tweet?text=${isSpecial ? encodeURIComponent(specialXText) : encodeURIComponent(defaultTextWithHashtags)}`, color: '#000000' },
        { name: 'Reddit', icon: 'reddit', href: isSpecial ? `https://www.reddit.com/submit?title=${encodeURIComponent(specialRedditTitle)}&url=${encodedUrl}&text=${encodeURIComponent(specialRedditContent)}` : `https://www.reddit.com/submit?title=${encodeURIComponent('Just created this with Matrices!')}&url=${encodedUrl}`, color: '#FF4500' },
        { name: 'WhatsApp', icon: 'whatsapp', href: `https://api.whatsapp.com/send?text=${isSpecial ? encodeURIComponent(specialWhatsAppText) : encodeURIComponent(defaultText)}`, color: '#25D366' },
        { name: 'Email', icon: 'email', href: isSpecial ? `mailto:?subject=${encodeURIComponent(specialEmailSubject)}&body=${encodeURIComponent(specialEmailBody)}` : `mailto:?subject=${encodeURIComponent('Just created this with Matrices!')}&body=${encodeURIComponent(defaultText)}`, color: '#4285F4' },
        { name: 'LinkedIn', icon: 'linkedin', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, color: '#0A66C2' },
        { name: 'Facebook', icon: 'facebook', href: isSpecial ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(specialFacebookText)}` : `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, color: '#1877F2' },
    ];
    
    const icons: Record<string, React.ReactNode> = {
        nothing: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <circle cx="12" cy="12" r="8" fill="#2a2b7b"/>
            </svg>
        ),
        x: (
            <svg fill="currentColor" viewBox="0 0 16 16" className="w-full h-full">
                <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.6.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z" />
            </svg>
        ),
        reddit: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" className="w-full h-full">
                <path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z" />
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165" />
            </svg>
        ),
        whatsapp: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" className="w-full h-full">
                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
            </svg>
        ),
        email: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
        ),
        linkedin: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" className="w-full h-full">
                <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" />
            </svg>
        ),
        facebook: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-1.5c-1 0-1.5.5-1.5 1.5V12h3l-.5 3h-2.5v6.8c4.56-.93 8-4.96 8-9.8z" />
            </svg>
        ),
        copy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
        ),
        close: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
        ),
    };

    if (!show) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-popup-title"
        >
            <div 
                className={`relative w-full max-w-xl m-4 p-6 rounded-lg shadow-2xl ${theme === 'dark' ? 'bg-nothing-darker text-nothing-light' : 'bg-white text-day-text'} animate-fade-in`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 id="share-popup-title" className="text-xl font-bold">Share</h2>
                </div>
                
                <button onClick={onClose} className={`absolute top-3 right-3 p-2 rounded-full ${theme === 'dark' ? 'hover:bg-nothing-gray-dark' : 'hover:bg-day-gray-light'}`} aria-label="Close share dialog">
                    {icons.close}
                </button>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-4 mb-6">
                    {socials.map(social => (
                        <a 
                            key={social.name} 
                            href={social.href} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={() => trackEvent('share_popup_click', { platform: social.name, variant })}
                            className="flex flex-col items-center space-y-2 text-center group"
                        >
                            <div 
                                style={{ backgroundColor: social.color }}
                                className={`h-14 w-14 rounded-full flex items-center justify-center transition-opacity group-hover:opacity-80`}
                            >
                                <div className="text-white w-7 h-7">
                                  {icons[social.icon]}
                                </div>
                            </div>
                            <span className="text-sm">{social.name}</span>
                        </a>
                    ))}
                </div>

                <div className={`flex items-center rounded-md border ${theme === 'dark' ? 'bg-nothing-dark border-nothing-gray-dark' : 'bg-day-gray-light border-gray-300'}`}>
                    <input 
                        type="text" 
                        readOnly 
                        value={textToCopy}
                        aria-label="Link to copy"
                        className={`w-full p-2 bg-transparent text-base truncate focus:outline-none ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`} 
                    />
                    <button 
                        onClick={handleCopy}
                        className={`flex-shrink-0 flex items-center justify-center w-24 space-x-2 px-3 py-2 text-sm font-semibold rounded-r-md transition-all duration-300 ${copyText === 'Copied!' ? 'bg-white text-nothing-dark' : (theme === 'dark' ? 'bg-nothing-red hover:brightness-90 text-nothing-light' : 'bg-day-accent hover:brightness-90 text-white')}`}
                    >
                        {copyText === 'Copy' && <span className="w-5 h-5">{icons.copy}</span>}
                        <span>{copyText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const SupportModal: React.FC<{ show: boolean; onClose: () => void; theme: Theme; }> = ({ show, onClose, theme }) => {
    const [view, setView] = useState<'initial' | 'upi'>('initial');
    const [copyText, setCopyText] = useState('Copy UPI ID');

    useEffect(() => {
        if (show) {
            setView('initial');
            setCopyText('Copy UPI ID');
        }
    }, [show]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (show) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [show, onClose]);

    const handleCopy = () => {
        navigator.clipboard.writeText('udaybhaskar2283@okicici');
        trackEvent('support_copy_upi_id');
        setCopyText('Copied!');
        setTimeout(() => setCopyText('Copy UPI ID'), 2000);
    };

    if (!show) return null;

    const modalBg = theme === 'dark' ? 'bg-nothing-darker text-nothing-light' : 'bg-white text-day-text';
    const buttonBaseClasses = `w-full text-center px-4 py-3 text-lg font-bold rounded-md transition-colors duration-300 flex items-center justify-center space-x-3`;
    const upiClasses = theme === 'dark' ? `bg-nothing-gray-dark hover:bg-gray-700` : `bg-day-gray-light hover:bg-gray-300`;

    const icons = {
        close: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
        ),
        back: (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
        ),
        copy: (
             <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
        ),
        paypal: (
            // FIX: Changed 'class' to 'className' for JSX compatibility.
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-paypal" viewBox="0 0 16 16">
              <path d="M14.06 3.713c.12-1.071-.093-1.832-.702-2.526C12.628.356 11.312 0 9.626 0H4.734a.7.7 0 0 0-.691.59L2.005 13.509a.42.42 0 0 0 .415.486h2.756l-.202 1.28a.628.628 0 0 0 .62.726H8.14c.429 0 .793-.31.862-.731l.025-.13.48-3.043.03-.164.001-.007a.35.35 0 0 1 .348-.297h.38c1.266 0 2.425-.256 3.345-.91q.57-.403.993-1.005a4.94 4.94 0 0 0 .88-2.195c.242-1.246.13-2.356-.57-3.154a2.7 2.7 0 0 0-.76-.59l-.094-.061ZM6.543 8.82a.7.7 0 0 1 .321-.079H8.3c2.82 0 5.027-1.144 5.672-4.456l.003-.016q.326.186.548.438c.546.623.679 1.535.45 2.71-.272 1.397-.866 2.307-1.663 2.874-.802.57-1.842.815-3.043.815h-.38a.87.87 0 0 0-.863.734l-.03.164-.48 3.043-.024.13-.001.004a.35.35 0 0 1-.348.296H5.595a.106.106 0 0 1-.105-.123l.208-1.32z"/>
            </svg>
        )
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-modal-title"
        >
            <div 
                className={`relative w-full max-w-sm m-4 p-6 rounded-lg shadow-2xl ${modalBg}`}
                onClick={e => e.stopPropagation()}
            >
                {view === 'upi' && (
                    <button onClick={() => setView('initial')} className={`absolute top-3 left-3 p-2 rounded-full ${theme === 'dark' ? 'hover:bg-nothing-gray-dark' : 'hover:bg-day-gray-light'}`} aria-label="Back to support options">
                        {icons.back}
                    </button>
                )}
                <button onClick={onClose} className={`absolute top-3 right-3 p-2 rounded-full ${theme === 'dark' ? 'hover:bg-nothing-gray-dark' : 'hover:bg-day-gray-light'}`} aria-label="Close support dialog">
                    {icons.close}
                </button>

                {view === 'initial' && (
                    <>
                        <h2 id="support-modal-title" className="text-2xl font-bold text-center mb-6">Support Matrices</h2>
                        <div className="space-y-4">
                            <a 
                                href="https://www.paypal.com/ncp/payment/72N9AB9VD4MJ4" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={`${buttonBaseClasses} bg-[#0070ba] text-white hover:bg-[#005ea6]`}
                                onClick={() => { trackEvent('support_paypal_click'); onClose(); }}
                            >
                                {icons.paypal}
                                <span>Pay with PayPal</span>
                            </a>
                            <button 
                                onClick={() => { setView('upi'); trackEvent('support_upi_click'); }}
                                className={`${buttonBaseClasses} ${upiClasses}`}
                            >
                                <span className="font-bold text-2xl leading-none">₹</span>
                                <span>Pay with UPI</span>
                            </button>
                        </div>
                    </>
                )}

                {view === 'upi' && (
                    <div className="flex flex-col items-center text-center">
                        <h2 className="text-2xl font-bold mb-4">Pay with UPI</h2>
                        <img src="images/UPI-QRCode.png" alt="UPI QR Code" width="256" height="256" className="rounded-lg border-4 border-white mb-4" />
                        <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>Scan the QR code with any UPI app</p>
                        <div className={`w-full flex items-center rounded-md border ${theme === 'dark' ? 'bg-nothing-dark border-nothing-gray-dark' : 'bg-day-gray-light border-gray-300'}`}>
                            <input 
                                type="text" 
                                readOnly 
                                value="udaybhaskar2283@okicici"
                                aria-label="UPI ID"
                                className={`w-full p-2 bg-transparent text-base truncate focus:outline-none ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`} 
                            />
                            <button 
                                onClick={handleCopy}
                                className={`flex-shrink-0 flex items-center justify-center w-36 space-x-2 px-3 py-2 text-sm font-semibold rounded-r-md transition-all duration-300 ${copyText === 'Copied!' ? 'bg-white text-nothing-dark' : (theme === 'dark' ? 'bg-nothing-red hover:brightness-90 text-nothing-light' : 'bg-day-accent hover:brightness-90 text-white')}`}
                            >
                                {copyText === 'Copy UPI ID' && <span className="w-5 h-5">{icons.copy}</span>}
                                <span>{copyText}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const ShareTargetModal: React.FC<{
  show: boolean;
  onClose: () => void;
  onSelect: (tab: Tab) => void;
  theme: Theme;
}> = ({ show, onClose, onSelect, theme }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (show) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose]);

  if (!show) return null;

  const handleSelect = (tab: Tab) => {
    trackEvent('share_target_select', { feature: tab });
    onSelect(tab);
  };
  
  const tabs: { key: Tab, label: string }[] = [
    { key: 'valueAliasing', label: 'Value Aliasing' },
    { key: 'pfp', label: 'Glyph Mirror' },
    { key: 'glassDots', label: 'Glass Dots' },
    { key: 'wallpaper', label: 'Matrix Wallpaper' },
    { key: 'photoWidget', label: 'Photo Widget' },
  ];

  const icons = {
    close: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    ),
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-target-modal-title"
    >
      <div 
        className={`relative w-full max-w-md m-4 p-6 rounded-lg shadow-2xl ${theme === 'dark' ? 'bg-nothing-darker text-nothing-light' : 'bg-white text-day-text'} animate-fade-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="share-target-modal-title" className="text-xl font-bold">Send image to...</h2>
        </div>
        
        <button onClick={onClose} className={`absolute top-3 right-3 p-2 rounded-full ${theme === 'dark' ? 'hover:bg-nothing-gray-dark' : 'hover:bg-day-gray-light'}`} aria-label="Close share dialog">
          {icons.close}
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className={`p-4 text-center font-semibold rounded-md transition-colors duration-200 ${theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700' : 'bg-day-gray-light hover:bg-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};