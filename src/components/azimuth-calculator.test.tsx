import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeatherMeCompassDial } from "./azimuth-calculator";

describe("WeatherMe compass port", () => {
  it("uses the strict WeatherMe radial geometry", () => {
    const html = renderToStaticMarkup(createElement(WeatherMeCompassDial, { heading: 90 }));
    expect(html).toContain('data-compass-layout="weatherme-v1"');
    expect(html).toContain('viewBox="0 0 400 400"');
    expect((html.match(/<line/g) ?? []).length).toBe(74);
    expect(html).toContain(">N</text>");
    expect(html).toContain(">E</text>");
    expect(html).toContain('x2="320"');
    expect(html).toContain('y2="200"');
  });

  it("keeps zero at the top and clockwise headings", () => {
    const html = renderToStaticMarkup(createElement(WeatherMeCompassDial, { heading: 0 }));
    expect(html).toContain('x2="200"');
    expect(html).toContain('y2="80"');
  });
});
