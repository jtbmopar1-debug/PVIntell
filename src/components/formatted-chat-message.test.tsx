import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedChatMessage } from "./formatted-chat-message";

describe("FormattedChatMessage", () => {
  it("renders internal PVIntell Markdown links as clickable links", () => {
    const html = renderToStaticMarkup(<FormattedChatMessage content="Here it is: [Open schematic](/sites/site-1/systems/system-1/schematic)"/>);
    expect(html).toContain('href="/sites/site-1/systems/system-1/schematic"');
    expect(html).toContain(">Open schematic</a>");
  });

  it("does not turn unsafe Markdown destinations into links", () => {
    const html = renderToStaticMarkup(<FormattedChatMessage content="[Do not open](javascript:alert(1))"/>);
    expect(html).not.toContain("<a");
  });
});
