const formatNumber = (value) => new Intl.NumberFormat("ru-RU").format(value);

const formatCurrency = (value) => `${formatNumber(value)} ₽`;

const formatPercent = (value) => {
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `+${formatted}%`;
};

const pluralize = (n, one, few, many) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const roundTo = (value, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const roundToRubles = (value) => Math.round(value);

const normalizeCount = (value) => Math.round(value);

const normalizeMoney = (value) => roundToRubles(value);

const NORMAL_DEADLINE_DAYS = 14;
const MIN_DEADLINE_DAYS = 3;
const MAX_RUSH_COEFFICIENT = 0.15;

const rushCoefByDays = (days) => {
  if (days >= NORMAL_DEADLINE_DAYS) return 0;
  const normalizedDays = Math.max(days, MIN_DEADLINE_DAYS);
  const ratio = (NORMAL_DEADLINE_DAYS - normalizedDays) / (NORMAL_DEADLINE_DAYS - MIN_DEADLINE_DAYS);
  return MAX_RUSH_COEFFICIENT * ratio * ratio;
};

const linearPriceFromCount = (count, config) => {
  if (count <= config.thresholdMin) return config.maxPrice;
  if (count >= config.thresholdMax) return config.minPrice;
  const span = config.thresholdMax - config.thresholdMin;
  const priceDrop = config.maxPrice - config.minPrice;
  return config.maxPrice - ((count - config.thresholdMin) * priceDrop) / span;
};

const countFromLinearPrice = (price, config) => {
  if (price >= config.maxPrice) return config.thresholdMin;
  if (price <= config.minPrice) return config.thresholdMax;
  const span = config.thresholdMax - config.thresholdMin;
  const priceDrop = config.maxPrice - config.minPrice;
  return config.thresholdMin + ((config.maxPrice - price) * span) / priceDrop;
};

const projectTypes = {
  event: {
    slides: {
      maxPrice: 2500,
      minPrice: 1500,
      thresholdMin: 30,
      thresholdMax: 200,
    },
    renders: {
      maxPrice: 1500,
      minPrice: 750,
      thresholdMin: 10,
      thresholdMax: 30,
    },
    keyvisualPrice: 30000,
  },
  quest: {
    slides: {
      maxPrice: 2000,
      minPrice: 1000,
      thresholdMin: 30,
      thresholdMax: 200,
    },
    renders: {
      maxPrice: 1000,
      minPrice: 500,
      thresholdMin: 10,
      thresholdMax: 30,
    },
    keyvisualPrice: 20000,
  },
};

const fields = {
  slidesCount: { min: 0, max: 200, step: 1, normalize: normalizeCount },
  slidesPrice: { min: 1500, max: 2500, step: 1, normalize: normalizeMoney },
  rendersCount: { min: 0, max: 50, step: 1, normalize: normalizeCount },
  rendersPrice: { min: 750, max: 1500, step: 1, normalize: normalizeMoney },
  deadlineDays: { min: 0, max: 30, step: 1, normalize: normalizeCount, clampMin: MIN_DEADLINE_DAYS },
};

const state = {
  projectType: "event",
  slidesCount: 20,
  slidesPrice: 2500,
  rendersCount: 0,
  rendersPrice: 1500,
  deadlineDays: 14,
  keyvisual: false,
};

const dom = {
  slidesCount: document.getElementById("slidesCount"),
  slidesCountRange: document.getElementById("slidesCountRange"),
  slidesPrice: document.getElementById("slidesPrice"),
  slidesPriceRange: document.getElementById("slidesPriceRange"),
  rendersCount: document.getElementById("rendersCount"),
  rendersCountRange: document.getElementById("rendersCountRange"),
  rendersPrice: document.getElementById("rendersPrice"),
  rendersPriceRange: document.getElementById("rendersPriceRange"),
  deadlineDays: document.getElementById("deadlineDays"),
  deadlineDaysRange: document.getElementById("deadlineDaysRange"),
  keyvisual: document.getElementById("keyvisual"),
  keyvisualPrice: document.getElementById("keyvisualPrice"),
  deadlineUnit: document.getElementById("deadlineUnit"),
  deadlinePercent: document.getElementById("deadlinePercent"),
  summarySlides: document.getElementById("summarySlides"),
  summaryRenders: document.getElementById("summaryRenders"),
  summaryUrgency: document.getElementById("summaryUrgency"),
  summaryKeyvisual: document.getElementById("summaryKeyvisual"),
  summaryTotal: document.getElementById("summaryTotal"),
  reset: document.getElementById("reset"),
  copy: document.getElementById("copy"),
};

const autosizeInputs = Array.from(document.querySelectorAll(".input-number"));

const updateInputSize = (input) => {
  if (!input) return;
  const raw = input.value === "" ? "0" : String(input.value);
  const width = Math.max(1, raw.length);
  input.style.width = `${width}ch`;
};

const tabs = Array.from(document.querySelectorAll(".tab"));

const getActiveType = () => projectTypes[state.projectType];

const setInputBounds = (key, { min, max, step }) => {
  const targets = [dom[key], dom[`${key}Range`]].filter(Boolean);
  targets.forEach((input) => {
    input.min = String(min);
    input.max = String(max);
    if (step !== undefined) {
      input.step = String(step);
    }
  });
};

const updateField = (key, value) => {
  const config = fields[key];
  const normalized = config.normalize ? config.normalize(value) : value;
  const effectiveMin = config.clampMin != null ? config.clampMin : config.min;
  const clamped = clamp(normalized, effectiveMin, config.max);
  state[key] = clamped;
  dom[key].value = clamped;
  updateInputSize(dom[key]);
  const rangeKey = `${key}Range`;
  if (dom[rangeKey]) {
    dom[rangeKey].value = clamped;
  }
};

const setActiveTab = (nextTab) => {
  tabs.forEach((tab) => {
    const isActive = tab === nextTab;
    tab.classList.toggle("tab--active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
};

const initialTab = tabs.find((tab) => tab.classList.contains("tab--active")) || tabs[0];

const updateSlidesFromCount = (value) => {
  updateField("slidesCount", value);
  const price = linearPriceFromCount(state.slidesCount, getActiveType().slides);
  updateField("slidesPrice", price);
};

const updateSlidesFromPrice = (value) => {
  updateField("slidesPrice", value);
  const count = countFromLinearPrice(state.slidesPrice, getActiveType().slides);
  updateField("slidesCount", count);
};

const updateRendersFromCount = (value) => {
  updateField("rendersCount", value);
  const price = linearPriceFromCount(state.rendersCount, getActiveType().renders);
  updateField("rendersPrice", price);
};

const updateRendersFromPrice = (value) => {
  updateField("rendersPrice", value);
  const count = countFromLinearPrice(state.rendersPrice, getActiveType().renders);
  updateField("rendersCount", count);
};

const updateTypeDependentBounds = () => {
  const config = getActiveType();
  fields.slidesPrice.min = config.slides.minPrice;
  fields.slidesPrice.max = config.slides.maxPrice;
  fields.rendersPrice.min = config.renders.minPrice;
  fields.rendersPrice.max = config.renders.maxPrice;
  setInputBounds("slidesPrice", fields.slidesPrice);
  setInputBounds("rendersPrice", fields.rendersPrice);
  dom.keyvisualPrice.textContent = `+${formatCurrency(config.keyvisualPrice)}`;
};

const recalc = () => {
  const slidesCost = roundTo(state.slidesCount * state.slidesPrice, 2);
  const rendersCost = roundTo(state.rendersCount * state.rendersPrice, 2);
  const keyvisualCost = state.keyvisual ? getActiveType().keyvisualPrice : 0;
  const baseCost = roundTo(slidesCost + rendersCost + keyvisualCost, 2);
  const rushCoef = rushCoefByDays(state.deadlineDays);
  const rushAddon = roundTo(baseCost * rushCoef, 2);
  const total = roundTo(baseCost + rushAddon, 2);

  dom.deadlinePercent.textContent = formatPercent(rushCoef * 100);
  dom.deadlineUnit.textContent = pluralize(state.deadlineDays, "день", "дня", "дней");

  const deadlineGroup = dom.deadlineDays.closest(".option-inputs");
  if (deadlineGroup) {
    deadlineGroup.classList.toggle("deadline-min", state.deadlineDays <= MIN_DEADLINE_DAYS);
  }

  dom.summarySlides.textContent = formatCurrency(roundToRubles(slidesCost));
  dom.summaryRenders.textContent = formatCurrency(roundToRubles(rendersCost));
  dom.summaryUrgency.textContent = formatCurrency(roundToRubles(rushAddon));
  dom.summaryKeyvisual.textContent = formatCurrency(roundToRubles(keyvisualCost));
  dom.summaryTotal.textContent = formatCurrency(roundToRubles(total));

  const toggleLine = (node, value) => {
    const line = node.closest(".summary-line");
    if (!line) return;
    line.style.display = value > 0 ? "" : "none";
  };

  toggleLine(dom.summarySlides, roundToRubles(slidesCost));
  toggleLine(dom.summaryRenders, roundToRubles(rendersCost));
  toggleLine(dom.summaryUrgency, roundToRubles(rushAddon));
  toggleLine(dom.summaryKeyvisual, roundToRubles(keyvisualCost));
};

const bindInput = (key, handler) => {
  dom[key].addEventListener("input", (event) => {
    const value = Number(event.target.value || 0);
    handler(value);
    recalc();
  });

  const rangeKey = `${key}Range`;
  if (dom[rangeKey]) {
    dom[rangeKey].addEventListener("input", (event) => {
      const value = Number(event.target.value || 0);
      handler(value);
      recalc();
    });
  }
};

autosizeInputs.forEach(updateInputSize);

dom.keyvisual.addEventListener("change", (event) => {
  state.keyvisual = event.target.checked;
  recalc();
});

const resetCalculator = () => {
  updateSlidesFromCount(20);
  updateRendersFromCount(0);
  updateField("deadlineDays", 14);
  state.keyvisual = false;
  dom.keyvisual.checked = false;
  recalc();
};

document.querySelectorAll(".btn--secondary").forEach((btn) => {
  btn.addEventListener("click", resetCalculator);
});

const getSummaryPayload = () => {
  const summaryItems = [
    { label: "Вёрстка слайдов", value: dom.summarySlides.textContent, node: dom.summarySlides },
    { label: "Отрисовка", value: dom.summaryRenders.textContent, node: dom.summaryRenders },
    { label: "Надбавка за срочность", value: dom.summaryUrgency.textContent, node: dom.summaryUrgency },
    { label: "Кейвижуал", value: dom.summaryKeyvisual.textContent, node: dom.summaryKeyvisual },
  ];

  const payloadLines = summaryItems
    .filter((item) => {
      const line = item.node.closest(".summary-line");
      return !line || line.style.display !== "none";
    })
    .map((item) => `${item.label}: ${item.value}`);

  payloadLines.push(`Всего: ${dom.summaryTotal.textContent}`);
  return payloadLines.join("\n");
};

document.querySelectorAll(".btn--primary").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getSummaryPayload());
      const textNode = btn.querySelector(".btn-text");
      if (textNode) {
        const originalText = textNode.textContent;
        textNode.textContent = "Скопировано";
        setTimeout(() => {
          textNode.textContent = originalText;
        }, 1200);
      }
    } catch (error) {
      console.error("Clipboard error", error);
    }
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab);
    const nextType = tab.dataset.projectType || "event";
    state.projectType = nextType in projectTypes ? nextType : "event";
    updateTypeDependentBounds();
    updateSlidesFromCount(state.slidesCount);
    updateRendersFromCount(state.rendersCount);
    recalc();
  });
});

if (initialTab) {
  setActiveTab(initialTab);
  const initialType = initialTab.dataset.projectType || "event";
  state.projectType = initialType in projectTypes ? initialType : "event";
}

updateTypeDependentBounds();
updateSlidesFromCount(state.slidesCount);
updateRendersFromCount(state.rendersCount);
updateField("deadlineDays", state.deadlineDays);
dom.keyvisual.checked = state.keyvisual;

bindInput("slidesCount", updateSlidesFromCount);
bindInput("slidesPrice", updateSlidesFromPrice);
bindInput("rendersCount", updateRendersFromCount);
bindInput("rendersPrice", updateRendersFromPrice);
bindInput("deadlineDays", (value) => updateField("deadlineDays", value));
recalc();
