export function applyHostContext(ctx: any) {
  if (ctx?.theme) {
    document.documentElement.setAttribute("data-theme", ctx.theme);
  }
  if (ctx?.styles?.variables) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(ctx.styles.variables)) {
      root.style.setProperty(`--${key}`, value as string);
    }
  }
  if (ctx?.styles?.css?.fonts) {
    let styleEl = document.getElementById("host-fonts");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "host-fonts";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = ctx.styles.css.fonts;
  }
}
