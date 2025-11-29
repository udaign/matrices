

// FIX: Import React to use types like React.SetStateAction
import React, { useState, useCallback } from 'react';
import { trackEvent } from './analytics';
import { getTimestamp } from './utils';

export const useHistory = <T,>(initialState: T) => {
    const [history, setHistory] = useState<T[]>([initialState]);
    const [index, setIndex] = useState(0);

    const setState = useCallback((action: React.SetStateAction<T>) => {
        const resolvedState = typeof action === 'function' 
            ? (action as (prevState: T) => T)(history[index]) 
            : action;

        if (JSON.stringify(resolvedState) === JSON.stringify(history[index])) {
            return;
        }
        
        const newHistory = history.slice(0, index + 1);
        newHistory.push(resolvedState);
        setHistory(newHistory);
        setIndex(newHistory.length - 1);
    }, [history, index]);

    const undo = useCallback(() => {
        if (index > 0) {
            setIndex(index - 1);
        }
    }, [index]);

    const redo = useCallback(() => {
        if (index < history.length - 1) {
            setIndex(index + 1);
        }
    }, [index, history.length]);
    
    const reset = useCallback((overrideState?: Partial<T>) => {
        const newState = { ...initialState, ...overrideState };
        const newHistory = history.slice(0, index + 1);
        newHistory.push(newState);
        setHistory(newHistory);
        setIndex(newHistory.length - 1);
    }, [initialState, history, index]);

    const resetHistory = useCallback((newState: T) => {
        setHistory([newState]);
        setIndex(0);
    }, []);

    return {
        state: history[index],
        setState,
        undo,
        redo,
        reset,
        resetHistory,
        canUndo: index > 0,
        canRedo: index < history.length - 1,
    };
};

interface UseImageHandlerProps {
  featureName: string;
  onFileSelectCallback: () => void;
  triggerShareToast: (showSpecificToast?: () => void, isSpecial?: boolean) => void;
}

export const useImageHandler = ({ featureName, onFileSelectCallback, triggerShareToast }: UseImageHandlerProps) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [uploadTimestamp, setUploadTimestamp] = useState<number | null>(null);

    const handleFileSelect = useCallback((file: File, method: 'drag_drop' | 'click' | 'paste' | 'share_target') => {
        setIsLoading(true);
        trackEvent('upload_image', { feature: featureName, method });
        const reader = new FileReader();
        reader.onload = (e) => {
            const resultSrc = e.target?.result as string;
            setImageSrc(resultSrc);
            setUploadTimestamp(Date.now());
            
            const img = new Image();
            img.onload = () => {
                setImage(img);
                setIsLoading(false);
                onFileSelectCallback();
            };
            img.onerror = () => {
                trackEvent('upload_error', { feature: featureName, reason: 'image_load_fail' });
                setImageSrc(null);
                setImage(null);
                setIsLoading(false);
            };
            img.src = resultSrc;
        };
        reader.readAsDataURL(file);
    }, [featureName, onFileSelectCallback]);

    const handleDownload = useCallback(async (
        getCanvasBlob: () => Promise<Blob | null>,
        filename: string,
        analyticsParams: Record<string, any>,
        onSuccess?: () => void,
        options?: { extension?: string }
    ) => {
        if (isDownloading) return;
        setIsDownloading(true);

        try {
            const startTime = performance.now();
            const blob = await getCanvasBlob();
            const endTime = performance.now();
            
            const generationTimeMs = Math.round(endTime - startTime);

            const eventParams = { ...analyticsParams };
            if (uploadTimestamp) {
                const durationInSeconds = Math.round((Date.now() - uploadTimestamp) / 1000);
                eventParams.duration_seconds = durationInSeconds;
            }
            eventParams.generation_time_ms = generationTimeMs;

            trackEvent('download', eventParams);

            if (generationTimeMs > 2000) {
                trackEvent('slow_download', eventParams);
            }

            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const extension = options?.extension || 'png';
                link.download = `${filename}-${getTimestamp()}.${extension}`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                if (onSuccess) {
                    onSuccess();
                } else {
                    triggerShareToast();
                }
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`Error preparing ${featureName} for download:`, e);
            trackEvent('download_error', { feature: featureName, error: errorMessage });
        } finally {
            setIsDownloading(false);
        }
    }, [isDownloading, uploadTimestamp, featureName, triggerShareToast]);

    const clearImage = useCallback(() => {
        trackEvent('clear_image', { feature: featureName });
        setImageSrc(null);
        setImage(null);
        setUploadTimestamp(null);
        onFileSelectCallback();
    }, [featureName, onFileSelectCallback]);

    return {
        imageSrc,
        image,
        isLoading,
        isDownloading,
        handleFileSelect,
        handleDownload,
        clearImage,
    };
};
