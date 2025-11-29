
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useHistory, useImageHandler } from './hooks';
import { getTimestamp } from './utils';
import { PhotoWidgetSettingsContainer, PhotoWidgetColorMatrix, Theme, PhotoWidgetOutputMode } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, SegmentedControl, ToggleSwitch } from './components';
import { trackEvent } from './analytics';

const PHOTO_WIDGET_BASE_SIZE = 1176;
const PADDING = 50;
const DEFAULT_SLIDER_VALUE = 50;

const PHOTO_WIDGET_MODES_INITIAL_STATE: PhotoWidgetSettingsContainer = {
  transparent: {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: 0,
    isCircular: false,
    isAntiAliased: false,
  },
  dark: {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: 0,
    isCircular: true,
    isAntiAliased: false,
  },
  light: {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: 0,
    isCircular: true,
    isAntiAliased: false,
  },
};

const drawPhotoWidgetMatrix = (ctx: CanvasRenderingContext2D, options: {
  width: number;
  height: number;
  outputMode: PhotoWidgetOutputMode;
  matrix: PhotoWidgetColorMatrix;
  pixelGap: number;
  isCircular: boolean;
  isAntiAliased: boolean;
}) => {
  const { width, height, outputMode, matrix, pixelGap, isCircular, isAntiAliased } = options;

  switch (outputMode) {
    case 'transparent':
      ctx.clearRect(0, 0, width, height);
      break;
    case 'dark':
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(0, 0, width, height);
      break;
    case 'light':
      ctx.fillStyle = '#f1f0f1';
      ctx.fillRect(0, 0, width, height);
      break;
  }

  if (!matrix || matrix.length === 0 || matrix[0].length === 0) return;
  const gridHeight = matrix.length, gridWidth = matrix[0].length;
  const drawableWidth = width - PADDING * 2, drawableHeight = height - PADDING * 2;
  const matrixAspect = gridWidth / gridHeight;

  let renderAreaWidth, renderAreaHeight;
  if ((drawableWidth / matrixAspect) <= drawableHeight) {
    renderAreaWidth = drawableWidth;
    renderAreaHeight = drawableWidth / matrixAspect;
  } else {
    renderAreaHeight = drawableHeight;
    renderAreaWidth = drawableHeight * matrixAspect;
  }

  const offsetX = PADDING + (drawableWidth - renderAreaWidth) / 2;
  const offsetY = PADDING + (drawableHeight - renderAreaHeight) / 2;

  const cellWidth = renderAreaWidth / gridWidth, cellHeight = renderAreaHeight / gridHeight;
  const scaledPixelGap = pixelGap * 0.84;
  const gapRatio = (((0.28 * (scaledPixelGap * 5)) / 100) * 0.2765);
  const pixelWidth = cellWidth * (1 - gapRatio), pixelHeight = cellHeight * (1 - gapRatio);

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const pixel = matrix[y][x];
      if (pixel) {
        const coverage = pixel.a / 255;
        let finalPixelWidth = pixelWidth, finalPixelHeight = pixelHeight;
        if (isAntiAliased) {
          const sizeMultiplier = Math.sqrt(coverage);
          finalPixelWidth *= sizeMultiplier;
          finalPixelHeight *= sizeMultiplier;
        }
        ctx.fillStyle = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
        const cellX = offsetX + x * cellWidth, cellY = offsetY + y * cellHeight;
        if (isCircular) {
          const radius = Math.min(finalPixelWidth, finalPixelHeight) / 2;
          if (radius > 0.1) {
            ctx.beginPath();
            ctx.arc(cellX + cellWidth / 2, cellY + cellHeight / 2, radius, 0, 2 * Math.PI);
            ctx.fill();
          }
        } else {
          if (finalPixelWidth > 0.1 && finalPixelHeight > 0.1) {
            const rectX = cellX + (cellWidth - finalPixelWidth) / 2, rectY = cellY + (cellHeight - finalPixelHeight) / 2;
            ctx.fillRect(rectX, rectY, finalPixelWidth, finalPixelHeight);
          }
        }
      }
    }
  }
};

export const usePhotoWidgetPanel = ({ theme, isMobile, footerLinks, triggerShareToast, handleShare }: { theme: Theme, isMobile: boolean, footerLinks: React.ReactNode, triggerShareToast: (showSpecificToast?: () => void) => void, handleShare: (variant?: 'default' | 'special') => Promise<void> }) => {
  const { state: photoWidgetSettings, setState: setPhotoWidgetSettings, undo: undoPhotoWidget, redo: redoPhotoWidget, reset: resetPhotoWidget, canUndo: canUndoPhotoWidget, canRedo: canRedoPhotoWidget } = useHistory(PHOTO_WIDGET_MODES_INITIAL_STATE);
  const [livePhotoWidgetSettings, setLivePhotoWidgetSettings] = useState(photoWidgetSettings);
  const [outputMode, setOutputMode] = useState<PhotoWidgetOutputMode>('transparent');
  const [activeFillTheme, setActiveFillTheme] = useState<'dark' | 'light'>('dark');
  const [colorMatrix, setColorMatrix] = useState<PhotoWidgetColorMatrix | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const livePhotoWidgetState = livePhotoWidgetSettings[outputMode];
  const { resolution, pixelGap, isCircular, isAntiAliased } = livePhotoWidgetState;

  const onFileSelectCallback = useCallback(() => {
    resetPhotoWidget();
    setOutputMode('transparent');
    setActiveFillTheme('dark');
  }, [resetPhotoWidget]);

  const {
    imageSrc,
    image,
    isLoading,
    isDownloading,
    handleFileSelect,
    handleDownload: baseHandleDownload,
    clearImage: baseClearImage
  } = useImageHandler({
    featureName: 'photo_widget',
    onFileSelectCallback,
    triggerShareToast,
  });

  const canvasWidth = useMemo(() => PHOTO_WIDGET_BASE_SIZE, []);
  const canvasHeight = useMemo(() => PHOTO_WIDGET_BASE_SIZE, []);

  useEffect(() => { setLivePhotoWidgetSettings(photoWidgetSettings); }, [photoWidgetSettings]);

  useEffect(() => {
    if (!image) { setColorMatrix(null); return; }
    const resValue = 20 + Math.floor(((resolution * 0.6592) / 100) * 130);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;
    const gridWidth = resValue, gridHeight = Math.round(gridWidth * (image.height / image.width));
    tempCanvas.width = gridWidth; tempCanvas.height = gridHeight;
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(image, 0, 0, gridWidth, gridHeight);
    const imageData = tempCtx.getImageData(0, 0, gridWidth, gridHeight).data;

    const fullMatrix: PhotoWidgetColorMatrix = Array.from({ length: gridHeight }, (_, y) =>
      Array.from({ length: gridWidth }, (_, x) => {
        const i = (y * gridWidth + x) * 4;
        if (imageData[i + 3] <= 10) { return null; }

        const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2];

        return {
          r: Math.round(Math.max(0, Math.min(255, r))),
          g: Math.round(Math.max(0, Math.min(255, g))),
          b: Math.round(Math.max(0, Math.min(255, b))),
          a: imageData[i + 3]
        };
      })
    );

    let minX = gridWidth, minY = gridHeight, maxX = -1, maxY = -1;
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (fullMatrix[y][x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX !== -1) {
      const contentWidth = maxX - minX + 1;
      const contentHeight = maxY - minY + 1;
      const croppedMatrix = Array.from({ length: contentHeight }, (_, y) =>
        Array.from({ length: contentWidth }, (_, x) => {
          return fullMatrix[y + minY][x + minX];
        })
      );
      setColorMatrix(croppedMatrix);
    } else {
      setColorMatrix(null);
    }
  }, [image, resolution]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !colorMatrix) return;
    const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
    if (!ctx) return;
    drawPhotoWidgetMatrix(ctx, { width: canvasWidth, height: canvasHeight, outputMode, matrix: colorMatrix, pixelGap, isCircular, isAntiAliased });
  }, [colorMatrix, pixelGap, isCircular, isAntiAliased, outputMode, canvasWidth, canvasHeight]);

  const getCanvasBlob = useCallback((): Promise<Blob | null> => {
    if (!colorMatrix) return Promise.resolve(null);
    return new Promise(resolve => {
      try {
        const downloadWidth = PHOTO_WIDGET_BASE_SIZE;
        const downloadHeight = PHOTO_WIDGET_BASE_SIZE;
        const canvas = document.createElement('canvas');
        canvas.width = downloadWidth;
        canvas.height = downloadHeight;
        const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
        if (!ctx) throw new Error('Failed to get canvas context for download.');

        drawPhotoWidgetMatrix(ctx, { ...photoWidgetSettings[outputMode], outputMode, width: downloadWidth, height: downloadHeight, matrix: colorMatrix });
        canvas.toBlob(blob => resolve(blob), 'image/png');
      } catch (e) {
        console.error("Error creating Photo Widget blob:", e);
        resolve(null);
      }
    });
  }, [colorMatrix, outputMode, photoWidgetSettings]);


  const handleDownload = () => {
    const analyticsParams: Record<string, string | number | boolean | undefined> = {
      feature: 'photo_widget',
      setting_output_mode: outputMode,
      setting_resolution: livePhotoWidgetState.resolution,
      setting_pixel_gap: livePhotoWidgetState.pixelGap,
      setting_is_circular: livePhotoWidgetState.isCircular,
      setting_is_anti_aliased: livePhotoWidgetState.isAntiAliased,
    };

    baseHandleDownload(getCanvasBlob, 'matrices-photowidget', analyticsParams);
  };

  const handleReset = useCallback(() => {
    trackEvent('photo_widget_reset_defaults', { output_mode: outputMode });
    setPhotoWidgetSettings(currentSettings => ({
      ...currentSettings,
      [outputMode]: PHOTO_WIDGET_MODES_INITIAL_STATE[outputMode],
    }));
  }, [outputMode, setPhotoWidgetSettings]);

  const handleOutputModeSelect = (mode: string) => {
    const newMode = mode === 'transparent' ? 'transparent' : activeFillTheme;
    trackEvent('photo_widget_output_mode_change', { mode: newMode });
    setOutputMode(newMode);
  };

  const handleFillThemeChange = (theme: 'dark' | 'light') => {
    trackEvent('photo_widget_fill_theme_change', { theme });
    setOutputMode(theme);
    setActiveFillTheme(theme);
  };

  const outputModeOptions = [
    { key: 'transparent', label: 'Transparent' },
    { key: 'fill', label: 'Fill' },
  ];

  const fillThemeOptions = [
    { key: 'light', label: 'Light Fill' },
    { key: 'dark', label: 'Dark Fill' },
  ];

  const controlsPanel = imageSrc ? (
    <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
      <div className={`p-4 rounded-lg space-y-2 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <SegmentedControl
          options={outputModeOptions}
          selected={outputMode === 'transparent' ? 'transparent' : 'fill'}
          onSelect={handleOutputModeSelect}
          theme={theme}
        />
        {outputMode !== 'transparent' && (
          <SegmentedControl
            options={fillThemeOptions}
            selected={activeFillTheme}
            onSelect={(key) => handleFillThemeChange(key as 'dark' | 'light')}
            theme={theme}
          />
        )}
      </div>

      <div className="flex justify-center items-center">
        <UndoRedoControls onUndo={() => { undoPhotoWidget(); trackEvent('photo_widget_undo'); }} onRedo={() => { redoPhotoWidget(); trackEvent('photo_widget_redo'); }} canUndo={canUndoPhotoWidget} canRedo={canRedoPhotoWidget} theme={theme} />
      </div>

      <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <EnhancedSlider
          theme={theme}
          isMobile={isMobile}
          label="Resolution"
          value={resolution}
          onChange={v => setLivePhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], resolution: v } }))}
          onChangeCommitted={v => { setPhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], resolution: v } })); trackEvent('photo_widget_slider_change', { slider_name: 'resolution', value: v, output_mode: outputMode }); }}
          onReset={() => setPhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], resolution: DEFAULT_SLIDER_VALUE } }))}
          disabled={isLoading}
        />
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${outputMode !== 'transparent' ? 'max-h-48 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
          <EnhancedSlider
            theme={theme}
            isMobile={isMobile}
            label="Pixel Gap"
            value={pixelGap}
            onChange={v => setLivePhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], pixelGap: v } }))}
            onChangeCommitted={v => { setPhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], pixelGap: v } })); trackEvent('photo_widget_slider_change', { slider_name: 'pixel_gap', value: v, output_mode: outputMode }); }}
            onReset={() => setPhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], pixelGap: 0 } }))}
            disabled={isLoading} />
        </div>
      </div>

      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
          <label htmlFor="pw-circular-toggle" className="text-sm">
            Circular Pixels
          </label>
          <button id="pw-circular-toggle" role="switch" aria-checked={isCircular} onClick={() => {
            const newIsCircular = !livePhotoWidgetState.isCircular;
            setPhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], isCircular: newIsCircular } }));
            trackEvent('photo_widget_toggle_change', { setting: 'circular_pixels', enabled: newIsCircular, output_mode: outputMode });
          }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isCircular ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isCircular ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
          <label htmlFor="pw-aa-toggle" className="text-sm">Anti-aliasing</label>
          <button id="pw-aa-toggle" role="switch" aria-checked={isAntiAliased} onClick={() => {
            const newIsAntiAliased = !livePhotoWidgetState.isAntiAliased;
            setPhotoWidgetSettings(s => ({ ...s, [outputMode]: { ...s[outputMode], isAntiAliased: newIsAntiAliased } }));
            trackEvent('photo_widget_toggle_change', { setting: 'anti_aliasing', enabled: newIsAntiAliased, output_mode: outputMode });
          }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isAntiAliased ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isAntiAliased ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="pt-2 flex space-x-2">
        <button onClick={baseClearImage} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Clear the current image">Clear Image</button>
        <button onClick={handleReset} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset photo widget controls to their default values">Reset Controls</button>
      </div>
      <div className="block md:hidden pt-8">
        <footer className="text-center tracking-wide">{footerLinks}</footer>
      </div>
    </div>
  ) : null;

  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} accept="image/png, image/jpeg" context="photoWidget" isMobile={isMobile} />
  ) : (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="max-w-full max-h-full h-auto w-auto rounded-lg"
          aria-label="Photo Widget Matrix Canvas"
          style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        />
      </div>
      <button
        onClick={() => handleShare()}
        className={`absolute bottom-3 right-3 z-10 p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
        aria-label="Share this creation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z" />
        </svg>
      </button>
    </div>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading || !colorMatrix} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current widget"> Download </button>;

  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme} accept="image/png, image/jpeg" isMobile={isMobile} />;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton, getCanvasBlob, undo: undoPhotoWidget, redo: redoPhotoWidget, canUndo: canUndoPhotoWidget, canRedo: canRedoPhotoWidget };
};
