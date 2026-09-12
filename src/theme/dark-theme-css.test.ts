import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dark theme contrast boundaries", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  it("keeps text and icon badges dark on solar-yellow controls", () => {
    expect(css).toContain('html[data-theme="dark"] [class~="bg-[#f6c945]"] * {color:#143c63!important}');
    expect(css).toContain('html[data-theme="dark"] [class~="bg-[#f6c945]"] [class*="bg-white/"] {background-color:rgba(255,255,255,.55)!important}');
  });

  it("keeps the new-system action green with dark readable text", () => {
    expect(css).toContain('html[data-theme="dark"] .theme-new-system-action {background-color:#a9dcb9!important;border-color:#65a77b!important;color:#123d2b!important}');
    expect(css).toContain('html[data-theme="dark"] .theme-new-system-action * {color:#123d2b!important}');
  });

  it("keeps continue-discovery actions blue with dark readable text", () => {
    expect(css).toContain('html[data-theme="dark"] .theme-continue-discovery-action {background-color:#a9d2ee!important;border-color:#659dc5!important;color:#103b5b!important}');
    expect(css).toContain('html[data-theme="dark"] .theme-continue-discovery-action * {color:#103b5b!important}');
    expect(css).toContain('.theme-continue-discovery-header {background-color:#b9dcf5;border-color:#76abd0;color:#103b5b}');
    expect(css).toContain('html[data-theme="dark"] .systems-card-list>article.card>.theme-continue-discovery-header {background:#17364e!important;border-color:#659dc5!important;color:#eaf6ff}');
  });

  it("keeps discovery Site and system naming tiles visibly green", () => {
    expect(css).toContain('.theme-new-site-system-tile {background-color:#e2f3e9;border-color:#78b58c;color:#123d2b}');
    expect(css).toContain('html[data-theme="dark"] .theme-new-site-system-tile {background-color:#173126!important;border-color:#65a77b!important;color:#e9f8ef!important}');
    expect(css).toContain('html[data-theme="dark"] .theme-new-site-system-tile .text-muted {color:#b7d5c2!important}');
  });
});
