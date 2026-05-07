import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  Eraser,
  Minus,
  Move,
  PaintBucket,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import './App.css';
import { animalOptions, getPetTemplatesByAnimal } from './data/petCatalog';

const WHEEL_CENTER = { x: 620, y: 330 };
const SNAP_DURATION = 320;
const PAINT_CANVAS_SIZE = 550;

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
        <button className="zoom-save-button" type="button">
          Save
        </button>
        <button className="generate-pet-button" type="button">
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
  const [dragOffsets, setDragOffsets] = useState({
    animal: 0,
    breed: 0,
    part: 0,
  });
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

  const handleLogin = (event) => {
    event.preventDefault();
    alert('Login feature coming soon');
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
          <a href="#login">Login</a>
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
              <a className="button button-primary" href="#download">
                Download for macOS
              </a>
              <a className="button button-primary" href="#download">
                Download for Windows
              </a>
              <a className="button button-primary" href="#download">
                Download for Linux
              </a>
              <a className="button button-secondary" href="#features">
                View Features
              </a>
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

        <section className="animal-studio section-grid" id="overview">
          <div className="studio-heading">
            <p className="eyebrow">Character studio</p>
            <h1>Build your AI pet personality</h1>
          </div>

          <div className="studio-preview">
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

        <section className="download-section section-grid" id="download">
          <div>
            <p className="eyebrow">Download</p>
            <h2>Download AI Desktop Pet</h2>
            <p>Available for macOS</p>
          </div>
          <div className="download-actions">
            <a className="button button-primary" href="#download">
              Download .dmg
            </a>
            <a className="button button-primary" href="#download">
              Download for Windows
            </a>
            <a className="button button-primary" href="#download">
              Download for Linux
            </a>
          </div>
        </section>

        <section className="login-section" id="login">
          <div className="section-heading">
            <p className="eyebrow">Account</p>
            <h2>Login</h2>
          </div>
          <form className="login-card" onSubmit={handleLogin}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" />

            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="Password" />

            <button className="button button-primary login-button" type="submit">
              Login
            </button>
          </form>
        </section>
      </main>

      <footer className="footer">
        <span>AI Desktop Pet</span>
        <span>Copyright 2026 AI Desktop Pet. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default App;
