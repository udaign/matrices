
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useHistory, useImageHandler } from './hooks';
import { getTimestamp } from './utils';
import { ValueAliasingState, WallpaperBgKey, WALLPAPER_BG_OPTIONS, Theme, ValueAliasingSettingsContainer, PrintState } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, SegmentedControl, ToastNotification, ToggleSwitch, SharePopup } from './components';
import { trackEvent } from './analytics';

const DEFAULT_SLIDER_VALUE = 50;
const VALUE_ALIASING_PHONE_WIDTH = 1260;
const VALUE_ALIASING_PHONE_HEIGHT = 2800;
const VALUE_ALIASING_DESKTOP_WIDTH = 3840;
const VALUE_ALIASING_DESKTOP_HEIGHT = 2160;
const VALUE_ALIASING_PIXEL_GAP_MULTIPLIER = 0.0423936;
const VALUE_ALIASING_RESOLUTION_MULTIPLIER = 71.8848;
const PRINT_DPI = 300;

const PRINT_SIZES: Record<string, { label: string, w: number, h: number, group: string, isRatio?: boolean }> = {
    // US Standard
    'us_8x10': { label: '8 x 10 in', w: 8, h: 10, group: 'US Standard' },
    'us_8.5x11': { label: '8.5 x 11 in', w: 8.5, h: 11, group: 'US Standard' },
    'us_11x14': { label: '11 x 14 in', w: 11, h: 14, group: 'US Standard' },
    'us_11x17': { label: '11 x 17 in', w: 11, h: 17, group: 'US Standard' },
    'us_12x16': { label: '12 x 16 in', w: 12, h: 16, group: 'US Standard' },
    'us_12x18': { label: '12 x 18 in', w: 12, h: 18, group: 'US Standard' },
    'us_16x20': { label: '16 x 20 in', w: 16, h: 20, group: 'US Standard' },
    'us_18x24': { label: '18 x 24 in', w: 18, h: 24, group: 'US Standard' },
    'us_20x30': { label: '20 x 30 in', w: 20, h: 30, group: 'US Standard' },
    'us_24x36': { label: '24 x 36 in', w: 24, h: 36, group: 'US Standard' },
    'us_27x40': { label: '27 x 40 in', w: 27, h: 40, group: 'US Standard' },
    'us_36x48': { label: '36 x 48 in', w: 36, h: 48, group: 'US Standard' },
    // ISO
    'iso_a5': { label: 'A5', w: 5.83, h: 8.27, group: 'ISO' },
    'iso_a4': { label: 'A4', w: 8.27, h: 11.69, group: 'ISO' },
    'iso_a3': { label: 'A3', w: 11.69, h: 16.54, group: 'ISO' },
    'iso_a2': { label: 'A2', w: 16.54, h: 23.39, group: 'ISO' },
    'iso_a1': { label: 'A1', w: 23.39, h: 33.11, group: 'ISO' },
    'iso_a0': { label: 'A0', w: 33.11, h: 46.81, group: 'ISO' },
    // Ratio (base size of 12 inches for the smaller side)
    'original': { label: 'Original Ratio', w: 1, h: 1, group: 'Ratio', isRatio: true },
    'ratio_1:1': { label: '1:1', w: 12, h: 12, group: 'Ratio', isRatio: true },
    'ratio_5:4': { label: '5:4', w: 15, h: 12, group: 'Ratio', isRatio: true },
    'ratio_4:3': { label: '4:3', w: 16, h: 12, group: 'Ratio', isRatio: true },
    'ratio_3:2': { label: '3:2', w: 18, h: 12, group: 'Ratio', isRatio: true },
    'ratio_16:9': { label: '16:9', w: 21.33, h: 12, group: 'Ratio', isRatio: true },
    'ratio_1.85:1': { label: '1.85:1', w: 22.2, h: 12, group: 'Ratio', isRatio: true },
    'ratio_2:1': { label: '2:1', w: 24, h: 12, group: 'Ratio', isRatio: true },
    'ratio_2.35:1': { label: '2.35:1', w: 28.2, h: 12, group: 'Ratio', isRatio: true },
    'ratio_21:9': { label: '21:9', w: 28, h: 12, group: 'Ratio', isRatio: true },
    'ratio_3:1': { label: '3:1', w: 36, h: 12, group: 'Ratio', isRatio: true },
};
const PRINT_SIZE_GROUPS = ['US Standard', 'ISO', 'Ratio'];

const VALUE_ALIASING_INITIAL_STATE: ValueAliasingState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    background: 'black' as WallpaperBgKey,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
    isMonochrome: true,
    exposure: DEFAULT_SLIDER_VALUE,
    contrast: DEFAULT_SLIDER_VALUE,
    isPureValue: false,
    isTransparent: false,
    lowerLimit: 0,
};

const PRINT_INITIAL_STATE: PrintState = {
    ...VALUE_ALIASING_INITIAL_STATE,
    size: 'original',
    orientation: 'portrait',
};

const FULL_VALUE_ALIASING_INITIAL_STATE: ValueAliasingSettingsContainer = {
    outputType: 'wallpaper',
    wallpaper: {
        phone: { ...VALUE_ALIASING_INITIAL_STATE },
        desktop: { ...VALUE_ALIASING_INITIAL_STATE },
    },
    print: PRINT_INITIAL_STATE,
};

const EASTER_EGG_COLORS = {
    yellow: '#FCCA21',
    blue: '#1A5A8A',
    red: '#BD1721',
    grey: '#E0E0E0',
};

const EASTER_EGG_PERMUTATIONS: [('yellow' | 'blue' | 'red'), ('yellow' | 'blue' | 'red'), ('yellow' | 'blue' | 'red')][] = [
    ['yellow', 'blue', 'red'],
    ['blue', 'yellow', 'red'],
    ['red', 'yellow', 'blue'],
    ['yellow', 'red', 'blue'],
    ['blue', 'red', 'yellow'],
    ['red', 'blue', 'yellow'],
];

const rgbToCmyk = (r: number, g: number, b: number): [number, number, number, number] => {
    const r_ = r / 255;
    const g_ = g / 255;
    const b_ = b / 255;
    const k = 1 - Math.max(r_, g_, b_);
    if (k === 1) return [0, 0, 0, 1];
    const c = (1 - r_ - k) / (1 - k);
    const m = (1 - g_ - k) / (1 - k);
    const y = (1 - b_ - k) / (1 - k);
    return [c, m, y, k];
};

const cmykToRgb = (c: number, m: number, y: number, k: number): [number, number, number] => {
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    return [Math.round(r), Math.round(g), Math.round(b)];
};

const simulateCmyk = (r: number, g: number, b: number): [number, number, number] => {
    const [c, m, y, k] = rgbToCmyk(r, g, b);
    return cmykToRgb(c, m, y, k);
};

const drawEasterEggPattern = (ctx: CanvasRenderingContext2D, W: number, H: number, permutationIndex: number, shouldSimulateCmyk: boolean) => {
    const permutation = EASTER_EGG_PERMUTATIONS[permutationIndex];
    if (!permutation) return;

    const getColor = (hex: string): string => {
        if (!shouldSimulateCmyk) return hex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const [simR, simG, simB] = simulateCmyk(r, g, b);
        return `rgb(${simR}, ${simG}, ${simB})`;
    }

    const colorA = getColor(EASTER_EGG_COLORS[permutation[0]]);
    const colorB = getColor(EASTER_EGG_COLORS[permutation[1]]);
    const colorC = getColor(EASTER_EGG_COLORS[permutation[2]]);

    const g_ratio = 0.809;
    const mid = 0.5;

    ctx.fillStyle = getColor(EASTER_EGG_COLORS.grey);
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, g_ratio * W, g_ratio * H);

    ctx.fillStyle = colorB;
    ctx.fillRect(g_ratio * W, 0, (1 - g_ratio) * W, mid * H);

    ctx.fillStyle = colorC;
    ctx.fillRect(0, g_ratio * H, mid * W, (1 - g_ratio) * H);
};

const drawValueAliasingMatrix = (ctx: CanvasRenderingContext2D, options: {
    canvasWidth: number,
    canvasHeight: number,
    image: HTMLImageElement,
    settings: {
        outputType: 'wallpaper' | 'print';
        valueAliasingType: 'phone' | 'desktop';
        isEasterEggActive: boolean;
        activePermutationIndex: number | null;
        resolution: number;
        pixelGap: number;
        background: WallpaperBgKey;
        cropOffsetX: number;
        cropOffsetY: number;
        isMonochrome: boolean;
        exposure: number;
        contrast: number;
        isPureValue: boolean;
        isTransparent: boolean;
        lowerLimit: number;
    }
}) => {
    const { canvasWidth, canvasHeight, image, settings } = options;
    const { outputType, valueAliasingType, isEasterEggActive, activePermutationIndex, resolution, pixelGap, background, cropOffsetX, cropOffsetY, isMonochrome, exposure, contrast, isPureValue, isTransparent, lowerLimit } = settings;
    
    const shouldSimulateCmyk = outputType === 'print';

    if (isEasterEggActive && activePermutationIndex !== null) {
        drawEasterEggPattern(ctx, canvasWidth, canvasHeight, activePermutationIndex, shouldSimulateCmyk);
    } else {
        if (isTransparent) {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        } else {
            const bgColor = WALLPAPER_BG_OPTIONS[background]?.color || '#000000';
            if (shouldSimulateCmyk) {
                const r = parseInt(bgColor.slice(1, 3), 16);
                const g = parseInt(bgColor.slice(3, 5), 16);
                const b = parseInt(bgColor.slice(5, 7), 16);
                const [simR, simG, simB] = simulateCmyk(r, g, b);
                ctx.fillStyle = `rgb(${simR}, ${simG}, ${simB})`;
            } else {
                ctx.fillStyle = bgColor;
            }
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
    }

    const valueAliasingGridWidth = Math.floor(10 + ((outputType === 'print' ? resolution * 4 : (valueAliasingType === 'desktop' ? resolution * 4 : resolution * 1.2)) / 100) * VALUE_ALIASING_RESOLUTION_MULTIPLIER);
    const valueAliasingGridHeight = Math.round(valueAliasingGridWidth * (canvasHeight / canvasWidth));
    
    const imgAspect = image.width / image.height, canvasAspect = canvasWidth / canvasHeight;
    let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;
    if (imgAspect > canvasAspect) { sWidth = image.height * canvasAspect; sx = (image.width - sWidth) * cropOffsetX; }
    else if (imgAspect < canvasAspect) { sHeight = image.width / canvasAspect; sy = (image.height - sHeight) * cropOffsetY; }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = valueAliasingGridWidth; tempCanvas.height = valueAliasingGridHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, valueAliasingGridWidth, valueAliasingGridHeight);
    
    const data = tempCtx.getImageData(0, 0, valueAliasingGridWidth, valueAliasingGridHeight).data;
    const calculatedValueAliasingPixelGap = pixelGap * VALUE_ALIASING_PIXEL_GAP_MULTIPLIER;
    const totalGapW = (valueAliasingGridWidth - 1) * calculatedValueAliasingPixelGap;
    const totalGapH = (valueAliasingGridHeight - 1) * calculatedValueAliasingPixelGap;
    const pxRenderW = (canvasWidth - totalGapW) / valueAliasingGridWidth;
    const pxRenderH = (canvasHeight - totalGapH) / valueAliasingGridHeight;

    const calculatedExposure = (exposure - 50) * 2;
    const calculatedContrast = contrast <= 50 ? contrast / 50 : 1 + ((contrast - 50) / 50) * 2;
    const threshold = lowerLimit / 100.0;
    
    const useEffectivePureValue = isEasterEggActive || isPureValue;

    for (let y = 0; y < valueAliasingGridHeight; y++) {
        for (let x = 0; x < valueAliasingGridWidth; x++) {
            const i = (y * valueAliasingGridWidth + x) * 4;
            const r_pixel = data[i], g_pixel = data[i+1], b_pixel = data[i+2];

            if (isMonochrome) {
                const originalGray = 0.299 * r_pixel + 0.587 * g_pixel + 0.114 * b_pixel;
                let adjusted = ((originalGray / 255.0 - 0.5) * calculatedContrast + 0.5) * 255.0 + calculatedExposure;
                const finalGray = Math.round(Math.max(0, Math.min(255, adjusted)));
                
                if (isEasterEggActive) {
                    const sizeMultiplier = (255.0 - finalGray) / 255.0;
                    if (sizeMultiplier > threshold) {
                        const [r, g, b] = [0, 0, 0];
                        if (shouldSimulateCmyk) {
                            const [simR, simG, simB] = simulateCmyk(r, g, b);
                            ctx.fillStyle = `rgb(${simR}, ${simG}, ${simB})`;
                        } else {
                            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                        }
                        const baseRadius = Math.min(pxRenderW, pxRenderH) / 2;
                        const finalRadius = baseRadius * sizeMultiplier;
                        if (finalRadius > 0.1) {
                            const drawX = x * (pxRenderW + calculatedValueAliasingPixelGap);
                            const drawY = y * (pxRenderH + calculatedValueAliasingPixelGap);
                            const centerX = drawX + pxRenderW / 2;
                            const centerY = drawY + pxRenderH / 2;
                            ctx.beginPath();
                            ctx.arc(centerX, centerY, finalRadius, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }
                } else {
                    const isLightMode = background === 'white';
                    const sizeMultiplier = isLightMode ? (255.0 - finalGray) / 255.0 : finalGray / 255.0;
                    if (sizeMultiplier > threshold) {
                        let r, g, b;
                        if (useEffectivePureValue) { [r, g, b] = isLightMode ? [0, 0, 0] : [255, 255, 255]; }
                        else { [r, g, b] = [finalGray, finalGray, finalGray]; }
                        if (shouldSimulateCmyk) {
                            const [simR, simG, simB] = simulateCmyk(r, g, b);
                            ctx.fillStyle = `rgb(${simR}, ${simG}, ${simB})`;
                        } else {
                            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                        }
                        const baseRadius = Math.min(pxRenderW, pxRenderH) / 2;
                        const finalRadius = baseRadius * sizeMultiplier;
                        if (finalRadius > 0.1) {
                            const drawX = x * (pxRenderW + calculatedValueAliasingPixelGap);
                            const drawY = y * (pxRenderH + calculatedValueAliasingPixelGap);
                            const centerX = drawX + pxRenderW / 2;
                            const centerY = drawY + pxRenderH / 2;
                            ctx.beginPath();
                            ctx.arc(centerX, centerY, finalRadius, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }
                }
            }
        }
    }
};

export const useValueAliasingPanel = ({
  theme,
  isMobile,
  footerLinks,
  triggerShareToast,
  handleShare,
  easterEggPrimed,
  setEasterEggPrimed,
  isEasterEggPermanentlyUnlocked,
  markEasterEggAsUnlocked,
  setJustUnlockedSpecialTheme,
  showSharePopup,
  setShowSharePopup,
  communityLink,
  appUrl,
  shareVariant,
}: {
  theme: Theme;
  isMobile: boolean;
  footerLinks: React.ReactNode;
  triggerShareToast: (showSpecificToast?: () => void, isSpecial?: boolean) => void;
  handleShare: (variant?: 'default' | 'special') => Promise<void>;
  easterEggPrimed: boolean;
  setEasterEggPrimed: React.Dispatch<React.SetStateAction<boolean>>;
  isEasterEggPermanentlyUnlocked: boolean;
  markEasterEggAsUnlocked: () => void;
  setJustUnlockedSpecialTheme: React.Dispatch<React.SetStateAction<boolean>>;
  showSharePopup: boolean;
  setShowSharePopup: React.Dispatch<React.SetStateAction<boolean>>;
  communityLink: string;
  appUrl: string;
  shareVariant: 'default' | 'special';
}) => {
  const { 
    state: valueAliasingSettings, 
    setState: setValueAliasingSettings, 
    undo: undoValueAliasing, 
    redo: redoValueAliasing, 
    reset: resetValueAliasingHistory,
    resetHistory: resetValueAliasingHistoryStack,
    canUndo: canUndoValueAliasing, 
    canRedo: canDoValueAliasing 
  } = useHistory(FULL_VALUE_ALIASING_INITIAL_STATE);
  
  const [liveValueAliasingSettings, setLiveValueAliasingSettings] = useState(valueAliasingSettings);
  const [valueAliasingType, setValueAliasingType] = useState<'phone' | 'desktop'>(isMobile ? 'phone' : 'desktop');
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [showFsToast, setShowFsToast] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const fullScreenFileInputRef = useRef<HTMLInputElement>(null);
  const [isFullScreenControlsOpen, setIsFullScreenControlsOpen] = useState(false);
  
  const [isEasterEggActive, setIsEasterEggActive] = useState(false);
  const [activePermutationIndex, setActivePermutationIndex] = useState<number | null>(null);

  const { outputType } = liveValueAliasingSettings;

  const liveActiveState = useMemo(() => {
      const { wallpaper, print } = liveValueAliasingSettings;
      return outputType === 'wallpaper' ? wallpaper[valueAliasingType] : print;
  }, [liveValueAliasingSettings, outputType, valueAliasingType]);

  const effectiveLiveState = useMemo(() => {
      if (isEasterEggActive) {
          return {
              ...liveActiveState,
              isPureValue: true,
              isTransparent: false,
          };
      }
      return liveActiveState;
  }, [isEasterEggActive, liveActiveState]);

  const { resolution, pixelGap, cropOffsetX, cropOffsetY, isMonochrome, exposure, contrast, lowerLimit } = liveActiveState;
  const { background, isPureValue, isTransparent } = effectiveLiveState;

  const resetEasterEgg = useCallback(() => {
    setIsEasterEggActive(false);
    setActivePermutationIndex(null);
  }, []);

  const onFileSelectCallback = useCallback(() => {
    resetEasterEgg();
  }, [resetEasterEgg]);
  
  const {
    imageSrc,
    image,
    isLoading,
    isDownloading,
    handleFileSelect,
    handleDownload: baseHandleDownload,
    clearImage
  } = useImageHandler({
    featureName: 'value_aliasing',
    onFileSelectCallback: onFileSelectCallback,
    triggerShareToast: triggerShareToast
  });

  useEffect(() => {
    if (image) {
        const newOrientation = image.width >= image.height ? 'landscape' : 'portrait';
        const newInitialState = JSON.parse(JSON.stringify(FULL_VALUE_ALIASING_INITIAL_STATE));
        newInitialState.print.size = 'original';
        newInitialState.print.orientation = newOrientation;
        resetValueAliasingHistoryStack(newInitialState);
    } else {
        resetValueAliasingHistoryStack(FULL_VALUE_ALIASING_INITIAL_STATE);
    }
  }, [image, resetValueAliasingHistoryStack]);

  useEffect(() => { setLiveValueAliasingSettings(valueAliasingSettings); }, [valueAliasingSettings]);
  
  const handleThemeChange = useCallback((themeSelection: 'dark' | 'light' | 'community') => {
      if (themeSelection === 'community') {
          if (!isEasterEggActive) {
              trackEvent('easter_egg_activated', { feature: 'value_aliasing' });
              setIsEasterEggActive(true);
              if (!isEasterEggPermanentlyUnlocked) {
                  markEasterEggAsUnlocked();
                  setJustUnlockedSpecialTheme(true);
              }
          }
      } else {
          trackEvent('value_aliasing_style_select', { style: themeSelection, from_community_theme: isEasterEggActive });
          
          setIsEasterEggActive(false);
          setValueAliasingSettings(s => {
              const newBackground: WallpaperBgKey = themeSelection === 'dark' ? 'black' : 'white';
              const newSettings: Partial<ValueAliasingState> = { background: newBackground };

              if (s.outputType === 'wallpaper') {
                  const updatedState = { ...s.wallpaper[valueAliasingType], ...newSettings };
                  return { ...s, wallpaper: { ...s.wallpaper, [valueAliasingType]: updatedState }};
              }
              const updatedState = { ...s.print, ...newSettings };
              return { ...s, print: updatedState as PrintState };
          });
      }
  }, [isEasterEggActive, isEasterEggPermanentlyUnlocked, markEasterEggAsUnlocked, setValueAliasingSettings, valueAliasingType, outputType, setJustUnlockedSpecialTheme]);
  
  const activateEasterEgg = useCallback(() => {
      handleThemeChange('community');
  }, [handleThemeChange]);

  const getRandomPermutationIndex = (excludeIndex: number | null = null): number => {
    const totalPermutations = EASTER_EGG_PERMUTATIONS.length;
    if (excludeIndex === null) {
        return Math.floor(Math.random() * totalPermutations);
    }

    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * totalPermutations);
    } while (newIndex === excludeIndex);
    
    return newIndex;
  };

  useEffect(() => {
    if (isEasterEggActive && activePermutationIndex === null) {
        setActivePermutationIndex(getRandomPermutationIndex());
    }
  }, [isEasterEggActive, activePermutationIndex]);

  const handleRefreshGrid = () => {
      trackEvent('value_aliasing_easter_egg_refresh');
      setActivePermutationIndex(currentIndex => getRandomPermutationIndex(currentIndex));
  };


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
      trackEvent('value_aliasing_fullscreen_enter');
      
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
      trackEvent('value_aliasing_fullscreen_exit');
      if (document.fullscreenElement) {
          document.exitFullscreen();
      } else {
          setIsFullScreenPreview(false);
      }
  }, []);

  const handleResetCurrentValueAliasing = useCallback(() => {
    trackEvent('value_aliasing_reset_defaults', { value_aliasing_type: outputType === 'wallpaper' ? valueAliasingType : 'print' });
    setValueAliasingSettings(s => {
        const resetStateForMode = (state: ValueAliasingState | PrintState, initial: ValueAliasingState | PrintState) => {
            const { cropOffsetX, cropOffsetY } = state;
            const printSpecifics = 'size' in state ? { size: state.size, orientation: state.orientation } : {};
            const baseReset = { ...initial, cropOffsetX, cropOffsetY, ...printSpecifics };
            return baseReset;
        };

        if (s.outputType === 'wallpaper') {
            return { ...s, wallpaper: {
                ...s.wallpaper,
                [valueAliasingType]: resetStateForMode(s.wallpaper[valueAliasingType], FULL_VALUE_ALIASING_INITIAL_STATE.wallpaper[valueAliasingType]) as ValueAliasingState
            }};
        } else {
            return { ...s, print: resetStateForMode(s.print, FULL_VALUE_ALIASING_INITIAL_STATE.print) as PrintState };
        }
    });
}, [valueAliasingType, setValueAliasingSettings, outputType]);

  const [fullCanvasWidth, fullCanvasHeight] = useMemo(() => {
      if (outputType === 'print') {
          const printState = liveActiveState as PrintState;
          const sizeInfo = PRINT_SIZES[printState.size];
          if (!sizeInfo) return [VALUE_ALIASING_DESKTOP_WIDTH, VALUE_ALIASING_DESKTOP_HEIGHT];

          let w, h;

          if (printState.size === 'original') {
              if (!image) return [3600, 3600];
              const baseSize = 12 * PRINT_DPI;
              const imgAspect = image.width / image.height;
              if (imgAspect >= 1) { // landscape or square
                  w = baseSize;
                  h = Math.round(baseSize / imgAspect);
              } else { // portrait
                  h = baseSize;
                  w = Math.round(baseSize * imgAspect);
              }
          } else {
              w = sizeInfo.w * PRINT_DPI;
              h = sizeInfo.h * PRINT_DPI;
          }

          return printState.orientation === 'landscape' ? [Math.max(w, h), Math.min(w, h)] : [Math.min(w, h), Math.max(w, h)];
      }
      return valueAliasingType === 'desktop' ? [VALUE_ALIASING_DESKTOP_WIDTH, VALUE_ALIASING_DESKTOP_HEIGHT] : [VALUE_ALIASING_PHONE_WIDTH, VALUE_ALIASING_PHONE_HEIGHT];
  }, [outputType, valueAliasingType, liveActiveState, image]);
  
  const [previewCanvasWidth, previewCanvasHeight] = useMemo(() => {
    if (outputType === 'wallpaper') {
        return [fullCanvasWidth, fullCanvasHeight];
    }
    // For 'print', calculate a scaled-down version for preview
    const aspectRatio = fullCanvasWidth / fullCanvasHeight;
    const MAX_PREVIEW_DIMENSION = 1500; // Cap longest side for performance

    if (fullCanvasWidth >= fullCanvasHeight) {
        return [MAX_PREVIEW_DIMENSION, Math.round(MAX_PREVIEW_DIMENSION / aspectRatio)];
    } else {
        return [Math.round(MAX_PREVIEW_DIMENSION * aspectRatio), MAX_PREVIEW_DIMENSION];
    }
  }, [outputType, fullCanvasWidth, fullCanvasHeight]);


  const valueAliasingCropIsNeeded = useMemo(() => image ? Math.abs((image.width / image.height) - (fullCanvasWidth / fullCanvasHeight)) > 0.01 : false, [image, fullCanvasWidth, fullCanvasHeight]);

  useEffect(() => {
    if (!image) return;
    const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
    if (!ctx) return;
    
    const drawOptions = {
        canvasWidth: previewCanvasWidth,
        canvasHeight: previewCanvasHeight,
        image,
        settings: {
            outputType,
            valueAliasingType,
            isEasterEggActive,
            activePermutationIndex,
            resolution,
            pixelGap,
            background,
            cropOffsetX,
            cropOffsetY,
            isMonochrome,
            exposure,
            contrast,
            isPureValue,
            isTransparent,
            lowerLimit,
        }
    };
    drawValueAliasingMatrix(ctx, drawOptions);

  }, [image, isFullScreenPreview, previewCanvasWidth, previewCanvasHeight, outputType, valueAliasingType, isEasterEggActive, activePermutationIndex, resolution, pixelGap, background, cropOffsetX, cropOffsetY, isMonochrome, exposure, contrast, isPureValue, isTransparent, lowerLimit]);
  
  const getCanvasBlob = useCallback(async (options: { highQuality?: boolean } = {}): Promise<Blob | null> => {
    const { highQuality = false } = options;
    const isPrintMode = liveValueAliasingSettings.outputType === 'print';

    if (!highQuality || !isPrintMode) {
        return new Promise(resolve => {
            const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
            if (canvas) {
                canvas.toBlob(blob => resolve(blob), 'image/png');
            } else {
                resolve(null);
            }
        });
    }

    return new Promise((resolve) => {
        if (!image) {
            resolve(null);
            return;
        }
        
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = fullCanvasWidth;
        offscreenCanvas.height = fullCanvasHeight;
        const ctx = offscreenCanvas.getContext('2d', { colorSpace: 'display-p3' });

        if (!ctx) {
            console.error("Could not create offscreen canvas context for high-quality export.");
            resolve(null);
            return;
        }

        const activeState = valueAliasingSettings[outputType === 'wallpaper' ? 'wallpaper' : 'print'];
        const settingsToDraw = outputType === 'wallpaper' ? activeState[valueAliasingType as 'phone' | 'desktop'] : activeState;
        
        const drawOptions = {
            canvasWidth: fullCanvasWidth,
            canvasHeight: fullCanvasHeight,
            image,
            settings: {
                ...settingsToDraw,
                outputType,
                valueAliasingType,
                isEasterEggActive,
                activePermutationIndex,
            }
        };

        drawValueAliasingMatrix(ctx, drawOptions);

        offscreenCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
  }, [isFullScreenPreview, liveValueAliasingSettings, valueAliasingSettings, outputType, valueAliasingType, image, fullCanvasWidth, fullCanvasHeight, isEasterEggActive, activePermutationIndex]);

  const handleFullScreenReplace = (file: File) => {
    trackEvent('value_aliasing_fullscreen_replace_image', { value_aliasing_type: valueAliasingType });
    handleFileSelect(file, 'click');
  };

  const handleFullScreenReplaceClick = () => {
    trackEvent('value_aliasing_fullscreen_replace_image_click', { value_aliasing_type: valueAliasingType });
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
      feature: 'value_aliasing',
      output_type: outputType,
      is_special_theme: isEasterEggActive,
      setting_resolution: liveActiveState.resolution,
      setting_pixel_gap: liveActiveState.pixelGap,
      setting_background: liveActiveState.background,
      setting_crop_offset_x: liveActiveState.cropOffsetX,
      setting_crop_offset_y: liveActiveState.cropOffsetY,
      setting_is_monochrome: liveActiveState.isMonochrome,
      setting_exposure: liveActiveState.exposure,
      setting_contrast: liveActiveState.contrast,
      setting_is_pure_value: liveActiveState.isPureValue,
      setting_is_transparent: liveActiveState.isTransparent,
      setting_lower_limit: liveActiveState.lowerLimit,
    };
    
    const onSuccess = () => {
        if (isFullScreenPreview) {
            triggerShareToast(() => setShowFsToast(true), isEasterEggActive);
        } else {
            triggerShareToast(undefined, isEasterEggActive);
        }
    };
    
    const isPrint = liveValueAliasingSettings.outputType === 'print';
    let filename: string;

    if (isPrint) {
        const { size, orientation } = liveValueAliasingSettings.print;
        filename = `matrices-valuealiasing-print-${size}-${orientation}`;
        analyticsParams.print_size = size;
        analyticsParams.print_orientation = orientation;
    } else {
        filename = `matrices-valuealiasing-${valueAliasingType}`;
        analyticsParams.wallpaper_type = valueAliasingType;
    }

    baseHandleDownload(() => getCanvasBlob({ highQuality: true }), filename, analyticsParams, onSuccess);
  };

  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0.5, initialOffsetY: 0.5, hasMoved: false });
  
  const handleValueAliasingDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (!valueAliasingCropIsNeeded) return;
      
      e.preventDefault();
      dragState.current.isDragging = true;
      dragState.current.hasMoved = false;
      
      const point = 'touches' in e ? e.touches[0] : e;
      dragState.current.startX = point.clientX;
      dragState.current.startY = point.clientY;
      dragState.current.initialOffsetX = liveActiveState.cropOffsetX;
      dragState.current.initialOffsetY = liveActiveState.cropOffsetY;
      
      document.body.style.cursor = 'grabbing';
  }, [valueAliasingCropIsNeeded, liveActiveState]);

  const handleValueAliasingDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDragging || !image) return;
      
      dragState.current.hasMoved = true;
      const point = 'touches' in e ? e.touches[0] : e;
      
      let deltaX = point.clientX - dragState.current.startX;
      let deltaY = point.clientY - dragState.current.startY;
      
      const activeCanvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
      if (activeCanvas) {
          const rect = activeCanvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
              const scaleX = previewCanvasWidth / rect.width;
              const scaleY = previewCanvasHeight / rect.height;
              deltaX *= scaleX;
              deltaY *= scaleY;
          }
      }
      
      const imgAspect = image.width / image.height;
      const canvasAspect = fullCanvasWidth / fullCanvasHeight;
      
      let panRangeX = 0, panRangeY = 0;
      if (imgAspect > canvasAspect) { panRangeX = (fullCanvasHeight * imgAspect) - fullCanvasWidth; }
      else if (imgAspect < canvasAspect) { panRangeY = (fullCanvasWidth / imgAspect) - fullCanvasHeight; }
      
      let newOffsetX = panRangeX > 0 ? dragState.current.initialOffsetX - (deltaX / panRangeX) : dragState.current.initialOffsetX;
      let newOffsetY = panRangeY > 0 ? dragState.current.initialOffsetY - (deltaY / panRangeY) : dragState.current.initialOffsetY;
      
      const newCropState = {
          cropOffsetX: Math.max(0, Math.min(1, newOffsetX)),
          cropOffsetY: Math.max(0, Math.min(1, newOffsetY)),
      };

      setLiveValueAliasingSettings(s => {
          if (s.outputType === 'wallpaper') {
              return { ...s, wallpaper: { ...s.wallpaper, [valueAliasingType]: { ...s.wallpaper[valueAliasingType], ...newCropState }}};
          }
          return { ...s, print: { ...s.print, ...newCropState }};
      });
  }, [image, fullCanvasWidth, fullCanvasHeight, previewCanvasWidth, previewCanvasHeight, valueAliasingType, isFullScreenPreview]);

  const handleValueAliasingDragEnd = useCallback(() => {
      if (dragState.current.isDragging) {
          dragState.current.isDragging = false;
          
          if (dragState.current.hasMoved) {
            trackEvent('value_aliasing_crop', { value_aliasing_type: outputType === 'wallpaper' ? valueAliasingType : 'print' });
          }

          const { cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } = liveActiveState;
          setValueAliasingSettings(s => {
            if (s.outputType === 'wallpaper') {
                return { ...s, wallpaper: { ...s.wallpaper, [valueAliasingType]: { ...s.wallpaper[valueAliasingType], cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY }}};
            }
            return { ...s, print: { ...s.print, cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY }};
          });
          
          document.body.style.cursor = 'default';
      }
  }, [liveActiveState, valueAliasingType, setValueAliasingSettings, outputType]);

  useEffect(() => {
      const onMove = (e: MouseEvent | TouchEvent) => handleValueAliasingDragMove(e);
      const onEnd = () => handleValueAliasingDragEnd();

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
  }, [handleValueAliasingDragMove, handleValueAliasingDragEnd]);

  const updateLiveSetting = (key: keyof ValueAliasingState, value: any) => {
    setLiveValueAliasingSettings(s => {
        if (s.outputType === 'wallpaper') {
            return { ...s, wallpaper: { ...s.wallpaper, [valueAliasingType]: { ...s.wallpaper[valueAliasingType], [key]: value }}};
        }
        return { ...s, print: { ...s.print, [key]: value }};
    });
  };

  const commitSetting = (key: keyof ValueAliasingState, value: any) => {
    setValueAliasingSettings(s => {
        if (s.outputType === 'wallpaper') {
            return { ...s, wallpaper: { ...s.wallpaper, [valueAliasingType]: { ...s.wallpaper[valueAliasingType], [key]: value }}};
        }
        return { ...s, print: { ...s.print, [key]: value }};
    });
    trackEvent('value_aliasing_slider_change', { slider_name: key, value: value, output_mode: outputType === 'wallpaper' ? valueAliasingType : 'print' });
  };
  
  const handleOutputTypeSelect = (type: 'wallpaper' | 'print') => {
    trackEvent('value_aliasing_output_type_select', { type });
    setValueAliasingSettings(s => ({ ...s, outputType: type }));
  };

  const valueAliasingTypeOptions = [ { key: 'phone', label: 'Phone' }, { key: 'desktop', label: 'Desktop' } ];
  const outputTypeOptions = [ { key: 'wallpaper', label: 'Wallpaper' }, { key: 'print', label: 'Print' } ];
  const orientationOptions = [ { key: 'landscape', label: 'Landscape' }, { key: 'portrait', label: 'Portrait' } ];
  
  const StyleSelector = () => {
    const baseButtonClasses = `py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none rounded-md flex items-center justify-center`;
    const selectedClasses = theme === 'dark' ? 'bg-nothing-light text-nothing-dark font-bold' : 'bg-day-text text-day-bg font-bold';
    const unselectedClasses = theme === 'dark' ? 'bg-nothing-gray-dark hover:bg-gray-700 text-nothing-light' : 'bg-day-gray-light hover:bg-gray-300 text-day-text';

    return (
        <div className={`flex space-x-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-gray-200'}`}>
            <button 
                onClick={() => handleThemeChange('dark')}
                className={`${baseButtonClasses} flex-grow ${!isEasterEggActive && liveActiveState.background === 'black' ? selectedClasses : unselectedClasses}`}
                aria-pressed={!isEasterEggActive && liveActiveState.background === 'black' ? 'true' : 'false'}
            >
                Dark
            </button>
            <button 
                onClick={() => handleThemeChange('light')}
                className={`${baseButtonClasses} flex-grow ${!isEasterEggActive && liveActiveState.background === 'white' ? selectedClasses : unselectedClasses}`}
                aria-pressed={!isEasterEggActive && liveActiveState.background === 'white' ? 'true' : 'false'}
            >
                Light
            </button>
            {isEasterEggPermanentlyUnlocked && (
                <button
                    onClick={() => handleThemeChange('community')}
                    className={`${baseButtonClasses} flex-shrink-0 w-10 ${isEasterEggActive ? selectedClasses : unselectedClasses}`}
                    aria-label="Activate Community Theme"
                    aria-pressed={isEasterEggActive ? 'true' : 'false'}
                >
                    <svg viewBox="0 0 22 22" className="h-5 w-5" aria-hidden="true">
                      <rect x="0" y="0" width="10" height="10" fill="#BD1721" />
                      <rect x="12" y="0" width="10" height="10" fill="#FCCA21" />
                      <rect x="0" y="12" width="10" height="10" fill="#0D4E81" />
                      <rect x="12" y="12" width="10" height="10" fill="#E0E0E0" />
                    </svg>
                </button>
            )}
        </div>
    );
  };

  const ShuffleButton = () => (
    <button
        onClick={handleRefreshGrid}
        className={`p-2 transition-colors duration-200 rounded-md ${theme === 'dark' ? 'bg-gray-700 text-nothing-gray-light hover:text-white' : 'bg-gray-200 text-day-gray-dark hover:text-black'}`}
        aria-label="Randomize Background Colors"
    >
        {isMobile ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                    <pattern id="shuffleIconPattern" patternUnits="userSpaceOnUse" width="24" height="24">
                        <rect x="0" y="0" width="12" height="12" fill="#BD1721" />
                        <rect x="12" y="0" width="12" height="12" fill="#FCCA21" />
                        <rect x="0" y="12" width="12" height="12" fill="#1A5A8A" />
                        <rect x="12" y="12" width="12" height="12" fill="#E0E0E0" />
                    </pattern>
                </defs>
                <polyline points="16 3 21 3 21 8" stroke="url(#shuffleIconPattern)"></polyline>
                <line x1="4" y1="20" x2="21" y2="3" stroke="url(#shuffleIconPattern)"></line>
                <polyline points="21 16 21 21 16 21" stroke="url(#shuffleIconPattern)"></polyline>
                <line x1="15" y1="15" x2="21" y2="21" stroke="url(#shuffleIconPattern)"></line>
                <line x1="4" y1="4" x2="9" y2="9" stroke="url(#shuffleIconPattern)"></line>
            </svg>
        )}
    </button>
  );

  const controlsPanel = imageSrc ? (
     <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <SegmentedControl options={outputTypeOptions} selected={outputType} onSelect={(key) => handleOutputTypeSelect(key as 'wallpaper' | 'print')} theme={theme} />
        {outputType === 'wallpaper' ? (
            <SegmentedControl options={valueAliasingTypeOptions} selected={valueAliasingType} onSelect={(key) => setValueAliasingType(key as 'phone' | 'desktop')} theme={theme} />
        ) : (
          <div className="space-y-4">
              <div>
                  <label htmlFor="print-size-select" className={`block text-sm mb-2 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>Print Size</label>
                  <select
                      id="print-size-select"
                      value={(liveActiveState as PrintState).size}
                      onChange={(e) => {
                          const newSize = e.target.value;
                          setValueAliasingSettings(s => ({ ...s, print: { ...s.print, size: newSize }}));
                          trackEvent('value_aliasing_print_size_change', { size: newSize });
                      }}
                      className={`w-full p-2 rounded-md border text-sm ${theme === 'dark' ? 'bg-nothing-gray-dark border-nothing-gray-dark text-nothing-light' : 'bg-day-gray-light border-gray-300 text-day-text'}`}
                  >
                      <option value="original">{PRINT_SIZES['original'].label}</option>
                      {PRINT_SIZE_GROUPS.map(group => (
                          <optgroup label={group} key={group}>
                              {Object.entries(PRINT_SIZES).filter(([key, val]) => val.group === group && key !== 'original').map(([key, val]) => (
                                  <option key={key} value={key}>{val.label}</option>
                              ))}
                          </optgroup>
                      ))}
                  </select>
              </div>
              <SegmentedControl options={orientationOptions} selected={(liveActiveState as PrintState).orientation} onSelect={(key) => {
                  const newOrientation = key as 'landscape' | 'portrait';
                  setValueAliasingSettings(s => ({ ...s, print: { ...s.print, orientation: newOrientation }}));
                  trackEvent('value_aliasing_orientation_change', { orientation: newOrientation });
              }} theme={theme} />
          </div>
        )}
        <StyleSelector />
      </div>

      <div className="flex justify-center items-center space-x-4">
        <UndoRedoControls onUndo={() => { undoValueAliasing(); trackEvent('value_aliasing_undo'); }} onRedo={() => { redoValueAliasing(); trackEvent('value_aliasing_redo'); }} canUndo={canUndoValueAliasing} canRedo={canDoValueAliasing} theme={theme} />
        {isEasterEggActive && <ShuffleButton />}
      </div>
      
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Exposure" value={exposure} onChange={v => updateLiveSetting('exposure', v)} onChangeCommitted={v => commitSetting('exposure', v)} onReset={() => commitSetting('exposure', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Contrast" value={contrast} onChange={v => updateLiveSetting('contrast', v)} onChangeCommitted={v => commitSetting('contrast', v)} onReset={() => commitSetting('contrast', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Resolution" value={resolution} onChange={v => updateLiveSetting('resolution', v)} onChangeCommitted={v => commitSetting('resolution', v)} onReset={() => commitSetting('resolution', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Pixel Gap" value={pixelGap} onChange={v => updateLiveSetting('pixelGap', v)} onChangeCommitted={v => commitSetting('pixelGap', v)} onReset={() => commitSetting('pixelGap', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Lower Limit" value={lowerLimit} onChange={v => updateLiveSetting('lowerLimit', v)} onChangeCommitted={v => commitSetting('lowerLimit', v)} onReset={() => commitSetting('lowerLimit', 0)} disabled={isLoading} />
      </div>

      {!isEasterEggActive && (
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
            <label htmlFor="pure-values-toggle" className="text-sm">Pure Values</label>
            <button id="pure-values-toggle" role="switch" aria-checked={isPureValue} onClick={() => commitSetting('isPureValue', !isPureValue)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isPureValue ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isPureValue ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
            <label htmlFor="transparent-output-toggle" className="text-sm">Transparent Output</label>
            <button id="transparent-output-toggle" role="switch" aria-checked={isTransparent} onClick={() => commitSetting('isTransparent', !isTransparent)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isTransparent ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isTransparent ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
      </div>
      )}
      
      <div className="pt-2 flex space-x-2">
        <button onClick={clearImage} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Clear the current image">Clear Image</button>
        <button onClick={handleResetCurrentValueAliasing} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset value aliasing controls to their default values">Reset Controls</button>
      </div>
      <div className="block md:hidden pt-8"><footer className="text-center tracking-wide">{footerLinks}</footer></div>
    </div>
  ) : null;
  
  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} context="valueAliasing" isMobile={isMobile}/>
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
                width={previewCanvasWidth} 
                height={previewCanvasHeight} 
                className={`border-2 rounded-lg ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} ${outputType === 'wallpaper' && valueAliasingType === 'phone' ? (isMobile ? 'w-4/5 h-auto' : 'max-h-full w-auto') : 'max-w-full max-h-full'}`} 
                aria-label="Value Aliasing Canvas" 
                onMouseDown={handleValueAliasingDragStart}
                onTouchStart={handleValueAliasingDragStart}
                style={{
                    cursor: valueAliasingCropIsNeeded ? 'grab' : 'default',
                    touchAction: valueAliasingCropIsNeeded ? 'none' : 'auto',
                    backgroundColor: (isTransparent && !isEasterEggActive && theme === 'dark') ? '#14151f' : (isTransparent && !isEasterEggActive && theme === 'light') ? '#efefef' : 'transparent',
                }}
            />
            <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-2">
                <button
                    onClick={() => handleShare(isEasterEggActive ? 'special' : 'default')}
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
                    width={previewCanvasWidth}
                    height={previewCanvasHeight}
                    className="max-w-full max-h-full"
                    aria-label="Full-screen Value Aliasing Canvas Preview"
                    onMouseDown={handleValueAliasingDragStart}
                    onTouchStart={handleValueAliasingDragStart}
                    style={{
                        cursor: valueAliasingCropIsNeeded ? 'grab' : 'default',
                        touchAction: valueAliasingCropIsNeeded ? 'none' : 'auto'
                    }}
                />
                {valueAliasingCropIsNeeded && (
                    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-2 py-1 rounded-md text-sm ${theme === 'dark' ? 'bg-nothing-dark/90 text-nothing-light' : 'bg-day-gray-light/90 text-day-text'} backdrop-blur-sm pointer-events-none`}>
                        ⓘ Drag to Crop
                    </div>
                )}
                
                {easterEggPrimed && (
                    <button
                        onClick={() => {
                            activateEasterEgg();
                            setEasterEggPrimed(false);
                        }}
                        className={`fixed top-4 right-4 z-[52] flex items-center p-2 px-3 transition-colors duration-300 rounded-md text-sm font-semibold easter-egg-glow`}
                        aria-label="Click to Unlock"
                    >
                        Click to Unlock
                    </button>
                )}

                {!isMobile && (
                  <div className="fixed bottom-4 left-4 z-[51] w-80 flex flex-col items-start space-y-2">
                    <div className="w-full">
                      {isFullScreenControlsOpen ? (
                        <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-4 max-h-[calc(100vh-10rem)] flex flex-col space-y-4 shadow-2xl`}>
                          <div className="flex justify-between items-center flex-shrink-0">
                            <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-day-text'}`}>Controls</h3>
                            <button onClick={() => { setIsFullScreenControlsOpen(false); trackEvent('value_aliasing_fullscreen_controls_toggle', { open: false }); }} className={`p-2 ${theme === 'dark' ? 'text-white hover:bg-white/20' : 'text-day-text hover:bg-black/10'} rounded-full transition-colors`} aria-label="Collapse controls">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                            </button>
                          </div>

                          <div className="overflow-y-auto space-y-4 pr-2 -mr-2">
                             
                            <div className={`p-3 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                                <SegmentedControl options={outputTypeOptions} selected={outputType} onSelect={(key) => handleOutputTypeSelect(key as 'wallpaper' | 'print')} theme={theme} />
                                {outputType === 'wallpaper' ? (
                                    <SegmentedControl options={valueAliasingTypeOptions} selected={valueAliasingType} onSelect={(key) => setValueAliasingType(key as 'phone' | 'desktop')} theme={theme} />
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="print-size-select-fs" className={`block text-sm mb-2 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>Print Size</label>
                                            <select
                                                id="print-size-select-fs"
                                                value={(liveActiveState as PrintState).size}
                                                onChange={(e) => {
                                                    const newSize = e.target.value;
                                                    setValueAliasingSettings(s => ({ ...s, print: { ...s.print, size: newSize }}));
                                                    trackEvent('value_aliasing_print_size_change', { size: newSize });
                                                }}
                                                className={`w-full p-2 rounded-md border text-sm ${theme === 'dark' ? 'bg-nothing-gray-dark border-nothing-gray-dark text-nothing-light' : 'bg-day-gray-light border-gray-300 text-day-text'}`}
                                            >
                                                <option value="original">{PRINT_SIZES['original'].label}</option>
                                                {PRINT_SIZE_GROUPS.map(group => (
                                                    <optgroup label={group} key={group}>
                                                        {Object.entries(PRINT_SIZES).filter(([key, val]) => val.group === group && key !== 'original').map(([key, val]) => (
                                                            <option key={key} value={key}>{val.label}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                        <SegmentedControl options={orientationOptions} selected={(liveActiveState as PrintState).orientation} onSelect={(key) => {
                                            const newOrientation = key as 'landscape' | 'portrait';
                                            setValueAliasingSettings(s => ({ ...s, print: { ...s.print, orientation: newOrientation }}));
                                            trackEvent('value_aliasing_orientation_change', { orientation: newOrientation });
                                        }} theme={theme} />
                                    </div>
                                )}
                                <StyleSelector />
                            </div>
                            <div className="flex justify-center items-center space-x-4">
                                <UndoRedoControls onUndo={() => { undoValueAliasing(); trackEvent('value_aliasing_undo'); }} onRedo={() => { redoValueAliasing(); trackEvent('value_aliasing_redo'); }} canUndo={canUndoValueAliasing} canRedo={canDoValueAliasing} theme={theme} />
                                {isEasterEggActive && <ShuffleButton />}
                            </div>
                            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-4`}>
                                <EnhancedSlider theme={theme} isMobile={isMobile} label="Exposure" value={exposure} onChange={v => updateLiveSetting('exposure', v)} onChangeCommitted={v => commitSetting('exposure', v)} onReset={() => commitSetting('exposure', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
                                <EnhancedSlider theme={theme} isMobile={isMobile} label="Contrast" value={contrast} onChange={v => updateLiveSetting('contrast', v)} onChangeCommitted={v => commitSetting('contrast', v)} onReset={() => commitSetting('contrast', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
                                <EnhancedSlider theme={theme} isMobile={isMobile} label="Resolution" value={resolution} onChange={v => updateLiveSetting('resolution', v)} onChangeCommitted={v => commitSetting('resolution', v)} onReset={() => commitSetting('resolution', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
                                <EnhancedSlider theme={theme} isMobile={isMobile} label="Pixel Gap" value={pixelGap} onChange={v => updateLiveSetting('pixelGap', v)} onChangeCommitted={v => commitSetting('pixelGap', v)} onReset={() => commitSetting('pixelGap', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
                                <EnhancedSlider theme={theme} isMobile={isMobile} label="Lower Limit" value={lowerLimit} onChange={v => updateLiveSetting('lowerLimit', v)} onChangeCommitted={v => commitSetting('lowerLimit', v)} onReset={() => commitSetting('lowerLimit', 0)} disabled={isLoading} />
                            </div>
                            {!isEasterEggActive && (
                            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-4`}>
                                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                    <label htmlFor="pure-values-toggle-fs" className="text-sm">Pure Values</label>
                                    <button id="pure-values-toggle-fs" role="switch" aria-checked={isPureValue} onClick={() => commitSetting('isPureValue', !isPureValue)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isPureValue ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isPureValue ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                    <label htmlFor="transparent-output-toggle-fs" className="text-sm">Transparent Output</label>
                                    <button id="transparent-output-toggle-fs" role="switch" aria-checked={isTransparent} onClick={() => commitSetting('isTransparent', !isTransparent)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isTransparent ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isTransparent ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                            )}
                            <div>
                              <button onClick={handleResetCurrentValueAliasing} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset value aliasing controls to their default values"> Reset Controls </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setIsFullScreenControlsOpen(true); trackEvent('value_aliasing_fullscreen_controls_toggle', { open: true }); }} className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80 text-white hover:bg-nothing-dark' : 'bg-day-bg/90 text-day-text hover:bg-day-gray-light border border-gray-300/50'} backdrop-blur-sm font-semibold py-3 px-4 rounded-lg flex items-center justify-between shadow-lg transition-colors`} aria-label="Expand controls">
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
                            aria-label="Download the current image"
                        >
                            {isDownloading ? 'Generating...' : 'Download'}
                        </button>
                    </div>
                  </div>
                )}

                <div className="fixed bottom-8 right-8 z-50 flex items-center space-x-2">
                     <button
                        onClick={() => handleShare(isEasterEggActive ? 'special' : 'default')}
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

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current image"> {isDownloading ? 'Generating...' : 'Download'} </button>;

  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme} isMobile={isMobile}/>;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton, valueAliasingType: valueAliasingType, activateEasterEgg, isEasterEggActive, getCanvasBlob, undo: undoValueAliasing, redo: redoValueAliasing, canUndo: canUndoValueAliasing, canRedo: canDoValueAliasing };
};
