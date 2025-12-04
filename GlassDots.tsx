
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useHistory, useImageHandler } from './hooks';
import { getTimestamp } from './utils';
import { GlassDotsState, Theme, GlassDotsSettingsContainer } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, SegmentedControl, ToastNotification, SharePopup } from './components';
import { trackEvent } from './analytics';

const DEFAULT_SLIDER_VALUE = 50;
const GLASSDOTS_PHONE_WIDTH = 1260;
const GLASSDOTS_PHONE_HEIGHT = 2800;
const GLASSDOTS_DESKTOP_WIDTH = 3840;
const GLASSDOTS_DESKTOP_HEIGHT = 2160;

const GLASSDOTS_INITIAL_STATE: GlassDotsState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    blurAmount: 50,
    isMonochrome: false,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
    isGrainEnabled: true,
    grainAmount: DEFAULT_SLIDER_VALUE,
    grainSize: 0,
    ior: 50,
    similaritySensitivity: 50,
    isBackgroundBlurEnabled: false,
    lowerLimit: 0,
    isMarkerEnabled: false,
};

const FULL_GLASSDOTS_INITIAL_STATE: GlassDotsSettingsContainer = {
    phone: { ...GLASSDOTS_INITIAL_STATE },
    desktop: { ...GLASSDOTS_INITIAL_STATE },
};

type PresetDefinition = {
    id: number;
    code: string;
    label: string;
    desktop: Partial<GlassDotsState>;
    phone: Partial<GlassDotsState>;
};

const PRESETS_DATA: PresetDefinition[] = [
    {
        id: 1, code: 'BDS', label: 'Beads',
        desktop: { resolution: 24, pixelGap: 32, lowerLimit: 0, similaritySensitivity: 90, blurAmount: 20, ior: 64, grainSize: 0, grainAmount: 64, isMarkerEnabled: true, isBackgroundBlurEnabled: true, isMonochrome: false },
        phone: { resolution: 8, pixelGap: 36, lowerLimit: 0, similaritySensitivity: 90, blurAmount: 24, ior: 64, grainSize: 0, grainAmount: 40, isMarkerEnabled: true, isBackgroundBlurEnabled: true, isMonochrome: false }
    },
    {
        id: 2, code: 'UNI', label: 'Uniform',
        desktop: { resolution: 96, pixelGap: 50, lowerLimit: 0, similaritySensitivity: 0, blurAmount: 24, ior: 12, grainSize: 0, grainAmount: 42, isMarkerEnabled: false, isBackgroundBlurEnabled: false, isMonochrome: false },
        phone: { resolution: 36, pixelGap: 36, lowerLimit: 0, similaritySensitivity: 0, blurAmount: 20, ior: 12, grainSize: 0, grainAmount: 28, isMarkerEnabled: false, isBackgroundBlurEnabled: false, isMonochrome: false }
    },
    {
        id: 3, code: 'PAL', label: 'Palette',
        desktop: { resolution: 52, pixelGap: 32, lowerLimit: 0, similaritySensitivity: 100, blurAmount: 84, ior: 100, grainSize: 8, grainAmount: 60, isMarkerEnabled: true, isBackgroundBlurEnabled: true, isMonochrome: false },
        phone: { resolution: 6, pixelGap: 32, lowerLimit: 0, similaritySensitivity: 100, blurAmount: 84, ior: 100, grainSize: 0, grainAmount: 48, isMarkerEnabled: true, isBackgroundBlurEnabled: true, isMonochrome: false }
    },
    {
        id: 4, code: 'MGR', label: 'Mono Grain',
        desktop: { resolution: 20, pixelGap: 36, lowerLimit: 0, similaritySensitivity: 96, blurAmount: 12, ior: 28, grainSize: 21, grainAmount: 72, isMarkerEnabled: true, isBackgroundBlurEnabled: false, isMonochrome: true },
        phone: { resolution: 3, pixelGap: 64, lowerLimit: 20, similaritySensitivity: 96, blurAmount: 16, ior: 24, grainSize: 10, grainAmount: 60, isMarkerEnabled: true, isBackgroundBlurEnabled: false, isMonochrome: true }
    },
    {
        id: 5, code: 'MBR', label: 'Membrane',
        desktop: { resolution: 96, pixelGap: 64, lowerLimit: 0, similaritySensitivity: 0, blurAmount: 6, ior: 100, grainSize: 0, grainAmount: 36, isMarkerEnabled: false, isBackgroundBlurEnabled: true, isMonochrome: false },
        phone: { resolution: 52, pixelGap: 64, lowerLimit: 0, similaritySensitivity: 0, blurAmount: 6, ior: 100, grainSize: 0, grainAmount: 20, isMarkerEnabled: false, isBackgroundBlurEnabled: true, isMonochrome: false }
    },
    {
        id: 6, code: 'BAR', label: 'Bare',
        desktop: { resolution: 0, pixelGap: 67, lowerLimit: 36, similaritySensitivity: 100, blurAmount: 16, ior: 32, grainSize: 0, grainAmount: 50, isMarkerEnabled: true, isBackgroundBlurEnabled: false, isMonochrome: false },
        phone: { resolution: 0, pixelGap: 56, lowerLimit: 21, similaritySensitivity: 100, blurAmount: 25, ior: 36, grainSize: 0, grainAmount: 36, isMarkerEnabled: true, isBackgroundBlurEnabled: false, isMonochrome: false }
    },
    {
        id: 7, code: 'ORG', label: 'Organic',
        desktop: { resolution: 82, pixelGap: 64, lowerLimit: 0, similaritySensitivity: 78, blurAmount: 12, ior: 80, grainSize: 0, grainAmount: 40, isMarkerEnabled: false, isBackgroundBlurEnabled: false, isMonochrome: false },
        phone: { resolution: 32, pixelGap: 36, lowerLimit: 0, similaritySensitivity: 90, blurAmount: 24, ior: 56, grainSize: 0, grainAmount: 50, isMarkerEnabled: false, isBackgroundBlurEnabled: false, isMonochrome: false }
    },
    {
        id: 8, code: 'BGR', label: 'Big Grain',
        desktop: { resolution: 7, pixelGap: 50, lowerLimit: 40, similaritySensitivity: 92, blurAmount: 25, ior: 80, grainSize: 10, grainAmount: 64, isMarkerEnabled: false, isBackgroundBlurEnabled: true, isMonochrome: false },
        phone: { resolution: 4, pixelGap: 50, lowerLimit: 32, similaritySensitivity: 67, blurAmount: 24, ior: 87, grainSize: 4, grainAmount: 64, isMarkerEnabled: false, isBackgroundBlurEnabled: true, isMonochrome: false }
    },
    {
        id: 9, code: 'MOD', label: 'Moderate',
        desktop: { resolution: 40, pixelGap: 60, lowerLimit: 0, similaritySensitivity: 92, blurAmount: 18, ior: 75, grainSize: 0, grainAmount: 20, isMarkerEnabled: true, isBackgroundBlurEnabled: false, isMonochrome: false },
        phone: { resolution: 8, pixelGap: 0, lowerLimit: 14, similaritySensitivity: 67, blurAmount: 17, ior: 84, grainSize: 0, grainAmount: 20, isMarkerEnabled: true, isBackgroundBlurEnabled: false, isMonochrome: false }
    },
];


const colorDistance = (
    c1: { r: number, g: number, b: number } | null,
    c2: { r: number, g: number, b: number } | null
): number => {
    if (!c1 || !c2) return Infinity;
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
};

const drawGlassDots = (ctx: CanvasRenderingContext2D, options: {
    canvasWidth: number;
    canvasHeight: number;
    sourceBleedCanvas: HTMLCanvasElement;
    blurBleedCanvas: HTMLCanvasElement;
    finalBgCanvas: HTMLCanvasElement;
    bleedX: number;
    bleedY: number;
    settings: GlassDotsState;
}) => {
    const { canvasWidth, canvasHeight, sourceBleedCanvas, blurBleedCanvas, finalBgCanvas, bleedX, bleedY, settings } = options;
    const { resolution, pixelGap, ior, similaritySensitivity, isGrainEnabled, grainAmount, grainSize, lowerLimit, isMarkerEnabled, isBackgroundBlurEnabled } = settings;

    // 1. Downsample image to grid for blob detection
    const gridWidth = Math.floor(10 + (resolution / 100) * 100);
    const gridHeight = Math.round(gridWidth * (canvasHeight / canvasWidth));
    if (gridWidth <= 0 || gridHeight <= 0) {
        ctx.drawImage(finalBgCanvas, 0, 0); // Draw background if grid is invalid
        return;
    };

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gridWidth;
    tempCanvas.height = gridHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    // We draw from sourceBleedCanvas (which has monochrome filter applied if needed)
    tempCtx.drawImage(sourceBleedCanvas, 0, 0, sourceBleedCanvas.width, sourceBleedCanvas.height, 0, 0, gridWidth, gridHeight);
    const imageData = tempCtx.getImageData(0, 0, gridWidth, gridHeight).data;

    const colorGrid: ({ r: number; g: number; b: number; } | null)[][] = Array.from({ length: gridHeight }, (_, y) =>
        Array.from({ length: gridWidth }, (_, x) => {
            const i = (y * gridWidth + x) * 4;
            return { r: imageData[i], g: imageData[i + 1], b: imageData[i + 2] };
        })
    );

    // 2. Blob detection
    // 2. Blob detection
    const visited = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false));
    const blobs: { x: number, y: number, size: number }[] = [];
    const similarityThreshold = (similaritySensitivity / 100) * 160;

    const findMaxBlobSize = (startX: number, startY: number, limitX: number, limitY: number, checkSimilarity: boolean) => {
        if (similaritySensitivity === 0) return 1;
        const anchorColor = colorGrid[startY][startX];
        let currentSize = 1;

        while (true) {
            const nextSize = currentSize + 1;
            if (startY + nextSize > limitY || startX + nextSize > limitX) break;

            let canExpand = true;
            // Check new column on the right
            for (let i = 0; i < nextSize; i++) {
                const cx = startX + currentSize;
                const cy = startY + i;
                if (visited[cy][cx]) { canExpand = false; break; }
                if (checkSimilarity && colorDistance(anchorColor, colorGrid[cy][cx]) > similarityThreshold) {
                    canExpand = false; break;
                }
            }
            if (!canExpand) break;

            // Check new row on the bottom
            for (let i = 0; i < currentSize; i++) {
                const cx = startX + i;
                const cy = startY + currentSize;
                if (visited[cy][cx]) { canExpand = false; break; }
                if (checkSimilarity && colorDistance(anchorColor, colorGrid[cy][cx]) > similarityThreshold) {
                    canExpand = false; break;
                }
            }
            if (!canExpand) break;

            currentSize = nextSize;
        }
        return currentSize;
    };

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (visited[y][x]) continue;

            const size = findMaxBlobSize(x, y, gridWidth, gridHeight, true);
            blobs.push({ x, y, size });

            // Mark the main blob area as visited globally
            for (let j = 0; j < size; j++) {
                for (let i = 0; i < size; i++) {
                    visited[y + j][x + i] = true;
                }
            }

            // Recursive fill for corners if blob is large enough
            if (size > 1) {
                // Use the same effective gap calculation as in the drawing phase to determine visual boundary
                const recalibratedPixelGap = pixelGap * 16 / 100;
                const effectiveGapPercent = (recalibratedPixelGap / 100);
                const visualRadius = (size - effectiveGapPercent) / 2;

                const centerX = size / 2;
                const centerY = size / 2;

                // Local visited array for the recursive fill within this block
                const localVisited = Array.from({ length: size }, () => Array(size).fill(false));

                // Mark the main circle area as occupied in local map
                for (let ly = 0; ly < size; ly++) {
                    for (let lx = 0; lx < size; lx++) {
                        // Strict Circle-Rectangle Intersection Test
                        // We check if the visual circle intersects with the grid cell at (lx, ly)
                        // Cell bounds: [lx, lx+1] x [ly, ly+1]

                        // Find the closest point on the rectangle to the circle center
                        const closestX = Math.max(lx, Math.min(centerX, lx + 1));
                        const closestY = Math.max(ly, Math.min(centerY, ly + 1));

                        const dx = centerX - closestX;
                        const dy = centerY - closestY;

                        // If distance squared is less than radius squared, they intersect
                        // We add a tiny buffer (epsilon) to be safe against floating point errors
                        if ((dx * dx + dy * dy) < (visualRadius * visualRadius) - 0.001) {
                            localVisited[ly][lx] = true;
                        }
                    }
                }

                // Find and fill empty spots
                for (let ly = 0; ly < size; ly++) {
                    for (let lx = 0; lx < size; lx++) {
                        if (localVisited[ly][lx]) continue;

                        // Find max square that fits in the empty space
                        // We don't need to check color similarity again as it's within the parent blob
                        let subSize = 1;
                        while (true) {
                            const nextSize = subSize + 1;
                            if (ly + nextSize > size || lx + nextSize > size) break;

                            let canExpand = true;
                            // Check right col
                            for (let i = 0; i < nextSize; i++) {
                                if (localVisited[ly + i][lx + subSize]) { canExpand = false; break; }
                            }
                            if (!canExpand) break;

                            // Check bottom row
                            for (let i = 0; i < subSize; i++) {
                                if (localVisited[ly + subSize][lx + i]) { canExpand = false; break; }
                            }
                            if (!canExpand) break;

                            subSize = nextSize;
                        }

                        // Add the filler blob
                        blobs.push({ x: x + lx, y: y + ly, size: subSize });

                        // Mark as visited locally
                        for (let j = 0; j < subSize; j++) {
                            for (let i = 0; i < subSize; i++) {
                                localVisited[ly + j][lx + i] = true;
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Identify top blobs for markers before any filtering
    const sortedAllBlobs = [...blobs].sort((a, b) => b.size - a.size);
    const top4PercentIndex = Math.ceil(sortedAllBlobs.length * 0.04);
    const markerCount = Math.min(top4PercentIndex, 5);
    const topBlobsForMarkers = new Set(sortedAllBlobs.slice(0, markerCount));

    // 4. Draw final image with blobs
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(finalBgCanvas, 0, 0);

    const refractScale = 1 + ((ior * 0.93) / 100) * 0.4;

    const cellWidth = canvasWidth / gridWidth;
    const cellHeight = canvasHeight / gridHeight;
    const recalibratedPixelGap = pixelGap * 16 / 100;
    const effectiveGapPercent = (recalibratedPixelGap / 100);
    const gapX = cellWidth * effectiveGapPercent;
    const gapY = cellHeight * effectiveGapPercent;

    // Calculate effective visual radius in grid units for collision detection
    // Visual radius in pixels = (size * cellWidth - gapX) / 2
    // Visual radius in grid units = Visual radius in pixels / cellWidth
    // = (size - gapX/cellWidth) / 2 = (size - effectiveGapPercent) / 2
    const getVisualRadiusInGridUnits = (size: number) => (size - effectiveGapPercent) / 2;

    const maskItems: { centerX: number, centerY: number, radius: number }[] = [];

    const maxBlobSize = blobs.reduce((max, b) => Math.max(max, b.size), 1);
    const sizeThreshold = (lowerLimit / 100) * maxBlobSize;
    const filteredBlobs = blobs.filter(b => b.size >= sizeThreshold);

    const drawableBlobs = filteredBlobs.map(blob => {
        const { x, y, size } = blob;
        const blobPixelWidth = cellWidth * size;
        const blobPixelHeight = cellHeight * size;
        const centerX = x * cellWidth + blobPixelWidth / 2;
        const centerY = y * cellHeight + blobPixelHeight / 2;
        const dotWidth = blobPixelWidth - gapX;
        const dotHeight = blobPixelHeight - gapY;
        const radius = Math.min(dotWidth, dotHeight) / 2;
        return { centerX, centerY, radius, size, originalBlob: blob };
    }).filter(b => b.radius > 0.1);

    for (const blob of drawableBlobs) {
        const { centerX, centerY, radius } = blob;
        maskItems.push({ centerX, centerY, radius });

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.clip();

        const refractedW = radius * 2 * refractScale;
        const refractedH = radius * 2 * refractScale;

        const sourceX = (centerX + bleedX) - refractedW / 2;
        const sourceY = (centerY + bleedY) - refractedH / 2;

        ctx.drawImage(blurBleedCanvas, sourceX, sourceY, refractedW, refractedH, centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    // 5. Draw plus signs on largest dots
    if (isMarkerEnabled && topBlobsForMarkers.size > 0) {
        const tempImageCtx = sourceBleedCanvas.getContext('2d', { willReadFrequently: true });
        if (tempImageCtx) {
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';

            for (const blob of drawableBlobs) {
                if (topBlobsForMarkers.has(blob.originalBlob)) {
                    const { centerX, centerY, radius } = blob;
                    const sampleX = Math.round(centerX + bleedX);
                    const sampleY = Math.round(centerY + bleedY);
                    const pixelData = tempImageCtx.getImageData(sampleX, sampleY, 1, 1).data;
                    const brightness = 0.299 * pixelData[0] + 0.587 * pixelData[1] + 0.114 * pixelData[2];
                    ctx.strokeStyle = brightness > 128 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';

                    const hardcodedPlusSignSize = 50;
                    const hardcodedPlusSignStroke = 36;
                    const stroke = (hardcodedPlusSignStroke / 100) * (radius * 0.05) + 1;
                    ctx.lineWidth = Math.max(1, stroke);

                    const size = (hardcodedPlusSignSize / 100) * radius * 0.5;

                    ctx.beginPath();
                    ctx.moveTo(centerX - size, centerY);
                    ctx.lineTo(centerX + size, centerY);
                    ctx.moveTo(centerX, centerY - size);
                    ctx.lineTo(centerX, centerY + size);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }


    // 6. Add grain if enabled
    if (isGrainEnabled && grainAmount > 0 && (maskItems.length > 0 || isBackgroundBlurEnabled)) {
        const grainCanvas = document.createElement('canvas');
        grainCanvas.width = canvasWidth;
        grainCanvas.height = canvasHeight;
        const grainCtx = grainCanvas.getContext('2d', { colorSpace: 'display-p3' });
        if (grainCtx) {
            const recalibratedGrainSize = grainSize * 18 / 100;
            const scale = 1 + (recalibratedGrainSize / 100) * 7;
            const noiseW = Math.ceil(canvasWidth / scale);
            const noiseH = Math.ceil(canvasHeight / scale);
            const noiseCanvas = document.createElement('canvas');
            noiseCanvas.width = noiseW;
            noiseCanvas.height = noiseH;
            const noiseCtx = noiseCanvas.getContext('2d', { colorSpace: 'display-p3' });
            if (noiseCtx) {
                const imageData = noiseCtx.createImageData(noiseW, noiseH);
                const data = imageData.data;
                const contrastFactor = 128 + (DEFAULT_SLIDER_VALUE / 100) * 127;
                for (let i = 0; i < data.length; i += 4) {
                    const val = 128 + (Math.random() - 0.5) * contrastFactor;
                    data[i] = data[i + 1] = data[i + 2] = val;
                    data[i + 3] = 255;
                }
                noiseCtx.putImageData(imageData, 0, 0);
                grainCtx.imageSmoothingEnabled = false;
                grainCtx.drawImage(noiseCanvas, 0, 0, noiseW, noiseH, 0, 0, canvasWidth, canvasHeight);

                if (!isBackgroundBlurEnabled) {
                    const dotsMaskCanvas = document.createElement('canvas');
                    dotsMaskCanvas.width = canvasWidth;
                    dotsMaskCanvas.height = canvasHeight;
                    const maskCtx = dotsMaskCanvas.getContext('2d', { colorSpace: 'display-p3' });
                    if (maskCtx) {
                        maskCtx.fillStyle = 'white';
                        maskCtx.beginPath();
                        for (const item of maskItems) {
                            maskCtx.moveTo(item.centerX + item.radius, item.centerY);
                            maskCtx.arc(item.centerX, item.centerY, item.radius, 0, 2 * Math.PI);
                        }
                        maskCtx.fill();
                        grainCtx.globalCompositeOperation = 'destination-in';
                        grainCtx.drawImage(dotsMaskCanvas, 0, 0);
                    }
                }

                ctx.save();
                const recalibratedGrainAmount = grainAmount * 35 / 100;
                ctx.globalAlpha = recalibratedGrainAmount / 100;
                ctx.globalCompositeOperation = 'overlay';
                ctx.drawImage(grainCanvas, 0, 0);
                ctx.restore();
            }
        }
    }
};

export const useGlassDotsPanel = ({
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
    triggerShareToast: (showSpecificToast?: () => void, isSpecial?: boolean) => void;
    handleShare: (variant?: 'default' | 'special') => Promise<void>;
    showSharePopup: boolean;
    setShowSharePopup: React.Dispatch<React.SetStateAction<boolean>>;
    communityLink: string;
    appUrl: string;
    shareVariant: 'default' | 'special';
}) => {
    const {
        state: glassDotsSettings,
        setState: setGlassDotsSettings,
        undo: undoGlassDots,
        redo: redoGlassDots,
        resetHistory: resetGlassDotsHistoryStack,
        canUndo: canUndoGlassDots,
        canRedo: canRedoGlassDots
    } = useHistory(FULL_GLASSDOTS_INITIAL_STATE);

    const [liveGlassDotsSettings, setLiveGlassDotsSettings] = useState(glassDotsSettings);
    const [wallpaperType, setWallpaperType] = useState<'phone' | 'desktop'>(isMobile ? 'phone' : 'desktop');
    const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
    const [showFsToast, setShowFsToast] = useState(false);
    const [viewMode, setViewMode] = useState<'presets' | 'controls'>('presets');
    const [activePresetId, setActivePresetId] = useState<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fullScreenCanvasRef = useRef<HTMLCanvasElement>(null);
    const fullScreenContainerRef = useRef<HTMLDivElement>(null);
    const fullScreenFileInputRef = useRef<HTMLInputElement>(null);
    const [isFullScreenControlsOpen, setIsFullScreenControlsOpen] = useState(false);
    const [isWarningExpanded, setIsWarningExpanded] = useState(true);
    const [tooltipPresetId, setTooltipPresetId] = useState<number | null>(null);
    const tooltipTimer = useRef<any>(null);
    const [isShuffling, setIsShuffling] = useState(false);
    const [showPerformanceWarning, setShowPerformanceWarning] = useState(false);
    const [hasDismissedPerformanceWarning, setHasDismissedPerformanceWarning] = useState(false);

    const liveActiveState = useMemo(() => {
        return liveGlassDotsSettings[wallpaperType];
    }, [liveGlassDotsSettings, wallpaperType]);

    const {
        imageSrc,
        image,
        isLoading,
        isDownloading,
        handleFileSelect,
        handleDownload: baseHandleDownload,
        clearImage
    } = useImageHandler({
        featureName: 'glass_dots',
        onFileSelectCallback: () => { },
        triggerShareToast: triggerShareToast
    });
    
    useEffect(() => {
        if (!imageSrc) {
            setHasDismissedPerformanceWarning(false);
            setShowPerformanceWarning(false);
            return;
        }

        const ua = navigator.userAgent.toLowerCase();
        const isFirefox = ua.includes('firefox');
        const isChromium = !!(window as any).chrome && !isFirefox;

        const shouldShow = (isChromium && !isMobile) || (isFirefox && isMobile);
        setShowPerformanceWarning(shouldShow);
    }, [imageSrc, isMobile]);

    useEffect(() => {
        if (image) {
            const defaultPreset = PRESETS_DATA.find(p => p.id === 1);
            if (defaultPreset) {
                const newInitialState: GlassDotsSettingsContainer = {
                    phone: {
                        ...FULL_GLASSDOTS_INITIAL_STATE.phone,
                        ...defaultPreset.phone,
                        isGrainEnabled: true
                    },
                    desktop: {
                        ...FULL_GLASSDOTS_INITIAL_STATE.desktop,
                        ...defaultPreset.desktop,
                        isGrainEnabled: true
                    }
                };
                resetGlassDotsHistoryStack(newInitialState);
                setActivePresetId(defaultPreset.id);
            } else {
                resetGlassDotsHistoryStack(FULL_GLASSDOTS_INITIAL_STATE);
                setActivePresetId(null);
            }
        } else {
            resetGlassDotsHistoryStack(FULL_GLASSDOTS_INITIAL_STATE);
            setActivePresetId(null);
        }
    }, [image, resetGlassDotsHistoryStack]);

    useEffect(() => { setLiveGlassDotsSettings(glassDotsSettings); }, [glassDotsSettings]);

    const handleResetCurrent = useCallback(() => {
        trackEvent('glass_dots_reset_defaults', { wallpaper_type: wallpaperType });

        const presetToRestore = activePresetId ? PRESETS_DATA.find(p => p.id === activePresetId) : null;

        setGlassDotsSettings(s => {
            const currentCrop = {
                cropOffsetX: s[wallpaperType].cropOffsetX,
                cropOffsetY: s[wallpaperType].cropOffsetY
            };

            let newSettings = { ...FULL_GLASSDOTS_INITIAL_STATE[wallpaperType] };

            if (presetToRestore) {
                const presetSettings = wallpaperType === 'phone' ? presetToRestore.phone : presetToRestore.desktop;
                newSettings = { ...newSettings, ...presetSettings, isGrainEnabled: true };
            }

            return {
                ...s,
                [wallpaperType]: {
                    ...newSettings,
                    ...currentCrop
                }
            };
        });
        // We do NOT clear activePresetId here anymore if we are resetting TO a preset.
        if (!presetToRestore) {
            setActivePresetId(null);
        }
    }, [wallpaperType, setGlassDotsSettings, activePresetId]);

    const applyPreset = useCallback((preset: PresetDefinition, targetType: 'phone' | 'desktop' = wallpaperType) => {
        setGlassDotsSettings(s => {
            const currentCrop = {
                cropOffsetX: s[targetType].cropOffsetX,
                cropOffsetY: s[targetType].cropOffsetY
            };

            // Get settings for the specific target device type
            const presetSettings = targetType === 'phone' ? preset.phone : preset.desktop;

            const finalSettings: GlassDotsState = {
                ...FULL_GLASSDOTS_INITIAL_STATE[targetType],
                ...currentCrop,
                ...presetSettings,
                isGrainEnabled: true
            } as GlassDotsState;

            return {
                ...s,
                [targetType]: finalSettings
            };
        });
    }, [wallpaperType, setGlassDotsSettings]);

    const handlePresetClick = (preset: PresetDefinition) => {
        trackEvent('glass_dots_preset_apply', { preset: preset.code, wallpaper_type: wallpaperType });
        setActivePresetId(preset.id);
        applyPreset(preset, wallpaperType);
    };

    const handleViewModeChange = (mode: 'presets' | 'controls') => {
        trackEvent('glass_dots_control_mode_change', { view_mode: mode });
        setViewMode(mode);
    };

    const handleDeviceTypeChange = (type: 'phone' | 'desktop') => {
        trackEvent('glass_dots_device_type_change', { device_type: type });
        setWallpaperType(type);
        if (activePresetId && viewMode === 'presets') {
            const preset = PRESETS_DATA.find(p => p.id === activePresetId);
            if (preset) {
                applyPreset(preset, type);
            }
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => {
            if (!document.fullscreenElement) {
                setIsFullScreenPreview(false);
                setIsFullScreenControlsOpen(false);
            }
        };
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);

    const enterFullScreen = () => {
        trackEvent('glass_dots_fullscreen_enter');
        flushSync(() => setIsFullScreenPreview(true));
        fullScreenContainerRef.current?.requestFullscreen().catch(() => setIsFullScreenPreview(false));
    };

    const exitFullScreen = useCallback(() => {
        trackEvent('glass_dots_fullscreen_exit');
        if (document.fullscreenElement) document.exitFullscreen();
        else setIsFullScreenPreview(false);
    }, []);

    const [fullCanvasWidth, fullCanvasHeight] = useMemo(() => {
        return wallpaperType === 'desktop' ? [GLASSDOTS_DESKTOP_WIDTH, GLASSDOTS_DESKTOP_HEIGHT] : [GLASSDOTS_PHONE_WIDTH, GLASSDOTS_PHONE_HEIGHT];
    }, [wallpaperType]);

    const [previewCanvasWidth, previewCanvasHeight] = useMemo(() => {
        return [fullCanvasWidth, fullCanvasHeight];
    }, [fullCanvasWidth, fullCanvasHeight]);

    const glassDotsCropIsNeeded = useMemo(() => image ? Math.abs((image.width / image.height) - (fullCanvasWidth / fullCanvasHeight)) > 0.01 : false, [image, fullCanvasWidth, fullCanvasHeight]);

    useEffect(() => {
        if (!image) return;
        const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
        if (!ctx) return;

        const { resolution, ior, cropOffsetX, cropOffsetY, isMonochrome, blurAmount, isBackgroundBlurEnabled } = liveActiveState;

        const gridWidth = Math.floor(10 + (resolution / 100) * 100);
        const maxBlobSizeFactor = 1.0;
        const maxBlobPixelWidth = (previewCanvasWidth / gridWidth) * (gridWidth * maxBlobSizeFactor);
        const refractScale = 1 + ((ior * 0.93) / 100) * 0.4;
        const scaleFactor = refractScale - 1;
        const bleed = (maxBlobPixelWidth / 2) * scaleFactor;

        const bleedX = bleed;
        const bleedY = bleed * (previewCanvasHeight / previewCanvasWidth);

        const bleedCanvasWidth = previewCanvasWidth + 2 * bleedX;
        const bleedCanvasHeight = previewCanvasHeight + 2 * bleedY;

        const sourceBleedCanvas = document.createElement('canvas');
        sourceBleedCanvas.width = bleedCanvasWidth;
        sourceBleedCanvas.height = bleedCanvasHeight;
        const sourceBleedCtx = sourceBleedCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceBleedCtx) return;


        const imgAspect = image.width / image.height;
        const bleedCanvasAspect = bleedCanvasWidth / bleedCanvasHeight;
        let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;

        if (imgAspect > bleedCanvasAspect) {
            sHeight = image.height;
            sWidth = sHeight * bleedCanvasAspect;
            sx = (image.width - sWidth) * cropOffsetX;
        } else {
            sWidth = image.width;
            sHeight = sWidth / bleedCanvasAspect;
            sy = (image.height - sHeight) * cropOffsetY;
        }
        sourceBleedCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, bleedCanvasWidth, bleedCanvasHeight);

        const blurBleedCanvas = document.createElement('canvas');
        blurBleedCanvas.width = bleedCanvasWidth;
        blurBleedCanvas.height = bleedCanvasHeight;
        const blurBleedCtx = blurBleedCanvas.getContext('2d', { colorSpace: 'display-p3' });
        if (!blurBleedCtx) return;

        const effectiveBlurAmount = 12 + (blurAmount * 0.88);
        const blurPx = (effectiveBlurAmount / 100) * Math.max(bleedCanvasWidth, bleedCanvasHeight) * 0.02;

        const filters = [];
        if (blurPx > 0) filters.push(`blur(${blurPx}px)`);
        if (isMonochrome) filters.push('grayscale(100%)');

        if (filters.length > 0) {
            blurBleedCtx.filter = filters.join(' ');
        }
        blurBleedCtx.drawImage(sourceBleedCanvas, 0, 0);

        const finalBgCanvas = document.createElement('canvas');
        finalBgCanvas.width = previewCanvasWidth;
        finalBgCanvas.height = previewCanvasHeight;
        const finalBgCtx = finalBgCanvas.getContext('2d', { colorSpace: 'display-p3' });
        if (!finalBgCtx) return;

        if (isBackgroundBlurEnabled) {
            const distortedCtx = blurBleedCtx;
            finalBgCtx.drawImage(distortedCtx.canvas, bleedX, bleedY, previewCanvasWidth, previewCanvasHeight, 0, 0, previewCanvasWidth, previewCanvasHeight);
        } else {
            if (isMonochrome) finalBgCtx.filter = 'grayscale(100%)';
            finalBgCtx.drawImage(sourceBleedCanvas, bleedX, bleedY, previewCanvasWidth, previewCanvasHeight, 0, 0, previewCanvasWidth, previewCanvasHeight);
            finalBgCtx.filter = 'none';
        }

        drawGlassDots(ctx, {
            canvasWidth: previewCanvasWidth,
            canvasHeight: previewCanvasHeight,
            sourceBleedCanvas,
            blurBleedCanvas,
            finalBgCanvas,
            bleedX,
            bleedY,
            settings: liveActiveState
        });
    }, [image, isFullScreenPreview, previewCanvasWidth, previewCanvasHeight, liveActiveState]);

    const getCanvasBlob = useCallback(async (options: { highQuality?: boolean } = {}): Promise<Blob | null> => {
        const { highQuality = false } = options;
        if (!image) return null;

        const targetWidth = highQuality ? fullCanvasWidth : previewCanvasWidth;
        const targetHeight = highQuality ? fullCanvasHeight : previewCanvasHeight;

        return new Promise((resolve) => {
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = targetWidth;
            offscreenCanvas.height = targetHeight;
            const ctx = offscreenCanvas.getContext('2d', { colorSpace: 'display-p3' });
            if (!ctx) return resolve(null);

            const settingsToDraw = glassDotsSettings[wallpaperType];

            const { resolution, ior, cropOffsetX, cropOffsetY, isMonochrome, blurAmount, isBackgroundBlurEnabled } = settingsToDraw;
            const gridWidth = Math.floor(10 + (resolution / 100) * 100);
            const maxBlobSizeFactor = 1.0;
            const maxBlobPixelWidth = (targetWidth / gridWidth) * (gridWidth * maxBlobSizeFactor);
            const refractScale = 1 + ((ior * 0.93) / 100) * 0.4;
            const scaleFactor = refractScale - 1;
            const bleed = (maxBlobPixelWidth / 2) * scaleFactor;
            const bleedX = bleed;
            const bleedY = bleed * (targetHeight / targetWidth);
            const bleedCanvasWidth = targetWidth + 2 * bleedX;
            const bleedCanvasHeight = targetHeight + 2 * bleedY;

            const sourceBleedCanvas = document.createElement('canvas');
            sourceBleedCanvas.width = bleedCanvasWidth;
            sourceBleedCanvas.height = bleedCanvasHeight;
            const sourceBleedCtx = sourceBleedCanvas.getContext('2d', { willReadFrequently: true });
            if (!sourceBleedCtx) return resolve(null);
            const imgAspect = image.width / image.height, bleedCanvasAspect = bleedCanvasWidth / bleedCanvasHeight;
            let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;
            if (imgAspect > bleedCanvasAspect) { sHeight = image.height; sWidth = sHeight * bleedCanvasAspect; sx = (image.width - sWidth) * cropOffsetX; }
            else { sWidth = image.width; sHeight = sWidth / bleedCanvasAspect; sy = (image.height - sHeight) * cropOffsetY; }
            sourceBleedCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, bleedCanvasWidth, bleedCanvasHeight);

            const blurBleedCanvas = document.createElement('canvas');
            blurBleedCanvas.width = bleedCanvasWidth;
            blurBleedCanvas.height = bleedCanvasHeight;
            const blurBleedCtx = blurBleedCanvas.getContext('2d', { colorSpace: 'display-p3' });
            if (!blurBleedCtx) return resolve(null);
            const effectiveBlurAmount = 12 + (blurAmount * 0.88);
            const blurPx = (effectiveBlurAmount / 100) * Math.max(bleedCanvasWidth, bleedCanvasHeight) * 0.02;

            const filters = [];
            if (blurPx > 0) filters.push(`blur(${blurPx}px)`);
            if (isMonochrome) filters.push('grayscale(100%)');

            if (filters.length > 0) blurBleedCtx.filter = filters.join(' ');
            blurBleedCtx.drawImage(sourceBleedCanvas, 0, 0);

            const finalBgCanvas = document.createElement('canvas');
            finalBgCanvas.width = targetWidth;
            finalBgCanvas.height = targetHeight;
            const finalBgCtx = finalBgCanvas.getContext('2d', { colorSpace: 'display-p3' });
            if (!finalBgCtx) return resolve(null);
            if (isBackgroundBlurEnabled) { finalBgCtx.drawImage(blurBleedCtx.canvas, bleedX, bleedY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight); }
            else {
                if (isMonochrome) finalBgCtx.filter = 'grayscale(100%)';
                finalBgCtx.drawImage(sourceBleedCanvas, bleedX, bleedY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
                finalBgCtx.filter = 'none';
            }

            drawGlassDots(ctx, {
                canvasWidth: targetWidth,
                canvasHeight: targetHeight,
                sourceBleedCanvas, blurBleedCanvas, finalBgCanvas, bleedX, bleedY,
                settings: settingsToDraw
            });
            offscreenCanvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }, [image, fullCanvasWidth, fullCanvasHeight, previewCanvasWidth, previewCanvasHeight, glassDotsSettings, wallpaperType]);

    const handleDownload = () => {
        const analyticsParams: Record<string, any> = {
            feature: 'glass_dots',
            wallpaper_type: wallpaperType,
            view_mode_on_download: viewMode,
            ...liveActiveState
        };
        const onSuccess = () => triggerShareToast(isFullScreenPreview ? () => setShowFsToast(true) : undefined);

        const filename = `matrices-glassdots-${wallpaperType}`;

        baseHandleDownload(() => getCanvasBlob({ highQuality: true }), filename, analyticsParams, onSuccess);
    };

    const handleFullScreenReplace = (file: File) => handleFileSelect(file, 'click');
    const handleFullScreenReplaceClick = () => fullScreenFileInputRef.current?.click();
    const handleFullScreenFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleFullScreenReplace(e.target.files[0]);
        if (e.target) e.target.value = '';
    };

    const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0.5, initialOffsetY: 0.5, hasMoved: false });

    const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!glassDotsCropIsNeeded) return;
        e.preventDefault();
        Object.assign(dragState.current, { isDragging: true, hasMoved: false, initialOffsetX: liveActiveState.cropOffsetX, initialOffsetY: liveActiveState.cropOffsetY });
        const point = 'touches' in e ? e.touches[0] : e;
        dragState.current.startX = point.clientX;
        dragState.current.startY = point.clientY;
        document.body.style.cursor = 'grabbing';
    }, [glassDotsCropIsNeeded, liveActiveState]);

    const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!dragState.current.isDragging || !image) return;
        dragState.current.hasMoved = true;
        const point = 'touches' in e ? e.touches[0] : e;
        const deltaX = point.clientX - dragState.current.startX;
        const deltaY = point.clientY - dragState.current.startY;

        const activeCanvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
        if (!activeCanvas) return;

        const rect = activeCanvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const imgAspect = image.width / image.height;
        const canvasAspect = fullCanvasWidth / fullCanvasHeight;

        let sWidth, sHeight;
        if (imgAspect > canvasAspect) {
            sHeight = image.height;
            sWidth = sHeight * canvasAspect;
        } else {
            sWidth = image.width;
            sHeight = sWidth / canvasAspect;
        }

        const panRangePxX = image.width - sWidth;
        const panRangePxY = image.height - sHeight;

        let newOffsetX = dragState.current.initialOffsetX;
        if (panRangePxX > 0) {
            const dragFractionX = deltaX / rect.width;
            newOffsetX -= (dragFractionX * sWidth) / panRangePxX;
        }

        let newOffsetY = dragState.current.initialOffsetY;
        if (panRangePxY > 0) {
            const dragFractionY = deltaY / rect.height;
            newOffsetY -= (dragFractionY * sHeight) / panRangePxY;
        }

        const newCropState = {
            cropOffsetX: Math.max(0, Math.min(1, newOffsetX)),
            cropOffsetY: Math.max(0, Math.min(1, newOffsetY)),
        };

        setLiveGlassDotsSettings(s => {
            return { ...s, [wallpaperType]: { ...s[wallpaperType], ...newCropState } };
        });
    }, [image, fullCanvasWidth, fullCanvasHeight, wallpaperType, isFullScreenPreview]);

    const handleDragEnd = useCallback(() => {
        if (dragState.current.isDragging) {
            dragState.current.isDragging = false;
            if (dragState.current.hasMoved) trackEvent('glass_dots_crop', { wallpaper_type: wallpaperType });
            const { cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } = liveActiveState;
            setGlassDotsSettings(s => {
                return { ...s, [wallpaperType]: { ...s[wallpaperType], cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } };
            });
            document.body.style.cursor = 'default';
        }
    }, [liveActiveState, wallpaperType, setGlassDotsSettings]);

    useEffect(() => {
        const onMove = (e: MouseEvent | TouchEvent) => handleDragMove(e);
        const onEnd = () => handleDragEnd();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onEnd);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        }
    }, [handleDragMove, handleDragEnd]);

    const updateLiveSetting = (key: keyof GlassDotsState, value: any) => {
        setLiveGlassDotsSettings(s => {
            return { ...s, [wallpaperType]: { ...s[wallpaperType], [key]: value } };
        });
        setActivePresetId(null);
    };

    const commitSetting = useCallback((key: keyof GlassDotsState, value: any) => {
        setGlassDotsSettings(s => {
            return { ...s, [wallpaperType]: { ...s[wallpaperType], [key]: value } };
        });
        trackEvent('glass_dots_slider_change', { slider_name: key, value, wallpaper_type: wallpaperType });
    }, [setGlassDotsSettings, wallpaperType]);

    const commitToggle = (key: keyof GlassDotsState, enabled: boolean) => {
        commitSetting(key, enabled);
        trackEvent('glass_dots_toggle_change', {
            setting: key,
            enabled,
            wallpaper_type: wallpaperType
        });
    }

    const wallpaperTypeOptions = [{ key: 'phone', label: 'Phone' }, { key: 'desktop', label: 'Desktop' }];
    const viewModeOptions = [{ key: 'presets', label: 'Presets' }, { key: 'controls', label: 'Full Control' }];

    const handlePresetMouseEnter = (id: number) => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        tooltipTimer.current = setTimeout(() => {
            setTooltipPresetId(id);
        }, 3600);
    };

    const handlePresetMouseLeave = () => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        setTooltipPresetId(null);
    };

    const handleShuffle = () => {
        trackEvent('glass_dots_shuffle', { wallpaper_type: wallpaperType });
        setActivePresetId(null);
        setIsShuffling(true);
        setTimeout(() => setIsShuffling(false), 250);

        const randomBool = (trueChance = 0.5) => Math.random() < trueChance;
        const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

        // Biased Size Variance (similaritySensitivity)
        // 80% chance > 25, 20% chance <= 25
        const isHighVariance = Math.random() < 0.8;
        const similaritySensitivity = isHighVariance ? randomInt(26, 100) : randomInt(0, 25);

        // Marker constraint: when size variance is less than 25, Markers toggle shouldn't turn on.
        let isMarkerEnabled = randomBool();
        if (similaritySensitivity < 25) {
            isMarkerEnabled = false;
        }

        // Biased Monochrome: 80% off, 20% on.
        const isMonochrome = randomBool(0.2);

        // Lower Limit Constraint: 0 to 32
        const lowerLimit = randomInt(0, 32);

        const ior = randomInt(0, 100);

        const newSettings: GlassDotsState = {
            resolution: randomInt(0, 100),
            pixelGap: randomInt(0, 100),
            blurAmount: randomInt(0, 100),
            isMonochrome: isMonochrome,
            cropOffsetX: liveActiveState.cropOffsetX,
            cropOffsetY: liveActiveState.cropOffsetY,
            isGrainEnabled: true,
            grainAmount: randomInt(0, 100),
            grainSize: randomInt(0, 100),
            ior: ior,
            similaritySensitivity: similaritySensitivity,
            isBackgroundBlurEnabled: ior >= 36 ? randomBool() : false,
            lowerLimit: lowerLimit,
            isMarkerEnabled: isMarkerEnabled,
        };

        setGlassDotsSettings(s => ({
            ...s,
            [wallpaperType]: newSettings
        }));
    };

    const PresetsGrid = () => (
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
            <div className="grid grid-cols-3 gap-3">
                {PRESETS_DATA.map((preset) => (
                    <button
                        key={preset.id}
                        onClick={() => handlePresetClick(preset)}
                        onMouseEnter={() => handlePresetMouseEnter(preset.id)}
                        onMouseLeave={handlePresetMouseLeave}
                        className={`relative aspect-[4/3] flex flex-col items-center justify-center rounded-md border transition-colors duration-200 ${activePresetId === preset.id
                            ? (theme === 'dark' ? 'bg-white border-white text-nothing-dark' : 'bg-black border-black text-white')
                            : (theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-nothing-light' : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-day-text')
                            }`}
                    >
                        <span className="text-2xl sm:text-3xl font-ndot mb-1">{preset.id}</span>
                        <span className="text-xs font-bold tracking-wider">{preset.code}</span>
                        {tooltipPresetId === preset.id && (
                            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap z-10 pointer-events-none shadow-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-white'}`}>
                                {preset.label}
                            </div>
                        )}
                    </button>
                ))}
                {/* Empty spacer for grid layout to center 0 */}
                <div></div>
                {/* Shuffle Button (Slot 0) */}
                <button
                    onClick={handleShuffle}
                    onMouseEnter={() => handlePresetMouseEnter(0)}
                    onMouseLeave={handlePresetMouseLeave}
                    className={`relative aspect-[4/3] flex flex-col items-center justify-center rounded-md border transition-colors duration-[250ms] ease-out ${isShuffling
                        ? (theme === 'dark' ? 'bg-white border-white text-nothing-dark' : 'bg-black border-black text-white')
                        : (theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-nothing-light' : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-day-text')
                        }`}
                >
                    <span className="text-2xl sm:text-3xl font-ndot mb-1">0</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 3 21 3 21 8"></polyline>
                        <line x1="4" y1="20" x2="21" y2="3"></line>
                        <polyline points="21 16 21 21 16 21"></polyline>
                        <line x1="15" y1="15" x2="21" y2="21"></line>
                        <line x1="4" y1="4" x2="9" y2="9"></line>
                    </svg>
                    {tooltipPresetId === 0 && (
                        <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap z-10 pointer-events-none shadow-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-white'}`}>
                            Randomize
                        </div>
                    )}
                </button>
                {/* Empty spacer */}
                <div></div>
            </div>
        </div>
    );

    const ManualControls = () => (
        <>
            <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                <EnhancedSlider theme={theme} isMobile={isMobile} label="Resolution" value={liveActiveState.resolution} onChange={v => updateLiveSetting('resolution', v)} onChangeCommitted={v => commitSetting('resolution', v)} onReset={() => commitSetting('resolution', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
                <EnhancedSlider theme={theme} isMobile={isMobile} label="Pixel Gap" value={liveActiveState.pixelGap} onChange={v => updateLiveSetting('pixelGap', v)} onChangeCommitted={v => commitSetting('pixelGap', v)} onReset={() => commitSetting('pixelGap', 50)} disabled={isLoading} />
                <EnhancedSlider theme={theme} isMobile={isMobile} label="Lower Limit" value={liveActiveState.lowerLimit} onChange={v => updateLiveSetting('lowerLimit', v)} onChangeCommitted={v => commitSetting('lowerLimit', v)} onReset={() => commitSetting('lowerLimit', 0)} disabled={isLoading} />
                <EnhancedSlider theme={theme} isMobile={isMobile} label="Size Variance" value={liveActiveState.similaritySensitivity} onChange={v => updateLiveSetting('similaritySensitivity', v)} onChangeCommitted={v => commitSetting('similaritySensitivity', v)} onReset={() => commitSetting('similaritySensitivity', 50)} disabled={isLoading} />
            </div>

            <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                <EnhancedSlider theme={theme} isMobile={isMobile} label="Glass Blur Amount" value={liveActiveState.blurAmount} onChange={v => updateLiveSetting('blurAmount', v)} onChangeCommitted={v => commitSetting('blurAmount', v)} onReset={() => commitSetting('blurAmount', 50)} disabled={isLoading} />
                <EnhancedSlider theme={theme} isMobile={isMobile} label="Index of Refraction" value={liveActiveState.ior} onChange={v => updateLiveSetting('ior', v)} onChangeCommitted={v => commitSetting('ior', v)} onReset={() => commitSetting('ior', 50)} disabled={isLoading} />
            </div>

            <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`grain-toggle-${isFullScreenPreview}`} className="text-sm">Grain</label><button id={`grain-toggle-${isFullScreenPreview}`} role="switch" aria-checked={liveActiveState.isGrainEnabled} onClick={() => commitToggle('isGrainEnabled', !liveActiveState.isGrainEnabled)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isGrainEnabled ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isGrainEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${liveActiveState.isGrainEnabled ? 'max-h-96 opacity-100 pt-4 space-y-4' : 'max-h-0 opacity-0'}`}>
                    <EnhancedSlider theme={theme} isMobile={isMobile} label="Grain Size" value={liveActiveState.grainSize} onChange={v => updateLiveSetting('grainSize', v)} onChangeCommitted={v => commitSetting('grainSize', v)} onReset={() => commitSetting('grainSize', 0)} disabled={isLoading} />
                    <EnhancedSlider theme={theme} isMobile={isMobile} label="Grain Amount" value={liveActiveState.grainAmount} onChange={v => updateLiveSetting('grainAmount', v)} onChangeCommitted={v => commitSetting('grainAmount', v)} onReset={() => commitSetting('grainAmount', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
                </div>
            </div>

            <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`marker-toggle-${isFullScreenPreview}`} className="text-sm">Markers</label><button id={`marker-toggle-${isFullScreenPreview}`} role="switch" aria-checked={liveActiveState.isMarkerEnabled} onClick={() => commitToggle('isMarkerEnabled', !liveActiveState.isMarkerEnabled)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isMarkerEnabled ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isMarkerEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`bg-blur-toggle-${isFullScreenPreview}`} className="text-sm">Background Blur</label><button id={`bg-blur-toggle-${isFullScreenPreview}`} role="switch" aria-checked={liveActiveState.isBackgroundBlurEnabled} onClick={() => commitToggle('isBackgroundBlurEnabled', !liveActiveState.isBackgroundBlurEnabled)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isBackgroundBlurEnabled ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isBackgroundBlurEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
                <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`mono-toggle-${isFullScreenPreview}`} className="text-sm">Monochrome</label><button id={`mono-toggle-${isFullScreenPreview}`} role="switch" aria-checked={liveActiveState.isMonochrome} onClick={() => commitToggle('isMonochrome', !liveActiveState.isMonochrome)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isMonochrome ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isMonochrome ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
            </div>
        </>
    );

    const AllControls = ({ isFullScreen = false }: { isFullScreen?: boolean }) => (
        <>
            <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                <SegmentedControl options={wallpaperTypeOptions} selected={wallpaperType} onSelect={(key) => handleDeviceTypeChange(key as 'phone' | 'desktop')} theme={theme} />
                <SegmentedControl options={viewModeOptions} selected={viewMode} onSelect={(key) => handleViewModeChange(key as 'presets' | 'controls')} theme={theme} />
            </div>

            {viewMode === 'controls' && !isFullScreen && (
                <div className={`rounded-lg text-sm overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'bg-black/40 text-nothing-gray-light' : 'bg-white/60 text-day-gray-dark'}`}>
                    <button
                        onClick={() => setIsWarningExpanded(!isWarningExpanded)}
                        className="w-full p-4 flex items-center justify-between focus:outline-none"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                            stroke="currentColor"
                            className={`w-4 h-4 transition-transform duration-300 ${isWarningExpanded ? 'rotate-180' : ''}`}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>
                    <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isWarningExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                            <div className="px-4 pb-4">
                                {isMobile
                                    ? "Due to the feature's performance-intensive nature, there can be some unexpected hiccups in the Full Control mode. The sliders won't slide, so tap on the sliders instead of sliding."
                                    : "Due to the feature's performance-intensive nature, the sliders won't slide. So tap on the sliders instead of sliding."
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPerformanceWarning && !hasDismissedPerformanceWarning && imageSrc && viewMode === 'presets' && (
                 <div className={`p-3 rounded-lg flex items-start space-x-3 text-sm transition-opacity duration-300 ${theme === 'dark' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`}>
                    <div className="flex-shrink-0 text-yellow-500 pt-0.5">
                        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 15a1 1 0 110-2 1 1 0 010 2zm0-3a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-grow">
                        <p className={`font-semibold ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-900'}`}>Performance Notice</p>
                        <p className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                            {isMobile
                                ? "For a smoother experience on mobile, using a Chromium-based browser is recommended (e.g. Chrome)."
                                : "For a smoother experience on desktop, using a firefox-based browser is recommended."
                            }
                        </p>
                    </div>
                    <button onClick={() => { trackEvent('glass_dots_performance_warning_dismissed'); setHasDismissedPerformanceWarning(true); }} className={`p-1 -m-1 rounded-full ${theme === 'dark' ? 'text-yellow-300 hover:bg-white/10' : 'text-yellow-800 hover:bg-black/10'}`} aria-label="Dismiss">
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
            
            <UndoRedoControls onUndo={() => { undoGlassDots(); trackEvent('glass_dots_undo'); }} onRedo={() => { redoGlassDots(); trackEvent('glass_dots_redo'); }} canUndo={canUndoGlassDots} canRedo={canRedoGlassDots} theme={theme} />

            {viewMode === 'presets' ? <PresetsGrid /> : <ManualControls />}
        </>
    );

    const controlsPanel = imageSrc ? (
        <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
            <AllControls />
            <div className="pt-2 flex space-x-2">
                <button onClick={clearImage} disabled={isLoading} className={`${viewMode === 'controls' ? 'w-1/2' : 'w-full'} border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Clear the current image">Clear Image</button>
                {viewMode === 'controls' && (
                    <button onClick={handleResetCurrent} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset controls to their default values">Reset Controls</button>
                )}
            </div>
            <div className="block md:hidden pt-8"><footer className="text-center tracking-wide">{footerLinks}</footer></div>
        </div>
    ) : null;

    const previewPanel = !imageSrc ? (
        <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} context="glassDots" isMobile={isMobile} />
    ) : (
        <>
            <input type="file" ref={fullScreenFileInputRef} onChange={handleFullScreenFileInputChange} className="hidden" accept="image/*" />
            <div className="relative flex items-center justify-center w-full h-full">
                <canvas ref={canvasRef} width={previewCanvasWidth} height={previewCanvasHeight} className={`border-2 rounded-lg ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} ${wallpaperType === 'phone' ? (isMobile ? 'w-4/5 h-auto' : 'max-h-full w-auto') : 'max-w-full max-h-full'}`} aria-label="Glass Dots Canvas" onMouseDown={handleDragStart} onTouchStart={handleDragStart} style={{ cursor: glassDotsCropIsNeeded ? 'grab' : 'default', touchAction: glassDotsCropIsNeeded ? 'none' : 'auto' }} />
                <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-2">
                    <button onClick={() => handleShare()} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Share this creation"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z" /></svg></button>
                    <button onClick={enterFullScreen} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Enter full-screen preview"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg></button>
                </div>
            </div>
            {isFullScreenPreview && createPortal(<div ref={fullScreenContainerRef} className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget && !dragState.current.hasMoved) { if (isFullScreenControlsOpen) setIsFullScreenControlsOpen(false); else exitFullScreen(); } }}>
                <canvas ref={fullScreenCanvasRef} width={previewCanvasWidth} height={previewCanvasHeight} className="max-w-full max-h-full" aria-label="Full-screen Canvas Preview" onMouseDown={handleDragStart} onTouchStart={handleDragStart} style={{ cursor: glassDotsCropIsNeeded ? 'grab' : 'default', touchAction: glassDotsCropIsNeeded ? 'none' : 'auto' }} />
                {glassDotsCropIsNeeded && <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-2 py-1 rounded-md text-sm ${theme === 'dark' ? 'bg-nothing-dark/90 text-nothing-light' : 'bg-day-gray-light/90 text-day-text'} backdrop-blur-sm pointer-events-none`}>ⓘ Drag to Crop</div>}
                {!isMobile && <div className="fixed bottom-4 left-4 z-[51] w-80 flex flex-col items-start space-y-2">
                    {isFullScreenControlsOpen ? <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-4 max-h-[calc(100vh-10rem)] flex flex-col space-y-4 shadow-2xl`}>
                        <div className="flex justify-between items-center flex-shrink-0"><h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-day-text'}`}>Controls</h3><button onClick={() => setIsFullScreenControlsOpen(false)} className={`p-2 ${theme === 'dark' ? 'text-white hover:bg-white/20' : 'text-day-text hover:bg-black/10'} rounded-full transition-colors`} aria-label="Collapse controls"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" /></svg></button></div>
                        <div className="overflow-y-auto space-y-4 pr-2 -mr-2">
                            <AllControls isFullScreen />
                            <div>
                                {viewMode === 'controls' && (
                                    <button onClick={handleResetCurrent} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset controls to their default values">
                                        Reset Controls
                                    </button>
                                )}
                            </div>
                        </div>
                    </div> : <button onClick={() => setIsFullScreenControlsOpen(true)} className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80 text-white hover:bg-nothing-dark' : 'bg-day-bg/90 text-day-text hover:bg-day-gray-light border border-gray-300/50'} backdrop-blur-sm font-semibold py-3 px-4 rounded-lg flex items-center justify-between shadow-lg transition-colors`} aria-label="Expand controls"><span>Controls</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z" /></svg></button>}
                    <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-2 flex flex-col items-stretch space-y-2 shadow-lg`}>
                        <button onClick={handleFullScreenReplaceClick} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Replace image">Replace Image</button>
                        <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download image">{isDownloading ? 'Generating...' : 'Download'}</button>
                    </div>
                </div>}
                <div className="fixed bottom-8 right-8 z-50 flex items-center space-x-2">
                    <button onClick={() => handleShare()} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Share creation"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z" /></svg></button>
                    <button onClick={exitFullScreen} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Exit full-screen"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg></button>
                </div>
                <ToastNotification show={showFsToast} onClose={() => setShowFsToast(false)} onShare={() => { }} theme={theme} isMobile={false} imageRendered={!!imageSrc} className="z-[60] !bottom-24" />
                <SharePopup show={showSharePopup} onClose={() => setShowSharePopup(false)} theme={theme} communityLink={communityLink} appUrl={appUrl} variant={shareVariant} />
            </div>, document.body)}
        </>
    );

    const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download image">{isDownloading ? 'Generating...' : 'Download'}</button>;
    const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme} isMobile={isMobile} />;

    return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, downloadButton, replaceButton, glassDotsWallpaperType: wallpaperType, getCanvasBlob, undo: undoGlassDots, redo: redoGlassDots, canUndo: canUndoGlassDots, canRedo: canRedoGlassDots };
};
