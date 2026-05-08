(function () {
  const STORAGE_KEY = "desktop-pet-template-builder-project";
  const CANVAS = { width: 512, height: 512 };

  const fileNameMap = new Map([
    ["body", "body"],
    ["head", "head"],
    ["tail", "tail"],
    ["front_leg", "frontLeg"],
    ["frontleg", "frontLeg"],
    ["back_leg", "backLeg"],
    ["backleg", "backLeg"],
  ]);

  const state = {
    templateId: "dog_base",
    layers: [],
    selectedId: null,
    pivotMode: false,
    lastJson: "",
  };

  const els = {
    fileInput: document.getElementById("fileInput"),
    exportButton: document.getElementById("exportButton"),
    downloadButton: document.getElementById("downloadButton"),
    saveButton: document.getElementById("saveButton"),
    loadButton: document.getElementById("loadButton"),
    resetButton: document.getElementById("resetButton"),
    templateIdInput: document.getElementById("templateIdInput"),
    canvasSurface: document.getElementById("canvasSurface"),
    layersList: document.getElementById("layersList"),
    statusText: document.getElementById("statusText"),
    pointerText: document.getElementById("pointerText"),
    pivotModeButton: document.getElementById("pivotModeButton"),
    emptySelection: document.getElementById("emptySelection"),
    selectionForm: document.getElementById("selectionForm"),
    partIdInput: document.getElementById("partIdInput"),
    boneInput: document.getElementById("boneInput"),
    posXInput: document.getElementById("posXInput"),
    posYInput: document.getElementById("posYInput"),
    pivotXInput: document.getElementById("pivotXInput"),
    pivotYInput: document.getElementById("pivotYInput"),
    scaleInput: document.getElementById("scaleInput"),
    scaleValue: document.getElementById("scaleValue"),
    rotationInput: document.getElementById("rotationInput"),
    rotationNumberInput: document.getElementById("rotationNumberInput"),
    rotationValue: document.getElementById("rotationValue"),
    sizeText: document.getElementById("sizeText"),
    jsonPreview: document.getElementById("jsonPreview"),
    jsonState: document.getElementById("jsonState"),
  };

  let dragSession = null;

  function recognizePartId(fileName) {
    const baseName = fileName.replace(/\.[^.]+$/, "").toLowerCase();
    return fileNameMap.get(baseName) || toCamelPartId(baseName);
  }

  function toCamelPartId(baseName) {
    return baseName.replace(/[_-]+([a-z0-9])/g, (_, char) => char.toUpperCase());
  }

  function getLayer(id) {
    return state.layers.find((layer) => layer.id === id) || null;
  }

  function clampNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function normalizeRotation(value, min, max) {
    let next = clampNumber(value, 0);
    while (next < min) {
      next += 360;
    }
    while (next > max) {
      next -= 360;
    }
    return round(next);
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          resolve({
            dataUrl: reader.result,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };
        img.onerror = () => reject(new Error(`无法读取图片尺寸：${file.name}`));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error(`无法读取文件：${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files) {
    const pngFiles = Array.from(files).filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
    if (!pngFiles.length) {
      setStatus("请选择 PNG 文件。");
      return;
    }

    for (const file of pngFiles) {
      try {
        const image = await readImage(file);
        const partId = recognizePartId(file.name);
        const existingIndex = state.layers.findIndex((layer) => layer.id === partId);
        const layer = {
          id: partId,
          fileName: file.name,
          image: `parts/${file.name}`,
          dataUrl: image.dataUrl,
          bone: partId,
          position: { x: 0, y: 0 },
          pivot: { x: Math.round(image.width / 2), y: Math.round(image.height / 2) },
          size: { width: image.width, height: image.height },
          scale: 1,
          rotation: 0,
        };

        if (existingIndex >= 0) {
          state.layers[existingIndex] = {
            ...state.layers[existingIndex],
            ...layer,
            bone: state.layers[existingIndex].bone || layer.bone,
          };
        } else {
          state.layers.push(layer);
        }

        state.selectedId = partId;
      } catch (error) {
        setStatus(error.message);
      }
    }

    normalizeLayerOrder();
    state.pivotMode = false;
    render();
    updateJsonPreview();
    setStatus(`已加载 ${pngFiles.length} 个 PNG。`);
    els.fileInput.value = "";
  }

  function normalizeLayerOrder() {
    state.layers = state.layers.filter(Boolean);
  }

  function zIndexOf(layer) {
    return state.layers.findIndex((candidate) => candidate.id === layer.id);
  }

  function render() {
    renderCanvas();
    renderLayerList();
    renderSelection();
    renderPivotMode();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderCanvas() {
    els.canvasSurface.innerHTML = "";
    state.layers.forEach((layer) => {
      const layerEl = document.createElement("div");
      layerEl.className = "part-layer";
      if (layer.id === state.selectedId) {
        layerEl.classList.add("selected");
      }
      layerEl.dataset.layerId = layer.id;
      layerEl.style.width = `${layer.size.width * layer.scale}px`;
      layerEl.style.height = `${layer.size.height * layer.scale}px`;
      layerEl.style.left = `${layer.position.x}px`;
      layerEl.style.top = `${layer.position.y}px`;
      layerEl.style.transformOrigin = `${layer.pivot.x * layer.scale}px ${layer.pivot.y * layer.scale}px`;
      layerEl.style.transform = `rotate(${layer.rotation || 0}deg)`;
      layerEl.style.zIndex = String(zIndexOf(layer) + 1);

      const img = document.createElement("img");
      img.src = layer.dataUrl;
      img.alt = layer.id;
      img.draggable = false;
      layerEl.appendChild(img);

      layerEl.addEventListener("pointerdown", (event) => beginDrag(event, layer.id));
      els.canvasSurface.appendChild(layerEl);

      if (hasPivot(layer)) {
        const dot = document.createElement("div");
        dot.className = "pivot-dot";
        dot.style.left = `${layer.position.x + layer.pivot.x * layer.scale}px`;
        dot.style.top = `${layer.position.y + layer.pivot.y * layer.scale}px`;
        dot.style.zIndex = String(state.layers.length + zIndexOf(layer) + 2);
        dot.title = `${layer.id} pivot`;
        els.canvasSurface.appendChild(dot);
      }
    });
  }

  function renderLayerList() {
    els.layersList.innerHTML = "";
    if (!state.layers.length) {
      const empty = document.createElement("div");
      empty.className = "empty-selection";
      empty.textContent = "暂无图层。";
      els.layersList.appendChild(empty);
      return;
    }

    [...state.layers].reverse().forEach((layer) => {
      const actualIndex = state.layers.findIndex((candidate) => candidate.id === layer.id);
      const row = document.createElement("div");
      row.className = "layer-row";
      if (layer.id === state.selectedId) {
        row.classList.add("selected");
      }

      const main = document.createElement("div");
      main.className = "layer-main";
      main.innerHTML = `
        <span class="layer-name">${escapeHtml(layer.id)}</span>
        <span class="layer-sub">zIndex ${actualIndex} · ${escapeHtml(layer.fileName)}</span>
      `;
      main.addEventListener("click", () => selectLayer(layer.id));

      const actions = document.createElement("div");
      actions.className = "layer-actions";
      actions.appendChild(makeIconButton("arrow-up", "Move Up", () => moveLayer(layer.id, 1), actualIndex === state.layers.length - 1));
      actions.appendChild(makeIconButton("arrow-down", "Move Down", () => moveLayer(layer.id, -1), actualIndex === 0));

      row.appendChild(main);
      row.appendChild(actions);
      els.layersList.appendChild(row);
    });
  }

  function makeIconButton(icon, title, onClick, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    button.title = title;
    button.disabled = disabled;
    button.innerHTML = `<i data-lucide="${icon}"></i><span class="fallback-label">${title.replace("Move ", "")}</span>`;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderSelection() {
    const layer = getLayer(state.selectedId);
    els.emptySelection.hidden = Boolean(layer);
    els.selectionForm.hidden = !layer;
    els.pivotModeButton.disabled = !layer;

    if (!layer) {
      return;
    }

    els.partIdInput.value = layer.id;
    els.boneInput.value = layer.bone;
    els.posXInput.value = round(layer.position.x);
    els.posYInput.value = round(layer.position.y);
    els.pivotXInput.value = hasPivot(layer) ? round(layer.pivot.x) : "";
    els.pivotYInput.value = hasPivot(layer) ? round(layer.pivot.y) : "";
    els.scaleInput.value = layer.scale;
    els.scaleValue.textContent = Number(layer.scale).toFixed(2);
    els.rotationInput.value = normalizeRotation(layer.rotation || 0, -180, 180);
    els.rotationNumberInput.value = round(layer.rotation || 0);
    els.rotationValue.textContent = `${round(layer.rotation || 0)}°`;
    els.sizeText.textContent = `size: ${layer.size.width} x ${layer.size.height}`;
  }

  function renderPivotMode() {
    els.canvasSurface.classList.toggle("pivot-mode", state.pivotMode);
    els.pivotModeButton.classList.toggle("active", state.pivotMode);
  }

  function selectLayer(id) {
    state.selectedId = id;
    render();
    const layer = getLayer(id);
    if (layer) {
      setStatus(`选中 ${layer.id}，position x=${round(layer.position.x)}, y=${round(layer.position.y)}。`);
    }
  }

  function moveLayer(id, direction) {
    const index = state.layers.findIndex((layer) => layer.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= state.layers.length) {
      return;
    }
    const [layer] = state.layers.splice(index, 1);
    state.layers.splice(nextIndex, 0, layer);
    render();
    updateJsonPreview();
  }

  function beginDrag(event, id) {
    if (state.pivotMode) {
      return;
    }

    const layer = getLayer(id);
    if (!layer) {
      return;
    }

    event.preventDefault();
    state.selectedId = id;
    dragSession = {
      id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.position.x,
      startY: layer.position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    els.canvasSurface.querySelectorAll(".part-layer").forEach((layerEl) => {
      layerEl.classList.toggle("selected", layerEl.dataset.layerId === id);
    });
    renderLayerList();
    renderSelection();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function updateDrag(event) {
    if (!dragSession) {
      return;
    }

    const layer = getLayer(dragSession.id);
    if (!layer) {
      dragSession = null;
      return;
    }

    layer.position.x = round(dragSession.startX + event.clientX - dragSession.startClientX);
    layer.position.y = round(dragSession.startY + event.clientY - dragSession.startClientY);
    setStatus(`拖动 ${layer.id}，position x=${layer.position.x}, y=${layer.position.y}。`);
    renderCanvas();
    renderSelection();
    updateJsonPreview();
  }

  function endDrag() {
    if (!dragSession) {
      return;
    }
    dragSession = null;
    updateJsonPreview();
  }

  function setPivotFromCanvas(event) {
    if (!state.pivotMode) {
      return;
    }

    const layer = getLayer(state.selectedId);
    if (!layer) {
      return;
    }

    const canvasPoint = getCanvasPoint(event);
    layer.pivot.x = round((canvasPoint.x - layer.position.x) / layer.scale);
    layer.pivot.y = round((canvasPoint.y - layer.position.y) / layer.scale);
    state.pivotMode = false;
    setStatus(`${layer.id} pivot 已设置为 x=${layer.pivot.x}, y=${layer.pivot.y}。`);
    render();
    updateJsonPreview();
  }

  function getCanvasPoint(event) {
    const rect = els.canvasSurface.getBoundingClientRect();
    const scaleX = CANVAS.width / rect.width;
    const scaleY = CANVAS.height / rect.height;
    return {
      x: round((event.clientX - rect.left) * scaleX),
      y: round((event.clientY - rect.top) * scaleY),
    };
  }

  function hasPivot(layer) {
    return Number.isFinite(layer.pivot.x) && Number.isFinite(layer.pivot.y);
  }

  function updateSelectedLayerFromInputs() {
    const layer = getLayer(state.selectedId);
    if (!layer) {
      return;
    }

    layer.bone = els.boneInput.value.trim() || layer.id;
    layer.position.x = clampNumber(els.posXInput.value, layer.position.x);
    layer.position.y = clampNumber(els.posYInput.value, layer.position.y);
    layer.pivot.x = clampNumber(els.pivotXInput.value, layer.pivot.x);
    layer.pivot.y = clampNumber(els.pivotYInput.value, layer.pivot.y);
    layer.scale = clampNumber(els.scaleInput.value, layer.scale);
    layer.rotation = clampNumber(els.rotationNumberInput.value, layer.rotation || 0);
    els.rotationInput.value = normalizeRotation(layer.rotation, -180, 180);
    render();
    updateJsonPreview();
  }

  function buildTemplate() {
    const parts = {};
    state.layers.forEach((layer, index) => {
      parts[layer.id] = {
        image: layer.image,
        bone: layer.bone || layer.id,
        position: {
          x: round(layer.position.x),
          y: round(layer.position.y),
        },
        pivot: {
          x: round(layer.pivot.x),
          y: round(layer.pivot.y),
        },
        size: {
          width: layer.size.width,
          height: layer.size.height,
        },
        scale: round(layer.scale),
        rotation: round(layer.rotation || 0),
        zIndex: index,
      };
    });

    return {
      templateId: state.templateId || "dog_base",
      canvas: { ...CANVAS },
      parts,
    };
  }

  function updateJsonPreview() {
    const template = buildTemplate();
    state.lastJson = JSON.stringify(template, null, 2);
    els.jsonPreview.value = state.lastJson;
    els.jsonState.textContent = `${Object.keys(template.parts).length} parts`;
  }

  function downloadJson() {
    updateJsonPreview();
    const blob = new Blob([state.lastJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function saveProject() {
    state.templateId = els.templateIdInput.value.trim() || "dog_base";
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        templateId: state.templateId,
        layers: state.layers,
        selectedId: state.selectedId,
      })
    );
    setStatus("项目已保存到 localStorage。");
  }

  function loadProject() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("localStorage 里还没有保存的项目。");
      return;
    }

    try {
      const saved = JSON.parse(raw);
      state.templateId = saved.templateId || "dog_base";
      state.layers = Array.isArray(saved.layers) ? saved.layers : [];
      state.selectedId = saved.selectedId || state.layers[0]?.id || null;
      state.pivotMode = false;
      els.templateIdInput.value = state.templateId;
      render();
      updateJsonPreview();
      setStatus("项目已从 localStorage 恢复。");
    } catch (error) {
      setStatus(`项目恢复失败：${error.message}`);
    }
  }

  function resetProject() {
    if (!confirm("清空当前画布和 JSON 预览？")) {
      return;
    }
    state.layers = [];
    state.selectedId = null;
    state.pivotMode = false;
    state.templateId = "dog_base";
    els.templateIdInput.value = state.templateId;
    render();
    updateJsonPreview();
    setStatus("画布已清空。");
  }

  function setStatus(message) {
    els.statusText.textContent = message;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return map[char];
    });
  }

  els.fileInput.addEventListener("change", (event) => handleFiles(event.target.files));
  els.exportButton.addEventListener("click", () => {
    state.templateId = els.templateIdInput.value.trim() || "dog_base";
    updateJsonPreview();
    setStatus("JSON 已生成。");
  });
  els.downloadButton.addEventListener("click", downloadJson);
  els.saveButton.addEventListener("click", saveProject);
  els.loadButton.addEventListener("click", loadProject);
  els.resetButton.addEventListener("click", resetProject);
  els.templateIdInput.addEventListener("input", (event) => {
    state.templateId = event.target.value.trim() || "dog_base";
    updateJsonPreview();
  });
  els.pivotModeButton.addEventListener("click", () => {
    if (!getLayer(state.selectedId)) {
      return;
    }
    state.pivotMode = !state.pivotMode;
    renderPivotMode();
    setStatus(state.pivotMode ? "Pivot 模式：在画布上点击设置当前图层 pivot。" : "已退出 Pivot 模式。");
  });

  ["input", "change"].forEach((eventName) => {
    els.boneInput.addEventListener(eventName, updateSelectedLayerFromInputs);
    els.posXInput.addEventListener(eventName, updateSelectedLayerFromInputs);
    els.posYInput.addEventListener(eventName, updateSelectedLayerFromInputs);
    els.pivotXInput.addEventListener(eventName, updateSelectedLayerFromInputs);
    els.pivotYInput.addEventListener(eventName, updateSelectedLayerFromInputs);
    els.scaleInput.addEventListener(eventName, updateSelectedLayerFromInputs);
    els.rotationNumberInput.addEventListener(eventName, updateSelectedLayerFromInputs);
    els.rotationInput.addEventListener(eventName, () => {
      els.rotationNumberInput.value = els.rotationInput.value;
      updateSelectedLayerFromInputs();
    });
  });

  els.canvasSurface.addEventListener("pointermove", (event) => {
    const point = getCanvasPoint(event);
    els.pointerText.textContent = `x: ${point.x}, y: ${point.y}`;
  });
  els.canvasSurface.addEventListener("pointerleave", () => {
    els.pointerText.textContent = "x: -, y: -";
  });
  els.canvasSurface.addEventListener("pointerup", endDrag);
  els.canvasSurface.addEventListener("pointercancel", endDrag);
  els.canvasSurface.addEventListener("click", setPivotFromCanvas);
  document.addEventListener("pointermove", updateDrag);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.pivotMode) {
      state.pivotMode = false;
      renderPivotMode();
      setStatus("已退出 Pivot 模式。");
    }
  });

  render();
  updateJsonPreview();
})();
