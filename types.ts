
export type RawPixel = number | { r: number; g: number; b: number };
export type Theme = 'light' | 'dark';
export type Tab = 'pfp' | 'wallpaper' | 'photoWidget' | 'valueAliasing' | 'glassDots';

// PFP
export type PfpState = {
    resolution: number;
    exposure: number;
    contrast: number;
    pixelGap: number;
    isCircular: boolean;
    isTransparent: boolean;
    isAntiAliased: boolean;
    isGlowEnabled: boolean;
    glowIntensity: number;
    cropOffsetX: number;
    cropOffsetY: number;
};

// Wallpaper
export const WALLPAPER_BG_OPTIONS = {
    'black': { color: '#000000', name: 'Black BG' },
    'white': { color: '#FFFFFF', name: 'White BG' },
};
export type WallpaperBgKey = keyof typeof WALLPAPER_BG_OPTIONS;

export type WallpaperState = {
    resolution: number;
    pixelGap: number;
    background: WallpaperBgKey;
    cropOffsetX: number;
    cropOffsetY: number;
    isMonochrome: boolean;
};

// Photo Widget
export type PhotoWidgetOutputMode = 'transparent' | 'dark' | 'light';

export type PhotoWidgetState = {
    resolution: number;
    pixelGap: number;
    isCircular: boolean;
    isAntiAliased: boolean;
};

export type PhotoWidgetSettingsContainer = {
    [key in PhotoWidgetOutputMode]: PhotoWidgetState;
};

export type PhotoWidgetColorMatrix = ({ r: number; g: number; b: number; a: number; } | null)[][];

// Value Aliasing
export type ValueAliasingState = {
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
};

export type PrintState = ValueAliasingState & {
    size: string;
    orientation: 'landscape' | 'portrait';
};

export type ValueAliasingSettingsContainer = {
    outputType: 'wallpaper' | 'print';
    wallpaper: {
        phone: ValueAliasingState;
        desktop: ValueAliasingState;
    };
    print: PrintState;
};

// Glass Dots
export type GlassDotsState = {
    resolution: number;
    pixelGap: number;
    blurAmount: number;
    isMonochrome: boolean;
    cropOffsetX: number;
    cropOffsetY: number;
    isGrainEnabled: boolean;
    grainAmount: number;
    grainSize: number;
    ior: number;
    similaritySensitivity: number;
    isBackgroundBlurEnabled: boolean;
    lowerLimit: number;
    isMarkerEnabled: boolean;
};

export type GlassDotsSettingsContainer = {
    phone: GlassDotsState;
    desktop: GlassDotsState;
};
