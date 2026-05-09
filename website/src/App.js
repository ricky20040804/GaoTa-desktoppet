import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Brush,
  Eraser,
  ImagePlus,
  Minus,
  Move,
  PaintBucket,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import JSZip from 'jszip';
import './App.css';
import { animalOptions, getPetTemplatesByAnimal } from './data/petCatalog';

const WHEEL_CENTER = { x: 620, y: 330 };
const SNAP_DURATION = 320;
const PAINT_CANVAS_SIZE = 550;
const TRANSPARENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/lzqY9QAAAABJRU5ErkJggg==';

const paintTools = [
  { id: 'move', label: 'Move', Icon: Move },
  { id: 'brush', label: 'Brush', Icon: Brush },
  { id: 'eraser', label: 'Eraser', Icon: Eraser },
  { id: 'fill', label: 'Fill', Icon: PaintBucket },
];

const paintColors = [
  '#221f28',
  '#ffffff',
  '#ff4d6d',
  '#ff9f43',
  '#ffd166',
  '#38b76b',
  '#3d8bff',
  '#8f5cff',
];

const brushSizes = [3, 6, 12, 22];
const studioSlideOptions = [
  {
    title: '生成卡通的专属宠物',
    subtitle: 'Generate exclusive pets for cartoons',
  },
  {
    title: '生成实际的专属宠物',
    subtitle: 'Generate an actual exclusive pet',
  },
];

const partNames = [
  'Overview',
  'head',
  'tail',
  'body',
  'leftfrontleg',
  'leftbackleg',
  'rightfrontleg',
  'rightbackleg',
];

const realPetPartOptions = partNames.map((label) => ({
  id: label.toLowerCase(),
  label,
}));
const realPetPreviewOptions = [{ id: 'assembly', label: 'Assembly' }, ...realPetPartOptions];

const exportPartConfig = {
  body: { bone: 'body', position: { x: 176, y: 196 }, pivot: { x: 128, y: 98 }, zIndex: 3 },
  head: { bone: 'head', position: { x: 118, y: 110 }, pivot: { x: 106, y: 116 }, zIndex: 4 },
  tail: { bone: 'tail', position: { x: 330, y: 156 }, pivot: { x: 34, y: 96 }, zIndex: 2 },
  leftfrontleg: { bone: 'leftfrontLeg', position: { x: 170, y: 322 }, pivot: { x: 54, y: 28 }, zIndex: 5 },
  leftbackleg: { bone: 'leftbackLeg', position: { x: 274, y: 326 }, pivot: { x: 52, y: 28 }, zIndex: 1 },
  rightfrontleg: { bone: 'rightfrontLeg', position: { x: 216, y: 324 }, pivot: { x: 54, y: 28 }, zIndex: 6 },
  rightbackleg: { bone: 'rightbackLeg', position: { x: 322, y: 326 }, pivot: { x: 52, y: 28 }, zIndex: 0 },
};

const exportMotion = {
  motionVersion: 1,
  defaultMotion: 'walk',
  motions: {
    idle: {
      duration: 1,
      loop: true,
      bones: {
        tail: [
          { time: 0, rotation: -32 },
          { time: 0.25, rotation: 0 },
          { time: 0.5, rotation: 32 },
          { time: 0.75, rotation: 0 },
          { time: 1, rotation: -32 },
        ],
      },
    },
    walk: {
      duration: 1,
      loop: true,
      bones: {
        body: [
          { time: 0, y: 0 },
          { time: 0.25, y: -4 },
          { time: 0.5, y: 0 },
          { time: 0.75, y: -4 },
          { time: 1, y: 0 },
        ],
        head: [
          { time: 0, rotation: -2 },
          { time: 0.5, rotation: 2 },
          { time: 1, rotation: -2 },
        ],
        tail: [
          { time: 0, rotation: -32 },
          { time: 0.25, rotation: 0 },
          { time: 0.5, rotation: 32 },
          { time: 0.75, rotation: 0 },
          { time: 1, rotation: -32 },
        ],
        leftfrontLeg: [
          { time: 0, rotation: -12 },
          { time: 0.5, rotation: 12 },
          { time: 1, rotation: -12 },
        ],
        leftbackLeg: [
          { time: 0, rotation: 12 },
          { time: 0.5, rotation: -12 },
          { time: 1, rotation: 12 },
        ],
        rightfrontLeg: [
          { time: 0, rotation: 12 },
          { time: 0.5, rotation: -12 },
          { time: 1, rotation: 12 },
        ],
        rightbackLeg: [
          { time: 0, rotation: -12 },
          { time: 0.5, rotation: 12 },
          { time: 1, rotation: -12 },
        ],
      },
    },
  },
};

const features = [
  {
    title: 'AI Chat',
    text: 'Talk with your desktop pet whenever you need a spark, a break, or a tiny bit of company.',
    icon: 'AI',
  },
  {
    title: 'Desktop Companion',
    text: 'Keep a warm little presence on your desktop while you work, browse, and create.',
    icon: 'DC',
  },
  {
    title: 'Custom Character',
    text: 'Shape the companion personality, look, and mood so it feels unmistakably yours.',
    icon: 'CC',
  },
  {
    title: 'Smooth Animations',
    text: 'Enjoy fluid reactions, playful motion, and interactions that feel light and alive.',
    icon: 'SA',
  },
];

const normalizeIndex = (index, length) => ((index % length) + length) % length;

const dataUrlToBlob = (dataUrl) => {
  const [metadata, base64] = dataUrl.split(',');
  const mimeType = metadata.match(/data:(.*);base64/)?.[1] ?? 'application/octet-stream';
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

const downloadBlob = (blob, fileName) => {
  const downloadURL = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadURL;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadURL), 0);
};

const getCircularDelta = (index, selectedIndex, length) => {
  let delta = index - selectedIndex;

  if (delta > length / 2) {
    delta -= length;
  }

  if (delta < -length / 2) {
    delta += length;
  }

  return delta;
};

function WheelLayer({
  ariaLabel,
  className,
  dragOffset,
  items,
  isDragging,
  onSelect,
  radius,
  selectedIndex,
  showThumb = false,
  step,
  renderThumb,
  wheelId,
}) {
  const positionedItems = useMemo(() => {
    const rawItems = items.map((item, index) => {
      const angle = getCircularDelta(index, selectedIndex, items.length) * step + dragOffset;
      const radians = (angle * Math.PI) / 180;
      const x = WHEEL_CENTER.x - radius * Math.cos(radians);
      const y = WHEEL_CENTER.y + radius * Math.sin(radians);

      return {
        ...item,
        angle,
        index,
        x,
        y,
      };
    });

    const activeItem = rawItems.reduce((closest, item) => {
      if (!closest || Math.abs(item.angle) < Math.abs(closest.angle)) {
        return item;
      }

      return closest;
    }, null);

    return rawItems.map((item) => ({
      ...item,
      isActive: activeItem?.index === item.index,
      isHidden: Math.abs(item.angle) > 83,
      isSoft: Math.abs(item.angle) > 62,
    }));
  }, [dragOffset, items, radius, selectedIndex, step]);

  return (
    <div
      aria-label={ariaLabel}
      className={`wheel-layer ${className} ${isDragging ? 'is-dragging' : ''}`}
      role="group"
      style={{
        '--diameter': `${radius * 2}px`,
        '--ring-left': `${WHEEL_CENTER.x - radius}px`,
        '--ring-top': `${WHEEL_CENTER.y - radius}px`,
      }}
    >
      <div className="wheel-arc" />
      {positionedItems.map((item) => (
        <button
          aria-pressed={item.index === selectedIndex}
          className={`wheel-option ${item.isActive ? 'is-active' : ''} ${
            item.isSoft ? 'is-soft' : ''
          } ${item.isHidden ? 'is-hidden' : ''}`}
          key={item.id}
          data-index={item.index}
          data-wheel={wheelId}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(item.index, item.angle);
          }}
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
          }}
          type="button"
        >
          {showThumb && (
            <span className="option-thumb" aria-hidden="true">
              {renderThumb?.(item)}
            </span>
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

const getPartFileName = (imagePath) => imagePath.split('/').filter(Boolean).pop();

const getPartImageSrc = (partsBasePath, imagePath) => {
  const fileName = getPartFileName(imagePath);

  return `${partsBasePath.replace(/\/$/, '')}/${fileName}`;
};

const getTemplateParts = (template) =>
  Object.entries(template?.parts ?? {})
    .map(([partId, part]) => ({ partId, ...part }))
    .sort((left, right) => left.zIndex - right.zIndex);

const findTemplatePart = (template, partId) => {
  const normalizedPartId = String(partId ?? '').toLowerCase();

  return getTemplateParts(template).find(
    (part) =>
      part.partId?.toLowerCase() === normalizedPartId ||
      part.bone?.toLowerCase() === normalizedPartId,
  );
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const hexToRgb = (hex) => {
  const cleanHex = hex.replace('#', '');
  const value = Number.parseInt(cleanHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

function PetLayerStack({ className = '', maxHeight, maxWidth, selectedTemplate, template }) {
  if (!selectedTemplate || !template) {
    return null;
  }

  const canvas = template.canvas ?? { width: 512, height: 512 };
  const previewScale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const parts = getTemplateParts(template);

  return (
    <div
      className={`pet-preview-stage ${className}`}
      style={{
        '--template-width': canvas.width,
        '--template-height': canvas.height,
        '--preview-scale': previewScale,
      }}
    >
      <div
        className="pet-preview-layers"
        style={{
          height: `${canvas.height}px`,
          width: `${canvas.width}px`,
        }}
      >
        {parts.map((part) => {
          const partScale = part.scale ?? 1;
          const width = part.size.width * partScale;
          const height = part.size.height * partScale;
          const pivotX = part.pivot.x * partScale;
          const pivotY = part.pivot.y * partScale;

          return (
            <img
              alt=""
              aria-hidden="true"
              className="pet-preview-part"
              key={part.partId}
              src={getPartImageSrc(selectedTemplate.partsBasePath, part.image)}
              style={{
                height: `${height}px`,
                left: `${part.position.x}px`,
                top: `${part.position.y}px`,
                transform: `rotate(${part.rotation ?? 0}deg)`,
                transformOrigin: `${pivotX}px ${pivotY}px`,
                width: `${width}px`,
                zIndex: part.zIndex,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function RealPetStudio() {
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const maskHistoryRef = useRef([]);
  const maskDrawingRef = useRef(false);
  const assemblyDragRef = useRef(null);
  const lastMaskPointRef = useRef(null);
  const [imageSrc, setImageSrc] = useState('');
  const [activePartId, setActivePartId] = useState('head');
  const [activeCutTool, setActiveCutTool] = useState('brush');
  const [cutBrushSize, setCutBrushSize] = useState(34);
  const [previewPartId, setPreviewPartId] = useState('overview');
  const [canUndoMask, setCanUndoMask] = useState(false);
  const [cutParts, setCutParts] = useState({});
  const [cutPartSizes, setCutPartSizes] = useState({});
  const [partLayouts, setPartLayouts] = useState({});
  const [isPivotModalOpen, setIsPivotModalOpen] = useState(false);
  const [pivotModalMessage, setPivotModalMessage] = useState('');

  const activePart = realPetPartOptions.find((part) => part.id === activePartId);
  const previewPart = realPetPartOptions.find((part) => part.id === previewPartId);

  const selectRealPetPart = (partId) => {
    setPreviewPartId(partId);

    if (partId !== 'overview' && partId !== 'assembly') {
      setActivePartId(partId);
    }
  };

  const resizeMaskCanvas = () => {
    const canvas = maskCanvasRef.current;
    const stage = canvas?.parentElement;

    if (!canvas || !stage) {
      return;
    }

    canvas.width = Math.round(stage.clientWidth);
    canvas.height = Math.round(stage.clientHeight);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    maskHistoryRef.current = [];
    setCanUndoMask(false);
  };

  const loadFile = (file) => {
    if (!file?.type.startsWith('image/')) {
      return;
    }

    const nextSrc = URL.createObjectURL(file);

    setImageSrc((currentSrc) => {
      if (currentSrc) {
        URL.revokeObjectURL(currentSrc);
      }

      return nextSrc;
    });
    setCutParts({});
    setCutPartSizes({});
    setPartLayouts({});
    setPreviewPartId('overview');
    setActivePartId('head');
    window.setTimeout(resizeMaskCanvas, 0);
  };

  useEffect(
    () => () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    },
    [imageSrc],
  );

  const handleDrop = (event) => {
    event.preventDefault();
    loadFile(event.dataTransfer.files[0]);
  };

  const saveMaskHistory = () => {
    const canvas = maskCanvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    maskHistoryRef.current = [...maskHistoryRef.current.slice(-11), context.getImageData(0, 0, canvas.width, canvas.height)];
    setCanUndoMask(true);
  };

  const getMaskPoint = (event) => {
    const bounds = maskCanvasRef.current.getBoundingClientRect();

    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const paintMaskLine = (fromPoint, toPoint) => {
    const canvas = maskCanvasRef.current;
    const context = canvas?.getContext('2d');

    if (!context) {
      return;
    }

    context.save();
    context.globalCompositeOperation = activeCutTool === 'eraser' ? 'destination-out' : 'source-over';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = cutBrushSize;
    context.strokeStyle = 'rgba(61, 139, 255, 0.68)';
    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
    context.restore();
  };

  const beginMaskPaint = (event) => {
    if (!imageSrc) {
      return;
    }

    event.preventDefault();
    saveMaskHistory();
    maskDrawingRef.current = true;
    lastMaskPointRef.current = getMaskPoint(event);
    paintMaskLine(lastMaskPointRef.current, lastMaskPointRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMaskMove = (event) => {
    if (!maskDrawingRef.current) {
      return;
    }

    const nextPoint = getMaskPoint(event);
    paintMaskLine(lastMaskPointRef.current, nextPoint);
    lastMaskPointRef.current = nextPoint;
  };

  const finishMaskPaint = (event) => {
    if (maskDrawingRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    maskDrawingRef.current = false;
    lastMaskPointRef.current = null;
  };

  const undoMask = () => {
    const canvas = maskCanvasRef.current;
    const previousMask = maskHistoryRef.current.pop();

    if (!canvas || !previousMask) {
      return;
    }

    canvas.getContext('2d').putImageData(previousMask, 0, 0);
    setCanUndoMask(maskHistoryRef.current.length > 0);
  };

  const resetMask = () => {
    const canvas = maskCanvasRef.current;

    if (!canvas) {
      return;
    }

    saveMaskHistory();
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCutPart = () => {
    const image = imageRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (!image || !maskCanvas || !activePart) {
      return;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const stageWidth = maskCanvas.width;
    const stageHeight = maskCanvas.height;
    const imageScale = Math.min(stageWidth / image.naturalWidth, stageHeight / image.naturalHeight);
    const drawnWidth = image.naturalWidth * imageScale;
    const drawnHeight = image.naturalHeight * imageScale;
    const drawnX = (stageWidth - drawnWidth) / 2;
    const drawnY = (stageHeight - drawnHeight) / 2;

    canvas.width = stageWidth;
    canvas.height = stageHeight;
    context.drawImage(image, drawnX, drawnY, drawnWidth, drawnHeight);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(maskCanvas, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (imageData.data[(y * canvas.width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (minX > maxX || minY > maxY) {
      return;
    }

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = maxX - minX + 1;
    trimmedCanvas.height = maxY - minY + 1;
    trimmedCanvas
      .getContext('2d')
      .drawImage(canvas, minX, minY, trimmedCanvas.width, trimmedCanvas.height, 0, 0, trimmedCanvas.width, trimmedCanvas.height);

    setCutParts((currentParts) => ({
      ...currentParts,
      [activePart.id]: trimmedCanvas.toDataURL('image/png'),
    }));
    setCutPartSizes((currentSizes) => ({
      ...currentSizes,
      [activePart.id]: {
        height: trimmedCanvas.height,
        width: trimmedCanvas.width,
      },
    }));
    setPartLayouts((currentLayouts) => ({
      ...currentLayouts,
      [activePart.id]: currentLayouts[activePart.id] ?? {
        position: exportPartConfig[activePart.id]?.position ?? { x: 180, y: 180 },
        pivot: {
          x: Math.round(trimmedCanvas.width / 2),
          y: Math.round(trimmedCanvas.height / 2),
        },
      },
    }));
    setPreviewPartId(activePart.id);
  };

  const getStagePoint = (event, stage) => {
    const bounds = stage.getBoundingClientRect();
    const scale = 512 / bounds.width;

    return {
      x: (event.clientX - bounds.left) * scale,
      y: (event.clientY - bounds.top) * scale,
    };
  };

  const getAssemblyPoint = (event) => getStagePoint(event, event.currentTarget);

  const beginPartLayoutDrag = (event, partId, mode, stageSelector) => {
    event.preventDefault();
    event.stopPropagation();
    const stage = event.currentTarget.closest(stageSelector);

    if (!stage) {
      return;
    }

    const startPoint = getStagePoint(event, stage);

    setActivePartId(partId);
    assemblyDragRef.current = {
      layout: partLayouts[partId],
      mode,
      partId,
      startPoint,
    };
  };

  const beginAssemblyDrag = (event, partId, mode) => {
    setPreviewPartId('assembly');
    beginPartLayoutDrag(event, partId, mode, '.real-pet-assembly-stage');
  };

  const beginPivotModalDrag = (event, partId, mode) => {
    beginPartLayoutDrag(event, partId, mode, '.pivot-modal-stage');
  };

  const handleLayoutMove = (point) => {
    const dragState = assemblyDragRef.current;

    if (!dragState) {
      return;
    }

    const deltaX = point.x - dragState.startPoint.x;
    const deltaY = point.y - dragState.startPoint.y;
    const size = cutPartSizes[dragState.partId] ?? { width: 1, height: 1 };

    setPartLayouts((currentLayouts) => {
      const baseLayout = dragState.layout ?? currentLayouts[dragState.partId];
      const nextLayout = {
        position: { ...baseLayout.position },
        pivot: { ...baseLayout.pivot },
      };

      if (dragState.mode === 'part') {
        nextLayout.position.x = Math.round(baseLayout.position.x + deltaX);
        nextLayout.position.y = Math.round(baseLayout.position.y + deltaY);
      } else {
        nextLayout.pivot.x = Math.round(Math.min(size.width, Math.max(0, baseLayout.pivot.x + deltaX)));
        nextLayout.pivot.y = Math.round(Math.min(size.height, Math.max(0, baseLayout.pivot.y + deltaY)));
      }

      return {
        ...currentLayouts,
        [dragState.partId]: nextLayout,
      };
    });
  };

  const handleAssemblyMove = (event) => {
    handleLayoutMove(getAssemblyPoint(event));
  };

  const handlePivotModalMove = (event) => {
    handleLayoutMove(getStagePoint(event, event.currentTarget));
  };

  const finishAssemblyDrag = () => {
    assemblyDragRef.current = null;
  };

  const exportRealPetZip = async () => {
    if (cutPartEntries.length === 0) {
      setPivotModalMessage('请先导入图片，抠出至少一个部位，并点击 Save 保存切件。');
      return;
    }

    try {
      const zip = new JSZip();
      const partsFolder = zip.folder('parts');
      const exportPartIds = Object.keys(exportPartConfig);
      const template = {
        templateId: 'user_custom_pet',
        canvas: {
          width: 512,
          height: 512,
        },
        parts: {},
      };

      exportPartIds.forEach((partId) => {
        const partConfig = exportPartConfig[partId];
        const size = cutPartSizes[partId] ?? { width: 1, height: 1 };
        const layout = partLayouts[partId] ?? {
          position: partConfig.position,
          pivot: cutParts[partId] ? partConfig.pivot : { x: 0, y: 0 },
        };

        template.parts[partConfig.bone] = {
          image: `parts/${partId}.png`,
          bone: partConfig.bone,
          position: layout.position,
          pivot: layout.pivot,
          size,
          scale: 1,
          rotation: 0,
          zIndex: partConfig.zIndex,
        };

        partsFolder.file(`${partId}.png`, dataUrlToBlob(cutParts[partId] ?? TRANSPARENT_PNG_DATA_URL));
      });

      zip.file('template.json', JSON.stringify(template, null, 2));
      zip.file('motion.json', JSON.stringify(exportMotion, null, 2));

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'custom_pet.zip');
    } catch (error) {
      setPivotModalMessage('导出失败，请再试一次。');
    }
  };

  const openPivotModalBeforeExport = () => {
    setPivotModalMessage('');

    if (cutPartEntries.length === 0) {
      setPivotModalMessage('请先导入图片，抠出至少一个部位，并点击 Save 保存切件。');
      setIsPivotModalOpen(true);
      return;
    }

    if (!cutParts[activePartId] && cutPartEntries[0]) {
      setActivePartId(cutPartEntries[0].id);
    }
    setIsPivotModalOpen(true);
  };

  const cutPartEntries = realPetPartOptions.filter((part) => part.id !== 'overview' && cutParts[part.id]);

  return (
    <>
      <div className="studio-heading">
        <p className="eyebrow">Real pet studio</p>
        <h1>Build from a real pet photo</h1>
      </div>

      <div className="real-pet-cutout-panel">
        <div className="real-pet-cutout-background" aria-hidden="true">
          <video
            autoPlay
            className="real-pet-cutout-background-video"
            loop
            muted
            playsInline
            src="/cover1.mov?v=20260507153031"
          />
        </div>
        <div
          className={`real-pet-dropzone ${imageSrc ? 'has-image' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          {imageSrc ? (
            <div
              className="real-pet-image-stage"
              onPointerCancel={finishMaskPaint}
              onPointerDown={beginMaskPaint}
              onPointerMove={handleMaskMove}
              onPointerUp={finishMaskPaint}
              style={{ '--cut-brush-size': `${cutBrushSize}px` }}
            >
              <img
                alt="Uploaded real pet"
                className="real-pet-source-image"
                onLoad={resizeMaskCanvas}
                ref={imageRef}
                src={imageSrc}
              />
              <canvas className="real-pet-mask-canvas" ref={maskCanvasRef} />
              <span className="real-pet-active-part-label">{activePart?.label}</span>
            </div>
          ) : (
            <button className="real-pet-upload-prompt" onClick={() => fileInputRef.current?.click()} type="button">
              <strong>拖入真实宠物图片</strong>
              <span>PNG 或 JPG</span>
            </button>
          )}
          <input
            accept="image/png,image/jpeg,image/webp"
            className="real-pet-file-input"
            onChange={(event) => loadFile(event.target.files[0])}
            ref={fileInputRef}
            type="file"
          />
        </div>

        <div className="real-pet-cutout-toolbar" aria-label="Real pet cutout tools">
          <div className="real-pet-tool-set" aria-label="Cutout tools">
            <span className="real-pet-tool-group-label">Tools</span>
            <button
              aria-label="抠图笔"
              aria-pressed={activeCutTool === 'brush'}
              className="real-pet-icon-tool"
              onClick={() => setActiveCutTool('brush')}
              title="抠图笔"
              type="button"
            >
              <Brush size={18} strokeWidth={2.25} />
            </button>
            <button
              aria-label="橡皮擦"
              aria-pressed={activeCutTool === 'eraser'}
              className="real-pet-icon-tool"
              onClick={() => setActiveCutTool('eraser')}
              title="橡皮擦"
              type="button"
            >
              <Eraser size={18} strokeWidth={2.25} />
            </button>
          </div>

          <div className="real-pet-tool-set real-pet-size-set" aria-label="Cutout brush size">
            <span className="real-pet-tool-group-label">Size</span>
            <input
              aria-label="Cutout brush size"
              max="72"
              min="12"
              onChange={(event) => setCutBrushSize(Number(event.target.value))}
              step="2"
              type="range"
              value={cutBrushSize}
            />
            <span className="real-pet-size-value">{cutBrushSize}px</span>
          </div>

          <div className="real-pet-tool-set" aria-label="Cutout actions">
            <span className="real-pet-tool-group-label">Edit</span>
            <button
              aria-label="回退"
              className="real-pet-icon-tool"
              disabled={!canUndoMask}
              onClick={undoMask}
              title="回退"
              type="button"
            >
              <Undo2 size={18} strokeWidth={2.25} />
            </button>
            <button
              aria-label="Reset"
              className="real-pet-icon-tool"
              disabled={!imageSrc}
              onClick={resetMask}
              title="Reset"
              type="button"
            >
              <RotateCcw size={18} strokeWidth={2.25} />
            </button>
            <button
              aria-label="重新导入图片"
              className="real-pet-icon-tool"
              onClick={() => fileInputRef.current?.click()}
              title="重新导入图片"
              type="button"
            >
              <ImagePlus size={18} strokeWidth={2.25} />
            </button>
            <button
              aria-label={`保存为 ${activePart?.label}`}
              className="real-pet-icon-tool is-save"
              disabled={!imageSrc}
              onClick={saveCutPart}
              title={`保存为 ${activePart?.label}`}
              type="button"
            >
              <Save size={18} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="real-pet-part-picker" aria-label="Choose part to cut">
          {realPetPartOptions
            .filter((part) => part.id !== 'overview')
            .map((part) => (
              <button
                aria-pressed={activePartId === part.id}
                className="real-pet-part-chip"
                key={part.id}
                onClick={() => selectRealPetPart(part.id)}
                type="button"
              >
                {part.label}
              </button>
            ))}
        </div>

      </div>

      <div className="real-pet-preview-panel">
        <div className="real-pet-preview-tabs" aria-label="Preview real pet parts">
          {realPetPreviewOptions.map((part) => (
            <button
              aria-pressed={previewPartId === part.id}
              className="real-pet-preview-tab"
              key={part.id}
              onClick={() => selectRealPetPart(part.id)}
              type="button"
            >
              {part.label}
            </button>
          ))}
        </div>

        <div className="real-pet-preview-display">
          {previewPartId === 'assembly' ? (
            cutPartEntries.length > 0 ? (
              <div
                className="real-pet-assembly-stage"
                onPointerCancel={finishAssemblyDrag}
                onPointerMove={handleAssemblyMove}
                onPointerUp={finishAssemblyDrag}
              >
                {cutPartEntries.map((part) => {
                  const layout = partLayouts[part.id];
                  const size = cutPartSizes[part.id];

                  if (!layout || !size) {
                    return null;
                  }

                  return (
                    <div
                      className={`real-pet-assembly-part ${activePartId === part.id ? 'is-active' : ''}`}
                      key={part.id}
                      style={{
                        height: `${size.height}px`,
                        left: `${layout.position.x}px`,
                        top: `${layout.position.y}px`,
                        width: `${size.width}px`,
                        zIndex: exportPartConfig[part.id]?.zIndex ?? 1,
                      }}
                    >
                      <img
                        alt=""
                        draggable="false"
                        onPointerDown={(event) => beginAssemblyDrag(event, part.id, 'part')}
                        src={cutParts[part.id]}
                      />
                      {activePartId === part.id && (
                        <button
                          aria-label={`Move ${part.label} pivot`}
                          className="real-pet-pivot-handle"
                          onPointerDown={(event) => beginAssemblyDrag(event, part.id, 'pivot')}
                          style={{
                            left: `${layout.pivot.x}px`,
                            top: `${layout.pivot.y}px`,
                          }}
                          title={`${part.label} pivot`}
                          type="button"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="real-pet-empty-state">保存切件后进入 Assembly 拼装位置和 pivot</div>
            )
          ) : previewPartId === 'overview' ? (
            cutPartEntries.length > 0 ? (
              <div className="real-pet-overview-grid">
                {cutPartEntries.map((part) => (
                  <figure className="real-pet-overview-card" key={part.id}>
                    <img alt="" src={cutParts[part.id]} />
                    <figcaption>{part.label}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="real-pet-empty-state">保存切件后会在这里生成 overview</div>
            )
          ) : cutParts[previewPartId] ? (
            <figure className="real-pet-single-preview">
              <img alt={`${previewPart?.label} cutout`} src={cutParts[previewPartId]} />
              <figcaption>{previewPart?.label}</figcaption>
            </figure>
          ) : (
            <div className="real-pet-empty-state">还没有保存 {previewPart?.label}</div>
          )}
        </div>

        <button
          className="real-pet-generate-button"
          onClick={openPivotModalBeforeExport}
          type="button"
        >
          Generate Pet
        </button>
      </div>

      {isPivotModalOpen && createPortal(
        <div
          className="pivot-modal-overlay"
          onMouseDown={() => setIsPivotModalOpen(false)}
          role="presentation"
        >
          <section
            aria-label="Set pet part pivots"
            aria-modal="true"
            className="pivot-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button
              aria-label="Close pivot editor"
              className="pivot-modal-close"
              onClick={() => setIsPivotModalOpen(false)}
              type="button"
            >
              <X size={22} strokeWidth={2.4} />
            </button>

            <div className="pivot-modal-copy">
              <p className="eyebrow">Pivot editor</p>
              <h2>设定每个切件的旋转中心</h2>
              <p>
                {cutPartEntries.length > 0
                  ? '你保存好的 PNG 切件已经自动导入。选择部位后拖动蓝色小点来设置 pivot；需要微调拼装位置时，也可以拖动切件本身。'
                  : '这里会自动载入你已经 Save 的透明 PNG 切件。当前还没有可导出的切件，请先回到抠图画板保存至少一个部位。'}
              </p>
              {pivotModalMessage && <div className="pivot-modal-message">{pivotModalMessage}</div>}
            </div>

            <div className="pivot-modal-body">
              <div
                className="pivot-modal-stage"
                onPointerCancel={finishAssemblyDrag}
                onPointerMove={handlePivotModalMove}
                onPointerUp={finishAssemblyDrag}
              >
                {cutPartEntries.length > 0 ? (
                  cutPartEntries.map((part) => {
                    const layout = partLayouts[part.id];
                    const size = cutPartSizes[part.id];

                    if (!layout || !size) {
                      return null;
                    }

                    return (
                      <div
                        className={`pivot-modal-part ${activePartId === part.id ? 'is-active' : ''}`}
                        key={part.id}
                        style={{
                          height: `${size.height}px`,
                          left: `${layout.position.x}px`,
                          top: `${layout.position.y}px`,
                          width: `${size.width}px`,
                          zIndex: exportPartConfig[part.id]?.zIndex ?? 1,
                        }}
                      >
                        <img
                          alt=""
                          draggable="false"
                          onPointerDown={(event) => beginPivotModalDrag(event, part.id, 'part')}
                          src={cutParts[part.id]}
                        />
                        {activePartId === part.id && (
                          <button
                            aria-label={`Move ${part.label} pivot`}
                            className="pivot-modal-handle"
                            onPointerDown={(event) => beginPivotModalDrag(event, part.id, 'pivot')}
                            style={{
                              left: `${layout.pivot.x}px`,
                              top: `${layout.pivot.y}px`,
                            }}
                            title={`${part.label} pivot`}
                            type="button"
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="pivot-modal-empty-state">
                    <strong>还没有保存切件</strong>
                    <span>先选择 head、body、tail 或四肢，用抠图笔涂出区域，然后点击 Save。</span>
                  </div>
                )}
              </div>

              <aside className="pivot-modal-sidebar">
                <div className="pivot-modal-tabs" aria-label="Choose part pivot">
                  {cutPartEntries.map((part) => (
                    <button
                      aria-pressed={activePartId === part.id}
                      className="pivot-modal-tab"
                      key={part.id}
                      onClick={() => setActivePartId(part.id)}
                      type="button"
                    >
                      {part.label}
                    </button>
                  ))}
                </div>
                <div className="pivot-modal-readout">
                  <strong>{cutPartEntries.length > 0 ? activePart?.label : '等待切件'}</strong>
                  <span>
                    {cutPartEntries.length > 0
                      ? `pivot x ${Math.round(partLayouts[activePartId]?.pivot?.x ?? 0)} / y ${Math.round(
                          partLayouts[activePartId]?.pivot?.y ?? 0,
                        )}`
                      : '保存切件后这里会显示 pivot 坐标'}
                  </span>
                </div>
                <button
                  className="pivot-modal-export"
                  disabled={cutPartEntries.length === 0}
                  onClick={async () => {
                    await exportRealPetZip();
                    setIsPivotModalOpen(false);
                  }}
                  type="button"
                >
                  Confirm & Download
                </button>
              </aside>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

function InteractivePetPreview({ selectedPart, selectedTemplate, status, template }) {
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 2.2;
  const baseCanvasRef = useRef(null);
  const dragState = useRef(null);
  const editCanvasRef = useRef(null);
  const editedPartsRef = useRef({});
  const lastPointRef = useRef(null);
  const redoStackRef = useRef([]);
  const undoStackRef = useRef([]);
  const [activeTool, setActiveTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(6);
  const [canRedo, setCanRedo] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [color, setColor] = useState(paintColors[0]);
  const [editedParts, setEditedParts] = useState({});
  const [isInteracting, setIsInteracting] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const selectedPartId = selectedPart?.partId ?? 'overview';
  const selectedEditKey = `${selectedTemplate?.templatePath ?? 'empty'}:${selectedPartId}`;
  const zoomProgress = ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;

  useEffect(() => {
    editedPartsRef.current = editedParts;
  }, [editedParts]);

  useEffect(() => {
    dragState.current = null;
    lastPointRef.current = null;
    setIsInteracting(false);
    setPan({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
  }, [selectedEditKey]);

  const clampZoom = (nextZoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));

  const refreshHistoryState = () => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const getEditContext = () => editCanvasRef.current?.getContext('2d');

  const saveEditedPart = () => {
    const editCanvas = editCanvasRef.current;

    if (!editCanvas) {
      return;
    }

    setEditedParts((current) => ({
      ...current,
      [selectedEditKey]: editCanvas.toDataURL('image/png'),
    }));
  };

  const pushHistory = () => {
    const context = getEditContext();

    if (!context) {
      return;
    }

    undoStackRef.current = [
      ...undoStackRef.current.slice(-24),
      context.getImageData(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE),
    ];
    redoStackRef.current = [];
    refreshHistoryState();
  };

  const getCanvasPoint = (event) => {
    const bounds = editCanvasRef.current.getBoundingClientRect();

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * PAINT_CANVAS_SIZE,
      y: ((event.clientY - bounds.top) / bounds.height) * PAINT_CANVAS_SIZE,
    };
  };

  const paintLine = (fromPoint, toPoint) => {
    const context = getEditContext();

    if (!context) {
      return;
    }

    context.globalAlpha = 1;
    context.globalCompositeOperation =
      activeTool === 'eraser' ? 'destination-out' : 'source-over';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = brushSize;
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
    context.globalCompositeOperation = 'source-over';
  };

  const fillVisiblePet = (point) => {
    const baseContext = baseCanvasRef.current?.getContext('2d');
    const editContext = getEditContext();

    if (!baseContext || !editContext) {
      return;
    }

    const baseData = baseContext.getImageData(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
    const editData = editContext.getImageData(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
    const fill = hexToRgb(color);
    const width = PAINT_CANVAS_SIZE;
    const height = PAINT_CANVAS_SIZE;
    const startX = Math.max(0, Math.min(width - 1, Math.floor(point.x)));
    const startY = Math.max(0, Math.min(height - 1, Math.floor(point.y)));
    const startIndex = (startY * width + startX) * 4;
    const target = {
      r: editData.data[startIndex],
      g: editData.data[startIndex + 1],
      b: editData.data[startIndex + 2],
      a: editData.data[startIndex + 3],
    };
    const paintPixel = (pixelIndex) => {
      const dataIndex = pixelIndex * 4;

      editData.data[dataIndex] = fill.r;
      editData.data[dataIndex + 1] = fill.g;
      editData.data[dataIndex + 2] = fill.b;
      editData.data[dataIndex + 3] = 220;
    };
    const isVisibleBase = (pixelIndex) => baseData.data[pixelIndex * 4 + 3] > 10;
    const isTargetPaint = (pixelIndex) => {
      const dataIndex = pixelIndex * 4;

      return (
        editData.data[dataIndex] === target.r &&
        editData.data[dataIndex + 1] === target.g &&
        editData.data[dataIndex + 2] === target.b &&
        editData.data[dataIndex + 3] === target.a
      );
    };

    if (!isVisibleBase(startY * width + startX)) {
      for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
        if (isVisibleBase(pixelIndex)) {
          paintPixel(pixelIndex);
        }
      }

      editContext.putImageData(editData, 0, 0);
      return;
    }

    const visited = new Uint8Array(width * height);
    const stack = [startY * width + startX];

    while (stack.length > 0) {
      const pixelIndex = stack.pop();

      if (visited[pixelIndex] || !isVisibleBase(pixelIndex) || !isTargetPaint(pixelIndex)) {
        continue;
      }

      visited[pixelIndex] = 1;
      paintPixel(pixelIndex);

      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      if (x > 0) stack.push(pixelIndex - 1);
      if (x < width - 1) stack.push(pixelIndex + 1);
      if (y > 0) stack.push(pixelIndex - width);
      if (y < height - 1) stack.push(pixelIndex + width);
    }

    editContext.putImageData(editData, 0, 0);
  };

  const handlePaintPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (activeTool === 'move') {
      dragState.current = {
        mode: 'move',
        pointerId: event.pointerId,
        startPan: pan,
        startX: event.clientX,
        startY: event.clientY,
      };
      setIsInteracting(true);
      return;
    }

    const point = getCanvasPoint(event);

    if (activeTool === 'fill') {
      pushHistory();
      fillVisiblePet(point);
      saveEditedPart();
      return;
    }

    pushHistory();
    dragState.current = {
      mode: 'draw',
      pointerId: event.pointerId,
    };
    lastPointRef.current = point;
    setIsInteracting(true);
    paintLine(point, point);
  };

  const handlePaintPointerMove = (event) => {
    if (!dragState.current) {
      return;
    }

    if (dragState.current.mode === 'move') {
      const deltaX = event.clientX - dragState.current.startX;
      const deltaY = event.clientY - dragState.current.startY;

      setPan({
        x: dragState.current.startPan.x + deltaX,
        y: dragState.current.startPan.y + deltaY,
      });
      return;
    }

    const point = getCanvasPoint(event);

    paintLine(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const finishPaintInteraction = (event) => {
    if (!dragState.current) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(dragState.current.pointerId)) {
      event.currentTarget.releasePointerCapture(dragState.current.pointerId);
    }

    if (dragState.current.mode === 'draw') {
      saveEditedPart();
    }

    dragState.current = null;
    lastPointRef.current = null;
    setIsInteracting(false);
  };

  const handleUndo = () => {
    const context = getEditContext();
    const previous = undoStackRef.current.pop();

    if (!context || !previous) {
      return;
    }

    redoStackRef.current = [
      ...redoStackRef.current.slice(-24),
      context.getImageData(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE),
    ];
    context.putImageData(previous, 0, 0);
    refreshHistoryState();
    saveEditedPart();
  };

  const handleRedo = () => {
    const context = getEditContext();
    const next = redoStackRef.current.pop();

    if (!context || !next) {
      return;
    }

    undoStackRef.current = [
      ...undoStackRef.current.slice(-24),
      context.getImageData(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE),
    ];
    context.putImageData(next, 0, 0);
    refreshHistoryState();
    saveEditedPart();
  };

  const handleClear = () => {
    const context = getEditContext();

    if (!context) {
      return;
    }

    pushHistory();
    context.clearRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
    refreshHistoryState();
    saveEditedPart();
  };

  useEffect(() => {
    const context = editCanvasRef.current?.getContext('2d');
    const savedEdit = editedPartsRef.current[selectedEditKey];

    if (!context) {
      return undefined;
    }

    undoStackRef.current = [];
    redoStackRef.current = [];
    refreshHistoryState();
    context.clearRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);

    if (!savedEdit) {
      return undefined;
    }

    let isCancelled = false;

    loadImage(savedEdit).then((image) => {
      if (!isCancelled) {
        context.clearRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
        context.drawImage(image, 0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedEditKey]);

  useEffect(() => {
    const canvas = baseCanvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    let isCancelled = false;

    context.clearRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);

    if (!selectedTemplate || status === 'loading' || status === 'error' || !template) {
      return undefined;
    }

    const drawTemplate = async () => {
      context.clearRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);

      if (selectedPartId === 'overview') {
        const templateCanvas = template.canvas ?? { width: 512, height: 512 };
        const templateScale = Math.min(470 / templateCanvas.width, 470 / templateCanvas.height);
        const offsetX = (PAINT_CANVAS_SIZE - templateCanvas.width * templateScale) / 2;
        const offsetY = (PAINT_CANVAS_SIZE - templateCanvas.height * templateScale) / 2;
        const loadedParts = await Promise.all(
          getTemplateParts(template).map(async (part) => ({
            image: await loadImage(getPartImageSrc(selectedTemplate.partsBasePath, part.image)),
            part,
          })),
        );

        if (isCancelled) {
          return;
        }

        loadedParts.forEach(({ image, part }) => {
          const partScale = part.scale ?? 1;
          const width = part.size.width * partScale * templateScale;
          const height = part.size.height * partScale * templateScale;
          const x = offsetX + part.position.x * templateScale;
          const y = offsetY + part.position.y * templateScale;
          const pivotX = x + part.pivot.x * partScale * templateScale;
          const pivotY = y + part.pivot.y * partScale * templateScale;

          context.save();
          context.translate(pivotX, pivotY);
          context.rotate(((part.rotation ?? 0) * Math.PI) / 180);
          context.translate(-pivotX, -pivotY);
          context.drawImage(image, x, y, width, height);
          context.restore();
        });

        return;
      }

      const part = findTemplatePart(template, selectedPartId);

      if (!part) {
        return;
      }

      const image = await loadImage(getPartImageSrc(selectedTemplate.partsBasePath, part.image));

      if (isCancelled) {
        return;
      }

      const fitScale = Math.min(470 / image.width, 470 / image.height);
      const width = image.width * fitScale;
      const height = image.height * fitScale;
      const x = (PAINT_CANVAS_SIZE - width) / 2;
      const y = (PAINT_CANVAS_SIZE - height) / 2;

      context.drawImage(image, x, y, width, height);
    };

    drawTemplate().catch(() => {
      if (!isCancelled) {
        context.clearRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedPartId, selectedTemplate, status, template]);

  const statusText =
    !selectedTemplate
      ? 'No template yet'
      : status === 'loading'
        ? 'Loading template'
        : status === 'error' || !template
          ? 'Template unavailable'
          : '';

  const generatePresetPetZip = async () => {
    if (!selectedTemplate || !template || status !== 'ready') {
      window.alert('模板还没有加载完成，请稍等一下再生成。');
      return;
    }

    try {
      const zip = new JSZip();
      const partsFolder = zip.folder('parts');
      const savedEdits = editedPartsRef.current;
      const templateExport = {
        ...template,
        templateId: `${selectedTemplate.animalType}_${selectedTemplate.breed}_custom`,
        parts: {},
      };

      await Promise.all(
        getTemplateParts(template).map(async (part) => {
          const fileName = getPartFileName(part.image);
          const partId = fileName.replace(/\.[^.]+$/, '').toLowerCase();
          const editDataUrl = savedEdits[`${selectedTemplate.templatePath}:${partId}`];
          const partImageSrc = getPartImageSrc(selectedTemplate.partsBasePath, part.image);
          const response = await fetch(partImageSrc);

          if (!response.ok) {
            throw new Error(`Missing part ${fileName}`);
          }

          if (editDataUrl) {
            const originalImage = await loadImage(partImageSrc);
            const editImage = await loadImage(editDataUrl);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fitScale = Math.min(470 / originalImage.width, 470 / originalImage.height);
            const displayedWidth = originalImage.width * fitScale;
            const displayedHeight = originalImage.height * fitScale;
            const displayedX = (PAINT_CANVAS_SIZE - displayedWidth) / 2;
            const displayedY = (PAINT_CANVAS_SIZE - displayedHeight) / 2;

            canvas.width = originalImage.width;
            canvas.height = originalImage.height;
            context.drawImage(originalImage, 0, 0);
            context.drawImage(
              editImage,
              displayedX,
              displayedY,
              displayedWidth,
              displayedHeight,
              0,
              0,
              originalImage.width,
              originalImage.height,
            );

            const editedBlob = await new Promise((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error(`Could not encode ${fileName}`));
                }
              }, 'image/png');
            });

            partsFolder.file(fileName, editedBlob);
          } else {
            partsFolder.file(fileName, await response.blob());
          }

          templateExport.parts[part.bone] = {
            ...part,
            image: `parts/${fileName}`,
          };
        }),
      );

      const motionResponse = await fetch(selectedTemplate.motionPath);

      if (!motionResponse.ok) {
        throw new Error('Missing motion file');
      }

      zip.file('template.json', JSON.stringify(templateExport, null, 2));
      zip.file('motion.json', JSON.stringify(await motionResponse.json(), null, 2));

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'custom_pet.zip');
    } catch (error) {
      window.alert('导出失败，请确认本地模板文件已经加载成功。');
    }
  };

  return (
    <div className="paint-editor-shell">
      <div className="paint-board-row">
        <div className="paint-toolbar" aria-label="Pet paint tools">
          <div className="paint-tool-set" aria-label="Drawing tools">
            <span className="paint-tool-group-label">Tools</span>
            {paintTools.map(({ id, label, Icon }) => (
              <button
                aria-label={label}
                aria-pressed={activeTool === id}
                className="paint-tool"
                key={id}
                onClick={() => setActiveTool(id)}
                title={label}
                type="button"
              >
                <Icon size={18} strokeWidth={2.25} />
              </button>
            ))}
          </div>

          <div className="paint-tool-set color-set" aria-label="Paint colors">
            <span className="paint-tool-group-label">Colors</span>
            {paintColors.map((paintColor) => (
              <button
                aria-label={`Use ${paintColor}`}
                aria-pressed={color === paintColor}
                className="color-swatch"
                key={paintColor}
                onClick={() => setColor(paintColor)}
                style={{ '--paint-color': paintColor }}
                type="button"
              />
            ))}
            <label className="custom-color">
              <Palette size={16} strokeWidth={2.25} />
              <input
                aria-label="Custom paint color"
                onChange={(event) => setColor(event.target.value)}
                type="color"
                value={color}
              />
            </label>
          </div>

          <div className="paint-tool-set brush-size-set" aria-label="Brush size">
            <span className="paint-tool-group-label">Size</span>
            {brushSizes.map((size) => (
              <button
                aria-label={`${size}px brush`}
                aria-pressed={brushSize === size}
                className="brush-size-button"
                key={size}
                onClick={() => setBrushSize(size)}
                type="button"
              >
                <span style={{ height: `${Math.max(3, size / 2)}px`, width: `${size + 8}px` }} />
              </button>
            ))}
          </div>

          <div className="paint-tool-set action-set" aria-label="Edit actions">
            <span className="paint-tool-group-label">Edit</span>
            <button
              aria-label="Undo"
              className="paint-tool"
              disabled={!canUndo}
              onClick={handleUndo}
              title="Undo"
              type="button"
            >
              <Undo2 size={18} strokeWidth={2.25} />
            </button>
            <button
              aria-label="Redo"
              className="paint-tool"
              disabled={!canRedo}
              onClick={handleRedo}
              title="Redo"
              type="button"
            >
              <Redo2 size={18} strokeWidth={2.25} />
            </button>
            <button
              aria-label="Clear edits"
              className="paint-tool"
              onClick={handleClear}
              title="Clear edits"
              type="button"
            >
              <Trash2 size={18} strokeWidth={2.25} />
            </button>
            <button
              aria-label="Reset view"
              className="paint-tool"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(MIN_ZOOM);
              }}
              title="Reset view"
              type="button"
            >
              <RotateCcw size={18} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div
          className={`preview-canvas paint-canvas-frame ${isInteracting ? 'is-dragging' : ''}`}
          aria-label="Selected pet paint canvas"
        >
          <div className="preview-glow" />
          <div className="preview-slot">
            <div
              className="paint-surface"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <canvas
                className="pet-base-canvas"
                height={PAINT_CANVAS_SIZE}
                ref={baseCanvasRef}
                width={PAINT_CANVAS_SIZE}
              />
              <canvas
                className={`pet-edit-canvas tool-${activeTool}`}
                height={PAINT_CANVAS_SIZE}
                onPointerCancel={finishPaintInteraction}
                onPointerDown={handlePaintPointerDown}
                onPointerMove={handlePaintPointerMove}
                onPointerUp={finishPaintInteraction}
                ref={editCanvasRef}
                width={PAINT_CANVAS_SIZE}
              />
              {statusText && <span className="canvas-status">{statusText}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="preview-zoom-panel" aria-label="Preview zoom controls">
        <button
          className="zoom-button"
          onClick={() => setZoom((currentZoom) => clampZoom(currentZoom - 0.1))}
          type="button"
        >
          <Minus size={18} strokeWidth={2.75} />
        </button>
        <input
          aria-label="Preview zoom"
          className="zoom-slider"
          max={MAX_ZOOM}
          min={MIN_ZOOM}
          onChange={(event) => setZoom(Number(event.target.value))}
          step="0.05"
          style={{ '--zoom-progress': `${zoomProgress}%` }}
          type="range"
          value={zoom}
        />
        <button
          className="zoom-button"
          onClick={() => setZoom((currentZoom) => clampZoom(currentZoom + 0.1))}
          type="button"
        >
          <Plus size={18} strokeWidth={2.75} />
        </button>
        <button className="zoom-save-button" onClick={saveEditedPart} type="button">
          Save
        </button>
        <button className="generate-pet-button" onClick={generatePresetPetZip} type="button">
          Generate Pet
        </button>
      </div>
    </div>
  );
}

function usePetTemplate(selectedTemplate) {
  const [template, setTemplate] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let isCancelled = false;

    setTemplate(null);
    setStatus(selectedTemplate ? 'loading' : 'empty');

    if (!selectedTemplate) {
      return () => {
        isCancelled = true;
      };
    }

    fetch(selectedTemplate.templatePath)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load template: ${response.status}`);
        }

        return response.json();
      })
      .then((nextTemplate) => {
        if (!isCancelled) {
          setTemplate(nextTemplate);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setStatus('error');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedTemplate]);

  return { status, template };
}

function App() {
  const [animalIndex, setAnimalIndex] = useState(0);
  const [breedIndex, setBreedIndex] = useState(0);
  const [partIndex, setPartIndex] = useState(0);
  const [activeDragWheel, setActiveDragWheel] = useState(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [dragOffsets, setDragOffsets] = useState({
    animal: 0,
    breed: 0,
    part: 0,
  });
  const [activeStudioSlide, setActiveStudioSlide] = useState(0);
  const dragState = useRef(null);
  const lastDragMoved = useRef(false);
  const snapTimers = useRef({});

  const selectedAnimal = animalOptions[animalIndex];
  const breedItems = useMemo(() => {
    const templates = getPetTemplatesByAnimal(selectedAnimal.id);

    if (templates.length === 0) {
      return [
        {
          id: `${selectedAnimal.id}-coming-soon`,
          label: 'Coming soon',
          template: null,
        },
      ];
    }

    return templates.map((template) => ({
      id: `${template.animalType}-${template.breed}`,
      label: template.label ?? template.breed,
      template,
    }));
  }, [selectedAnimal]);

  const partItems = useMemo(
    () =>
      partNames.map((label) => ({
        id: `${breedItems[breedIndex]?.id}-${label}`,
        label,
        partId: label.toLowerCase(),
      })),
    [breedIndex, breedItems],
  );

  const selectedBreed = breedItems[breedIndex];
  const selectedPart = partItems[partIndex];
  const selectedTemplate = selectedBreed?.template;
  const { status: templateStatus, template } = usePetTemplate(selectedTemplate);

  const handleAnimalSelect = (index) => {
    setAnimalIndex(index);
    setBreedIndex(0);
    setPartIndex(0);
  };

  const handleBreedSelect = (index) => {
    setBreedIndex(index);
    setPartIndex(0);
  };

  const selectWheelIndex = (wheelId, index) => {
    if (wheelId === 'animal') {
      handleAnimalSelect(index);
      return;
    }

    if (wheelId === 'breed') {
      handleBreedSelect(index);
      return;
    }

    setPartIndex(index);
  };

  const getWheelRuntimeConfig = (wheelId) => {
    const configs = {
      animal: {
        items: animalOptions,
        radius: 100,
        selectedIndex: animalIndex,
        step: 44,
      },
      breed: {
        items: breedItems,
        radius: 255,
        selectedIndex: breedIndex,
        step: 30,
      },
      part: {
        items: partItems,
        radius: 445,
        selectedIndex: partIndex,
        step: 24,
      },
    };

    return configs[wheelId];
  };

  const getWheelFromPointer = (event) => {
    const option = event.target.closest?.('[data-wheel]');

    if (option?.dataset?.wheel) {
      return option.dataset.wheel;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const distance = Math.hypot(x - WHEEL_CENTER.x, y - WHEEL_CENTER.y);
    const rings = ['animal', 'breed', 'part']
      .map((wheelId) => {
        const config = getWheelRuntimeConfig(wheelId);

        return {
          distance: Math.abs(distance - config.radius),
          wheelId,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    return rings[0].distance < 82 ? rings[0].wheelId : null;
  };

  const handleWheelPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    const option = event.target.closest?.('[data-wheel]');
    const wheelId = getWheelFromPointer(event);

    if (!wheelId) {
      return;
    }

    window.clearTimeout(snapTimers.current[wheelId]);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      currentOffset: dragOffsets[wheelId],
      moved: false,
      optionIndex: option?.dataset?.wheel === wheelId ? Number(option.dataset.index) : null,
      pointerId: event.pointerId,
      startOffset: dragOffsets[wheelId],
      startY: event.clientY,
      wheelId,
    };
    lastDragMoved.current = false;
    setActiveDragWheel(wheelId);
  };

  const handleWheelPointerMove = (event) => {
    if (!dragState.current) {
      return;
    }

    const deltaY = event.clientY - dragState.current.startY;
    const nextOffset = dragState.current.startOffset + deltaY * 0.34;

    if (Math.abs(deltaY) > 6) {
      dragState.current.moved = true;
    }

    dragState.current.currentOffset = nextOffset;
    const { wheelId } = dragState.current;

    setDragOffsets((current) => ({
      ...current,
      [wheelId]: nextOffset,
    }));
  };

  const snapWheelOption = (wheelId, index, optionAngle) => {
    const config = getWheelRuntimeConfig(wheelId);
    const currentAngle =
      optionAngle ??
      getCircularDelta(index, config.selectedIndex, config.items.length) * config.step +
        dragOffsets[wheelId];

    if (Math.abs(currentAngle) < 0.5) {
      selectWheelIndex(wheelId, index);
      return;
    }

    window.clearTimeout(snapTimers.current[wheelId]);
    setDragOffsets((current) => ({
      ...current,
      [wheelId]: current[wheelId] - currentAngle,
    }));

    snapTimers.current[wheelId] = window.setTimeout(() => {
      setDragOffsets((current) => ({
        ...current,
        [wheelId]: 0,
      }));
      selectWheelIndex(wheelId, index);
    }, SNAP_DURATION);
  };

  const finishWheelDrag = (event) => {
    if (!dragState.current) {
      return;
    }

    const { currentOffset, moved, optionIndex, pointerId, wheelId } = dragState.current;

    if (event.currentTarget.hasPointerCapture(pointerId)) {
      event.currentTarget.releasePointerCapture(pointerId);
    }

    dragState.current = null;
    lastDragMoved.current = moved;
    setActiveDragWheel(null);

    if (!moved) {
      if (optionIndex !== null) {
        snapWheelOption(wheelId, optionIndex);
      }

      window.setTimeout(() => {
        lastDragMoved.current = false;
      }, 0);
      return;
    }

    const config = getWheelRuntimeConfig(wheelId);
    const movedSteps = Math.round(currentOffset / config.step);
    const nextIndex = normalizeIndex(config.selectedIndex - movedSteps, config.items.length);

    setDragOffsets((current) => ({
      ...current,
      [wheelId]: 0,
    }));
    selectWheelIndex(wheelId, nextIndex);

    window.setTimeout(() => {
      lastDragMoved.current = false;
    }, 0);
  };

  const handleWheelOptionClick = (wheelId, index, optionAngle) => {
    if (lastDragMoved.current) {
      return;
    }

    snapWheelOption(wheelId, index, optionAngle);
  };

  const renderBreedThumb = (item) => {
    if (!item.template?.overviewImagePath) {
      return null;
    }

    return (
      <img
        alt=""
        className="option-overview-image"
        src={item.template.overviewImagePath}
      />
    );
  };

  const renderPartThumb = (item) => {
    if (!selectedTemplate || !template) {
      return null;
    }

    if (item.partId === 'overview') {
      return (
        <PetLayerStack
          className="wheel-pet-thumb"
          maxHeight={78}
          maxWidth={112}
          selectedTemplate={selectedTemplate}
          template={template}
        />
      );
    }

    const part = findTemplatePart(template, item.partId);

    if (!part) {
      return null;
    }

    return (
      <img
        alt=""
        className="option-part-image"
        src={getPartImageSrc(selectedTemplate.partsBasePath, part.image)}
      />
    );
  };

  const renderStudioSlide = (slideIndex) => {
    if (slideIndex === 1) {
      return (
        <div className="studio-slide real-pet-slide" aria-hidden={activeStudioSlide !== slideIndex} key={slideIndex}>
          <RealPetStudio />
        </div>
      );
    }

    return (
      <div className="studio-slide" aria-hidden={activeStudioSlide !== slideIndex} key={slideIndex}>
        <div className="studio-heading">
          <p className="eyebrow">Character studio</p>
          <h1>Build your AI pet personality</h1>
        </div>

        <div className="studio-preview">
          <div className="studio-preview-background" aria-hidden="true">
            <video
              autoPlay
              className="studio-preview-background-video"
              loop
              muted
              playsInline
              src="/cover1.mov?v=20260507153031"
            />
          </div>
          <InteractivePetPreview
            selectedPart={selectedPart}
            selectedTemplate={selectedTemplate}
            status={templateStatus}
            template={template}
          />
          <div className="selection-tray" aria-label="Current pet selection">
            <span>{selectedAnimal.label}</span>
            <span>{selectedBreed?.label}</span>
            <span>{selectedPart?.label}</span>
          </div>
        </div>

        <div
          className="wheel-panel"
          aria-label="Pet editor wheel controls"
          onPointerCancel={finishWheelDrag}
          onPointerDown={handleWheelPointerDown}
          onPointerMove={handleWheelPointerMove}
          onPointerUp={finishWheelDrag}
        >
          <div className="center-line" aria-hidden="true" />
          <WheelLayer
            ariaLabel="Animal wheel"
            className="animal-wheel"
            dragOffset={dragOffsets.animal}
            items={animalOptions}
            isDragging={activeDragWheel === 'animal'}
            onSelect={(index, angle) => handleWheelOptionClick('animal', index, angle)}
            radius={100}
            selectedIndex={animalIndex}
            step={44}
            wheelId="animal"
          />
          <WheelLayer
            ariaLabel="Breed wheel"
            className="breed-wheel"
            dragOffset={dragOffsets.breed}
            items={breedItems}
            isDragging={activeDragWheel === 'breed'}
            onSelect={(index, angle) => handleWheelOptionClick('breed', index, angle)}
            radius={255}
            selectedIndex={breedIndex}
            showThumb
            renderThumb={renderBreedThumb}
            step={30}
            wheelId="breed"
          />
          <WheelLayer
            ariaLabel="Body part wheel"
            className="part-wheel"
            dragOffset={dragOffsets.part}
            items={partItems}
            isDragging={activeDragWheel === 'part'}
            onSelect={(index, angle) => handleWheelOptionClick('part', index, angle)}
            radius={445}
            selectedIndex={partIndex}
            showThumb
            renderThumb={renderPartThumb}
            step={24}
            wheelId="part"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="site-shell">
      <nav className="navbar" aria-label="Primary navigation">
        <a className="brand" href="#home" aria-label="AI Desktop Pet home">
          <span className="brand-mark">A</span>
          AI Desktop Pet
        </a>
        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#download">Download</a>
        </div>
      </nav>

      <main>
        <section className="hero section-grid" id="home">
          <div className="hero-copy">
            <p className="eyebrow">AI companion for macOS</p>
            <h1>Your AI Desktop Pet Companion</h1>
            <p className="hero-subtitle">
              A cute desktop companion that can chat, react, and stay with you while you work.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#overview">
                <span className="hero-action-title">开始制作</span>
                <span className="hero-action-subtitle">Start Creating</span>
              </a>
              <button
                className="button button-secondary"
                onClick={() => setIsTutorialOpen(true)}
                type="button"
              >
                <span className="hero-action-title">查看教程</span>
                <span className="hero-action-subtitle">View Tutorial</span>
              </button>
            </div>
          </div>

          <div className="product-showcase" aria-label="AI Desktop Pet product preview">
            <div className="showcase-frame">
              <video
                aria-label="AI Desktop Pet app preview with a cute desktop companion"
                autoPlay
                loop
                muted
                playsInline
                src="/cover.mov?v=20260506222023"
              />
            </div>
            <div className="floating-note note-chat">
              <span>Chat ready</span>
              <strong>Always nearby</strong>
            </div>
            <div className="floating-note note-mood">
              <span>Mood</span>
              <strong>Happy</strong>
            </div>
          </div>
        </section>

        <section className="download-section section-grid" id="download">
          <div className="download-intro">
            <p className="eyebrow">Download</p>
            <h2>运行你的专属桌面宠物</h2>
            <p>
              这里分成两个下载：macOS 运行器负责启动桌面宠物，网页里生成的
              <strong> custom_pet.zip </strong>
              负责提供你的宠物外观数据。
            </p>
          </div>

          <div className="download-flow" aria-label="Desktop pet running steps">
            <article className="download-step-card">
              <span className="download-step-index">01</span>
              <h3>下载 macOS 运行器</h3>
              <p>这是桌面宠物 App 本体。下载后解压，首次打开如果被 macOS 拦截，请右键选择打开。</p>
              <a className="button button-primary" href="/downloads/gaotadeskpet.zip" download>
                下载运行器
              </a>
            </article>

            <article className="download-step-card">
              <span className="download-step-index">02</span>
              <h3>制作宠物数据包</h3>
              <p>回到制作区完成卡通宠物或真实宠物，点击 Generate Pet 下载 custom_pet.zip。</p>
              <a className="button button-secondary" href="#overview">
                开始制作
              </a>
            </article>

            <article className="download-step-card">
              <span className="download-step-index">03</span>
              <h3>放置并运行</h3>
              <p>解压 custom_pet.zip，把 custom_pet 文件夹放到 Downloads/custom_pet，然后重新打开运行器。</p>
              <button className="button button-secondary" onClick={() => setIsTutorialOpen(true)} type="button">
                查看教程
              </button>
            </article>
          </div>
        </section>

        <section className="animal-studio" id="overview">
          <div className="studio-carousel-viewport">
            <div
              className="studio-carousel-track"
              style={{ transform: `translateX(-${activeStudioSlide * 100}%)` }}
            >
              {[0, 1].map((slideIndex) => renderStudioSlide(slideIndex))}
            </div>
          </div>

          <div className="studio-slide-controls" aria-label="Character studio pages">
            {studioSlideOptions.map((option, slideIndex) => (
              <button
                aria-label={option.title}
                aria-pressed={activeStudioSlide === slideIndex}
                className="studio-slide-button"
                key={option.title}
                onClick={() => setActiveStudioSlide(slideIndex)}
                type="button"
              >
                <span className="studio-slide-button-title">{option.title}</span>
                <span className="studio-slide-button-subtitle">{option.subtitle}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="section-heading">
            <p className="eyebrow">Features</p>
            <h2>A tiny companion with real personality</h2>
          </div>
          <div className="features-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

      </main>

      {isTutorialOpen && (
        <div className="tutorial-overlay" role="presentation" onMouseDown={() => setIsTutorialOpen(false)}>
          <section
            aria-label="Create your desktop pet tutorial"
            aria-modal="true"
            className="tutorial-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button
              aria-label="Close tutorial"
              className="tutorial-close-button"
              onClick={() => setIsTutorialOpen(false)}
              type="button"
            >
              <X size={22} strokeWidth={2.4} />
            </button>

            <div className="tutorial-intro">
              <p className="eyebrow">Tutorial</p>
              <h2>创建你的专属桌面宠物</h2>
              <p>
                你可以先下载 macOS 运行器，再从预设卡通模板开始，或导入真实宠物照片自己抠图。网页最终生成的是
                <strong> custom_pet.zip </strong>
                宠物数据包；运行器 App 会读取这个数据包并把宠物显示在桌面上。
              </p>
            </div>

            <div className="tutorial-grid">
              <article className="tutorial-card tutorial-card-primary">
                <img
                  className="tutorial-visual"
                  src="/tutorial/cartoon-builder.svg"
                  alt="Cartoon pet builder showing drawing canvas, part picker, and save flow"
                />
                <span className="tutorial-step">01</span>
                <h3>卡通形象创作</h3>
                <ol>
                  <li>点击“开始制作”，默认进入“生成卡通的专属宠物”。</li>
                  <li>在右侧转盘选择动物、品种和部位，例如 overview、head、tail、body。</li>
                  <li>在左侧画板用画笔、橡皮擦、填充和颜色工具修改 PNG 外观。</li>
                  <li>点击 Save 保存当前切件，overview 会根据当前模板实时预览。</li>
                  <li>完成后点击 Generate Pet，导出可运行的 custom_pet.zip。</li>
                </ol>
              </article>

              <article className="tutorial-card">
                <img
                  className="tutorial-visual"
                  src="/tutorial/real-cutout.svg"
                  alt="Real pet cutout workspace showing brush mask and saved parts"
                />
                <span className="tutorial-step">02</span>
                <h3>真实宠物创作</h3>
                <ol>
                  <li>切换到“生成实际的专属宠物”。</li>
                  <li>拖入或重新导入一张真实宠物图片。</li>
                  <li>选择 head、body、tail 或四肢，用圆形抠图笔涂出要保留的区域。</li>
                  <li>用橡皮擦修边，必要时用回退或 Reset 重做当前 mask。</li>
                  <li>点击 Save，把当前 mask 保存成透明 PNG 切件。</li>
                </ol>
              </article>

              <article className="tutorial-card">
                <img
                  className="tutorial-visual"
                  src="/tutorial/assembly-export.svg"
                  alt="Assembly editor showing draggable PNG parts, pivot points, and export"
                />
                <span className="tutorial-step">03</span>
                <h3>拼装与 pivot</h3>
                <ol>
                  <li>保存多个切件后，在右侧切到 Assembly。</li>
                  <li>拖动每个 PNG，调整它在 512x512 画布里的 position。</li>
                  <li>拖动蓝色 pivot 点，设置头、尾巴和四肢旋转的位置。</li>
                  <li>template.json 会记录每个切件的 size、position 和 pivot。</li>
                </ol>
              </article>

              <article className="tutorial-card">
                <img
                  className="tutorial-visual"
                  src="/tutorial/start-creating.svg"
                  alt="Start creating flow from homepage to custom pet export"
                />
                <span className="tutorial-step">04</span>
                <h3>导出并运行</h3>
                <ol>
                  <li>先到 Download 区下载 macOS 运行器，这是可以打开的桌面宠物 App。</li>
                  <li>制作完成后点击 Generate Pet 下载 custom_pet.zip，这是宠物数据包。</li>
                  <li>解压 zip，得到 custom_pet 文件夹。</li>
                  <li>把 custom_pet 文件夹放到 Downloads/custom_pet，再打开运行器；首次打开被拦截时右键选择打开。</li>
                </ol>
              </article>
            </div>
          </section>
        </div>
      )}

      <footer className="footer">
        <span>AI Desktop Pet</span>
        <span>Copyright 2026 AI Desktop Pet. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default App;
