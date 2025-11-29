
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useHistory, useImageHandler } from './hooks';
import { getTimestamp } from './utils';
import { WallpaperState, WallpaperBgKey, WALLPAPER_BG_OPTIONS, Theme } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, SegmentedControl, ToastNotification, ToggleSwitch, SharePopup } from './components';
import { trackEvent } from './analytics';

const DEFAULT_SLIDER_VALUE = 50;
const WALLPAPER_PHONE_WIDTH = 1260;
const WALLPAPER_PHONE_HEIGHT = 2800;
const WALLPAPER_DESKTOP_WIDTH = 3840;
const WALLPAPER_DESKTOP_HEIGHT = 2160;
const WALLPAPER_PIXEL_GAP_MULTIPLIER = 0.0423936;
const WALLPAPER_RESOLUTION_MULTIPLIER = 71.8848;

const WALLPAPER_INITIAL_STATE: WallpaperState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    background: 'black' as WallpaperBgKey,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
    isMonochrome: false,
};

type WallpaperSettingsContainer = {
    phone: WallpaperState;
    desktop: WallpaperState;
};

const DUAL_WALLPAPER_INITIAL_STATE: WallpaperSettingsContainer = {
    phone: { ...WALLPAPER_INITIAL_STATE },
    desktop: { ...WALLPAPER_INITIAL_STATE },
};


export const useWallpaperPanel = ({
  theme,
  isMobile,
  footerLinks,
  triggerShareToast,
  handleShare,
  showSharePopup,
  setShowSharePopup,
  communityLink,
  appUrl,
  shareVariant,
}: {
  theme: Theme;
  isMobile: boolean;
  footerLinks: React.ReactNode;
  triggerShareToast: (showSpecificToast?: () => void) => void;
  handleShare: (variant?: 'default' | 'special') => Promise<void>;
  showSharePopup: boolean;
  setShowSharePopup: React.Dispatch<React.SetStateAction<boolean>>;
  communityLink: string;
  appUrl: string;
  shareVariant: 'default' | 'special';
}) => {
  const { 
    state: wallpaperSettings, 
    setState: setWallpaperSettings, 
    undo: undoWallpaper, 
    redo: redoWallpaper, 
    reset: resetWallpaperHistory, 
    canUndo: canUndoWallpaper, 
    canRedo: canRedoWallpaper 
  } = useHistory(DUAL_WALLPAPER_INITIAL_STATE);
  
  const [liveWallpaperSettings, setLiveWallpaperSettings] = useState(wallpaperSettings);
  const [wallpaperType, setWallpaperType] = useState<'phone' | 'desktop'>(isMobile ? 'phone' : 'desktop');
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [showFsToast, setShowFsToast] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const fullScreenFileInputRef = useRef<HTMLInputElement>(null);
  const [isFullScreenControlsOpen, setIsFullScreenControlsOpen] = useState(false);
  
  const {
    imageSrc,
    image,
    isLoading,
    isDownloading,
    handleFileSelect,
    handleDownload: baseHandleDownload,
    clearImage
  } = useImageHandler({
    featureName: 'wallpaper',
    onFileSelectCallback: resetWallpaperHistory,
    triggerShareToast: triggerShareToast
  });

  useEffect(() => { setLiveWallpaperSettings(wallpaperSettings); }, [wallpaperSettings]);

  const liveWallpaperState = liveWallpaperSettings[wallpaperType];
  const { resolution, pixelGap, background, cropOffsetX, cropOffsetY, isMonochrome } = liveWallpaperState;
  
  useEffect(() => {
    const handleFullScreenChange = () => {
        if (!document.fullscreenElement) {
            setIsFullScreenPreview(false);
            setIsFullScreenControlsOpen(false); // Close controls on exit
        }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const enterFullScreen = () => {
      trackEvent('wallpaper_fullscreen_enter');
      
      flushSync(() => {
        setIsFullScreenPreview(true);
      });

      if (fullScreenContainerRef.current) {
          fullScreenContainerRef.current.requestFullscreen()
              .catch(err => {
                  console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                  // If the request fails, revert the state
                  setIsFullScreenPreview(false);
              });
      }
  };
  
  const exitFullScreen = useCallback(() => {
      trackEvent('wallpaper_fullscreen_exit');
      if (document.fullscreenElement) {
          document.exitFullscreen();
      } else {
          setIsFullScreenPreview(false);
      }
  }, []);

  const handleResetCurrentWallpaper = useCallback(() => {
    trackEvent('wallpaper_reset_defaults', { wallpaper_type: wallpaperType });
    setWallpaperSettings(currentSettings => {
      const { cropOffsetX, cropOffsetY, background } = currentSettings[wallpaperType];
      return {
        ...currentSettings,
        [wallpaperType]: {
          ...DUAL_WALLPAPER_INITIAL_STATE[wallpaperType],
          cropOffsetX,
          cropOffsetY,
          background,
        }
      };
    });
  }, [wallpaperType, setWallpaperSettings]);

  const [currentWallpaperWidth, currentWallpaperHeight] = useMemo(() => wallpaperType === 'desktop' ? [WALLPAPER_DESKTOP_WIDTH, WALLPAPER_DESKTOP_HEIGHT] : [WALLPAPER_PHONE_WIDTH, WALLPAPER_PHONE_HEIGHT], [wallpaperType]);

  const wallpaperGridWidth = useMemo(() => Math.floor(10 + ((wallpaperType === 'desktop' ? resolution * 4 : resolution * 1.2) / 100) * WALLPAPER_RESOLUTION_MULTIPLIER), [resolution, wallpaperType]);
  const wallpaperGridHeight = useMemo(() => Math.round(wallpaperGridWidth * (currentWallpaperHeight / currentWallpaperWidth)), [wallpaperGridWidth, currentWallpaperWidth, currentWallpaperHeight]);
  const calculatedWallpaperPixelGap = useMemo(() => pixelGap * WALLPAPER_PIXEL_GAP_MULTIPLIER, [pixelGap]);
  const wallpaperCropIsNeeded = useMemo(() => image ? Math.abs((image.width / image.height) - (currentWallpaperWidth / currentWallpaperHeight)) > 0.01 : false, [image, currentWallpaperWidth, currentWallpaperHeight]);

  useEffect(() => {
    // Determine the single canvas to draw on, preventing the double-draw performance issue.
    const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
    if (!ctx) return;
    
    ctx.fillStyle = WALLPAPER_BG_OPTIONS[background]?.color || '#000000';
    ctx.fillRect(0, 0, currentWallpaperWidth, currentWallpaperHeight);
    if (!image) return;
    
    const imgAspect = image.width / image.height, canvasAspect = currentWallpaperWidth / currentWallpaperHeight;
    let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;
    if (imgAspect > canvasAspect) { sWidth = image.height * canvasAspect; sx = (image.width - sWidth) * cropOffsetX; }
    else if (imgAspect < canvasAspect) { sHeight = image.width / canvasAspect; sy = (image.height - sHeight) * cropOffsetY; }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = wallpaperGridWidth; tempCanvas.height = wallpaperGridHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, wallpaperGridWidth, wallpaperGridHeight);
    
    const data = tempCtx.getImageData(0, 0, wallpaperGridWidth, wallpaperGridHeight).data;
    const totalGapW = (wallpaperGridWidth - 1) * calculatedWallpaperPixelGap;
    const totalGapH = (wallpaperGridHeight - 1) * calculatedWallpaperPixelGap;
    const pxRenderW = (currentWallpaperWidth - totalGapW) / wallpaperGridWidth;
    const pxRenderH = (currentWallpaperHeight - totalGapH) / wallpaperGridHeight;
    
    for (let y = 0; y < wallpaperGridHeight; y++) {
        for (let x = 0; x < wallpaperGridWidth; x++) {
            const i = (y * wallpaperGridWidth + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2];
            if (isMonochrome) {
                const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
            } else {
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            }
            const drawX = x * (pxRenderW + calculatedWallpaperPixelGap);
            const drawY = y * (pxRenderH + calculatedWallpaperPixelGap);
            
            const radius = Math.min(pxRenderW, pxRenderH) / 2;
            if (radius > 0) {
                ctx.beginPath();
                const centerX = drawX + pxRenderW / 2;
                const centerY = drawY + pxRenderH / 2;
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
  }, [image, wallpaperGridWidth, wallpaperGridHeight, calculatedWallpaperPixelGap, background, currentWallpaperWidth, currentWallpaperHeight, cropOffsetX, cropOffsetY, isFullScreenPreview, isMonochrome]);
  
  const getCanvasBlob = useCallback((): Promise<Blob | null> => {
      return new Promise(resolve => {
          const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
          if (canvas) {
              canvas.toBlob(blob => resolve(blob), 'image/png');
          } else {
              resolve(null);
          }
      });
  }, [isFullScreenPreview]);

  const handleFullScreenReplace = (file: File) => {
    trackEvent('wallpaper_fullscreen_replace_image', { wallpaper_type: wallpaperType });
    // FIX: `handleFileSelect` expects a second argument for the upload method.
    handleFileSelect(file, 'click');
  };

  const handleFullScreenReplaceClick = () => {
    trackEvent('wallpaper_fullscreen_replace_image_click', { wallpaper_type: wallpaperType });
    fullScreenFileInputRef.current?.click();
  };
  
  const handleFullScreenFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          handleFullScreenReplace(e.target.files[0]);
      }
      if (e.target) {
          e.target.value = '';
      }
  };
  
  const handleDownload = () => {
    const analyticsParams: Record<string, string | number | boolean | undefined> = {
      feature: 'wallpaper',
      wallpaper_type: wallpaperType,
      setting_resolution: liveWallpaperState.resolution,
      setting_pixel_gap: liveWallpaperState.pixelGap,
      setting_background: liveWallpaperState.background,
      setting_crop_offset_x: liveWallpaperState.cropOffsetX,
      setting_crop_offset_y: liveWallpaperState.cropOffsetY,
      setting_is_monochrome: liveWallpaperState.isMonochrome,
    };

    const onSuccess = () => {
        if (isFullScreenPreview) {
            triggerShareToast(() => setShowFsToast(true));
        } else {
            triggerShareToast();
        }
    };

    baseHandleDownload(getCanvasBlob, 'matrices-wallpaper', analyticsParams, onSuccess);
  };

  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0.5, initialOffsetY: 0.5, hasMoved: false });
  
  const handleWallpaperDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (!wallpaperCropIsNeeded) return;
      
      e.preventDefault();

      dragState.current.isDragging = true;
      dragState.current.hasMoved = false;
      
      const point = 'touches' in e ? e.touches[0] : e;
      dragState.current.startX = point.clientX;
      dragState.current.startY = point.clientY;
      dragState.current.initialOffsetX = liveWallpaperSettings[wallpaperType].cropOffsetX;
      dragState.current.initialOffsetY = liveWallpaperSettings[wallpaperType].cropOffsetY;
      
      document.body.style.cursor = 'grabbing';
  }, [wallpaperCropIsNeeded, liveWallpaperSettings, wallpaperType]);

  const handleWallpaperDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDragging || !image) return;
      
      dragState.current.hasMoved = true;

      const point = 'touches' in e ? e.touches[0] : e;
      
      let deltaX = point.clientX - dragState.current.startX;
      let deltaY = point.clientY - dragState.current.startY;
      
      const activeCanvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;

      if (activeCanvas) {
          const rect = activeCanvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
              const scaleX = currentWallpaperWidth / rect.width;
              const scaleY = currentWallpaperHeight / rect.height;
              deltaX *= scaleX;
              deltaY *= scaleY;
          }
      }
      
      const imgAspect = image.width / image.height;
      const canvasAspect = currentWallpaperWidth / currentWallpaperHeight;
      
      let panRangeX = 0, panRangeY = 0;
      if (imgAspect > canvasAspect) { panRangeX = (currentWallpaperHeight * imgAspect) - currentWallpaperWidth; }
      else if (imgAspect < canvasAspect) { panRangeY = (currentWallpaperWidth / imgAspect) - currentWallpaperHeight; }
      
      let newOffsetX = panRangeX > 0 ? dragState.current.initialOffsetX - (deltaX / panRangeX) : dragState.current.initialOffsetX;
      let newOffsetY = panRangeY > 0 ? dragState.current.initialOffsetY - (deltaY / panRangeY) : dragState.current.initialOffsetY;
      
      setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], cropOffsetX: Math.max(0, Math.min(1, newOffsetX)), cropOffsetY: Math.max(0, Math.min(1, newOffsetY)) } }));
  }, [image, currentWallpaperWidth, currentWallpaperHeight, wallpaperType, isFullScreenPreview]);

  const handleWallpaperDragEnd = useCallback(() => {
      if (dragState.current.isDragging) {
          dragState.current.isDragging = false;
          
          if (dragState.current.hasMoved) {
            trackEvent('wallpaper_crop', { wallpaper_type: wallpaperType });
          }

          const { cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } = liveWallpaperSettings[wallpaperType];
          setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } }));
          
          document.body.style.cursor = 'default';
      }
  }, [liveWallpaperSettings, wallpaperType, setWallpaperSettings]);

  useEffect(() => {
      const onMove = (e: MouseEvent | TouchEvent) => handleWallpaperDragMove(e);
      const onEnd = () => handleWallpaperDragEnd();

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);

      return () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onEnd);
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
          document.removeEventListener('touchcancel', onEnd);
      }
  }, [handleWallpaperDragMove, handleWallpaperDragEnd]);

  const handleWallpaperTypeSelect = (type: string) => {
    trackEvent('wallpaper_type_select', { type });
    setWallpaperType(type as 'phone' | 'desktop');
  };
  
  const handleBackgroundColorSelect = (key: WallpaperBgKey) => {
    trackEvent('wallpaper_bg_change', { color: key, wallpaper_type: wallpaperType });
    setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], background: key } }));
  };
  
  const handleMonochromeToggle = () => {
    trackEvent('wallpaper_toggle_change', { setting: 'monochrome', enabled: !liveWallpaperState.isMonochrome, wallpaper_type: wallpaperType });
    setWallpaperSettings(s => ({...s, [wallpaperType]: { ...s[wallpaperType], isMonochrome: !s[wallpaperType].isMonochrome }}));
  };
  
  const wallpaperTypeOptions = [
      { key: 'phone', label: 'Phone' },
      { key: 'desktop', label: 'Desktop' }
  ];

  const backgroundColorOptions = [
      { key: 'white', label: 'White BG' },
      { key: 'black', label: 'Black BG' }
  ];

  const controlsPanel = imageSrc ? (
     <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
      <div className={`p-4 rounded-lg space-y-2 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <SegmentedControl options={wallpaperTypeOptions} selected={wallpaperType} onSelect={handleWallpaperTypeSelect} theme={theme} />
        <SegmentedControl options={backgroundColorOptions} selected={liveWallpaperState.background} onSelect={(key) => handleBackgroundColorSelect(key as WallpaperBgKey)} theme={theme} />
      </div>
      <UndoRedoControls onUndo={() => { undoWallpaper(); trackEvent('wallpaper_undo'); }} onRedo={() => { redoWallpaper(); trackEvent('wallpaper_redo'); }} canUndo={canUndoWallpaper} canRedo={canRedoWallpaper} theme={theme} />
      
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Resolution" 
            value={resolution} 
            onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))} 
            onChangeCommitted={v => { setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } })); trackEvent('wallpaper_slider_change', { slider_name: 'resolution', value: v, wallpaper_type: wallpaperType }); }}
            onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: DEFAULT_SLIDER_VALUE } }))}
            disabled={isLoading} 
        />
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Pixel Gap" 
            value={pixelGap} 
            onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))}
            onChangeCommitted={v => { setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } })); trackEvent('wallpaper_slider_change', { slider_name: 'pixel_gap', value: v, wallpaper_type: wallpaperType }); }} 
            onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: DEFAULT_SLIDER_VALUE } }))}
            disabled={isLoading} 
        />
      </div>

      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
          <label htmlFor="monochrome-toggle" className="text-sm">Monochrome</label>
          <button id="monochrome-toggle" role="switch" aria-checked={isMonochrome} onClick={handleMonochromeToggle} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isMonochrome ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isMonochrome ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
      
      <div className="pt-2 flex space-x-2">
        <button onClick={clearImage} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Clear the current image">Clear Image</button>
        <button onClick={handleResetCurrentWallpaper} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset wallpaper controls to their default values">Reset Controls</button>
      </div>
      <div className="block md:hidden pt-8"><footer className="text-center tracking-wide">{footerLinks}</footer></div>
    </div>
  ) : null;
  
  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} context="wallpaper" isMobile={isMobile} />
  ) : (
    <>
        <input
            type="file"
            ref={fullScreenFileInputRef}
            onChange={handleFullScreenFileInputChange}
            className="hidden"
            accept="image/*"
        />
        <div className="relative flex items-center justify-center w-full h-full">
            <canvas 
                ref={canvasRef} 
                width={currentWallpaperWidth} 
                height={currentWallpaperHeight} 
                className={`border-2 rounded-lg ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} ${wallpaperType === 'phone' ? (isMobile ? 'w-4/5 h-auto' : 'max-h-full w-auto') : 'max-w-full max-h-full'}`} 
                aria-label="Wallpaper Canvas" 
                onMouseDown={handleWallpaperDragStart}
                onTouchStart={handleWallpaperDragStart}
                style={{
                    cursor: wallpaperCropIsNeeded ? 'grab' : 'default',
                    touchAction: wallpaperCropIsNeeded ? 'none' : 'auto'
                }}
            />
            <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-2">
                <button
                    onClick={() => handleShare()}
                    className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
                    aria-label="Share this creation"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                </button>
                <button
                    onClick={enterFullScreen}
                    className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
                    aria-label="Enter full-screen preview"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                </button>
            </div>
        </div>
        {isFullScreenPreview && createPortal(
            <div
                ref={fullScreenContainerRef}
                className="fixed inset-0 bg-black z-50 flex items-center justify-center"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                        dragState.current.hasMoved = false;
                    }
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget && !dragState.current.hasMoved) {
                        if (isFullScreenControlsOpen) {
                            setIsFullScreenControlsOpen(false);
                        } else {
                            exitFullScreen();
                        }
                    }
                }}
            >
                <canvas
                    ref={fullScreenCanvasRef}
                    width={currentWallpaperWidth}
                    height={currentWallpaperHeight}
                    className="max-w-full max-h-full"
                    aria-label="Full-screen Wallpaper Canvas Preview"
                    onMouseDown={handleWallpaperDragStart}
                    onTouchStart={handleWallpaperDragStart}
                    style={{
                        cursor: wallpaperCropIsNeeded ? 'grab' : 'default',
                        touchAction: wallpaperCropIsNeeded ? 'none' : 'auto'
                    }}
                />
                {wallpaperCropIsNeeded && (
                    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-2 py-1 rounded-md text-sm ${theme === 'dark' ? 'bg-nothing-dark/90 text-nothing-light' : 'bg-day-gray-light/90 text-day-text'} backdrop-blur-sm pointer-events-none`}>
                        ⓘ Drag to Crop
                    </div>
                )}
                
                {!isMobile && (
                  <div className="fixed bottom-4 left-4 z-[51] w-80 flex flex-col items-start space-y-2">
                    <div className="w-full">
                      {isFullScreenControlsOpen ? (
                        <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-4 max-h-[calc(100vh-10rem)] flex flex-col space-y-4 shadow-2xl`}>
                          <div className="flex justify-between items-center flex-shrink-0">
                            <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-day-text'}`}>Controls</h3>
                            <button onClick={() => { setIsFullScreenControlsOpen(false); trackEvent('wallpaper_fullscreen_controls_toggle', { open: false }); }} className={`p-2 ${theme === 'dark' ? 'text-white hover:bg-white/20' : 'text-day-text hover:bg-black/10'} rounded-full transition-colors`} aria-label="Collapse controls">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                            </button>
                          </div>

                          <div className="overflow-y-auto space-y-4 pr-2 -mr-2">
                            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-2`}>
                                <SegmentedControl options={wallpaperTypeOptions} selected={wallpaperType} onSelect={handleWallpaperTypeSelect} theme={theme} />
                                <SegmentedControl options={backgroundColorOptions} selected={liveWallpaperState.background} onSelect={(key) => handleBackgroundColorSelect(key as WallpaperBgKey)} theme={theme} />
                            </div>
                            <UndoRedoControls onUndo={() => { undoWallpaper(); trackEvent('wallpaper_undo'); }} onRedo={() => { redoWallpaper(); trackEvent('wallpaper_redo'); }} canUndo={canUndoWallpaper} canRedo={canRedoWallpaper} theme={theme} />
                            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-4`}>
                                <EnhancedSlider 
                                    theme={theme}
                                    isMobile={isMobile}
                                    label="Resolution" 
                                    value={resolution} 
                                    onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))} 
                                    onChangeCommitted={v => { setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } })); trackEvent('wallpaper_slider_change', { slider_name: 'resolution', value: v, wallpaper_type: wallpaperType }); }}
                                    onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: DEFAULT_SLIDER_VALUE } }))}
                                    disabled={isLoading} 
                                />
                                <EnhancedSlider 
                                    theme={theme}
                                    isMobile={isMobile}
                                    label="Pixel Gap" 
                                    value={pixelGap} 
                                    onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))}
                                    onChangeCommitted={v => { setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } })); trackEvent('wallpaper_slider_change', { slider_name: 'pixel_gap', value: v, wallpaper_type: wallpaperType }); }}
                                    onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: DEFAULT_SLIDER_VALUE } }))}
                                    disabled={isLoading} 
                                />
                            </div>
                            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-4`}>
                              <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                  <label htmlFor="monochrome-toggle-fs" className="text-sm">Monochrome</label>
                                  <button id="monochrome-toggle-fs" role="switch" aria-checked={isMonochrome} onClick={handleMonochromeToggle} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isMonochrome ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isMonochrome ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                              </div>
                            </div>
                            <div>
                              <button onClick={handleResetCurrentWallpaper} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset wallpaper controls to their default values"> Reset Controls </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setIsFullScreenControlsOpen(true); trackEvent('wallpaper_fullscreen_controls_toggle', { open: true }); }} className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80 text-white hover:bg-nothing-dark' : 'bg-day-bg/90 text-day-text hover:bg-day-gray-light border border-gray-300/50'} backdrop-blur-sm font-semibold py-3 px-4 rounded-lg flex items-center justify-between shadow-lg transition-colors`} aria-label="Expand controls">
                          <span>Controls</span>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg>
                        </button>
                      )}
                    </div>
                    
                    <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-2 flex flex-col items-stretch space-y-2 shadow-lg`}>
                        <button
                            onClick={handleFullScreenReplaceClick}
                            disabled={isLoading}
                            className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`}
                            aria-label="Replace the current image"
                        >
                            Replace Image
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={isLoading || isDownloading}
                            className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`}
                            aria-label="Download the current wallpaper"
                        >
                            Download
                        </button>
                    </div>
                  </div>
                )}
                
                <div className="fixed bottom-8 right-8 z-50 flex items-center space-x-2">
                    <button
                        onClick={() => handleShare()}
                        className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
                        aria-label="Share this creation"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                    </button>
                    <button
                        onClick={exitFullScreen}
                        className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
                        aria-label="Exit full-screen preview"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                        </svg>
                    </button>
                </div>
                <ToastNotification
                  show={showFsToast}
                  onClose={() => setShowFsToast(false)}
                  onShare={() => {}}
                  theme={theme}
                  isMobile={false}
                  imageRendered={!!imageSrc}
                  className="z-[60] !bottom-24"
                />
                <SharePopup 
                    show={showSharePopup}
                    onClose={() => setShowSharePopup(false)}
                    theme={theme}
                    communityLink={communityLink}
                    appUrl={appUrl}
                    variant={shareVariant}
                />
            </div>,
            document.body
        )}
    </>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current wallpaper"> Download </button>;

  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme} isMobile={isMobile}/>;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton, wallpaperType, getCanvasBlob, undo: undoWallpaper, redo: redoWallpaper, canUndo: canUndoWallpaper, canRedo: canRedoWallpaper };
};