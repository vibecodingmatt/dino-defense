(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elements = {
    engineBadge: $("engineBadge"),
    environmentWarning: $("environmentWarning"),
    cameraStage: $("cameraStage"),
    cameraVideo: $("cameraVideo"),
    cameraPlaceholder: $("cameraPlaceholder"),
    scanGuide: $("scanGuide"),
    cameraSelect: $("cameraSelect"),
    trialLength: $("trialLength"),
    startLive: $("startLive"),
    stopLive: $("stopLive"),
    captureStill: $("captureStill"),
    refocus: $("refocus"),
    toggleTorch: $("toggleTorch"),
    zoomControl: $("zoomControl"),
    cameraZoom: $("cameraZoom"),
    zoomValue: $("zoomValue"),
    liveTimer: $("liveTimer"),
    focusChip: $("focusChip"),
    liveStatus: $("liveStatus"),
    liveLastTime: $("liveLastTime"),
    liveAttempts: $("liveAttempts"),
    liveResolution: $("liveResolution"),
    liveQuality: $("liveQuality"),
    photoInput: $("photoInput"),
    photoDrop: $("photoDrop"),
    photoPreview: $("photoPreview"),
    dropPrompt: $("dropPrompt"),
    photoSourceChip: $("photoSourceChip"),
    choosePhoto: $("choosePhoto"),
    clearPhoto: $("clearPhoto"),
    photoStatus: $("photoStatus"),
    photoLastTime: $("photoLastTime"),
    photoAttempts: $("photoAttempts"),
    photoResolution: $("photoResolution"),
    licenseForm: $("licenseForm"),
    resultBadge: $("resultBadge"),
    resultNotice: $("resultNotice"),
    parseWarnings: $("parseWarnings"),
    clearSensitive: $("clearSensitive"),
    diagnostics: $("diagnostics"),
    revealSensitive: $("revealSensitive"),
    sensitiveInspector: $("sensitiveInspector"),
    concealedState: $("concealedState"),
    headerFacts: $("headerFacts"),
    elementRows: $("elementRows"),
    rawOutput: $("rawOutput"),
    runRows: $("runRows"),
    liveSuccessRate: $("liveSuccessRate"),
    liveSuccessDetail: $("liveSuccessDetail"),
    photoSuccessRate: $("photoSuccessRate"),
    photoSuccessDetail: $("photoSuccessDetail"),
    agreementRate: $("agreementRate"),
    agreementDetail: $("agreementDetail"),
    clearHistory: $("clearHistory"),
    rawInput: $("rawInput"),
    rawStatus: $("rawStatus"),
    parseRaw: $("parseRaw"),
    loadSample: $("loadSample"),
    clearRawInput: $("clearRawInput"),
  };

  const FORM_FIELD_IDS = [
    "firstName",
    "middleName",
    "lastName",
    "suffix",
    "dateOfBirth",
    "sex",
    "streetAddress",
    "streetAddress2",
    "city",
    "jurisdiction",
    "postalCode",
    "country",
    "licenseNumber",
    "documentType",
    "issueDate",
    "expirationDate",
    "vehicleClass",
    "restrictions",
    "endorsements",
    "documentDiscriminator",
    "complianceType",
    "aamvaVersion",
    "eyeColor",
    "hairColor",
    "height",
    "weight",
  ];

  const SIGNATURE_FIELDS = [...FORM_FIELD_IDS];
  const MAX_DECODE_DIMENSION = 3200;
  const REFOCUS_INTERVAL_MS = 6000;
  const FOCUS_SWEEP_MS = 650;
  const BLUR_REFOCUS_THRESHOLD = 11;
  const BLUR_FRAMES_BEFORE_REFOCUS = 3;

  const READER_OPTIONS = {
    formats: ["PDF417"],
    tryHarder: true,
    tryRotate: false,
    tryInvert: true,
    maxNumberOfSymbols: 1,
    textMode: "Plain",
    returnErrors: false,
  };

  const LIVE_PASSES = [
    { name: "local", binarizer: "LocalAverage", tryDownscale: false, tryDenoise: false },
    { name: "contrast", binarizer: "LocalAverage", tryDownscale: false, tryDenoise: false, contrast: true },
    { name: "denoise", binarizer: "LocalAverage", tryDownscale: false, tryDenoise: true },
    { name: "left tilt", binarizer: "LocalAverage", tryDownscale: false, tryDenoise: false, contrast: true, rotation: -2 },
    { name: "right tilt", binarizer: "LocalAverage", tryDownscale: false, tryDenoise: false, contrast: true, rotation: 2 },
    { name: "global", binarizer: "GlobalHistogram", tryDownscale: true, tryDenoise: false },
  ];

  const PHOTO_PASSES = [
    { name: "full · local", crop: "full", binarizer: "LocalAverage" },
    { name: "center · local", crop: "center", binarizer: "LocalAverage" },
    { name: "lower · local", crop: "lower", binarizer: "LocalAverage" },
    { name: "upper · local", crop: "upper", binarizer: "LocalAverage" },
    { name: "full · contrast", crop: "full", binarizer: "LocalAverage", contrast: true },
    { name: "center · contrast", crop: "center", binarizer: "LocalAverage", contrast: true },
    { name: "lower · denoise", crop: "lower", binarizer: "LocalAverage", tryDenoise: true },
    { name: "center · left tilt", crop: "center", binarizer: "LocalAverage", contrast: true, rotation: -2 },
    { name: "center · right tilt", crop: "center", binarizer: "LocalAverage", contrast: true, rotation: 2 },
    { name: "full · global", crop: "full", binarizer: "GlobalHistogram", tryDownscale: true },
  ];

  const CANADIAN_PROVINCES = new Set([
    "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
  ]);

  const JURISDICTIONS = {
    "United States": [
      ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
      ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
      ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
      ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
      ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
      ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
      ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
      ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
      ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
      ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
      ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
      ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
      ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"], ["AS", "American Samoa"],
      ["GU", "Guam"], ["MP", "Northern Mariana Islands"], ["PR", "Puerto Rico"],
      ["VI", "U.S. Virgin Islands"],
    ],
    Canada: [
      ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
      ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"],
      ["NS", "Nova Scotia"], ["NT", "Northwest Territories"], ["NU", "Nunavut"],
      ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
      ["SK", "Saskatchewan"], ["YT", "Yukon"],
    ],
  };

  const ELEMENT_LABELS = {
    DAA: "Legacy concatenated name",
    DAB: "Legacy family name",
    DAC: "First / given name(s)",
    DAD: "Middle name(s)",
    DAE: "Name suffix",
    DAG: "Street address",
    DAH: "Street address line 2",
    DAI: "City",
    DAJ: "State / province",
    DAK: "Postal code",
    DAQ: "Customer / license ID",
    DAR: "Legacy vehicle class",
    DAS: "Legacy restriction codes",
    DAT: "Legacy endorsement codes",
    DAU: "Height",
    DAW: "Weight (pounds)",
    DAX: "Weight (kilograms)",
    DAY: "Eye color",
    DAZ: "Hair color",
    DBA: "Expiration date",
    DBB: "Date of birth",
    DBC: "Sex",
    DBD: "Issue date",
    DBG: "Reserved / legacy alias",
    DBJ: "Legacy customer / license ID",
    DBN: "Reserved / legacy alias",
    DBS: "Reserved / legacy alias",
    DCA: "Jurisdiction vehicle class",
    DCB: "Jurisdiction restriction codes",
    DCC: "Legacy endorsement codes",
    DCD: "Jurisdiction endorsement codes",
    DCE: "Weight range",
    DCF: "Document discriminator",
    DCG: "Issuing country",
    DCI: "Place of birth",
    DCJ: "Audit information",
    DCK: "Inventory control number",
    DCL: "Reserved",
    DCM: "Standard vehicle class",
    DCN: "Standard endorsement code",
    DCO: "Standard restriction code",
    DCP: "Vehicle class description",
    DCQ: "Endorsement description",
    DCR: "Restriction description",
    DCS: "Family name",
    DCT: "Combined given names (legacy v2/v3)",
    DCU: "Name suffix",
    DDA: "REAL ID compliance type",
    DDB: "Card revision date",
    DDC: "Reserved",
    DDD: "Limited-duration indicator",
    DDE: "Family-name truncation",
    DDF: "First-name truncation",
    DDG: "Middle-name truncation",
    DDH: "Under 18 until",
    DDI: "Under 19 until",
    DDJ: "Under 21 until",
    DDK: "Organ donor indicator",
    DDL: "Veteran indicator",
    DDM: "Commercial credential indicator",
    DDN: "Non-domiciled indicator",
    DDO: "Enhanced credential indicator",
    DDP: "Permit indicator",
  };

  const AAMVA_YEARS = {
    "00": "Pre-2000",
    "01": "2000",
    "02": "2003",
    "03": "2005",
    "04": "2009",
    "05": "2010",
    "06": "2011",
    "07": "2012",
    "08": "2013",
    "09": "2016",
    "10": "2020",
    "11": "2025",
  };

  const state = {
    reader: null,
    readyPromise: null,
    live: null,
    pendingLive: null,
    photoRun: null,
    photoUrl: "",
    currentResult: null,
    baseline: null,
    runs: [],
    runSequence: 0,
    sensitiveVisible: false,
  };

  function initialize() {
    populateJurisdictions();
    bindEvents();
    elements.licenseForm.addEventListener("submit", (event) => event.preventDefault());
    runParserSelfTest();

    const secureForCamera = isCameraOriginSupported();
    if (!secureForCamera) {
      elements.environmentWarning.hidden = false;
      elements.startLive.title = "Camera access requires HTTPS or localhost";
    }

    elements.startLive.disabled = true;
    elements.choosePhoto.disabled = true;
    setStatus(elements.liveStatus, "working", "Loading the local PDF417 engine…");
    setStatus(elements.photoStatus, "working", "Loading the local PDF417 engine…");
    state.readyPromise = prepareScanner();
    state.readyPromise.catch(() => {});
    refreshCameraDevices().catch(() => {});
  }

  function bindEvents() {
    elements.startLive.addEventListener("click", startLiveTrial);
    elements.stopLive.addEventListener("click", stopLiveTrial);
    elements.captureStill.addEventListener("click", captureHighResolutionStill);
    elements.refocus.addEventListener("click", () => {
      if (state.live) requestRefocus(state.live, true).catch(() => {});
    });
    elements.toggleTorch.addEventListener("click", toggleTorch);
    elements.cameraZoom.addEventListener("input", updateZoomLabel);
    elements.cameraZoom.addEventListener("change", applySelectedZoom);
    elements.choosePhoto.addEventListener("click", () => elements.photoInput.click());
    elements.photoDrop.addEventListener("click", () => {
      if (state.reader && !state.photoRun) elements.photoInput.click();
    });
    elements.photoDrop.addEventListener("keydown", (event) => {
      if (state.reader && !state.photoRun && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        elements.photoInput.click();
      }
    });
    elements.photoInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (file) runPhotoTrial(file);
      event.target.value = "";
    });
    ["dragenter", "dragover"].forEach((type) => {
      elements.photoDrop.addEventListener(type, (event) => {
        event.preventDefault();
        elements.photoDrop.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      elements.photoDrop.addEventListener(type, (event) => {
        event.preventDefault();
        elements.photoDrop.classList.remove("dragging");
      });
    });
    elements.photoDrop.addEventListener("drop", (event) => {
      if (!state.reader || state.photoRun) return;
      const [file] = event.dataTransfer.files || [];
      if (file) runPhotoTrial(file);
    });
    elements.clearPhoto.addEventListener("click", () => clearPhotoPreview());
    elements.clearSensitive.addEventListener("click", clearSensitiveData);
    elements.revealSensitive.addEventListener("click", toggleSensitiveInspector);
    elements.clearHistory.addEventListener("click", clearHistory);
    elements.parseRaw.addEventListener("click", parseManualPayload);
    elements.loadSample.addEventListener("click", () => {
      elements.rawInput.value = makeSafeSample();
      setStatus(elements.rawStatus, "idle", "Fabricated sample loaded. Select Parse text to map it.");
      elements.rawInput.focus();
    });
    elements.clearRawInput.addEventListener("click", () => {
      elements.rawInput.value = "";
      setStatus(elements.rawStatus, "idle", "Manual parser is ready.");
      elements.rawInput.focus();
    });
    window.addEventListener("pagehide", clearTransientMemory);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && (state.live || state.pendingLive)) stopLiveTrial();
    });
  }

  async function prepareScanner() {
    try {
      if (!window.ZXingWASM?.readBarcodes) {
        throw new Error("The local barcode decoder script did not load.");
      }

      elements.engineBadge.textContent = "Loading ZXing-C++";
      const wasmUrl = new URL("js/zxing-reader-3.1.1.wasm", window.location.href).href;
      await window.ZXingWASM.prepareZXingModule({
        overrides: {
          locateFile: (path, prefix) => path.endsWith(".wasm") ? wasmUrl : prefix + path,
        },
        fireImmediately: true,
      });

      state.reader = window.ZXingWASM;

      elements.engineBadge.textContent = "ZXing-C++ ready";
      elements.engineBadge.classList.add("ready");
      elements.startLive.disabled = !isCameraOriginSupported();
      elements.choosePhoto.disabled = false;
      elements.photoDrop.removeAttribute("aria-disabled");
      setStatus(elements.photoStatus, "idle", "Ready for a photo trial");
      setStatus(elements.liveStatus, "idle", elements.startLive.disabled
        ? "Camera requires HTTPS or localhost"
        : "Ready for a live trial");
      return state.reader;
    } catch (error) {
      elements.engineBadge.textContent = "Engine unavailable";
      elements.engineBadge.classList.add("error");
      elements.startLive.disabled = true;
      elements.choosePhoto.disabled = true;
      const message = location.protocol === "file:"
        ? "Open this page from localhost or HTTPS so its local WebAssembly file can load."
        : `Scanner could not initialize: ${friendlyError(error)}`;
      setStatus(elements.liveStatus, "error", message);
      setStatus(elements.photoStatus, "error", message);
      throw error;
    }
  }

  async function refreshCameraDevices(selectedId = "") {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === "videoinput");
    const prior = selectedId || elements.cameraSelect.value;
    elements.cameraSelect.replaceChildren();
    elements.cameraSelect.add(new Option("Automatic rear camera", ""));
    devices.forEach((device, index) => {
      elements.cameraSelect.add(new Option(device.label || `Camera ${index + 1}`, device.deviceId));
    });
    if (prior && devices.some((device) => device.deviceId === prior)) {
      elements.cameraSelect.value = prior;
    }
  }

  async function startLiveTrial() {
    if (state.live || state.pendingLive) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus(elements.liveStatus, "error", "This browser does not expose camera capture.");
      return;
    }
    if (!isCameraOriginSupported()) {
      setStatus(elements.liveStatus, "error", "Camera access requires HTTPS or localhost.");
      return;
    }

    try {
      await state.readyPromise;
    } catch {
      return;
    }

    const duration = Number(elements.trialLength.value) || 15000;
    const selectedDevice = elements.cameraSelect.value;
    const video = selectedDevice
      ? {
          deviceId: { exact: selectedDevice },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          resizeMode: { ideal: "none" },
          advanced: [{ focusMode: "continuous" }],
        }
      : {
          facingMode: { ideal: "environment" },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          resizeMode: { ideal: "none" },
          advanced: [{ focusMode: "continuous" }],
        };

    elements.startLive.disabled = true;
    elements.stopLive.disabled = false;
    elements.cameraSelect.disabled = true;
    elements.trialLength.disabled = true;
    setStatus(elements.liveStatus, "working", "Requesting camera permission…");

    const pending = { canceled: false };
    state.pendingLive = pending;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      if (pending.canceled) {
        stream.getTracks().forEach((track) => track.stop());
        state.pendingLive = null;
        restoreLiveControls();
        setStatus(elements.liveStatus, "warning", "Camera start canceled.");
        return;
      }
      const track = stream.getVideoTracks()[0];
      elements.cameraVideo.srcObject = stream;
      await elements.cameraVideo.play();
      await waitForVideo(elements.cameraVideo);
      if (pending.canceled) {
        stream.getTracks().forEach((track) => track.stop());
        elements.cameraVideo.pause();
        elements.cameraVideo.srcObject = null;
        state.pendingLive = null;
        restoreLiveControls();
        setStatus(elements.liveStatus, "warning", "Camera start canceled.");
        return;
      }

      const settings = track.getSettings?.() || {};
      const run = {
        active: true,
        stream,
        track,
        startAt: performance.now(),
        deadline: performance.now() + duration,
        duration,
        attempts: 0,
        nonAamvaReads: 0,
        scanTimer: 0,
        clockTimer: 0,
        timeoutTimer: 0,
        torchOn: false,
        capabilities: {},
        focusModes: [],
        focusMode: "",
        focusPending: false,
        lastFocusAt: 0,
        focusTimer: 0,
        focusResolve: null,
        blurStreak: 0,
        lastSharpness: 0,
        imageCapture: null,
        capturePending: false,
        controlChain: Promise.resolve(),
      };
      state.live = run;
      state.pendingLive = null;

      elements.cameraPlaceholder.hidden = true;
      elements.cameraStage.classList.add("active");
      elements.liveTimer.hidden = false;
      elements.liveAttempts.textContent = "0";
      elements.liveResolution.textContent =
        settings.width && settings.height ? `${settings.width}×${settings.height}` : "Active";
      setStatus(elements.liveStatus, "working", "Scanning for a PDF417 license barcode…");

      const capabilities = track.getCapabilities?.() || {};
      run.capabilities = capabilities;
      if (capabilities.torch) {
        elements.toggleTorch.hidden = false;
        elements.toggleTorch.disabled = false;
      }
      await configureAutofocus(run, capabilities);
      if (state.live !== run || !run.active) return;
      configureZoom(run, capabilities);
      configureHighResolutionCapture(run);

      run.startAt = performance.now();
      run.deadline = run.startAt + duration;

      refreshCameraDevices(settings.deviceId || selectedDevice)
        .then(() => {
          if (state.live === run) elements.cameraSelect.disabled = true;
        })
        .catch(() => {});
      elements.cameraSelect.disabled = true;
      run.clockTimer = window.setInterval(() => updateLiveClock(run), 100);
      run.timeoutTimer = window.setTimeout(() => finishLiveFailure(run), duration);
      updateLiveClock(run);
      scanLiveFrame(run);
    } catch (error) {
      if (state.live) {
        releaseLive(state.live);
      } else {
        stream?.getTracks().forEach((track) => track.stop());
        elements.cameraVideo.pause();
        elements.cameraVideo.srcObject = null;
      }
      state.pendingLive = null;
      restoreLiveControls();
      if (pending.canceled) {
        setStatus(elements.liveStatus, "warning", "Camera start canceled.");
        return;
      }
      setStatus(elements.liveStatus, "error", cameraErrorMessage(error));
      addRun({
        mode: "live",
        outcome: "failure",
        duration: 0,
        attempts: 0,
        fields: 0,
        match: "—",
      });
    }
  }

  function waitForVideo(video) {
    if (video.readyState >= 2 && video.videoWidth) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Camera preview timed out."));
      }, 6000);
      const ready = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener("loadeddata", ready);
      };
      video.addEventListener("loadeddata", ready, { once: true });
    });
  }

  async function scanLiveFrame(run) {
    if (state.live !== run || !run.active) return;
    if (run.focusPending || run.capturePending) {
      run.scanTimer = window.setTimeout(() => scanLiveFrame(run), 100);
      return;
    }
    const attemptStarted = performance.now();
    run.attempts += 1;
    elements.liveAttempts.textContent = String(run.attempts);

    try {
      const crop = captureGuideCanvas(elements.cameraVideo);
      const sharpness = measureSharpness(crop);
      run.lastSharpness = sharpness;
      const pass = LIVE_PASSES[(run.attempts - 1) % LIVE_PASSES.length];
      elements.liveQuality.textContent =
        `${sharpnessLabel(sharpness)} ${Math.round(sharpness)} · ${crop.width}×${crop.height} · ${pass.name}`;
      const hit = await decodeCanvasPass(crop, pass);
      if (state.live !== run || !run.active) return;
      if (hit) {
        const parsed = parseAamva(hit.rawValue);
        if (parsed.valid) {
          const elapsed = performance.now() - run.startAt;
          releaseLive(run);
          const summary = acceptParsedResult(parsed, "live", elapsed, run.attempts);
          elements.liveLastTime.textContent = formatDuration(elapsed);
          setStatus(
            elements.liveStatus,
            "success",
            `Captured ${summary.fields} fields in ${formatDuration(elapsed)}. Camera stopped.`
          );
          return;
        }

        run.nonAamvaReads += 1;
        setStatus(
          elements.liveStatus,
          "warning",
          "PDF417 found, but it was not a recognized line-based AAMVA DL/ID payload. Still scanning…"
        );
      }
    } catch (error) {
      if (state.live !== run || !run.active) return;
      setStatus(elements.liveStatus, "warning", `Frame could not be read; retrying (${friendlyError(error)}).`);
    }

    if (state.live !== run || !run.active) return;
    maybeRequestRefocus(run, run.lastSharpness);
    const spent = performance.now() - attemptStarted;
    run.scanTimer = window.setTimeout(() => scanLiveFrame(run), Math.max(30, 250 - spent));
  }

  function captureGuideCanvas(video) {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) {
      throw new DOMException("The camera frame is not ready.", "InvalidStateError");
    }

    const stageRect = elements.cameraStage.getBoundingClientRect();
    const guideRect = elements.scanGuide.getBoundingClientRect();
    const displayScale = Math.max(
      stageRect.width / videoWidth,
      stageRect.height / videoHeight
    );
    const displayedWidth = videoWidth * displayScale;
    const displayedHeight = videoHeight * displayScale;
    const hiddenX = (displayedWidth - stageRect.width) / 2;
    const hiddenY = (displayedHeight - stageRect.height) / 2;
    const guideX = guideRect.left - stageRect.left;
    const guideY = guideRect.top - stageRect.top;
    const paddingX = guideRect.width * 0.055;
    const paddingY = guideRect.height * 0.11;

    const x = (guideX - paddingX + hiddenX) / displayScale;
    const y = (guideY - paddingY + hiddenY) / displayScale;
    const width = (guideRect.width + paddingX * 2) / displayScale;
    const height = (guideRect.height + paddingY * 2) / displayScale;
    return drawSourceRegion(video, videoWidth, videoHeight, { x, y, width, height });
  }

  function drawSourceRegion(source, sourceWidth, sourceHeight, region) {
    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const width = Math.max(1, Math.min(sourceWidth - x, Math.ceil(region.width)));
    const height = Math.max(1, Math.min(sourceHeight - y, Math.ceil(region.height)));
    const scale = Math.min(1, MAX_DECODE_DIMENSION / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = scale < 1;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function renderDecodeVariant(source, pass) {
    const requestedScale =
      pass.scale || (source.width < 900 ? Math.min(2, 1400 / source.width) : 1);
    const radians = (pass.rotation || 0) * Math.PI / 180;
    const cosine = Math.abs(Math.cos(radians));
    const sine = Math.abs(Math.sin(radians));
    const naturalWidth = source.width * requestedScale;
    const naturalHeight = source.height * requestedScale;
    const rotatedWidth = naturalWidth * cosine + naturalHeight * sine;
    const rotatedHeight = naturalWidth * sine + naturalHeight * cosine;
    const limitScale = Math.min(
      1,
      MAX_DECODE_DIMENSION / Math.max(rotatedWidth, rotatedHeight)
    );
    const drawWidth = naturalWidth * limitScale;
    const drawHeight = naturalHeight * limitScale;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(rotatedWidth * limitScale));
    canvas.height = Math.max(1, Math.ceil(rotatedHeight * limitScale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = requestedScale * limitScale < 1;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(radians);
    context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.setTransform(1, 0, 0, 1, 0, 0);

    if (pass.contrast) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      stretchGrayscaleContrast(imageData);
      context.putImageData(imageData, 0, 0);
    }
    return canvas;
  }

  function stretchGrayscaleContrast(imageData) {
    const histogram = new Uint32Array(256);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      histogram[Math.round(0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2])] += 1;
    }

    const pixels = imageData.width * imageData.height;
    const lowTarget = pixels * 0.02;
    const highTarget = pixels * 0.98;
    let cumulative = 0;
    let low = 0;
    let high = 255;
    for (let value = 0; value < 256; value += 1) {
      cumulative += histogram[value];
      if (cumulative >= lowTarget) {
        low = value;
        break;
      }
    }
    cumulative = 0;
    for (let value = 0; value < 256; value += 1) {
      cumulative += histogram[value];
      if (cumulative >= highTarget) {
        high = value;
        break;
      }
    }

    const range = Math.max(24, high - low);
    for (let index = 0; index < data.length; index += 4) {
      const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      const value = Math.max(0, Math.min(255, Math.round((luminance - low) * 255 / range)));
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
  }

  function measureSharpness(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const data = context.getImageData(0, 0, width, height).data;
    const step = Math.max(2, Math.floor(Math.max(width, height) / 420));
    let total = 0;
    let samples = 0;
    const luminanceAt = (x, y) => {
      const index = (y * width + x) * 4;
      return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    };
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const center = luminanceAt(x, y);
        const horizontal = Math.abs(2 * center - luminanceAt(x - step, y) - luminanceAt(x + step, y));
        const vertical = Math.abs(2 * center - luminanceAt(x, y - step) - luminanceAt(x, y + step));
        total += (horizontal + vertical) / 2;
        samples += 1;
      }
    }
    return samples ? total / samples : 0;
  }

  function sharpnessLabel(score) {
    if (score < BLUR_REFOCUS_THRESHOLD) return "Soft";
    if (score < BLUR_REFOCUS_THRESHOLD * 1.8) return "Usable";
    return "Sharp";
  }

  async function decodeCanvasPass(source, pass) {
    const canvas = renderDecodeVariant(source, pass);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const results = await state.reader.readBarcodes(imageData, {
      ...READER_OPTIONS,
      binarizer: pass.binarizer || "LocalAverage",
      tryDenoise: Boolean(pass.tryDenoise),
      tryDownscale: Boolean(pass.tryDownscale),
      tryRotate: Boolean(pass.tryRotate),
    });
    const result = results.find((candidate) =>
      candidate.format === "PDF417" && candidate.text
    );
    return result
      ? { rawValue: result.text, format: "pdf417", sourcePass: pass.name }
      : null;
  }

  function updateLiveClock(run) {
    if (state.live !== run || !run.active) return;
    const remaining = Math.max(0, run.deadline - performance.now());
    elements.liveTimer.textContent = `${(remaining / 1000).toFixed(1)}s`;
  }

  function finishLiveFailure(run) {
    if (state.live !== run || !run.active) return;
    const elapsed = performance.now() - run.startAt;
    const detail = run.nonAamvaReads
      ? "The trial found PDF417, but no recognized line-based AAMVA payload."
      : "No recognized AAMVA PDF417 read before the timer ended.";
    releaseLive(run);
    elements.liveLastTime.textContent = "No read";
    setStatus(elements.liveStatus, "error", `${detail} Try changing angle, distance, or light.`);
    addRun({
      mode: "live",
      outcome: "failure",
      duration: elapsed,
      attempts: run.attempts,
      fields: 0,
      match: "—",
    });
  }

  function stopLiveTrial() {
    const run = state.live;
    if (!run && state.pendingLive) {
      state.pendingLive.canceled = true;
      elements.stopLive.disabled = true;
      setStatus(
        elements.liveStatus,
        "warning",
        "Cancel requested. Dismiss the browser permission prompt if it is still open."
      );
      return;
    }
    if (!run) return;
    const elapsed = performance.now() - run.startAt;
    releaseLive(run);
    setStatus(elements.liveStatus, "warning", "Trial stopped. Canceled trials are excluded from success rates.");
    addRun({
      mode: "live",
      outcome: "canceled",
      duration: elapsed,
      attempts: run.attempts,
      fields: 0,
      match: "—",
    });
  }

  function releaseLive(run) {
    run.active = false;
    clearTimeout(run.scanTimer);
    clearTimeout(run.timeoutTimer);
    clearTimeout(run.focusTimer);
    clearInterval(run.clockTimer);
    if (run.focusResolve) {
      const resolveFocus = run.focusResolve;
      run.focusResolve = null;
      resolveFocus();
    }
    run.stream?.getTracks().forEach((track) => track.stop());
    elements.cameraVideo.pause();
    elements.cameraVideo.srcObject = null;
    elements.cameraStage.classList.remove("active");
    elements.cameraPlaceholder.hidden = false;
    elements.liveTimer.hidden = true;
    elements.focusChip.hidden = true;
    elements.refocus.hidden = true;
    elements.refocus.disabled = true;
    elements.captureStill.hidden = true;
    elements.captureStill.disabled = true;
    elements.zoomControl.hidden = true;
    elements.cameraZoom.disabled = true;
    elements.toggleTorch.hidden = true;
    elements.toggleTorch.disabled = true;
    elements.toggleTorch.classList.remove("on");
    elements.toggleTorch.setAttribute("aria-pressed", "false");
    state.live = null;
    restoreLiveControls();
  }

  function restoreLiveControls() {
    const secureForCamera = isCameraOriginSupported();
    elements.startLive.disabled = !state.reader || !secureForCamera || Boolean(state.pendingLive);
    elements.stopLive.disabled = true;
    elements.cameraSelect.disabled = false;
    elements.trialLength.disabled = false;
  }

  function configureZoom(run, capabilities) {
    const range = capabilities.zoom;
    if (
      !range ||
      !Number.isFinite(range.min) ||
      !Number.isFinite(range.max) ||
      range.max <= range.min ||
      !run.track?.applyConstraints
    ) {
      elements.zoomControl.hidden = true;
      return;
    }

    const current = Number(run.track.getSettings?.().zoom);
    const value = Number.isFinite(current) ? current : range.min;
    const step = Number.isFinite(range.step) && range.step > 0 ? range.step : 0.1;
    elements.cameraZoom.min = String(range.min);
    elements.cameraZoom.max = String(range.max);
    elements.cameraZoom.step = String(step);
    elements.cameraZoom.value = String(Math.max(range.min, Math.min(range.max, value)));
    elements.cameraZoom.disabled = false;
    elements.zoomControl.hidden = false;
    updateZoomLabel();
  }

  function updateZoomLabel() {
    elements.zoomValue.textContent = `${Number(elements.cameraZoom.value).toFixed(1)}×`;
  }

  async function applySelectedZoom() {
    const run = state.live;
    if (!run?.active) return;
    const zoom = Number(elements.cameraZoom.value);
    elements.cameraZoom.disabled = true;
    try {
      await applyCameraControls(run, { zoom });
      updateZoomLabel();
    } catch (error) {
      setStatus(elements.liveStatus, "warning", `Zoom is unavailable: ${friendlyError(error)}`);
    } finally {
      if (state.live === run && run.active) elements.cameraZoom.disabled = false;
    }
  }

  function configureHighResolutionCapture(run) {
    if (typeof window.ImageCapture !== "function") {
      elements.captureStill.hidden = true;
      return;
    }
    try {
      run.imageCapture = new ImageCapture(run.track);
      elements.captureStill.hidden = false;
      elements.captureStill.disabled = false;
    } catch {
      run.imageCapture = null;
      elements.captureStill.hidden = true;
    }
  }

  async function captureHighResolutionStill() {
    const run = state.live;
    if (!run?.active || !run.imageCapture || run.capturePending) return;
    if (state.photoRun) {
      setStatus(elements.liveStatus, "warning", "Wait for the current photo decode to finish.");
      return;
    }

    run.capturePending = true;
    elements.captureStill.disabled = true;
    setStatus(elements.liveStatus, "working", "Capturing a full-resolution still locally…");
    try {
      let settings;
      try {
        const capabilities = await run.imageCapture.getPhotoCapabilities?.();
        if (capabilities?.imageWidth?.max && capabilities?.imageHeight?.max) {
          settings = {
            imageWidth: capabilities.imageWidth.max,
            imageHeight: capabilities.imageHeight.max,
          };
        }
      } catch {
        // Some browsers support takePhoto() but not photo capability inspection.
      }
      const blob = await run.imageCapture.takePhoto(settings);
      if (state.live !== run || !run.active) return;
      const file = new File(
        [blob],
        `local-camera-capture.${blob.type.includes("png") ? "png" : "jpg"}`,
        { type: blob.type || "image/jpeg" }
      );
      await runPhotoTrial(file);
      if (state.live === run && run.active) {
        setStatus(elements.liveStatus, "working", "Live scan continues after the local high-resolution capture.");
      }
    } catch (error) {
      if (state.live === run && run.active) {
        setStatus(elements.liveStatus, "warning", `High-resolution capture failed: ${friendlyError(error)}`);
      }
    } finally {
      if (state.live === run && run.active) {
        run.capturePending = false;
        elements.captureStill.disabled = false;
      }
    }
  }

  async function configureAutofocus(run, capabilities) {
    const reportedModes = normalizeFocusModes(capabilities.focusMode);
    const focusConstraintKnown =
      navigator.mediaDevices.getSupportedConstraints?.().focusMode === true;
    run.focusModes = reportedModes.length
      ? reportedModes
      : focusConstraintKnown
        ? ["continuous"]
        : [];

    elements.focusChip.hidden = false;
    if (!run.focusModes.length || !run.track?.applyConstraints) {
      setFocusChip(run, "AF device-managed");
      return;
    }

    elements.refocus.hidden = false;
    elements.refocus.disabled = false;
    const preferredModes = [
      run.focusModes.includes("continuous") ? "continuous" : "",
      run.focusModes.includes("single-shot") ? "single-shot" : "",
    ].filter(Boolean);

    for (const mode of preferredModes) {
      try {
        await applyCameraControls(run, { focusMode: mode });
        if (state.live !== run || !run.active) return;
        run.lastFocusAt = performance.now();
        const actualMode = run.track.getSettings?.().focusMode;
        if (mode === "continuous") {
          setFocusChip(run, actualMode === "continuous" ? "AF continuous" : "AF continuous requested");
        } else {
          setFocusChip(run, "AF pulse mode");
        }
        return;
      } catch {
        // Try the next focus mode before falling back to device-managed focus.
        run.focusModes = run.focusModes.filter((candidate) => candidate !== mode);
      }
    }

    run.focusModes = [];
    elements.refocus.hidden = true;
    elements.refocus.disabled = true;
    setFocusChip(run, "AF device-managed");
  }

  function normalizeFocusModes(value) {
    const modes = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(modes.filter((mode) =>
      mode === "continuous" || mode === "single-shot"
    ))];
  }

  function maybeRequestRefocus(run, sharpness) {
    if (sharpness < BLUR_REFOCUS_THRESHOLD) run.blurStreak += 1;
    else run.blurStreak = 0;
    if (
      !run.focusModes.length ||
      run.focusPending ||
      run.blurStreak < BLUR_FRAMES_BEFORE_REFOCUS ||
      performance.now() - run.lastFocusAt < REFOCUS_INTERVAL_MS
    ) return;
    run.blurStreak = 0;
    requestRefocus(run).catch(() => {});
  }

  async function requestRefocus(run, force = false) {
    if (
      state.live !== run ||
      !run.active ||
      !run.focusModes.length ||
      run.focusPending ||
      (!force && performance.now() - run.lastFocusAt < REFOCUS_INTERVAL_MS)
    ) return;

    run.focusPending = true;
    run.lastFocusAt = performance.now();
    elements.refocus.disabled = true;
    setFocusChip(run, "AF refocusing…");

    try {
      const canSweep = run.focusModes.includes("single-shot");
      const canContinue = run.focusModes.includes("continuous");
      if (canSweep) {
        await applyCameraControls(run, { focusMode: "single-shot" });
        if (canContinue) {
          await waitForFocusSweep(run);
          if (state.live !== run || !run.active) return;
          await applyCameraControls(run, { focusMode: "continuous" });
          setFocusChip(run, "AF continuous");
        } else {
          setFocusChip(run, "AF pulse mode");
        }
      } else if (canContinue) {
        await applyCameraControls(run, { focusMode: "continuous" });
        setFocusChip(run, "AF continuous");
      }
    } catch {
      if (state.live === run && run.active) {
        setFocusChip(run, "AF device-managed");
      }
    } finally {
      if (state.live === run && run.active) {
        run.focusPending = false;
        elements.refocus.disabled = false;
      }
    }
  }

  function waitForFocusSweep(run) {
    return new Promise((resolve) => {
      clearTimeout(run.focusTimer);
      run.focusResolve = () => {
        run.focusResolve = null;
        resolve();
      };
      run.focusTimer = window.setTimeout(() => {
        run.focusTimer = 0;
        run.focusResolve?.();
      }, FOCUS_SWEEP_MS);
    });
  }

  function setFocusChip(run, text) {
    if (state.live !== run || !run.active) return;
    elements.focusChip.textContent = text;
    elements.focusChip.hidden = false;
  }

  function applyCameraControls(run, controls) {
    const operation = async () => {
      if (
        state.live !== run ||
        !run.active ||
        run.track?.readyState === "ended" ||
        !run.track?.applyConstraints
      ) {
        throw new DOMException("Camera track is no longer active.", "AbortError");
      }

      const current = run.track.getConstraints?.() || {};
      const next = { ...current };
      delete next.focusMode;
      delete next.torch;
      const advanced = (Array.isArray(current.advanced) ? current.advanced : [])
        .map((entry) => {
          const preserved = { ...entry };
          delete preserved.focusMode;
          delete preserved.torch;
          return preserved;
        })
        .filter((entry) => Object.keys(entry).length);

      const focusMode = controls.focusMode ?? run.focusMode;
      if (focusMode) next.focusMode = focusMode;
      if (Number.isFinite(controls.zoom)) next.zoom = controls.zoom;
      if (run.capabilities.torch) {
        advanced.push({ torch: controls.torch ?? run.torchOn });
      }
      if (advanced.length) next.advanced = advanced;
      else delete next.advanced;

      await run.track.applyConstraints(next);
      if (controls.focusMode) run.focusMode = controls.focusMode;
    };

    run.controlChain = run.controlChain.catch(() => {}).then(operation);
    return run.controlChain;
  }

  async function toggleTorch() {
    const run = state.live;
    if (!run?.track?.applyConstraints) return;
    const previous = run.torchOn;
    const next = !previous;
    try {
      await applyCameraControls(run, { torch: next });
      run.torchOn = next;
      elements.toggleTorch.classList.toggle("on", next);
      elements.toggleTorch.setAttribute("aria-pressed", String(next));
    } catch (error) {
      run.torchOn = previous;
      elements.toggleTorch.classList.toggle("on", previous);
      elements.toggleTorch.setAttribute("aria-pressed", String(previous));
      setStatus(elements.liveStatus, "warning", `Torch is unavailable: ${friendlyError(error)}`);
    }
  }

  async function runPhotoTrial(file) {
    if (state.photoRun) {
      setStatus(elements.photoStatus, "warning", "A photo is already being decoded.");
      return;
    }
    if (!file || (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name))) {
      setStatus(elements.photoStatus, "error", "Choose an image file.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setStatus(elements.photoStatus, "error", "This image is over 50 MB. Choose a smaller original photo.");
      addRun({ mode: "photo", outcome: "failure", duration: 0, attempts: 0, fields: 0, match: "—" });
      return;
    }

    clearPhotoPreview(false);
    const run = { canceled: false, rejectPreview: null, attempts: 0, nonAamvaReads: 0 };
    state.photoRun = run;
    const previewReady = showPhotoPreview(file, run);
    elements.choosePhoto.disabled = true;
    elements.photoDrop.setAttribute("aria-busy", "true");
    elements.photoDrop.setAttribute("aria-disabled", "true");
    elements.photoAttempts.textContent = "0";
    setStatus(elements.photoStatus, "working", "Loading the image into private in-memory canvases…");
    const started = performance.now();

    try {
      await Promise.all([state.readyPromise, previewReady]);
      if (run.canceled || state.photoRun !== run) return;
      const source = createPhotoSourceCanvas(elements.photoPreview);
      const crops = new Map();

      for (const pass of PHOTO_PASSES) {
        if (run.canceled || state.photoRun !== run) return;
        run.attempts += 1;
        elements.photoAttempts.textContent = String(run.attempts);
        setStatus(
          elements.photoStatus,
          "working",
          `Local pass ${run.attempts}/${PHOTO_PASSES.length}: ${pass.name}`
        );
        await nextPaint();

        if (!crops.has(pass.crop)) {
          crops.set(pass.crop, createPhotoCrop(source, pass.crop));
        }
        const hit = await decodeCanvasPass(crops.get(pass.crop), {
          ...pass,
          tryRotate: true,
        });
        if (!hit) continue;

        const parsed = parseAamva(hit.rawValue);
        if (!parsed.valid) {
          run.nonAamvaReads += 1;
          continue;
        }

        const elapsed = performance.now() - started;
        const summary = acceptParsedResult(parsed, "photo", elapsed, run.attempts);
        elements.photoLastTime.textContent = formatDuration(elapsed);
        setStatus(
          elements.photoStatus,
          "success",
          `Captured ${summary.fields} fields in ${formatDuration(elapsed)} using ${pass.name}.`
        );
        return;
      }

      const elapsed = performance.now() - started;
      elements.photoLastTime.textContent = run.nonAamvaReads ? "Parse failed" : "No read";
      const detail = run.nonAamvaReads
        ? "PDF417 was detected, but the result was not a supported line-based AAMVA payload."
        : "No PDF417 barcode was found after all local crop and enhancement passes.";
      setStatus(
        elements.photoStatus,
        "error",
        `${detail} Retake closer, square to the barcode, and without glare.`
      );
      addRun({
        mode: "photo",
        outcome: "failure",
        duration: elapsed,
        attempts: run.attempts,
        fields: 0,
        match: "—",
      });
    } catch (error) {
      if (run.canceled || state.photoRun !== run) return;
      const elapsed = performance.now() - started;
      elements.photoLastTime.textContent = "Error";
      setStatus(elements.photoStatus, "error", `Image could not be decoded: ${friendlyError(error)}`);
      addRun({
        mode: "photo",
        outcome: "failure",
        duration: elapsed,
        attempts: run.attempts,
        fields: 0,
        match: "—",
      });
    } finally {
      if (state.photoRun === run) {
        state.photoRun = null;
        elements.choosePhoto.disabled = !state.reader;
        elements.photoDrop.removeAttribute("aria-busy");
        elements.photoDrop.removeAttribute("aria-disabled");
      }
    }
  }

  function createPhotoSourceCanvas(image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    return drawSourceRegion(image, width, height, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  function createPhotoCrop(source, name) {
    const regions = {
      full: { x: 0, y: 0, width: 1, height: 1 },
      center: { x: 0.025, y: 0.18, width: 0.95, height: 0.64 },
      lower: { x: 0.025, y: 0.39, width: 0.95, height: 0.59 },
      upper: { x: 0.025, y: 0.02, width: 0.95, height: 0.59 },
    };
    const region = regions[name] || regions.full;
    return drawSourceRegion(source, source.width, source.height, {
      x: source.width * region.x,
      y: source.height * region.y,
      width: source.width * region.width,
      height: source.height * region.height,
    });
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function showPhotoPreview(file, run) {
    state.photoUrl = URL.createObjectURL(file);
    elements.photoPreview.hidden = false;
    elements.dropPrompt.hidden = true;
    elements.photoDrop.classList.add("has-image");
    elements.photoSourceChip.textContent = humanFileSize(file.size);
    elements.photoSourceChip.hidden = false;
    elements.clearPhoto.disabled = false;
    const ready = new Promise((resolve, reject) => {
      run.rejectPreview = reject;
      elements.photoPreview.onload = () => {
        const dimensions = {
          width: elements.photoPreview.naturalWidth,
          height: elements.photoPreview.naturalHeight,
        };
        elements.photoResolution.textContent = `${dimensions.width}×${dimensions.height}`;
        elements.photoPreview.onload = null;
        elements.photoPreview.onerror = null;
        run.rejectPreview = null;
        resolve(dimensions);
      };
      elements.photoPreview.onerror = () => {
        elements.photoPreview.onload = null;
        elements.photoPreview.onerror = null;
        run.rejectPreview = null;
        reject(new Error("The browser could not open this image format."));
      };
    });
    elements.photoPreview.src = state.photoUrl;
    return ready;
  }

  function clearPhotoPreview(resetStatus = true) {
    cancelPhotoRun();
    elements.photoPreview.onload = null;
    elements.photoPreview.onerror = null;
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = "";
    elements.photoPreview.removeAttribute("src");
    elements.photoPreview.hidden = true;
    elements.dropPrompt.hidden = false;
    elements.photoDrop.classList.remove("has-image", "dragging");
    elements.photoSourceChip.hidden = true;
    elements.clearPhoto.disabled = true;
    elements.photoResolution.textContent = "—";
    if (resetStatus) {
      elements.photoLastTime.textContent = "—";
      elements.photoAttempts.textContent = "0";
      setStatus(elements.photoStatus, "idle", "Ready for a photo trial");
    }
  }

  function cancelPhotoRun() {
    const run = state.photoRun;
    if (!run) return;
    run.canceled = true;
    run.rejectPreview?.(new DOMException("Photo decode canceled.", "AbortError"));
    run.rejectPreview = null;
    state.photoRun = null;
    elements.choosePhoto.disabled = !state.reader;
    elements.photoDrop.removeAttribute("aria-busy");
    elements.photoDrop.removeAttribute("aria-disabled");
  }

  function parseAamva(rawValue) {
    const raw = typeof rawValue === "string" ? rawValue.replace(/\u0000/g, "") : "";
    const warnings = [];
    const warn = (message) => {
      if (!warnings.includes(message)) warnings.push(message);
    };

    if (!raw.trim()) {
      return { valid: false, raw, warnings: ["The decoded payload was empty."], fields: {}, elements: [], metadata: {} };
    }

    const metadata = parseHeader(raw, warn);
    const subfile = extractPrimarySubfile(raw, metadata, warn);
    const parsedElements = parseElementLines(subfile.text, subfile.type, warn);
    const byCode = parsedElements.byCode;
    const getRaw = (...codes) => {
      for (const code of codes) {
        const values = byCode.get(code);
        const usable = values?.find((value) => cleanField(value));
        if (usable !== undefined) return usable;
      }
      return "";
    };
    const clean = (value) => cleanField(value);

    const rawCountry = clean(getRaw("DCG")).toUpperCase();
    const jurisdiction = clean(getRaw("DAJ")).toUpperCase();
    let country = rawCountry;
    if (!country && CANADIAN_PROVINCES.has(jurisdiction)) {
      country = "CAN";
      warn("Issuing country was absent; Canada was inferred from the province code.");
    } else if (!country) {
      country = "";
      warn("Issuing country was absent; U.S. date order was assumed.");
    }
    const legacyVersion = /^(00|01)$/.test(metadata.version);
    const canadianDates = rawCountry
      ? rawCountry === "CAN"
      : CANADIAN_PROVINCES.has(jurisdiction);
    const yearFirstDates = legacyVersion || canadianDates;

    const parseDateField = (code, label) => {
      const value = clean(getRaw(code));
      if (!value) return "";
      const parsed = parseAamvaDate(value, yearFirstDates);
      if (!parsed) warn(`${label} (${code}) was not a valid ${yearFirstDates ? "YYYYMMDD" : "MMDDYYYY"} date.`);
      return parsed;
    };

    const legacyName = parseLegacyName(clean(getRaw("DAA")), warn);
    const combinedGivenNames = clean(getRaw("DCT"));
    if (!clean(getRaw("DAC")) && combinedGivenNames) {
      warn("Legacy DCT contains combined given names; it was kept together rather than split into invented first/middle parts.");
    }

    const fields = {
      firstName: clean(getRaw("DAC")) || legacyName.firstName || combinedGivenNames,
      middleName: clean(getRaw("DAD")) || legacyName.middleName,
      lastName: clean(getRaw("DCS", "DAB")) || legacyName.lastName,
      suffix: normalizeSuffix(clean(getRaw("DCU", "DAE")) || legacyName.suffix),
      dateOfBirth: parseDateField("DBB", "Date of birth"),
      sex: normalizeSex(clean(getRaw("DBC")), metadata.version),
      streetAddress: clean(getRaw("DAG")),
      streetAddress2: clean(getRaw("DAH")),
      city: clean(getRaw("DAI")),
      jurisdiction,
      postalCode: formatPostalCode(clean(getRaw("DAK")), country),
      country,
      licenseNumber: clean(getRaw("DAQ")),
      documentType: subfile.type || "",
      issueDate: parseDateField("DBD", "Issue date"),
      expirationDate: parseDateField("DBA", "Expiration date"),
      vehicleClass: clean(getRaw(...(legacyVersion ? ["DAR", "DCA", "DCM"] : ["DCA", "DCM"]))),
      restrictions: clean(getRaw(...(legacyVersion ? ["DAS", "DCB", "DCO"] : ["DCB", "DCO"]))),
      endorsements: clean(getRaw(...(legacyVersion ? ["DAT", "DCD", "DCN"] : ["DCD", "DCN"]))),
      documentDiscriminator: clean(getRaw("DCF")),
      complianceType: clean(getRaw("DDA")).toUpperCase(),
      aamvaVersion: metadata.version
        ? `${metadata.version}${AAMVA_YEARS[metadata.version] ? ` · ${AAMVA_YEARS[metadata.version]}` : ""}`
        : "",
      eyeColor: clean(getRaw("DAY")).toUpperCase(),
      hairColor: normalizeHairColor(clean(getRaw("DAZ"))),
      height: formatHeight(clean(getRaw("DAU")), metadata.version),
      weight: formatWeight(getRaw),
    };

    if (fields.expirationDate && isExpiredThroughDate(fields.expirationDate)) {
      warn("The encoded expiration date has passed.");
    }
    const versionNumber = Number(metadata.version);
    if (metadata.version && Number.isFinite(versionNumber) && versionNumber > 11) {
      warn(`AAMVA version ${metadata.version} is newer than the implemented 2025 v11 mapping; unknown fields were preserved.`);
    }
    if (subfile.type === "EN" && metadata.version && metadata.version !== "10") {
      warn("The EN enhanced-license subfile is defined for AAMVA v10; it was parsed here on a best-effort basis.");
    }

    const knownCoreCodes = [
      "DAQ", "DAA", "DCS", "DAB", "DAC", "DCT", "DBB", "DBA",
      "DBD", "DAG", "DAI", "DAJ", "DAK", "DCF", "DCG",
    ].filter((code) => byCode.has(code)).length;
    const hasAnsiHeader = metadata.fileType === "ANSI" && metadata.headerValid;
    const valid = parsedElements.items.length >= 5 &&
      knownCoreCodes >= (hasAnsiHeader ? 5 : 7) &&
      Boolean(fields.licenseNumber || fields.lastName || fields.documentDiscriminator);

    if (!hasAnsiHeader) {
      warn("No standard ANSI header was found. Header metadata and date-country interpretation may be incomplete.");
    }
    if (!valid) {
      warn("Not enough recognized AAMVA elements were present for safe population. Annex I compact encoding is not supported by this prototype.");
    }

    const expected = [
      ["licenseNumber", "customer ID"],
      ["lastName", "family name"],
      ["firstName", "given name"],
      ["dateOfBirth", "date of birth"],
      ["expirationDate", "expiration date"],
      ["streetAddress", "street address"],
      ["city", "city"],
      ["jurisdiction", "state/province"],
      ["documentDiscriminator", "document discriminator"],
    ];
    const missing = expected.filter(([key]) => !fields[key]).map(([, label]) => label);
    if (valid && missing.length) warn(`Not populated: ${missing.join(", ")}.`);

    return {
      valid,
      raw,
      warnings,
      fields,
      elements: parsedElements.items,
      metadata: {
        ...metadata,
        subfileType: subfile.type || "Unknown",
        parsedElementCount: parsedElements.items.length,
      },
    };
  }

  function parseHeader(raw, warn) {
    const ansiIndex = raw.indexOf("ANSI ");
    const metadata = {
      fileType: "",
      iin: "",
      version: "",
      jurisdictionVersion: "",
      entryCount: 0,
      descriptors: [],
      ansiIndex,
      descriptorEnd: -1,
      headerValid: false,
    };
    if (ansiIndex < 0) return metadata;

    let cursor = ansiIndex + 5;
    metadata.fileType = "ANSI";
    metadata.iin = raw.slice(cursor, cursor + 6);
    cursor += 6;
    metadata.version = raw.slice(cursor, cursor + 2);
    cursor += 2;
    const legacyHeader = /^(00|01)$/.test(metadata.version);
    if (!legacyHeader) {
      metadata.jurisdictionVersion = raw.slice(cursor, cursor + 2);
      cursor += 2;
    }
    const entryText = raw.slice(cursor, cursor + 2);
    cursor += 2;

    const preambleValid = ansiIndex === 4 &&
      raw[0] === "@" &&
      raw[1] === "\n" &&
      raw[2] === "\u001e" &&
      raw[3] === "\r";
    const iinValid = /^\d{6}$/.test(metadata.iin);
    const versionValid = /^\d{2}$/.test(metadata.version);
    if (!preambleValid) warn("The ANSI preamble or control separators were nonstandard; parsing continued on a best-effort basis.");
    if (!iinValid) warn("The header issuer ID was malformed.");
    if (!versionValid) warn("The header AAMVA version was malformed.");
    const entryCount = /^\d{2}$/.test(entryText) ? Number(entryText) : 0;
    metadata.entryCount = entryCount;

    if (!entryCount || entryCount > 20) {
      warn("The header subfile count was missing or implausible; line-based fallback was used.");
      metadata.descriptorEnd = cursor;
      return metadata;
    }

    for (let index = 0; index < entryCount; index += 1) {
      const descriptor = raw.slice(cursor, cursor + 10);
      const type = descriptor.slice(0, 2);
      const offsetText = descriptor.slice(2, 6);
      const lengthText = descriptor.slice(6, 10);
      if (!/^[A-Z0-9]{2}$/.test(type) || !/^\d{4}$/.test(offsetText) || !/^\d{4}$/.test(lengthText)) {
        warn(`Subfile descriptor ${index + 1} was malformed.`);
        break;
      }
      metadata.descriptors.push({
        type,
        offset: Number(offsetText),
        length: Number(lengthText),
      });
      cursor += 10;
    }
    metadata.descriptorEnd = cursor;
    const descriptorsValid = metadata.descriptors.length === entryCount &&
      metadata.descriptors.every((item) =>
        item.offset >= cursor &&
        item.length > 2 &&
        item.offset + item.length <= raw.length
      );
    if (!descriptorsValid) {
      warn("One or more subfile descriptors pointed outside the decoded payload.");
    }
    metadata.headerValid = preambleValid && iinValid && versionValid && descriptorsValid;
    return metadata;
  }

  function extractPrimarySubfile(raw, metadata, warn) {
    const preferredTypes = ["DL", "ID", "EN"];
    const descriptor = preferredTypes
      .map((type) => metadata.descriptors.find((item) => item.type === type))
      .find(Boolean);

    if (descriptor && descriptor.offset >= 0 && descriptor.length > 2) {
      const end = descriptor.offset + descriptor.length;
      const candidate = raw.slice(descriptor.offset, Math.min(end, raw.length));
      if (candidate.startsWith(descriptor.type)) {
        return { type: descriptor.type, text: candidate };
      }
      warn("The declared DL/ID subfile offset did not align after decoding; a structural fallback was used.");
    }

    const searchStart = metadata.descriptorEnd >= 0 ? metadata.descriptorEnd : 0;
    const tail = raw.slice(searchStart);
    const atTail = tail.match(/(DL|ID|EN)(?=(?:DA|DB|DC|DD)[A-Z0-9])/);
    if (atTail) return { type: atTail[1], text: tail.slice(atTail.index) };

    const anywhere = raw.match(/(?:^|[\n\r\u001e])(DL|ID|EN)(?=(?:DA|DB|DC|DD)[A-Z0-9])/);
    if (anywhere) {
      const start = anywhere.index + anywhere[0].length - anywhere[1].length;
      return { type: anywhere[1], text: raw.slice(start) };
    }

    return { type: "", text: raw };
  }

  function parseElementLines(text, subfileType, warn) {
    let payload = String(text || "").replace(/\u0000/g, "");
    if (subfileType && payload.startsWith(subfileType)) payload = payload.slice(2);
    payload = payload.replace(/\u001e/g, "\n");
    const lines = payload.split(/[\r\n]+/);
    const items = [];
    const byCode = new Map();

    for (let rawLine of lines) {
      rawLine = rawLine.trim();
      if (!rawLine) continue;
      if (subfileType && rawLine === subfileType) continue;
      if (subfileType && rawLine.startsWith(subfileType) && rawLine.length > 5) {
        rawLine = rawLine.slice(2);
      }
      const code = rawLine.slice(0, 3).toUpperCase();
      if (!/^[A-Z][A-Z0-9]{2}$/.test(code)) continue;
      const value = rawLine.slice(3).trim();
      items.push({ code, value });
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(value);
    }

    if (items.length < 2 && payload.length > 20 && !/[\r\n]/.test(payload)) {
      warn("The payload did not retain AAMVA element separators, so fields could not be split safely.");
    }
    return { items, byCode };
  }

  function parseAamvaDate(value, yearFirst) {
    if (!/^\d{8}$/.test(value) || value === "00000000") return "";
    const year = Number(yearFirst ? value.slice(0, 4) : value.slice(4, 8));
    const month = Number(yearFirst ? value.slice(4, 6) : value.slice(0, 2));
    const day = Number(yearFirst ? value.slice(6, 8) : value.slice(2, 4));
    if (year < 1800 || year > 2299 || month < 1 || month > 12 || day < 1 || day > 31) return "";
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return "";
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function isExpiredThroughDate(isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return todayUtc > Date.UTC(year, month - 1, day);
  }

  function cleanField(value) {
    const normalized = String(value || "").trim();
    return /^(NONE|UNAVL|UNAVAIL|N\/A)$/i.test(normalized) ? "" : normalized;
  }

  function normalizeSuffix(value) {
    const suffix = value.toUpperCase();
    const aliases = {
      "1ST": "I", "2ND": "II", "3RD": "III", "4TH": "IV", "5TH": "V",
      "6TH": "VI", "7TH": "VII", "8TH": "VIII", "9TH": "IX",
    };
    return aliases[suffix] || suffix;
  }

  function parseLegacyName(value, warn) {
    if (!value) return { firstName: "", middleName: "", lastName: "", suffix: "" };
    const parts = value.split(",").map((part) => cleanField(part));
    if (parts.length < 2) {
      warn("Legacy DAA name did not contain its expected comma separators; it was retained as the family name.");
    }
    return {
      lastName: parts[0] || "",
      firstName: parts[1] || "",
      middleName: parts[2] || "",
      suffix: parts[3] || "",
    };
  }

  function normalizeSex(value, version) {
    if (/^(00|01)$/.test(version)) {
      if (value.toUpperCase() === "M") return "1";
      if (value.toUpperCase() === "F") return "2";
    }
    return value;
  }

  function normalizeHairColor(value) {
    const upper = value.toUpperCase();
    const aliases = {
      BALD: "BAL", BLACK: "BLK", BLOND: "BLN", BLONDE: "BLN", BROWN: "BRO",
      GRAY: "GRY", GREY: "GRY", RED: "RED", AUBURN: "RED", SANDY: "SDY",
      WHITE: "WHI", UNKNOWN: "UNK",
    };
    return aliases[upper] || upper;
  }

  function formatPostalCode(value, country) {
    if (country === "USA" && /^\d{9}$/.test(value)) {
      const extension = value.slice(5);
      return extension === "0000" ? value.slice(0, 5) : `${value.slice(0, 5)}-${extension}`;
    }
    return value;
  }

  function formatHeight(value, version) {
    if (/^(00|01)$/.test(version) && /^\d{3}$/.test(value)) {
      const feet = Number(value[0]);
      const inches = Number(value.slice(1));
      if (feet > 0 && inches < 12) return `${feet} ft ${inches} in`;
    }
    const match = value.match(/^(\d{2,3})\s*(in|cm)?$/i);
    if (!match) return value;
    const amount = Number(match[1]);
    const unit = (match[2] || "").toLowerCase();
    if (unit === "in" || (!unit && amount < 100)) {
      return `${Math.floor(amount / 12)} ft ${amount % 12} in (${amount} in)`;
    }
    if (unit === "cm") return `${amount} cm`;
    return value;
  }

  function formatWeight(getRaw) {
    const pounds = cleanField(getRaw("DAW"));
    const kilograms = cleanField(getRaw("DAX"));
    const parts = [];
    if (/^\d+$/.test(pounds)) parts.push(`${Number(pounds)} lb`);
    else if (pounds) parts.push(pounds);
    if (/^\d+$/.test(kilograms)) parts.push(`${Number(kilograms)} kg`);
    else if (kilograms) parts.push(kilograms);
    if (parts.length) return parts.join(" / ");
    const range = cleanField(getRaw("DCE"));
    const ranges = {
      "0": "Up to 70 lb",
      "1": "71–100 lb",
      "2": "101–130 lb",
      "3": "131–160 lb",
      "4": "161–190 lb",
      "5": "191–220 lb",
      "6": "221–250 lb",
      "7": "251–280 lb",
      "8": "281–320 lb",
      "9": "321+ lb",
    };
    return ranges[range] || range;
  }

  function acceptParsedResult(parsed, mode, duration, attempts) {
    const fields = populateForm(parsed.fields);
    const signature = makeFieldSignature(parsed.fields);
    let match = "Baseline";
    if (!state.baseline) {
      state.baseline = { raw: parsed.raw, signature };
    } else if (parsed.raw === state.baseline.raw) {
      match = "Exact";
    } else if (signature === state.baseline.signature) {
      match = "Fields";
    } else {
      match = "Different";
    }

    state.currentResult = parsed;
    state.sensitiveVisible = false;
    renderResultSummary(parsed, mode, fields);
    renderDiagnostics(parsed);
    elements.clearSensitive.disabled = false;
    elements.revealSensitive.disabled = false;
    addRun({ mode, outcome: "success", duration, attempts, fields, match });
    return { fields, match };
  }

  function populateForm(data) {
    clearForm();
    for (const id of FORM_FIELD_IDS) {
      const control = $(id);
      const value = data[id] || "";
      if (control.tagName === "SELECT") {
        setSelectValue(control, value);
      } else {
        control.value = value;
      }
      control.classList.toggle("populated", Boolean(control.value));
    }
    return FORM_FIELD_IDS.filter((id) => Boolean($(id).value)).length;
  }

  function setSelectValue(select, value) {
    select.querySelectorAll("option[data-dynamic]").forEach((option) => option.remove());
    if (!value) {
      select.value = "";
      return;
    }
    const exists = Array.from(select.options).some((option) => option.value === value);
    if (!exists) {
      const option = new Option(value, value);
      option.dataset.dynamic = "true";
      select.add(option);
    }
    select.value = value;
  }

  function clearForm() {
    FORM_FIELD_IDS.forEach((id) => {
      const control = $(id);
      control.querySelectorAll?.("option[data-dynamic]").forEach((option) => option.remove());
      control.value = "";
      control.classList.remove("populated");
    });
  }

  function renderResultSummary(parsed, mode, fieldCount) {
    const label = mode === "live" ? "Live" : mode === "photo" ? "Photo" : "Manual";
    elements.resultBadge.textContent = `${label} · ${fieldCount}/${FORM_FIELD_IDS.length} fields`;
    elements.resultBadge.className = `result-badge ${parsed.warnings.length ? "warning" : "success"}`;
    elements.resultNotice.textContent =
      `${label} data populated in memory only. Review values before use; barcode capture is not authenticity verification.`;
    if (parsed.warnings.length) {
      elements.parseWarnings.hidden = false;
      elements.parseWarnings.replaceChildren();
      const strong = document.createElement("strong");
      strong.textContent = "Review: ";
      elements.parseWarnings.append(strong, document.createTextNode(parsed.warnings.join(" ")));
    } else {
      elements.parseWarnings.hidden = true;
      elements.parseWarnings.textContent = "";
    }
  }

  function renderDiagnostics(parsed) {
    elements.sensitiveInspector.hidden = true;
    elements.concealedState.hidden = false;
    elements.revealSensitive.textContent = "Reveal sensitive data";
    elements.revealSensitive.setAttribute("aria-pressed", "false");
    elements.headerFacts.replaceChildren();
    elements.elementRows.replaceChildren();
    elements.rawOutput.textContent = "";
    state.sensitiveVisible = false;
  }

  function toggleSensitiveInspector() {
    if (!state.currentResult) return;
    state.sensitiveVisible = !state.sensitiveVisible;
    elements.sensitiveInspector.hidden = !state.sensitiveVisible;
    elements.concealedState.hidden = state.sensitiveVisible;
    elements.revealSensitive.textContent =
      state.sensitiveVisible ? "Hide sensitive data" : "Reveal sensitive data";
    elements.revealSensitive.setAttribute("aria-pressed", String(state.sensitiveVisible));
    if (state.sensitiveVisible) populateSensitiveInspector(state.currentResult);
  }

  function populateSensitiveInspector(parsed) {
    const facts = [
      ["File type", parsed.metadata.fileType || "Not found"],
      ["Issuer ID", parsed.metadata.iin || "—"],
      ["AAMVA", parsed.metadata.version || "—"],
      ["Jurisdiction ver.", parsed.metadata.jurisdictionVersion || "—"],
      ["Subfile", parsed.metadata.subfileType || "—"],
    ];
    elements.headerFacts.replaceChildren(...facts.map(([label, value]) => {
      const item = document.createElement("div");
      item.className = "header-fact";
      const name = document.createElement("span");
      const output = document.createElement("strong");
      name.textContent = label;
      output.textContent = value;
      item.append(name, output);
      return item;
    }));

    elements.elementRows.replaceChildren(...parsed.elements.map(({ code, value }) => {
      const row = document.createElement("tr");
      const codeCell = document.createElement("td");
      const labelCell = document.createElement("td");
      const valueCell = document.createElement("td");
      codeCell.textContent = code;
      labelCell.textContent = ELEMENT_LABELS[code] || (code.startsWith("Z") ? "Jurisdiction-specific" : "Unknown / retained");
      valueCell.textContent = value || "(empty)";
      row.append(codeCell, labelCell, valueCell);
      return row;
    }));
    elements.rawOutput.textContent = visualizeControls(parsed.raw);
  }

  function clearSensitiveData() {
    const stoppedCamera = Boolean(state.pendingLive || state.live);
    if (state.pendingLive) {
      state.pendingLive.canceled = true;
      elements.stopLive.disabled = true;
    }
    if (state.live) releaseLive(state.live);
    clearForm();
    clearPhotoPreview();
    elements.rawInput.value = "";
    setStatus(elements.rawStatus, "idle", "Manual parser is ready.");
    state.currentResult = null;
    state.baseline = null;
    state.sensitiveVisible = false;
    elements.resultBadge.textContent = "No scan yet";
    elements.resultBadge.className = "result-badge empty";
    elements.resultNotice.textContent =
      "A successful scan populates these editable fields. A barcode copies data; it does not prove that an ID is genuine.";
    elements.parseWarnings.hidden = true;
    elements.parseWarnings.textContent = "";
    elements.sensitiveInspector.hidden = true;
    elements.concealedState.hidden = false;
    elements.headerFacts.replaceChildren();
    elements.elementRows.replaceChildren();
    elements.rawOutput.textContent = "";
    elements.revealSensitive.disabled = true;
    elements.revealSensitive.textContent = "Reveal sensitive data";
    elements.revealSensitive.setAttribute("aria-pressed", "false");
    elements.clearSensitive.disabled = true;
    if (stoppedCamera) {
      setStatus(elements.liveStatus, "warning", "Camera stopped and decoded ID data cleared.");
    }
  }

  function addRun(run) {
    state.runSequence += 1;
    state.runs.push({ ...run, id: state.runSequence });
    renderRuns();
    updateScores();
    elements.clearHistory.disabled = false;
  }

  function renderRuns() {
    if (!state.runs.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = "Completed live and photo trials will appear here.";
      row.append(cell);
      elements.runRows.replaceChildren(row);
      return;
    }

    const rows = [...state.runs].reverse().map((run) => {
      const row = document.createElement("tr");
      const values = [
        `#${String(run.id).padStart(2, "0")}`,
        chip(run.mode === "live" ? "Live" : "Photo", run.mode),
        chip(capitalize(run.outcome), run.outcome),
        run.duration ? formatDuration(run.duration) : "—",
        String(run.attempts),
        run.fields ? `${run.fields}/${FORM_FIELD_IDS.length}` : "—",
        run.match === "—" ? "—" : chip(run.match, run.match.toLowerCase()),
      ];
      values.forEach((value) => {
        const cell = document.createElement("td");
        if (value instanceof Node) cell.append(value);
        else cell.textContent = value;
        row.append(cell);
      });
      return row;
    });
    elements.runRows.replaceChildren(...rows);
  }

  function chip(text, className) {
    const item = document.createElement("span");
    item.className = `table-chip ${className}`;
    item.textContent = text;
    return item;
  }

  function updateScores() {
    updateMethodScore("live", elements.liveSuccessRate, elements.liveSuccessDetail);
    updateMethodScore("photo", elements.photoSuccessRate, elements.photoSuccessDetail);
    const comparable = state.runs.filter((run) =>
      run.outcome === "success" && ["Exact", "Fields", "Different"].includes(run.match)
    );
    const agreeing = comparable.filter((run) => ["Exact", "Fields"].includes(run.match));
    const exact = comparable.filter((run) => run.match === "Exact").length;
    if (!comparable.length) {
      elements.agreementRate.textContent = "—";
      elements.agreementDetail.textContent = "First success becomes baseline";
    } else {
      elements.agreementRate.textContent = `${Math.round((agreeing.length / comparable.length) * 100)}%`;
      elements.agreementDetail.textContent =
        `${exact} exact · ${agreeing.length - exact} field match · ${comparable.length} compared`;
    }
  }

  function updateMethodScore(mode, rateElement, detailElement) {
    const completed = state.runs.filter((run) => run.mode === mode && run.outcome !== "canceled");
    const successes = completed.filter((run) => run.outcome === "success");
    if (!completed.length) {
      rateElement.textContent = "—";
      detailElement.textContent = "No completed trials";
      return;
    }
    rateElement.textContent = `${Math.round((successes.length / completed.length) * 100)}%`;
    const median = medianValue(successes.map((run) => run.duration));
    detailElement.textContent = `${successes.length}/${completed.length} tasks · ${median ? `${formatDuration(median)} median` : "no successful time"}`;
  }

  function clearHistory() {
    state.runs = [];
    state.runSequence = 0;
    state.baseline = null;
    renderRuns();
    updateScores();
    elements.clearHistory.disabled = true;
  }

  function parseManualPayload() {
    const raw = elements.rawInput.value;
    if (!raw.trim()) {
      setStatus(elements.rawStatus, "warning", "Paste decoded text or load the fabricated sample first.");
      elements.rawInput.focus();
      return;
    }
    const parsed = parseAamva(raw);
    if (!parsed.valid) {
      setStatus(elements.rawStatus, "error", `Manual parse failed. ${parsed.warnings.join(" ")}`);
      return;
    }
    const fieldCount = populateForm(parsed.fields);
    state.currentResult = parsed;
    renderResultSummary(parsed, "manual", fieldCount);
    renderDiagnostics(parsed);
    elements.clearSensitive.disabled = false;
    elements.revealSensitive.disabled = false;
    setStatus(elements.rawStatus, "success", `Manual text populated ${fieldCount} mapped fields.`);
    document.querySelector(".results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function makeSafeSample() {
    const fields = [
      "DAQSAMPLE-042",
      "DCSEXAMPLE",
      "DDEN",
      "DACMORGAN",
      "DDFN",
      "DADALEX",
      "DDGN",
      "DCUJR",
      "DCAD",
      "DCBNONE",
      "DCDNONE",
      "DBD07152024",
      "DBB02141990",
      "DBA07152032",
      "DBC9",
      "DAU068 in",
      "DAYGRN",
      "DAZBRO",
      "DAW165",
      "DAG42 TEST GARDEN WAY",
      "DAILAKESHORE",
      "DAJVA",
      "DAK232200000",
      "DCFTEST-DOCUMENT-0001",
      "DCGUSA",
      "DCKFABRICATED-ONLY",
      "DDAF",
      "DDB06012025",
    ];
    return buildAamvaSample({ version: "11", type: "DL", fields });
  }

  function buildAamvaSample({ version, jurisdictionVersion = "00", type, fields }) {
    const subfile = `${type}${fields.join("\n")}\r`;
    const prefix = "@\n\u001e\r";
    const legacyHeader = /^(00|01)$/.test(version);
    const fixed = `ANSI 636000${version}${legacyHeader ? "" : jurisdictionVersion}01`;
    const offset = prefix.length + fixed.length + 10;
    const descriptor = `${type}${String(offset).padStart(4, "0")}${String(subfile.length).padStart(4, "0")}`;
    return `${prefix}${fixed}${descriptor}${subfile}`;
  }

  function runParserSelfTest() {
    const current = parseAamva(makeSafeSample());
    const legacy = parseAamva(buildAamvaSample({
      version: "01",
      type: "DL",
      fields: [
        "DAAEXAMPLE,MORGAN,ALEX,JR",
        "DAQV01-SAMPLE",
        "DARC",
        "DASB",
        "DATM",
        "DBD20010101",
        "DBB19761123",
        "DBA20301231",
        "DBCM",
        "DAU509",
        "DAG42 TEST GARDEN WAY",
        "DAILAKESHORE",
        "DAJVA",
        "DAK23220",
        "DCGUSA",
      ],
    }));
    const canadian = parseAamva(buildAamvaSample({
      version: "03",
      type: "ID",
      fields: [
        "DAQCAN-SAMPLE",
        "DCSEXAMPLE",
        "DACMORGAN",
        "DBD20240715",
        "DBB19900214",
        "DBA20320715",
        "DAG42 TEST GARDEN WAY",
        "DAILAKESHORE",
        "DAJON",
        "DAKA1A1A1",
        "DCFCAN-DOCUMENT-1",
        "DCGCAN",
      ],
    }));
    const enhanced = parseAamva(buildAamvaSample({
      version: "10",
      type: "EN",
      fields: [
        "DAQEN-SAMPLE",
        "DCSEXAMPLE",
        "DACMORGAN",
        "DBD07152024",
        "DBB02141990",
        "DBA07152032",
        "DAG42 TEST GARDEN WAY",
        "DAILAKESHORE",
        "DAJVA",
        "DAK232200000",
        "DCFEN-DOCUMENT-1",
        "DCGUSA",
      ],
    }));
    const passed = current.valid &&
      current.fields.licenseNumber === "SAMPLE-042" &&
      current.fields.firstName === "MORGAN" &&
      current.fields.dateOfBirth === "1990-02-14" &&
      current.metadata.version === "11" &&
      legacy.valid &&
      legacy.fields.firstName === "MORGAN" &&
      legacy.fields.dateOfBirth === "1976-11-23" &&
      legacy.fields.vehicleClass === "C" &&
      legacy.fields.sex === "1" &&
      legacy.fields.height === "5 ft 9 in" &&
      canadian.valid &&
      canadian.fields.dateOfBirth === "1990-02-14" &&
      canadian.fields.documentType === "ID" &&
      enhanced.valid &&
      enhanced.fields.documentType === "EN";
    document.documentElement.dataset.parserSelfTest = passed ? "pass" : "fail";
    document.documentElement.dataset.parserVectors = "4";
    if (!passed) {
      throw new Error("The built-in AAMVA parser self-test failed.");
    }
  }

  function populateJurisdictions() {
    const select = $("jurisdiction");
    Object.entries(JURISDICTIONS).forEach(([groupName, options]) => {
      const group = document.createElement("optgroup");
      group.label = groupName;
      options.forEach(([code, name]) => group.append(new Option(`${code} — ${name}`, code)));
      select.append(group);
    });
  }

  function makeFieldSignature(fields) {
    return JSON.stringify(SIGNATURE_FIELDS.map((key) =>
      String(fields[key] || "").trim().toUpperCase()
    ));
  }

  function setStatus(element, type, text) {
    const className = `status-line ${type}`;
    const message = element.querySelector("span");
    if (element.className === className && message?.textContent === text) return;
    element.className = className;
    if (message) message.textContent = text;
  }

  function visualizeControls(raw) {
    const markers = { "\u001e": "␞\n", "\r": "␍\n", "\n": "␊\n" };
    return raw.replace(/[\u001e\r\n]/g, (character) => markers[character]);
  }

  function formatDuration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
    return milliseconds < 1000
      ? `${Math.round(milliseconds)} ms`
      : `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 2 : 1)} s`;
  }

  function humanFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function medianValue(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function friendlyError(error) {
    return error?.message || error?.name || "Unknown error";
  }

  function cameraErrorMessage(error) {
    switch (error?.name) {
      case "NotAllowedError":
        return "Camera permission was denied. Allow access in browser settings and try again.";
      case "NotFoundError":
        return "No usable camera was found on this device.";
      case "NotReadableError":
        return "The camera is busy in another app or could not be started.";
      case "OverconstrainedError":
        return "The selected camera is no longer available. Choose Automatic rear camera.";
      default:
        return `Camera could not start: ${friendlyError(error)}`;
    }
  }

  function isCameraOriginSupported() {
    return window.isSecureContext && location.protocol !== "file:";
  }

  function clearTransientMemory() {
    clearSensitiveData();
    elements.liveLastTime.textContent = "—";
    elements.liveAttempts.textContent = "0";
    elements.liveResolution.textContent = "—";
    setStatus(
      elements.liveStatus,
      state.reader ? "idle" : "error",
      state.reader ? "Ready for a live trial" : "Scanner is unavailable"
    );
  }

  initialize();
})();
