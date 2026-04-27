import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload, Play, Pause, Monitor, Maximize, GripHorizontal, CheckCircle2,
  XCircle, Trash2, Plus, Type, Italic, FileVideo, Download, X, Settings, Settings2,
  Image as ImageIcon, Move, Info, AlertCircle, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Eye, EyeOff, Link2, GripVertical, ChevronUp, ChevronDown, Volume2, VolumeX
} from 'lucide-react';
import * as Bridge from './tauri-bridge';

// --- Asset URL Hook ---
// Resolves URLs for compliance icons and safezone images. In Tauri this
// uses convertFileSrc against the writable asset folder so files added at
// runtime work; in web/dev it falls back to /compliance/* and /safezones/*.
function useAssetUrls() {
  const [urls, setUrls] = useState({ compliance: {}, safezones: {} });
  const [version, setVersion] = useState(0);

  const refresh = React.useCallback(async () => {
    const [comp, safe] = await Promise.all([
      Bridge.getComplianceFiles().catch(() => []),
      Bridge.getSafezoneFiles().catch(() => []),
    ]);
    const buildMap = async (kind, files) => {
      const entries = await Promise.all(
        files.map(async (f) => [f, await Bridge.getAssetUrl(kind, f)])
      );
      return Object.fromEntries(entries);
    };
    const [compMap, safeMap] = await Promise.all([
      buildMap('compliance', comp),
      buildMap('safezones', safe),
    ]);
    setUrls({ compliance: compMap, safezones: safeMap });
  }, []);

  useEffect(() => { refresh(); }, [refresh, version]);

  const resolve = React.useCallback(
    (kind, filename) => urls[kind]?.[filename] || (Bridge.isTauri ? '' : `/${kind}/${filename}`),
    [urls]
  );

  return { urls, resolve, refresh, bumpVersion: () => setVersion(v => v + 1) };
}

// --- Config Hook ---
function useConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Bridge.loadConfig()
      .then(data => { setConfig(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const saveConfig = async (newConfig) => {
    await Bridge.persistConfig(newConfig);
    setConfig(newConfig);
  };

  return { config, loading, error, saveConfig };
}

// --- Constants & Data Models ---

const RESIZE_MODES = [
  { id: 'crop', name: 'Crop', desc: 'Fill frame, crop edges', icon: Maximize },
  { id: 'blur', name: 'Blur', desc: 'Blurred bg behind', icon: ImageIcon },
  { id: 'black', name: 'Letterbox', desc: 'Black bars', icon: Monitor },
  { id: 'manual', name: 'Manual', desc: 'Pan and zoom', icon: Move },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

// Reusable Color Input Component with Integrated Alpha Slider
const ColorInput = ({ label, value, onChange }) => {
  const hexColor = (value?.startsWith('#') && value.length >= 7) ? value.substring(0, 7) : '#000000';
  const alphaHex = (value?.startsWith('#') && value.length === 9) ? value.substring(7, 9) : 'ff';
  const alphaPerc = Math.round((parseInt(alphaHex, 16) / 255) * 100);

  const handleColorChange = (newHex) => {
    onChange(newHex + alphaHex);
  };

  const handleAlphaChange = (newAlphaPerc) => {
    const aHex = Math.round((newAlphaPerc / 100) * 255).toString(16).padStart(2, '0');
    onChange(hexColor + aHex);
  };

  return (
    <div className="flex items-center gap-2 bg-ink-900 border border-white/[0.08] rounded p-1">
      <div className="w-16 shrink-0 text-[10px] text-ink-400 font-medium pl-1 truncate leading-none">{label}</div>
      <div className="relative w-5 h-5 rounded overflow-hidden border border-white/[0.08] shrink-0 shadow-inner">
        <div className="absolute inset-0 bg-checkerboard"></div>
        <div className="absolute inset-0" style={{ backgroundColor: value }}></div>
        <input
          type="color"
          value={hexColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={alphaPerc}
        onChange={(e) => handleAlphaChange(parseInt(e.target.value))}
        className="w-[50px] shrink-0 slim opacity-60 hover:opacity-100 transition-opacity"
        title="Opacity"
      />
      <span className="text-[9px] text-ink-500 font-mono ml-auto pr-1 tabular-nums">{alphaPerc}%</span>
    </div>
  );
};

// --- Shared Number Input Component ---
const NumberInput = ({ value, onChange, min, max, step = 1, className = '', containerClassName = '' }) => {
  const numStep = parseFloat(step) || 1;
  const numMin = min !== undefined ? parseFloat(min) : undefined;
  const numMax = max !== undefined ? parseFloat(max) : undefined;

  const handleInc = () => {
    let nv = (parseFloat(value) || 0) + numStep;
    if (nv % 1 !== 0) nv = parseFloat(nv.toPrecision(12));
    if (numMax !== undefined) nv = Math.min(nv, numMax);
    onChange(nv);
  };
  const handleDec = () => {
    let nv = (parseFloat(value) || 0) - numStep;
    if (nv % 1 !== 0) nv = parseFloat(nv.toPrecision(12));
    if (numMin !== undefined) nv = Math.max(nv, numMin);
    onChange(nv);
  };
  return (
    <div className={`flex bg-ink-900 border border-white/[0.08] rounded overflow-hidden focus-within:border-white/[0.2] focus-within:ring-1 focus-within:ring-white/[0.1] transition-colors ${containerClassName}`}>
      <input
        type="number"
        value={value}
        placeholder="0"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        className={`flex-1 min-w-0 bg-transparent text-white outline-none w-full appearance-none min-h-0 text-[12px] px-2 !pr-0 ${className}`}
      />
      <div className="flex flex-col border-l border-white/[0.08] bg-ink-850 shrink-0 w-5">
        <button tabIndex="-1" onClick={handleInc} className="flex-1 flex items-center justify-center text-ink-400 hover:text-ink-50 hover:bg-white/[0.05] transition-colors"><ChevronUp size={10} strokeWidth={2.5} /></button>
        <div className="h-px w-full bg-white/[0.04]" />
        <button tabIndex="-1" onClick={handleDec} className="flex-1 flex items-center justify-center text-ink-400 hover:text-ink-50 hover:bg-white/[0.05] transition-colors"><ChevronDown size={10} strokeWidth={2.5} /></button>
      </div>
    </div>
  );
};

// Normalise padding: legacy number → object
const normPad = (p) =>
  (!p || typeof p === 'number')
    ? { top: p || 0, right: p || 0, bottom: p || 0, left: p || 0, linked: true }
    : p;

const PaddingInput = ({ value, onChange }) => {
  const pad = normPad(value);
  const lbl = 'text-[10px] text-ink-500 select-none';

  const update = (field, n) => {
    onChange(pad.linked ? { ...pad, top: n, right: n, bottom: n, left: n } : { ...pad, [field]: n });
  };

  const toggleLink = () => onChange({ ...pad, linked: !pad.linked });

  if (pad.linked) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLink}
          className="shrink-0 p-1.5 rounded border transition-colors bg-accent-bg border-accent-ring/50 text-accent-soft"
          title="Unlink sides"
        ><Link2 size={13} /></button>
        <div className="relative flex-1">
          <NumberInput min="0" step="0.5" value={pad.top} onChange={v => update('top', v)} containerClassName="h-7 w-full shadow-sm" />
          <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[9px] text-ink-500 pointer-events-none">all</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-1">
      {/* Top */}
      <div className="flex flex-col items-center gap-0.5">
        <span className={lbl}>Top</span>
        <NumberInput min="0" step="0.5" value={pad.top} onChange={v => update('top', v)} containerClassName="h-6 w-16" />
      </div>

      {/* Left · link · Right */}
      <div className="flex items-center justify-center gap-1.5">
        <span className={`${lbl} w-6 text-right shrink-0`}>Left</span>
        <NumberInput min="0" step="0.5" value={pad.left} onChange={v => update('left', v)} containerClassName="h-6 w-16" />
        <button
          onClick={toggleLink}
          className="shrink-0 p-1 rounded border transition-colors bg-ink-850 border-white/[0.08] text-ink-500 hover:text-ink-100"
          title="Link all sides"
        ><Link2 size={12} /></button>
        <NumberInput min="0" step="0.5" value={pad.right} onChange={v => update('right', v)} containerClassName="h-6 w-16" />
        <span className={`${lbl} w-6 shrink-0`}>Right</span>
      </div>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-0.5">
        <NumberInput min="0" step="0.5" value={pad.bottom} onChange={v => update('bottom', v)} containerClassName="h-6 w-16" />
        <span className={lbl}>Bottom</span>
      </div>
    </div>
  );
};

// CSS Mapper for Alignment Options
const getAlignStyles = (align) => {
  switch (align) {
    case 'justify-left': return { textAlign: 'justify', textAlignLast: 'left' };
    case 'justify-center': return { textAlign: 'justify', textAlignLast: 'center' };
    case 'justify-right': return { textAlign: 'justify', textAlignLast: 'right' };
    default: return { textAlign: align || 'center', textAlignLast: 'auto' };
  }
};

// --- Canvas-based overlay rendering (shared by video and image exports) ---
const preloadIcons = (icons) => Promise.all(icons.map(icon => new Promise((resolveIcon) => {
  const img = new Image();
  img.onload = () => resolveIcon({ ...icon, imgElement: img });
  img.onerror = () => {
    console.warn(`Failed to load icon for export: ${icon.url}`);
    resolveIcon({ ...icon, imgElement: null });
  };
  img.src = icon.url;
})));

const drawOverlays = (ctx, cW, cH, texts, loadedIcons) => {
  texts.forEach(text => {
    const x = (text.x / 100) * cW;
    const y = (text.y / 100) * cH;
    const w = (text.width / 100) * cW;
    const h = (text.height / 100) * cH;
    const px = cW * (text.fontSize / 100);

    const bgColor = text.bgColor || 'transparent';
    if (bgColor !== 'transparent' && bgColor !== 'rgba(0,0,0,0)' && bgColor !== '#00000000') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, w, h);
    }

    ctx.fillStyle = text.color || '#ffffff';
    ctx.font = `${text.isItalic ? 'italic ' : ''}${text.fontWeight || '500'} ${px}px ${text.fontFamily || 'Arial, sans-serif'}`;
    ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = `${(text.letterSpacing || 0) / 10}em`;
    }

    const p = normPad(text.padding);
    const padTop    = cW * (p.top    / 100);
    const padRight  = cW * (p.right  / 100);
    const padBottom = cW * (p.bottom / 100);
    const padLeft   = cW * (p.left   / 100);

    const textW = w - (padLeft + padRight);
    const textStartX = x + padLeft;
    let currentY = y + padTop;

    if (text.shadow === 'drop') {
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = px * 0.2;
      ctx.shadowOffsetX = px * 0.1;
      ctx.shadowOffsetY = px * 0.1;
    } else if (text.shadow === 'outline') {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = px * 0.15;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'transparent';
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    const drawShadowText = (word, wx, wy) => {
      if (text.shadow === 'outline') ctx.strokeText(word, wx, wy);
      ctx.fillText(word, wx, wy);
    };

    const hardLines = text.text.split('\n');
    const lineHeight = px * (text.lineHeight || 1.2);

    hardLines.forEach(hardLine => {
      if (hardLine === '') {
        currentY += lineHeight;
        return;
      }

      const words = hardLine.split(' ');
      let lineWords = [];
      let currentLineWidth = 0;

      const drawLine = (wordsToDraw, isLastLineOfParagraph) => {
        if (wordsToDraw.length === 0) return;

        let actualAlign = text.align || 'center';
        const isJustify = actualAlign.startsWith('justify');

        if (isJustify) {
          if (isLastLineOfParagraph) {
            if (actualAlign === 'justify-left') actualAlign = 'left';
            else if (actualAlign === 'justify-center') actualAlign = 'center';
            else if (actualAlign === 'justify-right') actualAlign = 'right';
            else actualAlign = 'left';
          } else {
            actualAlign = 'justify';
          }
        }

        ctx.textAlign = 'left';
        const spaceWidth = ctx.measureText(' ').width;
        const totalWordsWidth = wordsToDraw.reduce((sum, word) => sum + ctx.measureText(word).width, 0);

        if (actualAlign === 'justify' && wordsToDraw.length > 1) {
          const totalSpace = textW - totalWordsWidth;
          const spaceBetween = totalSpace / (wordsToDraw.length - 1);
          let currentX = textStartX;
          wordsToDraw.forEach((word) => {
            drawShadowText(word, currentX, currentY);
            currentX += ctx.measureText(word).width + spaceBetween;
          });
        } else {
          let currentX = textStartX;
          const normalWidth = totalWordsWidth + spaceWidth * (wordsToDraw.length - 1);

          if (actualAlign === 'center') currentX = textStartX + (textW - normalWidth) / 2;
          else if (actualAlign === 'right') currentX = textStartX + textW - normalWidth;

          wordsToDraw.forEach(word => {
            drawShadowText(word, currentX, currentY);
            currentX += ctx.measureText(word).width + spaceWidth;
          });
        }
        currentY += lineHeight;
      };

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordWidth = ctx.measureText(word).width;
        const spaceWidth = ctx.measureText(' ').width;
        const widthWithWord = currentLineWidth + (lineWords.length > 0 ? spaceWidth : 0) + wordWidth;

        if (widthWithWord > textW && lineWords.length > 0) {
          drawLine(lineWords, false);
          lineWords = [word];
          currentLineWidth = wordWidth;
        } else {
          lineWords.push(word);
          currentLineWidth = widthWithWord;
        }
      }
      drawLine(lineWords, true);
    });

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  });

  loadedIcons.forEach(iconObj => {
    if (!iconObj.imgElement) return;
    const img = iconObj.imgElement;
    const x = (iconObj.x / 100) * cW;
    const y = (iconObj.y / 100) * cH;
    const w = (iconObj.width / 100) * cW;

    const imgW = img.naturalWidth || img.width || 100;
    const imgH = img.naturalHeight || img.height || 100;
    const h = w * (imgH / imgW);

    ctx.globalAlpha = (iconObj.opacity !== undefined ? iconObj.opacity : 100) / 100;
    ctx.drawImage(img, x, y, w, h);
    ctx.globalAlpha = 1.0;
  });
};

// Draws a source (video frame or image) onto ctx using the given fit mode.
const drawMediaFit = (ctx, source, sW, sH, cW, cH, mode, manualXform) => {
  const ratioW = cW / sW;
  const ratioH = cH / sH;

  if (mode === 'blur') {
    const scale = Math.max(ratioW, ratioH);
    const dw = sW * scale, dh = sH * scale;
    ctx.filter = 'blur(30px)';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(source, (cW - dw) / 2, (cH - dh) / 2, dw, dh);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
  }

  if (mode === 'manual') {
    const mx = manualXform || { scale: 1, offsetX: 0, offsetY: 0, blur: true };
    if (mx.blur) {
      const blurScale = Math.max(ratioW, ratioH);
      ctx.filter = 'blur(30px)';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(source, (cW - sW * blurScale) / 2, (cH - sH * blurScale) / 2, sW * blurScale, sH * blurScale);
      ctx.filter = 'none';
      ctx.globalAlpha = 1.0;
    }
    const containScale = Math.min(ratioW, ratioH) * mx.scale;
    const dw = sW * containScale, dh = sH * containScale;
    const dx = (cW - dw) / 2 + mx.offsetX * cW;
    const dy = (cH - dh) / 2 + mx.offsetY * cH;
    ctx.drawImage(source, dx, dy, dw, dh);
  } else {
    const scale = mode === 'crop' ? Math.max(ratioW, ratioH) : Math.min(ratioW, ratioH);
    const dw = sW * scale, dh = sH * scale;
    const dx = (cW - dw) / 2, dy = (cH - dh) / 2;
    ctx.drawImage(source, dx, dy, dw, dh);
  }
};

const encodeStaticImage = async (imageData, template, mode, texts, icons, manualXform, imageExport) => {
  const loadedIcons = await preloadIcons(icons);

  const source = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = imageData.url;
  });

  const format = imageExport?.format === 'png' ? 'png' : 'jpg';
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = Math.max(0, Math.min(1, (imageExport?.quality ?? 90) / 100));

  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext('2d');

  if (format !== 'png') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const sW = source.naturalWidth || source.width;
  const sH = source.naturalHeight || source.height;
  drawMediaFit(ctx, source, sW, sH, canvas.width, canvas.height, mode, manualXform);

  drawOverlays(ctx, canvas.width, canvas.height, texts, loadedIcons);

  const blob = await new Promise((res, rej) =>
    canvas.toBlob(
      b => b ? res(b) : rej(new Error('Image export failed')),
      mime,
      format === 'png' ? undefined : quality
    )
  );
  return { blob, extension: format };
};

// --- Main Application ---
export default function WYSIWYGVideoEditor() {
  const { config, loading, saveConfig } = useConfig();
  const assetUrls = useAssetUrls();

  const SOCIAL_TEMPLATES = useMemo(() => config ? config.templates : {}, [config]);
  const COMPLIANCE_ICONS = useMemo(() => config ? config.complianceIcons.map(i => i.filename) : [], [config]);
  const resolveIconUrl = React.useCallback(
    (filename) => assetUrls.resolve('compliance', filename),
    [assetUrls]
  );
  const resolveSafezoneUrl = React.useCallback(
    (filename) => assetUrls.resolve('safezones', filename),
    [assetUrls]
  );

  const [videos, setVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(null);

  // Settings State
  const [resizeMode, setResizeMode] = useState('blur');
  const [selectedTemplateGroup, setSelectedTemplateGroup] = useState('Instagram');
  const [selectedTemplateId, setSelectedTemplateId] = useState('ig-stories');
  const [customSize, setCustomSize] = useState({ width: 1080, height: 1080 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftTab, setLeftTab] = useState('layout');

  // Overlays
  const [textOverlays, setTextOverlays] = useState([]);
  const [iconOverlays, setIconOverlays] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [selectedIconId, setSelectedIconId] = useState(null);

  const [outroFile, setOutroFile] = useState(null);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [manualTransform, setManualTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0, blur: true });
  const dragDropRegistered = useRef(false);

  useEffect(() => { setManualTransform({ scale: 1, offsetX: 0, offsetY: 0, blur: true }); }, [selectedTemplateId]);

  // Render State
  const [renderState, setRenderState] = useState({ isRendering: false, isComplete: false, stats: null });
  const cancelRef = useRef(false);

  // Derived state
  const selectedTemplate = useMemo(() => {
    if (selectedTemplateId === 'custom') return { id: 'custom', name: 'Custom Size', width: customSize.width, height: customSize.height, ratio: 'Custom' };
    for (const group in SOCIAL_TEMPLATES) {
      const found = SOCIAL_TEMPLATES[group].find(t => t.id === selectedTemplateId);
      if (found) return found;
    }
    return SOCIAL_TEMPLATES.Instagram ? SOCIAL_TEMPLATES.Instagram[2] : { id: 'custom', name: 'Custom Size', width: 1080, height: 1080, ratio: 'Custom' };
  }, [selectedTemplateId, customSize, SOCIAL_TEMPLATES]);

  const activeVideo = useMemo(() => videos.find(v => v.id === selectedVideoId) || videos[0] || null, [videos, selectedVideoId]);
  const activeText = useMemo(() => textOverlays.find(t => t.id === selectedTextId) || null, [textOverlays, selectedTextId]);
  const activeIcon = useMemo(() => iconOverlays.find(i => i.id === selectedIconId) || null, [iconOverlays, selectedIconId]);

  // --- Tauri-Specific File Handling ---
  const processTauriPaths = React.useCallback(async (paths) => {
    console.log('[App] Starting ingestion for:', paths);
    const newItems = [];
    
    for (const filePath of paths) {
      try {
        const name = Bridge.getFileName(filePath);
        const type = Bridge.getMediaType(filePath);
        const url = await Bridge.getPreviewUrl(filePath);
        console.log(`[App] Ingesting: ${name} (${type})`);

        const item = await new Promise((resolve) => {
          if (type === 'image') {
            const img = new Image();
            const fallbackTimer = setTimeout(() => {
              resolve({ id: generateId(), filePath, url, name, type: 'image', width: 1920, height: 1080, duration: 0, status: 'queued', progress: 0 });
            }, 2000);
            img.onload = () => {
              clearTimeout(fallbackTimer);
              resolve({ id: generateId(), filePath, url, name, type: 'image', width: img.naturalWidth, height: img.naturalHeight, duration: 0, status: 'queued', progress: 0 });
            };
            img.onerror = () => {
              clearTimeout(fallbackTimer);
              resolve({ id: generateId(), filePath, url, name, type: 'image', width: 1920, height: 1080, duration: 0, status: 'queued', progress: 0 });
            };
            img.src = url;
          } else {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';
            
            const fallbackTimer = setTimeout(() => {
              resolve({ id: generateId(), filePath, url, name, type: 'video', width: 1920, height: 1080, duration: 10, status: 'queued', progress: 0 });
            }, 3000);
            
            video.onloadedmetadata = () => {
              clearTimeout(fallbackTimer);
              resolve({ id: generateId(), filePath, url, name, type: 'video', width: video.videoWidth, height: video.videoHeight, duration: video.duration, status: 'queued', progress: 0 });
            };
            video.onerror = () => {
              clearTimeout(fallbackTimer);
              resolve({ id: generateId(), filePath, url, name, type: 'video', width: 1920, height: 1080, duration: 10, status: 'queued', progress: 0 });
            };
            video.src = url;
            video.load();
          }
        });
        newItems.push(item);
      } catch (err) {
        console.error('[App] Ingestion failed for:', filePath, err);
      }
    }

    console.log('[App] Final items added to queue:', newItems);
    setVideos(prev => [...prev, ...newItems]);
    if (!selectedVideoId && newItems.length > 0) {
      setSelectedVideoId(newItems[0].id);
    }
  }, [selectedVideoId]);

  const handleTauriFileSelect = async () => {
    const paths = await Bridge.pickMediaFiles();
    if (paths && paths.length > 0) processTauriPaths(paths);
  };

  const handleTauriOutroSelect = async () => {
    const path = await Bridge.pickVideoFile();
    if (path) {
      const url = await Bridge.getPreviewUrl(path);
      setOutroFile({ filePath: path, url, name: Bridge.getFileName(path) });
    }
  };

  // Tauri drag-and-drop listener
  useEffect(() => {
    if (!Bridge.isTauri || dragDropRegistered.current) return;
    dragDropRegistered.current = true;
    
    let unlisten;
    console.log('[App] Initializing Native Drag-and-Drop...');
    
    Bridge.setupDragDrop((paths) => {
      console.log('[App] Native drop event caught:', paths);
      const mediaExts = new Set(['mp4','webm','mov','avi','mkv','m4v','flv','jpg','jpeg','png','webp','gif','bmp','svg']);
      const filtered = paths.filter(p => {
        const ext = Bridge.getExtension(p);
        const ok = mediaExts.has(ext);
        console.log(`  > ${p} (${ext}): ${ok ? 'KEEP' : 'SKIP'}`);
        return ok;
      });
      if (filtered.length > 0) processTauriPaths(filtered);
    }).then(fn => { unlisten = fn; });
    
    return () => { if (unlisten) unlisten(); };
  }, [processTauriPaths]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <span className="text-ink-400 text-sm">Loading configuration...</span>
      </div>
    );
  }

  // --- File Handling ---
  const isSupportedMedia = (f) => f.type.startsWith('video/') || f.type.startsWith('image/');

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files).filter(isSupportedMedia);
    if (!files.length) return;
    processNewFiles(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(isSupportedMedia);
    if (!files.length) return;
    processNewFiles(files);
  };

  const processNewFiles = async (files) => {
    const newItems = await Promise.all(files.map(file => new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        const img = new Image();
        const fallback = setTimeout(() => {
          resolve({
            id: generateId(), file, url, name: file.name, type: 'image',
            width: 1920, height: 1080, duration: 0, status: 'queued', progress: 0
          });
        }, 1500);
        img.onload = () => {
          clearTimeout(fallback);
          resolve({
            id: generateId(), file, url, name: file.name, type: 'image',
            width: img.naturalWidth, height: img.naturalHeight, duration: 0,
            status: 'queued', progress: 0
          });
        };
        img.onerror = () => {
          clearTimeout(fallback);
          resolve({
            id: generateId(), file, url, name: file.name, type: 'image',
            width: 1920, height: 1080, duration: 0, status: 'queued', progress: 0
          });
        };
        img.src = url;
        return;
      }

      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";

      const fallbackTimer = setTimeout(() => {
        resolve({
          id: generateId(), file, url, name: file.name, type: 'video',
          width: 1920, height: 1080, duration: 10, status: 'queued', progress: 0
        });
      }, 1500);

      video.onloadedmetadata = () => {
        clearTimeout(fallbackTimer);
        resolve({
          id: generateId(), file, url, name: file.name, type: 'video',
          width: video.videoWidth, height: video.videoHeight, duration: video.duration,
          status: 'queued', progress: 0
        });
      };
      video.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve({
          id: generateId(), file, url, name: file.name, type: 'video',
          width: 1920, height: 1080, duration: 10, status: 'queued', progress: 0
        });
      };
    })));

    setVideos(prev => [...prev, ...newItems]);
    if (!selectedVideoId && newItems.length > 0) {
      setSelectedVideoId(newItems[0].id);
    }
  };



  const handleOutroUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setOutroFile({ file, url: URL.createObjectURL(file), name: file.name });
    }
  };

  // --- Overlay Handling ---
  const addTextOverlay = () => {
    const newText = {
      id: generateId(),
      text: 'New Text',
      x: 30, y: 40, width: 40, height: 10,
      fontSize: 3.5,
      padding: { top: 2, right: 2, bottom: 2, left: 2, linked: true },
      color: '#ffffffff',
      bgColor: '#00000080',
      align: 'center',
      fontWeight: '500',
      isItalic: false,
      fontFamily: 'Arial, sans-serif',
      letterSpacing: 0,
      lineHeight: 1.2,
      shadow: 'none',
      borderRadius: 0
    };
    setTextOverlays([...textOverlays, newText]);
    setSelectedTextId(newText.id);
    setSelectedIconId(null);
  };

  const updateTextOverlay = (id, updates) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addIconOverlay = () => {
    const firstCfg = config?.complianceIcons?.[0];
    const firstName = COMPLIANCE_ICONS[0];
    const newIcon = {
      id: generateId(),
      filename: firstName,
      url: resolveIconUrl(firstName),
      x: 10, y: 10, width: 15,
      opacity: 100,
      minWidth: firstCfg?.minWidth ?? null
    };
    setIconOverlays([...iconOverlays, newIcon]);
    setSelectedIconId(newIcon.id);
    setSelectedTextId(null);
  };

  const updateIconOverlay = (id, updates) => {
    setIconOverlays(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  // --- FFmpeg-Native Render Pipeline (Tauri) ---
  const encodeVideoFFmpeg = async (videoData, template, mode, texts, icons, outroData, onProgress, manualXform, videoExport) => {
    const loadedIcons = await preloadIcons(icons);
    const fps = videoExport?.fps ?? 30;
    const format = (videoExport?.preferredFormat === 'webm') ? 'webm' : 'mp4';
    const bitrate = videoExport?.bitrate ?? 8000000;
    const renderAudio = videoExport?.renderAudio !== false;
    const extension = format;

    // Create a temp session for the overlay PNG
    const { session_id, temp_dir } = await Bridge.createRenderSession();

    try {
      // Step 1: Render overlays once to a transparent PNG
      let overlayPath = '';
      if (texts.length > 0 || loadedIcons.length > 0) {
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = template.width;
        overlayCanvas.height = template.height;
        const overlayCtx = overlayCanvas.getContext('2d');
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        drawOverlays(overlayCtx, overlayCanvas.width, overlayCanvas.height, texts, loadedIcons);

        const overlayBlob = await new Promise(r => overlayCanvas.toBlob(r, 'image/png'));
        const overlayBuffer = new Uint8Array(await overlayBlob.arrayBuffer());
        overlayPath = `${temp_dir}\\overlay.png`;
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(overlayPath, overlayBuffer);
      }

      onProgress(10);

      // Step 2: Encode main video using FFmpeg-native pipeline
      const nameParts = videoData.name.split('.'); nameParts.pop();
      const baseName = nameParts.join('.') || 'output';
      const mainOutputPath = outroData
        ? `${temp_dir}\\main_${baseName}.${extension}`
        : videoData.outputPath;

      await Bridge.encodeVideoDirect({
        sourcePath: videoData.filePath,
        overlayPath: overlayPath,
        outputPath: mainOutputPath,
        resizeMode: mode,
        width: template.width,
        height: template.height,
        scale: manualXform?.scale ?? 1,
        offsetX: manualXform?.offsetX ?? 0,
        offsetY: manualXform?.offsetY ?? 0,
        useBlur: manualXform?.blur !== false,
        fps, format, bitrate, renderAudio,
      });

      onProgress(outroData ? 70 : 95);

      // Step 3: Handle outro if present (no manual transform, just fit/blur)
      if (outroData) {
        const outroOutputPath = `${temp_dir}\\outro_${baseName}.${extension}`;

        await Bridge.encodeVideoDirect({
          sourcePath: outroData.filePath,
          overlayPath: '',
          outputPath: outroOutputPath,
          resizeMode: mode === 'blur' ? 'blur' : 'fit',
          width: template.width,
          height: template.height,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          useBlur: mode === 'blur' || (mode === 'manual' && manualXform?.blur !== false),
          fps, format, bitrate, renderAudio,
        });

        onProgress(90);
        await Bridge.concatVideos([mainOutputPath, outroOutputPath], videoData.outputPath);
      }

      await Bridge.cleanupSession(session_id);
      onProgress(100);
      return { outputPath: videoData.outputPath, extension };
    } catch (err) {
      await Bridge.cleanupSession(session_id).catch(() => {});
      throw err;
    }
  };

  // --- Rendering Engine ---
  const startRender = async () => {
    cancelRef.current = false;
    setRenderState({ isRendering: true, isComplete: false, stats: null });
    setVideos(prev => prev.map(v => ({ ...v, status: 'queued', progress: 0 })));

    // In Tauri mode, ask user for output folder once
    let outputDir = null;
    if (Bridge.isTauri) {
      outputDir = await Bridge.pickOutputFolder();
      if (!outputDir) {
        setRenderState({ isRendering: false, isComplete: false, stats: null });
        return;
      }
    }

    let successCount = 0; let failCount = 0; let cancelledCount = 0;
    const videosToRender = [...videos];

    for (const vid of videosToRender) {
      if (cancelRef.current) {
        setVideos(prev => prev.map(x => x.id === vid.id ? { ...x, status: 'cancelled' } : x));
        cancelledCount++;
        continue;
      }

      setVideos(prev => prev.map(x => x.id === vid.id ? { ...x, status: 'processing', progress: 0 } : x));

      try {
        const nameParts = vid.name.split('.'); nameParts.pop();
        const baseName = nameParts.join('.') || 'output';

        if (vid.type === 'image') {
          const result = await encodeStaticImage(vid, selectedTemplate, resizeMode, textOverlays, iconOverlays, manualTransform, config?.export?.image);
          setVideos(prev => prev.map(x => x.id === vid.id ? { ...x, progress: 100 } : x));
          const { blob, extension } = result;
          const outName = `${baseName}_processed.${extension}`;

          if (Bridge.isTauri && outputDir) {
            const uniquePath = await Bridge.getUniqueFilePath(`${outputDir}\\${outName}`);
            await Bridge.saveBlob(uniquePath, blob);
          } else {
            Bridge.downloadBlob(blob, outName);
          }
        } else {
          if (Bridge.isTauri) {
            const format = (config?.export?.video?.preferredFormat === 'webm') ? 'webm' : 'mp4';
            const outName = `${baseName}_processed.${format}`;
            const outputPath = await Bridge.getUniqueFilePath(`${outputDir}\\${outName}`);
            const vidWithOutput = { ...vid, outputPath };

            await encodeVideoFFmpeg(vidWithOutput, selectedTemplate, resizeMode, textOverlays, iconOverlays, outroFile, (prog) => {
              setVideos(prev => prev.map(x => x.id === vid.id ? { ...x, progress: prog } : x));
            }, manualTransform, config?.export?.video);
          } else {
            const result = await encodeVideoOnCanvas(vid, selectedTemplate, resizeMode, textOverlays, iconOverlays, outroFile, (prog) => {
              setVideos(prev => prev.map(x => x.id === vid.id ? { ...x, progress: prog } : x));
            }, manualTransform, config?.export?.video);
            const { blob, extension } = result;
            Bridge.downloadBlob(blob, `${baseName}_processed.${extension}`);
          }
        }

        setVideos(prev => prev.map(x => x.id === vid.id ? { ...x, status: 'success', progress: 100 } : x));
        successCount++;
      } catch (err) {
        console.error("Render failed:", err);
        setVideos(prev => prev.map(x => x.id === vid.id ? { ...x, status: 'failed' } : x));
        failCount++;
      }
    }

    setRenderState({
      isRendering: false,
      isComplete: true,
      stats: { total: videosToRender.length, success: successCount, failed: failCount, cancelled: cancelledCount }
    });
  };

  const cancelRender = () => cancelRef.current = true;

  const encodeVideoOnCanvas = async (videoData, template, mode, texts, icons, outroFile, onProgress, manualXform, videoExport) => {
    const loadedIcons = await preloadIcons(icons);
    const renderAudio = videoExport?.renderAudio !== false;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = template.width;
      canvas.height = template.height;
      const ctx = canvas.getContext('2d');

      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.src = videoData.url;
      vid.playsInline = true;

      let audioCtx, audioDest;
      if (renderAudio) {
        // Route audio via AudioContext so speakers stay silent while MediaRecorder captures it.
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const sourceNode = audioCtx.createMediaElementSource(vid);
          audioDest = audioCtx.createMediaStreamDestination();
          sourceNode.connect(audioDest);
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
        } catch (err) {
          console.warn("Audio extraction unavailable", err);
        }
      } else {
        vid.muted = true;
      }

      let recorder;
      const chunks = [];
      let isRecording = true;
      let animationFrameId;
      let isPlayingOutro = false;
      let recorderInitialized = false;

      vid.onloadedmetadata = () => vid.play().catch(reject);

      vid.onplay = () => {
        if (recorderInitialized) return;
        recorderInitialized = true;

        try {
          const fps = videoExport?.fps ?? 30;
          const bitrate = videoExport?.bitrate ?? 8000000;
          const preferred = videoExport?.preferredFormat ?? 'auto';
          const stream = canvas.captureStream(fps);

          if (audioDest) {
            const audioTracks = audioDest.stream.getAudioTracks();
            if (audioTracks.length > 0) {
              stream.addTrack(audioTracks[0]);
            }
          }

          const hasAudio = stream.getAudioTracks().length > 0;
          const mp4WithAudio = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
          const webmWithAudio = 'video/webm; codecs="vp9, opus"';
          const webmBasicWithAudio = 'video/webm; codecs="vp8, opus"';

          const mp4Supported = hasAudio
            ? (MediaRecorder.isTypeSupported(mp4WithAudio) || MediaRecorder.isTypeSupported('video/mp4'))
            : MediaRecorder.isTypeSupported('video/mp4');
          const vp9Supported = hasAudio
            ? (MediaRecorder.isTypeSupported(webmWithAudio) || MediaRecorder.isTypeSupported('video/webm; codecs=vp9'))
            : MediaRecorder.isTypeSupported('video/webm; codecs=vp9');
          const useMp4 = preferred !== 'webm' && mp4Supported;

          let mimeType, extension, options;
          if (useMp4) {
            mimeType = hasAudio && MediaRecorder.isTypeSupported(mp4WithAudio) ? mp4WithAudio : 'video/mp4';
            extension = 'mp4';
            options = { mimeType, videoBitsPerSecond: bitrate };
          } else if (vp9Supported) {
            mimeType = hasAudio && MediaRecorder.isTypeSupported(webmWithAudio) ? webmWithAudio : 'video/webm; codecs=vp9';
            extension = 'webm';
            options = { mimeType, videoBitsPerSecond: bitrate };
          } else if (hasAudio && MediaRecorder.isTypeSupported(webmBasicWithAudio)) {
            mimeType = webmBasicWithAudio;
            extension = 'webm';
            options = { mimeType, videoBitsPerSecond: Math.min(bitrate, 5000000) };
          } else {
            mimeType = 'video/webm';
            extension = 'webm';
            options = { videoBitsPerSecond: Math.min(bitrate, 5000000) };
          }
          if (hasAudio) options.audioBitsPerSecond = 128000;

          recorder = new MediaRecorder(stream, options);
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            if (audioCtx) audioCtx.close().catch(() => {});
            resolve({ blob: new Blob(chunks, { type: mimeType }), extension });
          };

          recorder.start();
          drawFrame();
        } catch (e) {
          reject(e);
        }
      };

      const drawFrame = () => {
        if (!isRecording) return;
        if (cancelRef.current) {
          isRecording = false;
          vid.pause();
          if (recorder && recorder.state !== 'inactive') recorder.stop();
          return reject(new Error('Cancelled by user'));
        }

        const cW = canvas.width;
        const cH = canvas.height;
        const vW = vid.videoWidth;
        const vH = vid.videoHeight;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cW, cH);

        if (vid.readyState >= 2 && vW > 0 && vH > 0) {
          const ratioW = cW / vW;
          const ratioH = cH / vH;

          if (mode === 'blur') {
            const scale = Math.max(ratioW, ratioH);
            const dw = vW * scale; const dh = vH * scale;
            const dx = (cW - dw) / 2; const dy = (cH - dh) / 2;
            ctx.filter = 'blur(30px)';
            ctx.globalAlpha = 0.5;
            ctx.drawImage(vid, dx, dy, dw, dh);
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
          }

          if (mode === 'manual') {
            const mx = manualXform || { scale: 1, offsetX: 0, offsetY: 0, blur: true };
            if (mx.blur) {
              const blurScale = Math.max(ratioW, ratioH);
              ctx.filter = 'blur(30px)';
              ctx.globalAlpha = 0.5;
              ctx.drawImage(vid, (cW - vW * blurScale) / 2, (cH - vH * blurScale) / 2, vW * blurScale, vH * blurScale);
              ctx.filter = 'none';
              ctx.globalAlpha = 1.0;
            }
            const containScale = Math.min(ratioW, ratioH) * mx.scale;
            const dw = vW * containScale; const dh = vH * containScale;
            const dx = (cW - dw) / 2 + mx.offsetX * cW;
            const dy = (cH - dh) / 2 + mx.offsetY * cH;
            ctx.drawImage(vid, dx, dy, dw, dh);
          } else {
            const scale = mode === 'crop' ? Math.max(ratioW, ratioH) : Math.min(ratioW, ratioH);
            const dw = vW * scale; const dh = vH * scale;
            const dx = (cW - dw) / 2; const dy = (cH - dh) / 2;
            ctx.drawImage(vid, dx, dy, dw, dh);
          }
        }

        if (!isPlayingOutro) {
          drawOverlays(ctx, cW, cH, texts, loadedIcons);
        }

        if (vid.duration > 0) {
          if (!isPlayingOutro) {
            onProgress(Math.min(90, (vid.currentTime / vid.duration) * 90));
          } else {
            onProgress(90 + Math.min(9, (vid.currentTime / vid.duration) * 9));
          }
        }

        animationFrameId = requestAnimationFrame(drawFrame);
      };

      vid.onended = () => {
        if (!isPlayingOutro && outroFile) {
          isPlayingOutro = true;
          vid.src = outroFile.url;
          vid.load();
          vid.play().catch(reject);
        } else {
          isRecording = false;
          cancelAnimationFrame(animationFrameId);
          if (recorder && recorder.state !== 'inactive') recorder.stop();
        }
      };

      vid.onerror = (e) => reject(new Error("Video playback error"));
    });
  };

  return (
    <div 
      className="h-screen bg-ink-950 text-ink-100 font-sans flex flex-col overflow-hidden selection:bg-accent/30" 
      onDragOver={Bridge.isTauri ? undefined : (e => e.preventDefault())} 
      onDrop={Bridge.isTauri ? undefined : handleDrop}
    >

      {/* TOP HEADER */}
      <header className="h-12 border-b border-white/[0.05] bg-ink-900 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-[14px] font-bold text-ink-100 flex items-center gap-2 tracking-tight">
            <VideoIcon size={16} /> Batch Studio
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setSettingsOpen(true)} className="text-ink-400 hover:text-ink-100 transition-colors p-1 rounded hover:bg-ink-850" title="Settings">
            <Settings size={16} />
          </button>
          <div className="w-px h-4 bg-white/[0.08]" />
          {renderState.isRendering ? (
            <button onClick={cancelRender} className="h-8 px-4 rounded-md text-[11.5px] font-medium border border-rose-400/40 text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 transition-colors">
              <XCircle size={14} /> Cancel
            </button>
          ) : (
            <button onClick={startRender} disabled={videos.length === 0} className="h-8 px-4 rounded-md text-[11.5px] font-semibold bg-accent hover:bg-accent-soft text-white flex items-center gap-1.5 transition-colors shadow-[0_0_8px_rgba(99,102,241,0.3)] disabled:opacity-50">
              <Download size={14} /> Render ({videos.length})
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDEBAR - Tabs */}
      <aside className="w-[300px] shrink-0 bg-ink-900 border-r border-white/[0.05] flex flex-col h-full z-10">
        <div className="h-11 shrink-0 border-b border-white/[0.05] flex items-center px-3 gap-1">
          <button onClick={() => setLeftTab('layout')} className={`h-7 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 transition-colors ${leftTab === 'layout' ? 'bg-white/[0.05] text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}>Layout</button>
          <button onClick={() => setLeftTab('content')} className={`h-7 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 transition-colors ${leftTab === 'content' ? 'bg-white/[0.05] text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}>Content</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
          {leftTab === 'layout' ? (
<div className="p-5 space-y-8 flex-1">
          {/* Canvas Size Settings */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider flex items-center gap-2">
                <Settings2 size={14} /> Output Template
              </h2>
              <button className="text-[11px] text-ink-400 hover:text-ink-100 font-mono">
                {selectedTemplate.width}×{selectedTemplate.height}
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1 p-1 bg-ink-850 rounded-lg border border-white/[0.04]">
                {Object.keys(SOCIAL_TEMPLATES).map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setSelectedTemplateGroup(p);
                      setSelectedTemplateId(SOCIAL_TEMPLATES[p][0].id);
                    }}
                    className={`px-2 h-7 rounded-md text-[11.5px] font-medium transition-all ${selectedTemplateGroup === p ? 'bg-ink-700 text-ink-50 shadow-card' : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.03]'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                {SOCIAL_TEMPLATES[selectedTemplateGroup]?.filter(t => t.id !== 'custom-id').map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-md border transition-all text-left ${selectedTemplateId === t.id ? 'bg-accent-bg border-accent-ring' : 'bg-transparent border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08]'}`}
                  >
                    <div className="relative shrink-0 flex items-center justify-center p-1 w-8 h-8 rounded bg-ink-900 border border-white/[0.08]">
                      <div className={`border rounded-[1px] w-full ${selectedTemplateId === t.id ? 'border-accent-soft bg-accent-soft/20' : 'border-ink-500 bg-ink-700'}`} style={{ aspectRatio: t.width/t.height }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12.5px] font-medium truncate ${selectedTemplateId === t.id ? 'text-ink-50' : 'text-ink-100'}`}>{t.name}</div>
                      <div className="text-[10.5px] text-ink-500 font-mono">{t.width} × {t.height} {t.ratio ? `· ${t.ratio}` : ''}</div>
                    </div>
                    {selectedTemplateId === t.id && <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(99,102,241,0.7)]" />}
                  </button>
                ))}
              </div>

              {selectedTemplateGroup === 'Custom' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-ink-500 mb-1 block">Width</label>
                    <NumberInput value={customSize.width} onChange={val => setCustomSize(p => ({...p, width: val}))} containerClassName="h-8" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500 mb-1 block">Height</label>
                    <NumberInput value={customSize.height} onChange={val => setCustomSize(p => ({...p, height: val}))} containerClassName="h-8" />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Resize Modes */}
          <section>
            <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">Fit Strategy</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {RESIZE_MODES.map(m => {
                const IconC = m.icon;
                const active = resizeMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setResizeMode(m.id)}
                    className={`group relative p-3 rounded-lg border text-left transition-all ${active ? 'bg-accent-bg border-accent-ring' : 'bg-ink-850 border-white/[0.04] hover:border-white/[0.1] hover:bg-ink-800'}`}
                  >
                    <IconC size={15} className={active ? 'text-accent-soft' : 'text-ink-300 group-hover:text-ink-100'} />
                    <div className={`text-[12px] font-medium mt-2 ${active ? 'text-ink-50' : 'text-ink-100'}`}>{m.name}</div>
                    {m.desc && <div className={`text-[11px] mt-0.5 ${active ? 'text-accent-soft/80' : 'text-ink-500'}`}>{m.desc}</div>}
                  </button>
                );
              })}
            </div>
            
            {resizeMode === 'manual' && (
              <div className="mt-3 p-3 rounded-lg bg-ink-850 border border-white/[0.05] space-y-3 fade-in">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] text-ink-400">Scale</label>
                  <span className="text-[10px] text-ink-400 font-mono tabular-nums">{manualTransform.scale.toFixed(2)}×</span>
                </div>
                <input
                  type="range" min="0.1" max="5" step="0.05"
                  value={manualTransform.scale}
                  onChange={e => setManualTransform(t => ({ ...t, scale: parseFloat(e.target.value) }))}
                  className="w-full slim"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setManualTransform(t => ({ ...t, blur: !t.blur }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium transition-colors border ${manualTransform.blur ? 'bg-accent-bg border-accent-ring text-accent-soft' : 'bg-ink-900 border-white/[0.08] text-ink-300 hover:text-ink-100'}`}
                  >
                    <ImageIcon size={12} /> Blur BG
                  </button>
                  <button
                    onClick={() => setManualTransform({ scale: 1, offsetX: 0, offsetY: 0, blur: manualTransform.blur })}
                    className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium transition-colors border bg-ink-900 border-white/[0.08] text-ink-300 hover:text-ink-100"
                  >
                    <Move size={12} /> Reset Pos
                  </button>
                </div>
              </div>
            )}
          </section>

          
        </div>
          ) : (
            <div className="p-5 space-y-8 flex-1">

              {/* Text Overlays - Properties Panel */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider">Overlays</h2>
              <div className="flex gap-2">
                <button
                  onClick={addTextOverlay}
                  className="text-xs flex items-center gap-1 bg-ink-850 hover:bg-ink-700 px-2 py-1 rounded text-ink-100 transition-colors"
                >
                  <Plus size={14} /> Text
                </button>
                <button
                  onClick={addIconOverlay}
                  className="text-xs flex items-center gap-1 bg-ink-850 hover:bg-ink-700 px-2 py-1 rounded text-ink-100 transition-colors"
                >
                  <Plus size={14} /> Icon
                </button>
              </div>
            </div>

            {/* Show Panel Based on Selection */}
            {activeText ? (
              <div className="space-y-3 bg-ink-850 p-3 rounded-lg border border-white/[0.08]">
                <h3 className="text-sm font-semibold text-ink-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><Type size={14} /> <span className="text-[13px]">Text Properties</span></div>
                </h3>

                <textarea
                  value={activeText.text}
                  onChange={(e) => updateTextOverlay(activeText.id, { text: e.target.value })}
                  className="w-full bg-ink-900 border border-white/[0.08] rounded p-1.5 text-[12.5px] text-white focus:ring-1 focus-ring focus:outline-none"
                  rows={2}
                />

                <div className="grid grid-cols-1 gap-2">
                  <ColorInput
                    label="Text Color"
                    value={activeText.color}
                    onChange={(val) => updateTextOverlay(activeText.id, { color: val })}
                  />
                  <ColorInput
                    label="Background Color"
                    value={activeText.bgColor}
                    onChange={(val) => updateTextOverlay(activeText.id, { bgColor: val })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="col-span-2">
                    <label className="text-[11px] text-ink-400 block mb-1">Font Family</label>
                    <select
                      value={activeText.fontFamily || 'Arial, sans-serif'}
                      onChange={(e) => updateTextOverlay(activeText.id, { fontFamily: e.target.value })}
                      className="w-full h-7 bg-ink-900 border border-white/[0.08] rounded px-2 text-[12px] text-white focus:ring-1 focus-ring focus:outline-none"
                    >
                      <option value="Arial, Helvetica, sans-serif">Arial</option>
                      <option value="'Arial Black', Gadget, sans-serif">Arial Black</option>
                      <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
                      <option value="'Courier New', Courier, monospace">Courier New</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Impact, Charcoal, sans-serif">Impact</option>
                      <option value="'Times New Roman', Times, serif">Times New Roman</option>
                      <option value="'Trebuchet MS', Helvetica, sans-serif">Trebuchet MS</option>
                      <option value="Verdana, Geneva, sans-serif">Verdana</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-ink-400 block mb-1">Weight</label>
                    <select
                      value={activeText.fontWeight || '500'}
                      onChange={(e) => updateTextOverlay(activeText.id, { fontWeight: e.target.value })}
                      className="w-full h-7 bg-ink-900 border border-white/[0.08] rounded px-2 text-[12px] text-white focus:ring-1 focus-ring focus:outline-none"
                    >
                      <option value="100">100 - Thin</option>
                      <option value="300">300 - Light</option>
                      <option value="400">400 - Normal</option>
                      <option value="500">500 - Medium</option>
                      <option value="600">600 - Semi-Bold</option>
                      <option value="700">700 - Bold</option>
                      <option value="900">900 - Black</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-400 block mb-1">Size</label>
                    <NumberInput
                      min="1" max="100" step="0.5"
                      value={activeText.fontSize}
                      onChange={(val) => updateTextOverlay(activeText.id, { fontSize: val || 1 })}
                      containerClassName="h-7"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-ink-400 block mb-1">Line Height</label>
                    <NumberInput
                      min="0.5" max="3" step="0.1"
                      value={activeText.lineHeight || 1.2}
                      onChange={(val) => updateTextOverlay(activeText.id, { lineHeight: val || 1.2 })}
                      containerClassName="h-7"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-ink-400 block mb-1">Letter Spacing</label>
                    <NumberInput
                      min="-50" max="50" step="1"
                      value={activeText.letterSpacing || 0}
                      onChange={(val) => updateTextOverlay(activeText.id, { letterSpacing: val || 0 })}
                      containerClassName="h-7"
                    />
                  </div>

                  <div className="col-span-2 mt-1">
                    <label className="text-[11px] text-ink-400 block mb-1.5">Padding</label>
                    <PaddingInput
                      value={activeText.padding}
                      onChange={(val) => updateTextOverlay(activeText.id, { padding: val })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] text-ink-400 block mb-1">Shadow/Outline</label>
                    <select
                      value={activeText.shadow || 'none'}
                      onChange={(e) => updateTextOverlay(activeText.id, { shadow: e.target.value })}
                      className="w-full h-7 bg-ink-900 border border-white/[0.08] rounded px-2 text-[12px] text-white focus:ring-1 focus-ring focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="drop">Drop Shadow</option>
                      <option value="outline">Black Outline</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-ink-400">Alignment / Justification</label>
                    <button
                      className={`flex justify-center p-1 rounded transition-colors ${activeText.isItalic ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
                      onClick={() => updateTextOverlay(activeText.id, { isItalic: !activeText.isItalic })}
                      title="Italicize"
                    ><Italic size={14} /></button>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_1fr_auto_1fr_1fr_1fr] gap-1 bg-ink-900 p-1 rounded border border-white/[0.08]">
                    <button
                      className={`flex justify-center py-1.5 rounded transition-colors ${activeText.align === 'left' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
                      onClick={() => updateTextOverlay(activeText.id, { align: 'left' })}
                      title="Left"
                    ><AlignLeft size={16} /></button>
                    <button
                      className={`flex justify-center py-1.5 rounded transition-colors ${activeText.align === 'center' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
                      onClick={() => updateTextOverlay(activeText.id, { align: 'center' })}
                      title="Center"
                    ><AlignCenter size={16} /></button>
                    <button
                      className={`flex justify-center py-1.5 rounded transition-colors ${activeText.align === 'right' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
                      onClick={() => updateTextOverlay(activeText.id, { align: 'right' })}
                      title="Right"
                    ><AlignRight size={16} /></button>

                    <div className="w-px bg-ink-700 h-full"></div>

                    <button
                      className={`flex items-center justify-center gap-0.5 py-1.5 rounded transition-colors ${activeText.align === 'justify-left' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
                      onClick={() => updateTextOverlay(activeText.id, { align: 'justify-left' })}
                      title="Justify (Last line Left)"
                    ><AlignJustify size={14} /><span className="text-[9px] font-bold">L</span></button>
                    <button
                      className={`flex items-center justify-center gap-0.5 py-1.5 rounded transition-colors ${activeText.align === 'justify-center' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
                      onClick={() => updateTextOverlay(activeText.id, { align: 'justify-center' })}
                      title="Justify (Last line Center)"
                    ><AlignJustify size={14} /><span className="text-[9px] font-bold">C</span></button>
                    <button
                      className={`flex items-center justify-center gap-0.5 py-1.5 rounded transition-colors ${activeText.align === 'justify-right' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}
                      onClick={() => updateTextOverlay(activeText.id, { align: 'justify-right' })}
                      title="Justify (Last line Right)"
                    ><AlignJustify size={14} /><span className="text-[9px] font-bold">R</span></button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setTextOverlays(prev => prev.filter(t => t.id !== activeText.id));
                    setSelectedTextId(null);
                  }}
                  className="w-full mt-2 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Remove Text Box
                </button>
              </div>
            ) : activeIcon ? (
              <div className="space-y-4 bg-ink-850 p-4 rounded-lg border border-white/[0.08]">
                <h3 className="text-sm font-semibold text-ink-100 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2"><ImageIcon size={16} /> Icon Properties</div>
                </h3>

                <div>
                  <label className="text-xs text-ink-400 block mb-2">Select Icon</label>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {COMPLIANCE_ICONS.map(iconName => (
                      <button
                        key={iconName}
                        onClick={() => {
                          const cfg = config?.complianceIcons?.find(ic => ic.filename === iconName);
                          updateIconOverlay(activeIcon.id, { filename: iconName, url: resolveIconUrl(iconName), minWidth: cfg?.minWidth ?? null });
                        }}
                        className={`aspect-square rounded border flex items-center justify-center p-2 overflow-hidden transition-all relative ${
                          activeIcon.filename === iconName || activeIcon.url === resolveIconUrl(iconName)
                            ? 'border-accent-ring ring-1 ring-blue-500 bg-ink-850'
                            : 'border-white/[0.08] hover:border-slate-500 bg-ink-900/80 hover:bg-ink-850'
                        }`}
                        title={iconName}
                      >
                        <div className="absolute inset-0 bg-checkerboard opacity-20 pointer-events-none"></div>
                        <img
                          src={resolveIconUrl(iconName)}
                          alt={iconName}
                          className="max-w-full max-h-full object-contain relative z-10"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.classList.add('opacity-30', 'grayscale');
                            e.target.parentElement.title = `${iconName} (Not found on server)`;
                          }}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] text-ink-500 mt-1 font-mono">
                    {(() => {
                      const outW = Math.round(activeIcon.width / 100 * selectedTemplate.width);
                      const outH = (activeIcon._nw && activeIcon._nh)
                        ? Math.round(outW * activeIcon._nh / activeIcon._nw)
                        : null;
                      return outH ? `${outW} × ${outH} px` : `${outW} px wide`;
                    })()}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-ink-400 block">Opacity</label>
                    <span className="text-[10px] text-ink-500 font-mono">{activeIcon.opacity !== undefined ? activeIcon.opacity : 100}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100"
                    value={activeIcon.opacity !== undefined ? activeIcon.opacity : 100}
                    onChange={(e) => updateIconOverlay(activeIcon.id, { opacity: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-ink-700 rounded-lg appearance-none cursor-pointer range-slider"
                  />
                </div>

                <button
                  onClick={() => {
                    setIconOverlays(prev => prev.filter(i => i.id !== activeIcon.id));
                    setSelectedIconId(null);
                  }}
                  className="w-full mt-2 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Remove Icon
                </button>
              </div>
            ) : (
              <div className="text-sm text-ink-400 p-4 bg-ink-850 rounded-lg">Select a text or icon overlay to edit properties.</div>
            )}
          </section>

          {/* Outro */}
          <section>
            <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">Global Outro</h2>
            <div className="relative">
              {!outroFile ? (
                <div className="border-2 border-dashed border-white/[0.08] rounded-lg p-4 text-center hover:bg-ink-850 transition-colors relative cursor-pointer" onClick={() => { if (Bridge.isTauri) handleTauriOutroSelect(); }}>
                  {!Bridge.isTauri && <input type="file" accept="video/*" onChange={handleOutroUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />}
                  <FileVideo className="mx-auto text-ink-500 mb-2" size={24} />
                  <span className="text-xs text-ink-400">Browse for outro video...</span>
                </div>
              ) : (
                <div className="bg-ink-850 border border-white/[0.08] rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileVideo className="text-violet-400 shrink-0" size={16} />
                    <span className="text-xs truncate">{outroFile.name}</span>
                  </div>
                  <button onClick={() => setOutroFile(null)} className="text-ink-400 hover:text-red-400 shrink-0 ml-2">
                    <X size={16} />
                  </button>
                </div>
              )}
              <p className="text-[10px] text-ink-500 mt-2">Appended to every rendered video. Static images are exported as-is without an outro.</p>
            </div>
          </section>
            </div>
          )}
        </div>
      </aside>

      {/* CENTER - Canvas Preview */}
      <main className="flex-1 flex flex-col h-full min-h-0 relative bg-black/40">

        <div className="h-11 shrink-0 border-b border-white/[0.05] flex items-center px-4 gap-2 bg-ink-900 z-10">
          <div className="flex items-center gap-2">
            {activeVideo ? (
              <>
                <span className="chip">
                  {activeVideo.type === 'video' ? <FileVideo size={12} className="text-ink-500" /> : <ImageIcon size={12} className="text-ink-500" />}
                  <span className="truncate max-w-[220px] text-ink-200 font-medium ml-1">{activeVideo.name}</span>
                </span>
                <span className="chip font-mono">{activeVideo.width}×{activeVideo.height}</span>
                {activeVideo.type === 'video' && <span className="chip font-mono">{Math.round(activeVideo.duration)}s</span>}
              </>
            ) : (
              <span className="text-[13px] font-medium text-ink-100 ml-2">Live Preview</span>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 p-0.5 bg-ink-850 rounded-md border border-white/[0.05]">
            <span className="text-[11px] text-ink-300 font-mono px-2 flex items-center gap-1.5 break-normal">
              <span className="text-ink-500 font-sans">{selectedTemplateGroup}:</span>
              <span>{selectedTemplate.name || 'Custom'}, <span className="text-ink-400">{selectedTemplate.width} × {selectedTemplate.height}</span>{selectedTemplate.ratio ? `, ${selectedTemplate.ratio}` : ''}</span>
            </span>
            {selectedTemplate.safeAreaImage && (
              <>
                <div className="w-px h-4 bg-white/[0.06] mx-1" />
                <button
                  onClick={() => setShowSafeZone(v => !v)}
                  className={`h-7 px-2.5 rounded text-[11.5px] flex items-center gap-1.5 transition-colors ${showSafeZone ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:text-ink-100'}`}
                >
                  {showSafeZone ? <Eye size={13} /> : <EyeOff size={13} />} Safe zone
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-dot-pattern min-h-0 min-w-0">
          {!activeVideo ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ink-850 mb-4 shadow-lg border border-white/[0.08]">
                <Upload className="text-ink-400" size={24} />
              </div>
              <p className="text-ink-400 text-sm">Drag and drop videos or images anywhere</p>
            </div>
          ) : (
            <PreviewCanvas
              video={activeVideo}
              template={selectedTemplate}
              resizeMode={resizeMode}
              textOverlays={textOverlays}
              selectedTextId={selectedTextId}
              setSelectedTextId={setSelectedTextId}
              updateTextOverlay={updateTextOverlay}
              iconOverlays={iconOverlays}
              selectedIconId={selectedIconId}
              setSelectedIconId={setSelectedIconId}
              updateIconOverlay={updateIconOverlay}
              showSafeZone={showSafeZone}
              manualTransform={manualTransform}
              onManualTransformChange={setManualTransform}
              resolveSafezoneUrl={resolveSafezoneUrl}
            />
          )}
        </div>
      </main>

            {/* RIGHT SIDEBAR - Batch Queue */}
      <aside className="w-[340px] shrink-0 bg-ink-900 border-l border-white/[0.05] flex flex-col h-full z-10">
        <div className="h-11 shrink-0 border-b border-white/[0.05] flex items-center justify-between px-4">
          <h2 className="text-[12px] font-semibold text-ink-100 flex items-center gap-1.5">
            Queue <span className="text-[10.5px] font-mono text-ink-500">{videos.length}</span>
          </h2>
          <label className="cursor-pointer h-7 px-2 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-100 hover:bg-white/[0.05]" title="Add Media" onClick={(e) => { if (Bridge.isTauri) { e.preventDefault(); handleTauriFileSelect(); } }}>
            <Plus size={14} />
            <input type="file" multiple accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">

          {renderState.isRendering && (
            <div className="mb-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg p-3 text-xs flex gap-2 items-start shadow-sm">
              <Info size={14} className="shrink-0 mt-0.5" />
              <p className="leading-snug">{Bridge.isTauri ? 'Encoding via FFmpeg. Please wait until the batch is completely finished.' : 'Encoding runs in real-time. Please keep this tab active until the batch is completely finished.'}</p>
            </div>
          )}

          {renderState.isComplete && renderState.stats && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 shadow-sm fade-in">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-500">Batch Complete</h3>
                <button 
                  onClick={() => setRenderState(s => ({ ...s, isComplete: false }))}
                  className="ml-auto text-ink-500 hover:text-ink-100"
                ><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-ink-950/50 rounded p-2 border border-white/[0.03]">
                  <div className="text-[10px] text-ink-500 uppercase tracking-wider">Success</div>
                  <div className="text-lg font-bold text-ink-100 font-mono">{renderState.stats.success}</div>
                </div>
                <div className="bg-ink-950/50 rounded p-2 border border-white/[0.03]">
                  <div className="text-[10px] text-ink-500 uppercase tracking-wider">Failed</div>
                  <div className="text-lg font-bold text-rose-400 font-mono">{renderState.stats.failed}</div>
                </div>
              </div>
              {renderState.stats.cancelled > 0 && (
                <div className="mt-2 text-[10px] text-orange-400/80 text-center">
                  {renderState.stats.cancelled} items were cancelled.
                </div>
              )}
            </div>
          )}

          {videos.length === 0 ? (
            <div className="text-center py-10">
              <FileVideo className="mx-auto text-slate-700 mb-2" size={32} />
              <p className="text-xs text-ink-500">Queue is empty</p>
            </div>
          ) : (
            videos.map((vid, idx) => {
              const active = selectedVideoId === vid.id;
              return (
                <div
                  key={vid.id}
                  onClick={() => setSelectedVideoId(vid.id)}
                  className={`group relative flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer overflow-hidden ${active ? 'bg-ink-850 border-accent-ring shadow-card' : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.08]'}`}
                >
                  <div className="w-10 h-10 shrink-0 bg-ink-900 border border-white/[0.08] rounded flex items-center justify-center overflow-hidden">
                    {vid.url ? (
                      vid.type === 'video' ? (
                        <video src={vid.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={vid.url} className="w-full h-full object-cover" />
                      )
                    ) : (
                      vid.type === 'video' ? <FileVideo size={16} className="text-ink-500" /> : <ImageIcon size={16} className="text-ink-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className={`text-[12.5px] font-medium truncate ${active ? 'text-ink-50' : 'text-ink-100'}`}>
                      {vid.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {vid.status === 'queued' && <span className="w-1.5 h-1.5 rounded-full bg-ink-400" title="Queued" />}
                      {vid.status === 'processing' && <span className="w-1.5 h-1.5 rounded-full bg-accent-soft" title="Processing" />}
                      {vid.status === 'success' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Success" />}
                      {vid.status === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Failed" />}
                      {vid.status === 'cancelled' && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" title="Cancelled" />}
                      <span className="text-[10.5px] text-ink-500 font-mono truncate">
                        {vid.width}×{vid.height} {vid.type === 'image' ? 'IMG' : `${Math.round(vid.duration)}s`}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); setVideos(v => v.filter(x => x.id !== vid.id)); if(selectedVideoId === vid.id) setSelectedVideoId(null); }}
                    className="w-7 h-7 flex items-center justify-center rounded text-ink-500 hover:text-rose-400 hover:bg-rose-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>

                  {(vid.status === 'processing' || vid.status === 'success') && (
                    <div className="absolute bottom-0 left-0 h-[2px] bg-ink-850 w-full">
                      <div className={`h-full transition-all duration-300 ${vid.status === 'success' ? 'bg-emerald-500' : 'bg-accent-soft'}`} style={{ width: `${vid.progress}%` }}></div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
      </div>
      {settingsOpen && config && (
        <SettingsModal
          config={config}
          onSave={async (newConfig) => { await saveConfig(newConfig); setSettingsOpen(false); }}
          onClose={() => setSettingsOpen(false)}
          onAssetsChanged={assetUrls.refresh}
        />
      )}

      {renderState.isComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ink-900 border border-white/[0.08] p-6 rounded-xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-green-400" /> Batch Complete
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm"><span className="text-ink-400">Total Videos:</span> <span className="font-medium text-white">{renderState.stats.total}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink-400">Succeeded:</span> <span className="font-medium text-green-400">{renderState.stats.success}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink-400">Failed:</span> <span className="font-medium text-red-400">{renderState.stats.failed}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink-400">Cancelled:</span> <span className="font-medium text-orange-400">{renderState.stats.cancelled}</span></div>
            </div>
            <p className="text-xs text-ink-500 bg-ink-850 p-3 rounded mb-6 italic">
              {Bridge.isTauri ? 'All processed files have been saved to your selected output folder.' : "All processed videos have automatically been downloaded to your browser's download folder."}
            </p>
            <button
              onClick={() => setRenderState({ isRendering: false, isComplete: false, stats: null })}
              className="w-full py-2 bg-ink-850 hover:bg-ink-700 text-white rounded font-medium transition-colors border border-white/[0.08]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .bg-dot-pattern { background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px); background-size: 20px 20px; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .bg-checkerboard { background-image: linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px; }
        .range-slider::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; cursor: pointer; }
      `}} />
    </div>
  );
}

// --- Preview Canvas Component ---
function PreviewCanvas({
  video, template, resizeMode,
  textOverlays, selectedTextId, setSelectedTextId, updateTextOverlay,
  iconOverlays, selectedIconId, setSelectedIconId, updateIconOverlay,
  showSafeZone, manualTransform, onManualTransformChange, resolveSafezoneUrl
}) {
  const isImage = video.type === 'image';
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);
  const blurVideoRef = useRef(null);
  const manualDragRef = useRef(null);

  const formatTime = (time) => {
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = Math.floor(time % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSeek = (e) => {
    if (!videoRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = percent * duration;
    setCurrentTime(percent * duration);
  };

  useEffect(() => {
    if (isImage || !videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(()=>{});
      if(blurVideoRef.current) blurVideoRef.current.play().catch(()=>{});
    } else {
      videoRef.current.pause();
      if(blurVideoRef.current) blurVideoRef.current.pause();
    }
  }, [isPlaying, video.id, isImage]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted, video.id, isImage]);

  useEffect(() => {
    setIsPlaying(true);
    if (!isImage && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(()=>{});
    }
  }, [video.id, isImage]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        const wrapperRatio = width / height;
        const templateRatio = template.width / template.height;

        if (wrapperRatio > templateRatio) {
          setCanvasSize({ width: height * templateRatio, height: height });
        } else {
          setCanvasSize({ width: width, height: width / templateRatio });
        }
      }
    });

    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [template.width, template.height]);

  const togglePlay = (e) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const handleCanvasPointerDown = (e) => {
    if (e.target.closest('.text-overlay-element') || e.target.closest('.icon-overlay-element')) return;
    const clickInsideCanvas = containerRef.current && containerRef.current.contains(e.target);
    if (resizeMode === 'manual' && clickInsideCanvas) {
      e.currentTarget.setPointerCapture(e.pointerId);
      manualDragRef.current = {
        startX: e.clientX, startY: e.clientY,
        initOffsetX: manualTransform.offsetX, initOffsetY: manualTransform.offsetY
      };
      return;
    }
    setSelectedTextId(null);
    setSelectedIconId(null);
  };

  const handleCanvasPointerMove = (e) => {
    if (!manualDragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - manualDragRef.current.startX) / rect.width;
    const dy = (e.clientY - manualDragRef.current.startY) / rect.height;
    onManualTransformChange(t => ({
      ...t,
      offsetX: manualDragRef.current.initOffsetX + dx,
      offsetY: manualDragRef.current.initOffsetY + dy
    }));
  };

  const handleCanvasPointerUp = () => { manualDragRef.current = null; };

  const manualVideoStyle = (() => {
    if (resizeMode !== 'manual' || canvasSize.width === 0 || !video.width || !video.height) return null;
    const containScale = Math.min(canvasSize.width / video.width, canvasSize.height / video.height);
    const applied = containScale * manualTransform.scale;
    const dw = video.width * applied;
    const dh = video.height * applied;
    const left = (canvasSize.width - dw) / 2 + manualTransform.offsetX * canvasSize.width;
    const top = (canvasSize.height - dh) / 2 + manualTransform.offsetY * canvasSize.height;
    return { position: 'absolute', width: `${dw}px`, height: `${dh}px`, left: `${left}px`, top: `${top}px`, maxWidth: 'none', maxHeight: 'none', objectFit: 'fill' };
  })();

  const renderMedia = (opts) => {
    const { refEl, className, style, isMain } = opts;
    if (isImage) {
      return <img ref={refEl} src={video.url} alt="" draggable={false} className={className} style={style} />;
    }
    return (
      <video
        ref={refEl}
        src={video.url}
        loop
        muted={isMain ? isMuted : true}
        playsInline
        className={className}
        style={style}
        onTimeUpdate={isMain ? (e) => setCurrentTime(e.target.currentTime) : undefined}
        onLoadedMetadata={isMain ? (e) => setDuration(e.target.duration) : undefined}
      />
    );
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 min-w-0 bg-transparent">
      <div
        ref={wrapperRef}
        className={`flex-1 relative flex items-center justify-center min-h-0 min-w-0 p-4 md:p-8 ${resizeMode === 'manual' ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      >
      {canvasSize.width > 0 && (
        <div
          ref={containerRef}
          className="relative bg-black shadow-2xl shadow-black overflow-hidden ring-1 ring-slate-800"
          style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}
        >
          {(resizeMode === 'blur' || (resizeMode === 'manual' && manualTransform.blur)) && renderMedia({
            refEl: blurVideoRef,
            className: 'absolute inset-0 w-full h-full object-cover blur-xl opacity-60 scale-110 pointer-events-none',
          })}

          {resizeMode === 'manual' ? renderMedia({
            refEl: videoRef,
            className: 'pointer-events-none select-none',
            style: manualVideoStyle || {},
            isMain: true
          }) : renderMedia({
            refEl: videoRef,
            className: 'absolute inset-0 w-full h-full pointer-events-none',
            style: {
              objectFit: resizeMode === 'crop' ? 'cover' : 'contain',
              backgroundColor: resizeMode === 'black' ? '#000' : 'transparent',
            },
            isMain: true
          })}

          {showSafeZone && template.safeArea && (
            <div
              className="absolute border border-red-500/40 border-dashed pointer-events-none"
              style={{ top: template.safeArea.top, bottom: template.safeArea.bottom, left: template.safeArea.left, right: template.safeArea.right }}
            >
              <div className="absolute -top-6 left-0 text-[10px] text-red-500/80 bg-black/50 px-1 rounded whitespace-nowrap">Safe Area</div>
            </div>
          )}

          <div className="absolute inset-0 pointer-events-none" style={{ containerType: 'inline-size' }}>
            {/* Render Texts First (bottom layer) */}
            {textOverlays.map(text => (
              <DraggableText
                key={text.id}
                textObj={text}
                isSelected={selectedTextId === text.id}
                onSelect={() => { setSelectedTextId(text.id); setSelectedIconId(null); }}
                onUpdate={(updates) => updateTextOverlay(text.id, updates)}
                containerRef={containerRef}
              />
            ))}

            {/* Render Icons Second (top layer) */}
            {iconOverlays.map(icon => (
              <DraggableIcon
                key={icon.id}
                iconObj={icon}
                isSelected={selectedIconId === icon.id}
                onSelect={() => { setSelectedIconId(icon.id); setSelectedTextId(null); }}
                onUpdate={(updates) => updateIconOverlay(icon.id, updates)}
                containerRef={containerRef}
              />
            ))}
          </div>

          {showSafeZone && template.safeAreaImage && (
            <img
              src={(resolveSafezoneUrl && resolveSafezoneUrl(template.safeAreaImage)) || `/safezones/${template.safeAreaImage}`}
              alt="Safe zone overlay"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-40"
              draggable={false}
            />
          )}

        </div>
      )}

      </div>

      {canvasSize.width > 0 && !isImage && (
        <div className="h-12 shrink-0 flex flex-col justify-center items-center bg-black/20 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button onClick={togglePlay} className="w-7 h-7 rounded-md flex items-center justify-center text-ink-300 hover:bg-white/[0.08] hover:text-ink-50 cursor-pointer transition-colors">
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <div className="w-[300px] max-w-[40vw] h-1.5 rounded-full bg-ink-800 overflow-hidden cursor-pointer border border-white/[0.05]" onClick={handleSeek}>
              <div className="h-full bg-accent pointer-events-none" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}></div>
            </div>
            <div className="text-[11px] text-ink-400 font-mono pl-3 pr-1 tabular-nums whitespace-nowrap">
              {formatTime(currentTime)} <span className="text-ink-600 mx-0.5">/</span> {formatTime(duration)}
            </div>
            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/[0.05]">
              <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="text-ink-400 hover:text-ink-50 transition-colors" title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (val > 0 && isMuted) setIsMuted(false);
                  if (val === 0 && !isMuted) setIsMuted(true);
                }} 
                className="w-16 slim" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Draggable Icon Component ---
function DraggableIcon({ iconObj, isSelected, onSelect, onUpdate, containerRef }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0, initX: 0, initY: 0, initW: 0 });

  const handlePointerDown = (e, mode) => {
    e.stopPropagation();
    onSelect();

    if (!containerRef.current) return;
    if (mode === 'drag') setIsDragging(true);
    if (mode === 'resize') setIsResizing(true);

    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      initX: iconObj.x,
      initY: iconObj.y,
      initW: iconObj.width
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handlePointerMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - startPosRef.current.x) / rect.width) * 100;
      const dy = ((e.clientY - startPosRef.current.y) / rect.height) * 100;

      if (isDragging) {
        let newX = startPosRef.current.initX + dx;
        let newY = startPosRef.current.initY + dy;

        newX = Math.max(0, Math.min(newX, 100 - iconObj.width));
        newY = Math.max(0, Math.min(newY, 100)); // Height adjusts based on aspect ratio natively

        onUpdate({ x: newX, y: newY });
      }

      if (isResizing) {
        let newW = startPosRef.current.initW + dx;

        const minWPercent = iconObj.minWidth ? (iconObj.minWidth / rect.width) * 100 : 0;

        newW = Math.max(minWPercent, Math.min(newW, 100 - iconObj.x));
        onUpdate({ width: newW });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isResizing, iconObj, onUpdate, containerRef]);

  return (
    <div
      className={`absolute flex flex-col icon-overlay-element pointer-events-auto ${isSelected ? 'ring-2 ring-blue-500 shadow-lg z-50' : 'z-10'}`}
      style={{
        left: `${iconObj.x}%`,
        top: `${iconObj.y}%`,
        width: `${iconObj.width}%`,
        height: 'auto' // Native aspect-ratio lock enforcement
      }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {isSelected && (
        <div
          className="absolute -top-7 left-0 right-0 h-6 bg-accent rounded-t-md text-white flex items-center justify-center cursor-move shadow-md opacity-90 hover:opacity-100 transition-opacity z-20"
          onPointerDown={(e) => handlePointerDown(e, 'drag')}
        >
          <Move size={14} />
        </div>
      )}

      <img
        src={iconObj.url}
        alt="Compliance Icon"
        draggable={false}
        className="w-full h-auto block select-none pointer-events-none"
        style={{ opacity: (iconObj.opacity !== undefined ? iconObj.opacity : 100) / 100 }}
        onLoad={(e) => { if (e.target.naturalWidth) onUpdate({ _nw: e.target.naturalWidth, _nh: e.target.naturalHeight }); }}
      />

      {isSelected && (
        <div
          className="absolute -bottom-2 -right-2 w-5 h-5 bg-accent cursor-se-resize rounded-full flex items-center justify-center shadow-md border-2 border-white opacity-90 hover:opacity-100 transition-opacity z-20"
          onPointerDown={(e) => handlePointerDown(e, 'resize')}
        >
          <GripHorizontal size={10} className="text-white transform -rotate-45" />
        </div>
      )}
    </div>
  );
}

// --- Draggable Resizable Text Component ---
function DraggableText({ textObj, isSelected, onSelect, onUpdate, containerRef }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const startPosRef = useRef({ x: 0, y: 0, initX: 0, initY: 0, initW: 0, initH: 0 });
  const textareaRef = useRef(null);

  const checkOverflow = () => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      const isCutOff = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      setIsOverflowing(isCutOff);
    }
  };

  useEffect(() => {
    checkOverflow();
  }, [textObj.text, textObj.fontSize, textObj.fontFamily, textObj.lineHeight, textObj.padding, textObj.width, textObj.height]);

  useEffect(() => {
    if (!textareaRef.current) return;
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(textareaRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (e, mode) => {
    e.stopPropagation();
    onSelect();

    if (!containerRef.current) return;
    if (mode === 'drag') setIsDragging(true);
    if (mode === 'resize') setIsResizing(true);

    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      initX: textObj.x,
      initY: textObj.y,
      initW: textObj.width,
      initH: textObj.height
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handlePointerMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - startPosRef.current.x) / rect.width) * 100;
      const dy = ((e.clientY - startPosRef.current.y) / rect.height) * 100;

      if (isDragging) {
        let newX = startPosRef.current.initX + dx;
        let newY = startPosRef.current.initY + dy;

        newX = Math.max(0, Math.min(newX, 100 - textObj.width));
        newY = Math.max(0, Math.min(newY, 100 - textObj.height));

        onUpdate({ x: newX, y: newY });
      }

      if (isResizing) {
        let newW = startPosRef.current.initW + dx;
        let newH = startPosRef.current.initH + dy;

        newW = Math.max(5, Math.min(newW, 100 - textObj.x));
        newH = Math.max(5, Math.min(newH, 100 - textObj.y));

        onUpdate({ width: newW, height: newH });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isResizing, textObj, onUpdate, containerRef]);

  const fontFamily = textObj.fontFamily || 'Arial, sans-serif';
  const shadow = textObj.shadow || 'none';
  const borderRadius = textObj.borderRadius || 0;

  const shadowStyle = shadow === 'outline'
    ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
    : shadow === 'drop'
      ? '2px 2px 8px rgba(0,0,0,0.8)'
      : 'none';

  const alignStyles = getAlignStyles(textObj.align);

  return (
    <div
      className={`absolute overflow-visible flex flex-col text-overlay-element pointer-events-auto ${isSelected ? 'ring-2 ring-blue-500 shadow-lg z-50' : 'z-10'}`}
      style={{
        left: `${textObj.x}%`,
        top: `${textObj.y}%`,
        width: `${textObj.width}%`,
        height: `${textObj.height}%`,
        backgroundColor: textObj.bgColor,
        borderRadius: `${borderRadius}px`
      }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {isOverflowing && (
        <div
          className="absolute -top-3 -right-3 text-red-500 bg-black/80 rounded-full z-10 shadow border border-red-500/50"
          title="Text is cut off! Increase box size or decrease font/padding."
        >
          <AlertCircle size={18} />
        </div>
      )}

      {isSelected && (
        <div
          className="absolute -top-7 left-0 right-0 h-6 bg-accent rounded-t-md text-white flex items-center justify-center cursor-move shadow-md opacity-90 hover:opacity-100 transition-opacity"
          onPointerDown={(e) => handlePointerDown(e, 'drag')}
        >
          <Move size={14} />
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={textObj.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        className="w-full h-full bg-transparent border-none resize-none overflow-hidden outline-none flex-1"
        style={{
          color: textObj.color,
          fontSize: `${textObj.fontSize}cqw`,
          fontFamily: fontFamily,
          textShadow: shadowStyle,
          textAlign: alignStyles.textAlign,
          textAlignLast: alignStyles.textAlignLast,
          fontWeight: textObj.fontWeight || '500',
          fontStyle: textObj.isItalic ? 'italic' : 'normal',
          lineHeight: textObj.lineHeight || 1.2,
          letterSpacing: `${(textObj.letterSpacing || 0) / 10}em`,
          padding: (() => { const p = normPad(textObj.padding); return `${p.top}cqw ${p.right}cqw ${p.bottom}cqw ${p.left}cqw`; })()
        }}
      />

      {isSelected && (
        <div
          className="absolute -bottom-2 -right-2 w-5 h-5 bg-accent cursor-se-resize rounded-full flex items-center justify-center shadow-md border-2 border-white opacity-90 hover:opacity-100 transition-opacity"
          onPointerDown={(e) => handlePointerDown(e, 'resize')}
        >
          <GripHorizontal size={10} className="text-white transform -rotate-45" />
        </div>
      )}
    </div>
  );
}

// --- Settings Modal ---
const DEFAULT_EXPORT = {
  image: { format: 'jpg', quality: 90 },
  video: { preferredFormat: 'auto', bitrate: 8000000, fps: 30, renderAudio: true }
};

function SettingsModal({ config, onSave, onClose, onAssetsChanged }) {
  const [draft, setDraft] = useState(() => {
    const cloned = JSON.parse(JSON.stringify(config));
    cloned.export = {
      image: { ...DEFAULT_EXPORT.image, ...(cloned.export?.image || {}) },
      video: { ...DEFAULT_EXPORT.video, ...(cloned.export?.video || {}) }
    };
    return cloned;
  });
  const [activeTab, setActiveTab] = useState('icons');
  const [activePlatform, setActivePlatform] = useState(() => Object.keys(config.templates)[0] || 'Instagram');
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [safezoneFiles, setSafezoneFiles] = useState([]);
  const [iconUrls, setIconUrls] = useState({});
  const [safezoneUrls, setSafezoneUrls] = useState({});
  // Pending file deletions, applied on Save.
  const [pendingDeleteIcons, setPendingDeleteIcons] = useState([]);
  const [pendingDeleteSafezones, setPendingDeleteSafezones] = useState([]);
  // Pointer-based drag reorder (HTML5 DnD is unreliable in WebView2 with
  // window-level dragDropEnabled, so we track pointer events ourselves).
  const groupNodes = useRef(new Map());
  const templateNodes = useRef(new Map());
  const [groupDrag, setGroupDrag] = useState(null);       // { from, overIdx }
  const [templateDrag, setTemplateDrag] = useState(null); // { from, overIdx }

  const reorderGroups = (fromIdx, toIdx) => {
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return;
    setDraft(d => {
      const keys = Object.keys(d.templates);
      const reordered = [...keys];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const newTemplates = {};
      reordered.forEach(k => { newTemplates[k] = d.templates[k]; });
      return { ...d, templates: newTemplates };
    });
  };

  const reorderTemplates = (platform, fromIdx, toIdx) => {
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return;
    setDraft(d => {
      const arr = [...d.templates[platform]];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...d, templates: { ...d.templates, [platform]: arr } };
    });
  };
  const [complianceFiles, setComplianceFiles] = useState([]);

  const refreshAssetUrls = async (compFiles, safeFiles) => {
    const buildMap = async (kind, files) => {
      const entries = await Promise.all(files.map(async f => [f, await Bridge.getAssetUrl(kind, f)]));
      return Object.fromEntries(entries);
    };
    const [c, s] = await Promise.all([
      buildMap('compliance', compFiles),
      buildMap('safezones', safeFiles),
    ]);
    setIconUrls(c);
    setSafezoneUrls(s);
  };

  const reloadAssetLists = async () => {
    const [comp, safe] = await Promise.all([
      Bridge.getComplianceFiles().catch(() => []),
      Bridge.getSafezoneFiles().catch(() => []),
    ]);
    setComplianceFiles(comp);
    setSafezoneFiles(safe);
    setDraft(d => {
      const existing = d.complianceIcons || [];
      const merged = comp.map(filename => {
        const found = existing.find(e => e.filename === filename);
        return found || { filename, label: filename.replace(/\.[^.]+$/, ''), minWidth: 40, minHeight: 40 };
      });
      const extras = existing.filter(e => !comp.includes(e.filename));
      return { ...d, complianceIcons: [...merged, ...extras] };
    });
    await refreshAssetUrls(comp, safe);
  };

  useEffect(() => {
    reloadAssetLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaveError(null);
    try {
      // Apply pending file deletions first. Clear image URLs before deleting
      // so WebView2 releases any handles on the asset files.
      if (Bridge.isTauri) {
        if (pendingDeleteIcons.length > 0 || pendingDeleteSafezones.length > 0) {
          setIconUrls({});
          setSafezoneUrls({});
          // Yield a frame so React unmounts the <img> tags first.
          await new Promise(r => setTimeout(r, 50));
        }
        for (const f of pendingDeleteIcons) {
          await Bridge.deleteAssetFile('compliance', f);
        }
        for (const f of pendingDeleteSafezones) {
          await Bridge.deleteAssetFile('safezones', f);
        }
      }
      // Drop config entries that point to deleted files
      const cleaned = {
        ...draft,
        complianceIcons: (draft.complianceIcons || []).filter(ic => !pendingDeleteIcons.includes(ic.filename)),
        templates: Object.fromEntries(
          Object.entries(draft.templates || {}).map(([k, arr]) => [
            k,
            arr.map(t => pendingDeleteSafezones.includes(t.safeAreaImage)
              ? (() => { const { safeAreaImage, ...rest } = t; return rest; })()
              : t),
          ])
        ),
      };
      await onSave(cleaned);
      setPendingDeleteIcons([]);
      setPendingDeleteSafezones([]);
      await reloadAssetLists();
      onAssetsChanged && onAssetsChanged();
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save');
    }
  };

  const handleAddIconFiles = async () => {
    const paths = await Bridge.pickImageFiles(true);
    if (!paths) return;
    for (const p of paths) {
      try {
        await Bridge.addAssetFile('compliance', p);
      } catch (err) {
        setSaveError(err.message || 'Failed to add file');
      }
    }
    await reloadAssetLists();
    onAssetsChanged && onAssetsChanged();
  };

  const handleAddSafezoneFiles = async () => {
    const paths = await Bridge.pickImageFiles(true);
    if (!paths) return;
    for (const p of paths) {
      try {
        await Bridge.addAssetFile('safezones', p);
      } catch (err) {
        setSaveError(err.message || 'Failed to add file');
      }
    }
    await reloadAssetLists();
    onAssetsChanged && onAssetsChanged();
  };

  const togglePendingDeleteIcon = (filename) => {
    setPendingDeleteIcons(p => p.includes(filename) ? p.filter(f => f !== filename) : [...p, filename]);
  };

  const togglePendingDeleteSafezone = (filename) => {
    setPendingDeleteSafezones(p => p.includes(filename) ? p.filter(f => f !== filename) : [...p, filename]);
  };

  // ---- Pointer-based drag reorder helpers ----
  const startReorder = (kind, idx) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (kind === 'group') setGroupDrag({ from: idx, overIdx: idx });
    else setTemplateDrag({ from: idx, overIdx: idx });
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    if (!groupDrag && !templateDrag) return;
    const computeTarget = (clientY, nodes) => {
      let target = null;
      nodes.forEach((node, idx) => {
        if (!node) return;
        const r = node.getBoundingClientRect();
        if (clientY >= r.top && clientY <= r.bottom) target = idx;
      });
      return target;
    };
    const onMove = (e) => {
      if (groupDrag) {
        const t = computeTarget(e.clientY, groupNodes.current);
        if (t != null && t !== groupDrag.overIdx) setGroupDrag(d => d ? { ...d, overIdx: t } : d);
      }
      if (templateDrag) {
        const t = computeTarget(e.clientY, templateNodes.current);
        if (t != null && t !== templateDrag.overIdx) setTemplateDrag(d => d ? { ...d, overIdx: t } : d);
      }
    };
    const onUp = () => {
      if (groupDrag && groupDrag.from !== groupDrag.overIdx) {
        reorderGroups(groupDrag.from, groupDrag.overIdx);
      }
      if (templateDrag && templateDrag.from !== templateDrag.overIdx) {
        reorderTemplates(activePlatform, templateDrag.from, templateDrag.overIdx);
      }
      setGroupDrag(null);
      setTemplateDrag(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [groupDrag, templateDrag, activePlatform]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateIcon = (idx, field, val) => {
    setDraft(d => {
      const icons = d.complianceIcons.map((ic, i) => i === idx ? { ...ic, [field]: val } : ic);
      return { ...d, complianceIcons: icons };
    });
  };

  const deleteIcon = (idx) => {
    setDraft(d => ({ ...d, complianceIcons: d.complianceIcons.filter((_, i) => i !== idx) }));
  };

  const addIcon = () => {
    setDraft(d => ({ ...d, complianceIcons: [...d.complianceIcons, { filename: '', label: '' }] }));
  };

  const platformNames = Object.keys(draft.templates);

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name || draft.templates[name]) return;
    setDraft(d => ({ ...d, templates: { ...d.templates, [name]: [] } }));
    setActivePlatform(name);
    setNewGroupName('');
    setAddingGroup(false);
  };

  const deleteGroup = (name) => {
    if (name === 'Custom') return;
    setDraft(d => {
      const t = { ...d.templates };
      delete t[name];
      return { ...d, templates: t };
    });
    const remaining = platformNames.filter(p => p !== name);
    setActivePlatform(remaining[0] || '');
  };

  const updateTemplate = (platform, idx, field, val) => {
    setDraft(d => {
      const templates = d.templates[platform].map((t, i) => i === idx ? { ...t, [field]: val } : t);
      return { ...d, templates: { ...d.templates, [platform]: templates } };
    });
  };

  const toggleSafeArea = (platform, idx, hasIt) => {
    setDraft(d => {
      const templates = d.templates[platform].map((t, i) => {
        if (i !== idx) return t;
        if (hasIt) {
          const { safeArea, ...rest } = t;
          return rest;
        } else {
          return { ...t, safeArea: { top: '10%', bottom: '10%', left: '5%', right: '5%' } };
        }
      });
      return { ...d, templates: { ...d.templates, [platform]: templates } };
    });
  };

  const updateSafeArea = (platform, idx, field, val) => {
    setDraft(d => {
      const templates = d.templates[platform].map((t, i) => {
        if (i !== idx) return t;
        return { ...t, safeArea: { ...t.safeArea, [field]: val } };
      });
      return { ...d, templates: { ...d.templates, [platform]: templates } };
    });
  };

  const deleteTemplate = (platform, idx) => {
    setDraft(d => {
      const templates = d.templates[platform].filter((_, i) => i !== idx);
      return { ...d, templates: { ...d.templates, [platform]: templates } };
    });
  };

  const updateSafeAreaImage = (platform, idx, val) => {
    setDraft(d => {
      const templates = d.templates[platform].map((t, i) => {
        if (i !== idx) return t;
        if (!val) { const { safeAreaImage, ...rest } = t; return rest; }
        return { ...t, safeAreaImage: val };
      });
      return { ...d, templates: { ...d.templates, [platform]: templates } };
    });
  };

  const addTemplate = (platform) => {
    setDraft(d => {
      const templates = [...d.templates[platform], { id: generateId(), name: 'New Template', width: 1080, height: 1080, ratio: '1:1' }];
      return { ...d, templates: { ...d.templates, [platform]: templates } };
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-ink-900 border border-white/[0.08] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] shrink-0">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar nav */}
          <nav className="w-44 shrink-0 border-r border-white/[0.05] flex flex-col py-3 px-2 gap-0.5 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('icons')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'icons' ? 'bg-accent-bg text-accent-soft' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100'}`}
            >Compliance Icons</button>
            <button
              onClick={() => setActiveTab('safezones')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'safezones' ? 'bg-accent-bg text-accent-soft' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100'}`}
            >Safezones</button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-accent-bg text-accent-soft' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100'}`}
            >Output Templates</button>

            {activeTab === 'templates' && (
              <div className="mt-1 ml-1 border-l border-white/[0.08] pl-2 flex flex-col gap-0.5">
                {platformNames.map((name, idx) => {
                  const isOver = groupDrag && groupDrag.overIdx === idx && groupDrag.from !== idx;
                  const isDragging = groupDrag && groupDrag.from === idx;
                  return (
                    <div
                      key={name}
                      ref={(node) => { if (node) groupNodes.current.set(idx, node); else groupNodes.current.delete(idx); }}
                      className={`flex items-center group cursor-default rounded ${isOver ? 'bg-blue-500/20 ring-1 ring-accent-ring' : ''} ${isDragging ? 'opacity-50' : ''}`}
                    >
                      <span
                        onPointerDown={startReorder('group', idx)}
                        className="shrink-0 px-0.5 py-1.5 cursor-grab active:cursor-grabbing touch-none"
                        title="Drag to reorder"
                      >
                        <GripVertical size={11} className="text-slate-700 group-hover:text-ink-500" />
                      </span>
                      <button
                        onClick={() => setActivePlatform(name)}
                        className={`flex-1 text-left px-1.5 py-1.5 rounded text-xs font-medium transition-colors truncate ${activePlatform === name ? 'text-accent-soft bg-blue-500/10' : 'text-ink-500 hover:text-ink-100 hover:bg-ink-850'}`}
                      >{name}</button>
                      {name !== 'Custom' && (
                        <button
                          onClick={() => deleteGroup(name)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-0.5 rounded transition-all shrink-0"
                          title="Delete group"
                        ><Trash2 size={11} /></button>
                      )}
                    </div>
                  );
                })}
                {addingGroup ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName(''); }}}
                      placeholder="Name"
                      autoFocus
                      className="flex-1 bg-ink-850 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring min-w-0"
                    />
                    <button onClick={addGroup} className="text-green-400 hover:text-green-300 transition-colors shrink-0"><Plus size={13} /></button>
                    <button onClick={() => { setAddingGroup(false); setNewGroupName(''); }} className="text-ink-400 hover:text-white transition-colors shrink-0"><X size={13} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingGroup(true)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-ink-500 hover:text-ink-100 hover:bg-ink-850 rounded transition-colors mt-0.5"
                  ><Plus size={12} /> Add Group</button>
                )}
              </div>
            )}

            <button
              onClick={() => setActiveTab('export')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'export' ? 'bg-accent-bg text-accent-soft' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-100'}`}
            >Export</button>
          </nav>

          {/* Right scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {activeTab === 'icons' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-ink-500">
                  {complianceFiles.length > 0
                    ? `${complianceFiles.length} file${complianceFiles.length !== 1 ? 's' : ''} in the compliance folder.`
                    : 'No files in the compliance folder yet.'}
                </p>
                {Bridge.isTauri && (
                  <button
                    onClick={handleAddIconFiles}
                    className="text-xs flex items-center gap-1 bg-accent hover:bg-accent-soft text-white px-3 py-1.5 rounded-lg transition-colors"
                  ><Plus size={13} /> Add Icon</button>
                )}
              </div>
              {pendingDeleteIcons.length > 0 && (
                <p className="text-[10px] text-yellow-500">
                  {pendingDeleteIcons.length} file{pendingDeleteIcons.length !== 1 ? 's' : ''} marked for deletion. They will be removed from the folder when you click Save.
                </p>
              )}
              <div className="space-y-2">
                {draft.complianceIcons.map((icon, idx) => {
                  const inFolder = complianceFiles.includes(icon.filename);
                  const markedForDelete = pendingDeleteIcons.includes(icon.filename);
                  return (
                    <div key={idx} className={`bg-ink-850 border rounded-lg p-3 space-y-2 ${markedForDelete ? 'border-red-700/60 opacity-60' : inFolder ? 'border-white/[0.08]' : 'border-yellow-700/50'}`}>
                      <div className="flex items-center gap-2">
                        <img
                          src={iconUrls[icon.filename] || ''}
                          className="w-9 h-9 object-contain bg-ink-700 rounded shrink-0 border border-slate-600"
                          onError={(e) => { e.target.style.opacity = '0.2'; }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-ink-100 font-mono truncate">{icon.filename}</p>
                          {!inFolder && <p className="text-[10px] text-yellow-500">Not found in folder</p>}
                          {markedForDelete && <p className="text-[10px] text-red-400">Will be deleted on Save</p>}
                        </div>
                        {Bridge.isTauri && inFolder ? (
                          <button
                            onClick={() => togglePendingDeleteIcon(icon.filename)}
                            className={`transition-colors shrink-0 ${markedForDelete ? 'text-red-400 hover:text-red-300' : 'text-slate-600 hover:text-red-400'}`}
                            title={markedForDelete ? 'Undo delete' : 'Delete file from folder on save'}
                          ><Trash2 size={13} /></button>
                        ) : (
                          <button onClick={() => deleteIcon(idx)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3">
                          <label className="text-[10px] text-ink-500 block mb-0.5">Label</label>
                          <input
                            type="text"
                            value={icon.label}
                            onChange={(e) => updateIcon(idx, 'label', e.target.value)}
                            placeholder="Display label"
                            className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-500 block mb-0.5">Min Width (px)</label>
                          <input
                            type="number" min="1"
                            value={icon.minWidth ?? ''}
                            placeholder="none"
                            onChange={(e) => updateIcon(idx, 'minWidth', e.target.value === '' ? null : parseInt(e.target.value))}
                            className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-500 block mb-0.5">Min Height (px)</label>
                          <input
                            type="number" min="1"
                            value={icon.minHeight ?? ''}
                            placeholder="none"
                            onChange={(e) => updateIcon(idx, 'minHeight', e.target.value === '' ? null : parseInt(e.target.value))}
                            className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'safezones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-ink-500">
                  {safezoneFiles.length > 0
                    ? `${safezoneFiles.length} file${safezoneFiles.length !== 1 ? 's' : ''} in the safezones folder.`
                    : 'No files in the safezones folder yet.'}
                </p>
                {Bridge.isTauri && (
                  <button
                    onClick={handleAddSafezoneFiles}
                    className="text-xs flex items-center gap-1 bg-accent hover:bg-accent-soft text-white px-3 py-1.5 rounded-lg transition-colors"
                  ><Plus size={13} /> Add Safezone</button>
                )}
              </div>
              {pendingDeleteSafezones.length > 0 && (
                <p className="text-[10px] text-yellow-500">
                  {pendingDeleteSafezones.length} file{pendingDeleteSafezones.length !== 1 ? 's' : ''} marked for deletion. They will be removed from the folder when you click Save.
                </p>
              )}
              <div className="space-y-2">
                {safezoneFiles.map(filename => {
                  const markedForDelete = pendingDeleteSafezones.includes(filename);
                  return (
                    <div key={filename} className={`bg-ink-850 border rounded-lg p-3 flex items-center gap-2 ${markedForDelete ? 'border-red-700/60 opacity-60' : 'border-white/[0.08]'}`}>
                      <img
                        src={safezoneUrls[filename] || ''}
                        className="w-12 h-12 object-contain bg-ink-700 rounded shrink-0 border border-slate-600"
                        onError={(e) => { e.target.style.opacity = '0.2'; }}
                        alt={filename}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-ink-100 font-mono truncate" title={filename}>{filename}</p>
                        {markedForDelete && <p className="text-[10px] text-red-400">Will be deleted on Save</p>}
                      </div>
                      {Bridge.isTauri && (
                        <button
                          onClick={() => togglePendingDeleteSafezone(filename)}
                          className={`transition-colors shrink-0 ${markedForDelete ? 'text-red-400 hover:text-red-300' : 'text-slate-600 hover:text-red-400'}`}
                          title={markedForDelete ? 'Undo delete' : 'Delete file from folder on save'}
                        ><Trash2 size={13} /></button>
                      )}
                    </div>
                  );
                })}
                {safezoneFiles.length === 0 && (
                  <div className="text-center text-xs text-ink-500 py-6 border border-dashed border-white/[0.08] rounded-lg">
                    No safezone images yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              {activePlatform && draft.templates[activePlatform] && (
                <div className="space-y-2">
                  {draft.templates[activePlatform].map((t, idx) => {
                    const isOver = templateDrag && templateDrag.overIdx === idx && templateDrag.from !== idx;
                    const isDragging = templateDrag && templateDrag.from === idx;
                    return (
                    <div
                      key={t.id || idx}
                      ref={(node) => { if (node) templateNodes.current.set(idx, node); else templateNodes.current.delete(idx); }}
                      className={`bg-ink-850 border rounded-lg p-3 space-y-2 ${isOver ? 'border-accent-ring ring-1 ring-accent-ring' : 'border-white/[0.08]'} ${isDragging ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          onPointerDown={startReorder('template', idx)}
                          className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-1"
                          title="Drag to reorder"
                        >
                          <GripVertical size={14} className="text-slate-600 hover:text-ink-400" />
                        </span>
                        <input
                          type="text"
                          value={t.name}
                          onChange={(e) => updateTemplate(activePlatform, idx, 'name', e.target.value)}
                          placeholder="Name"
                          className="flex-1 bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                        />
                        <button onClick={() => deleteTemplate(activePlatform, idx)} className="text-red-400 hover:text-red-300 transition-colors shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-ink-500 block mb-0.5">Width</label>
                          <input
                            type="number"
                            value={t.width}
                            onChange={(e) => updateTemplate(activePlatform, idx, 'width', parseInt(e.target.value) || 0)}
                            className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-500 block mb-0.5">Height</label>
                          <input
                            type="number"
                            value={t.height}
                            onChange={(e) => updateTemplate(activePlatform, idx, 'height', parseInt(e.target.value) || 0)}
                            className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-ink-500 block mb-0.5">Ratio</label>
                          <input
                            type="text"
                            value={t.ratio}
                            onChange={(e) => updateTemplate(activePlatform, idx, 'ratio', e.target.value)}
                            className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`sa-${t.id || idx}`}
                          checked={!!t.safeArea}
                          onChange={(e) => toggleSafeArea(activePlatform, idx, !!t.safeArea)}
                          className="rounded"
                        />
                        <label htmlFor={`sa-${t.id || idx}`} className="text-xs text-ink-400 cursor-pointer">Has safe area</label>
                      </div>
                      {t.safeArea && (
                        <div className="grid grid-cols-4 gap-2">
                          {['top', 'bottom', 'left', 'right'].map(side => (
                            <div key={side}>
                              <label className="text-[10px] text-ink-500 block mb-0.5 capitalize">{side}</label>
                              <input
                                type="text"
                                value={t.safeArea[side]}
                                onChange={(e) => updateSafeArea(activePlatform, idx, side, e.target.value)}
                                className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] text-ink-500 block mb-1">Safe Zone Image</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={t.safeAreaImage || ''}
                            onChange={(e) => updateSafeAreaImage(activePlatform, idx, e.target.value)}
                            className="flex-1 bg-ink-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus-ring"
                          >
                            <option value="">— none —</option>
                            {safezoneFiles.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                          {t.safeAreaImage && (
                            <img
                              src={safezoneUrls[t.safeAreaImage] || `/safezones/${t.safeAreaImage}`}
                              alt="preview"
                              className="w-8 h-8 object-contain rounded border border-slate-600 shrink-0 bg-ink-850"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                  <button
                    onClick={() => addTemplate(activePlatform)}
                    className="text-xs flex items-center gap-1 bg-ink-850 hover:bg-ink-700 px-3 py-2 rounded-lg text-ink-100 transition-colors border border-white/[0.08] w-full justify-center"
                  >
                    <Plus size={14} /> Add Template
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-6">
              <section className="bg-ink-850 border border-white/[0.08] rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
                  <ImageIcon size={14} /> Static Image Export
                </h3>
                <p className="text-[11px] text-ink-500">Applied when rendering image inputs (JPG, PNG, WebP, etc.) — controls the format and quality of the output file.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-400 block mb-1">Format</label>
                    <select
                      value={draft.export.image.format}
                      onChange={(e) => setDraft(d => ({ ...d, export: { ...d.export, image: { ...d.export.image, format: e.target.value } } }))}
                      className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus-ring"
                    >
                      <option value="jpg">JPG</option>
                      <option value="png">PNG (24-bit)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-400 block mb-1">
                      Quality {draft.export.image.format === 'jpg' ? `(${draft.export.image.quality}%)` : '— N/A'}
                    </label>
                    <input
                      type="range" min="1" max="100" step="1"
                      value={draft.export.image.quality}
                      disabled={draft.export.image.format !== 'jpg'}
                      onChange={(e) => setDraft(d => ({ ...d, export: { ...d.export, image: { ...d.export.image, quality: parseInt(e.target.value) } } }))}
                      className="w-full h-1.5 bg-ink-700 rounded-lg appearance-none cursor-pointer range-slider disabled:opacity-40"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-ink-500">PNG ignores the quality slider — it's always lossless 24-bit.</p>
              </section>

              <section className="bg-ink-850 border border-white/[0.08] rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
                  <FileVideo size={14} /> Video Export
                </h3>
                <p className="text-[11px] text-ink-500">Applied when rendering video inputs. MP4 is preferred if the browser supports it; otherwise WebM is used as a fallback.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-ink-400 block mb-1">Format</label>
                    <select
                      value={draft.export.video.preferredFormat}
                      onChange={(e) => setDraft(d => ({ ...d, export: { ...d.export, video: { ...d.export.video, preferredFormat: e.target.value } } }))}
                      className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus-ring"
                    >
                      <option value="auto">Auto (MP4 if supported)</option>
                      <option value="webm">Force WebM</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-400 block mb-1">Bitrate (Mbps)</label>
                    <input
                      type="number" min="1" max="50" step="0.5"
                      value={Math.round((draft.export.video.bitrate / 1000000) * 10) / 10}
                      onChange={(e) => setDraft(d => ({ ...d, export: { ...d.export, video: { ...d.export.video, bitrate: Math.round(parseFloat(e.target.value || '0') * 1000000) } } }))}
                      className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-400 block mb-1">FPS</label>
                    <input
                      type="number" min="1" max="60" step="1"
                      value={draft.export.video.fps}
                      onChange={(e) => setDraft(d => ({ ...d, export: { ...d.export, video: { ...d.export.video, fps: parseInt(e.target.value) || 30 } } }))}
                      className="w-full bg-ink-900 border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus-ring"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-ink-500">Chrome and Edge produce MP4; Firefox and Safari fall back to WebM regardless of the preference above.</p>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <div>
                    <label className="text-xs text-ink-100 font-medium block">Render audio</label>
                    <p className="text-[11px] text-ink-500 mt-0.5">When off, output files are silent. Independent of the live preview volume.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.export.video.renderAudio !== false}
                    onClick={() => setDraft(d => ({ ...d, export: { ...d.export, video: { ...d.export.video, renderAudio: !(d.export.video.renderAudio !== false) } } }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-white/[0.08] transition-colors focus:outline-none focus-ring ${draft.export.video.renderAudio !== false ? 'bg-accent' : 'bg-ink-900'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${draft.export.video.renderAudio !== false ? 'translate-x-4' : 'translate-x-0.5'} mt-[1px]`} />
                  </button>
                </div>
              </section>
            </div>
          )}
          </div>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-white/[0.08] shrink-0 gap-3">
          <div className="flex-1">
            {savedIndicator && <span className="text-green-400 text-xs font-medium">Saved!</span>}
            {saveError && <span className="text-red-400 text-xs">{saveError}</span>}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-ink-850 hover:bg-ink-700 text-ink-100 rounded-lg border border-white/[0.08] transition-colors"
          >Cancel</button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-accent hover:bg-accent-soft text-white rounded-lg font-medium transition-colors"
          >Save</button>
        </div>
      </div>
    </div>
  );
}

// Helper icons
function VideoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-accent-soft">
      <path d="m22 8-6 4 6 4V8Z"/>
      <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
    </svg>
  )
}
