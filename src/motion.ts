// 仅负责展示动效。转换、文本和协议状态不经过这里。
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const ease = "cubic-bezier(.22,.8,.25,1)";
const running = new Map<Element, Animation>();
const visibleTargets = new WeakMap<Element, boolean>();
const disclosureTargets = new WeakMap<HTMLDetailsElement, boolean>();

function cancel(el: Element) {
  running.get(el)?.cancel();
  running.delete(el);
}
function animate(
  el: Element,
  frames: Keyframe[],
  duration: number,
  finish = () => {},
) {
  cancel(el);
  if (reduced.matches || typeof el.animate !== "function") {
    finish();
    return;
  }
  const animation = el.animate(frames, { duration, easing: ease });
  running.set(el, animation);
  animation.onfinish = () => {
    if (running.get(el) !== animation) return;
    running.delete(el);
    finish();
  };
}

const floating = new Set(["export-menu", "mobile-bar"]);
const notices = new Set(["error-panel", "copy-fallback"]);
export function setVisible(el: HTMLElement, visible: boolean) {
  if (!floating.has(el.id) && !notices.has(el.id) && el.id !== "preview") {
    el.hidden = !visible;
    return;
  }
  if ((visibleTargets.get(el) ?? !el.hasAttribute("hidden")) === visible)
    return;
  visibleTargets.set(el, visible);
  const wasHidden = el.hasAttribute("hidden");
  const opacity = wasHidden ? 0 : Number(getComputedStyle(el).opacity);
  const height = wasHidden ? 0 : el.getBoundingClientRect().height;
  cancel(el);
  el.inert = !visible;
  if (el.id === "preview") {
    el.toggleAttribute("hidden", !visible);
    if (visible) animate(el, [{ opacity: 0.55 }, { opacity: 1 }], 180);
    return;
  }
  el.hidden = false;
  if (notices.has(el.id)) {
    const end = visible ? el.getBoundingClientRect().height : 0;
    const margin = getComputedStyle(el).marginBottom;
    el.style.overflow = "hidden";
    animate(
      el,
      [
        {
          height: `${height}px`,
          opacity,
          marginBottom: wasHidden ? "0px" : margin,
        },
        {
          height: `${end}px`,
          opacity: visible ? 1 : 0,
          marginBottom: visible ? margin : "0px",
        },
      ],
      visible ? 240 : 180,
      () => {
        el.hidden = !visible;
        el.style.overflow = "";
      },
    );
  } else {
    const offset =
      el.id === "mobile-bar"
        ? "translateY(-4px)"
        : "translateY(-5px) scale(.98)";
    const start = wasHidden ? offset : getComputedStyle(el).transform;
    animate(
      el,
      [
        { opacity, transform: start },
        { opacity: visible ? 1 : 0, transform: visible ? "none" : offset },
      ],
      visible ? 200 : 140,
      () => {
        el.hidden = !visible;
      },
    );
  }
}

export function setDisclosure(details: HTMLDetailsElement, open: boolean) {
  const summary = details.querySelector("summary")!;
  const content = details.querySelector<HTMLElement>(".details-content")!;
  const wasOpen = details.open;
  const start = details.getBoundingClientRect().height;
  const opacity = wasOpen ? getComputedStyle(content).opacity : "0";
  cancel(details);
  cancel(content);
  disclosureTargets.set(details, open);
  details.dataset.expanded = String(open);
  summary.setAttribute("aria-expanded", String(open));
  content.inert = !open;
  if (reduced.matches) {
    details.open = open;
    details.style.overflow = "";
    return;
  }
  details.open = true;
  const end = open
    ? details.getBoundingClientRect().height
    : summary.getBoundingClientRect().height + 1;
  details.style.overflow = "hidden";
  animate(
    details,
    [{ height: `${start}px` }, { height: `${end}px` }],
    open ? 280 : 220,
    () => {
      details.open = open;
      details.style.overflow = "";
    },
  );
  animate(
    content,
    [
      { opacity, transform: wasOpen ? "none" : "translateY(-5px)" },
      { opacity: open ? 1 : 0, transform: open ? "none" : "translateY(-3px)" },
    ],
    open ? 240 : 160,
  );
}

let morphTimer = 0;
export function stopMorph() {
  clearTimeout(morphTimer);
  document.getElementById("preview-surface")?.removeAttribute("data-morphing");
}
export function beginMorph() {
  stopMorph();
  if (reduced.matches) return;
  document.getElementById("preview-surface")!.dataset.morphing = "true";
  morphTimer = window.setTimeout(stopMorph, 340);
}
export function confirmStatus() {
  const dot = document.getElementById("status-dot")!;
  animate(
    dot,
    [
      { transform: "scale(1)", opacity: 0.6 },
      { transform: "scale(1.65)", opacity: 1, offset: 0.35 },
      { transform: "scale(1)", opacity: 1 },
    ],
    280,
  );
}

export function initMotion() {
  if (!reduced.matches) {
    document.documentElement.classList.add("page-enter");
    window.setTimeout(
      () => document.documentElement.classList.remove("page-enter"),
      650,
    );
  }
  for (const details of document.querySelectorAll<HTMLDetailsElement>(
    "details",
  )) {
    const summary = details.querySelector("summary")!;
    details.dataset.expanded = String(details.open);
    summary.setAttribute("aria-expanded", String(details.open));
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      setDisclosure(
        details,
        !(running.has(details) ? disclosureTargets.get(details) : details.open),
      );
    });
  }
  // 光感只跟随精确指针，空闲不运行帧循环；触屏和减少动态效果时关闭。
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  for (const panel of document.querySelectorAll<HTMLElement>(
    ".editors, .preview-surface",
  )) {
    let frame = 0;
    panel.addEventListener("pointermove", (event) => {
      if (!fine.matches || reduced.matches || event.pointerType !== "mouse")
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty("--light-x", `${event.clientX - rect.left}px`);
        panel.style.setProperty("--light-y", `${event.clientY - rect.top}px`);
        panel.dataset.lit = "true";
      });
    });
    panel.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      delete panel.dataset.lit;
    });
  }
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    stopMorph();
    document.documentElement.classList.remove("page-enter");
    for (const animation of running.values()) animation.finish();
    document
      .querySelectorAll<HTMLElement>("[data-lit]")
      .forEach((el) => delete el.dataset.lit);
  });
}
