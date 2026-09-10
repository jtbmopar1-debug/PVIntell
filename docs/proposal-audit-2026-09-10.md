# Proposal pipeline audit — 10 September 2026

## Scope and verification

Checked discovery → deterministic sizing → saved proposal → schematic/overview → shopping-list inputs. Regression tests use an isolated in-memory project store and the real action/save boundaries; no live user proposals were rewritten. The suite passed 134 tests at the end of this audit's regression pass; TypeScript also passed. Browser interaction and a live-provider rebuild have not been exercised by this audit.

## Corrections

- Preserve individual discovery answers while batching consecutive writes on completion. Tests cover changing one answer, rebuilding from it, and removing a previously selected motor.
- Persist location-based azimuth/tilt starting recommendations, including a valid 0° value. Keep actual roof direction/pitch separate from those targets.
- Preserve structured roof-face data; screen recorded rectangles and obstructions, including power-driven array growth. Unknown supplementary-array dimensions cannot inherit the owned modules' dimensions or imply a proven fit.
- Include conditional flat-roof tilt-frame/strut shopping items. Pitched-roof rails follow the recorded roof pitch; no automatic tilt kit. Remove universal 1.2 m bracket-spacing assumptions.
- Respect excluded panels/generators and existing generator ratings/routes. Do not invent a kVA power factor.
- Preserve panel-profile wattage and electrical details consistently; keep user-owned modules provisional and supplementary capacity separate. Respect inventory allocation and unused quantities.
- Keep future additions out of current sizing.
- Preserve generator/load evidence and larger schematic payloads at the calculator save boundary.
- Ignore zero-quantity and deselected loads. Separate typical energy input from peak running input; do not report a welder's kVA as kWh. Avoid counting a pool heater twice or confusing it with a household heat pump.
- Preserve inverter arrangement choices instead of silently substituting hybrid wording. Show module-level microinverter AC output and optimiser topology appropriately; explicitly identify unresolved standalone configurations.
- Use the same grid-relationship decision for scope text and schematic rendering. Rebuild clears stale draft structures even when headline sizes happen to match.

## Remaining validation limits

This remains a planning engine, not proof of a buildable or compliant installation. In particular:

- Solar climatology and daily-energy allowances are not an hourly PV/load/battery/generator dispatch simulation. Seasonal/time-of-day shade and roof aspect are screened and disclosed, not numerically modelled into plane-of-array yield. Multi-day resilience needs that further modelling.
- Roof-fit screening uses rectangles, a planning module gap and obstruction area, not exact obstacle positions, structural calculations, fire/access setbacks or tilted-row shadow spacing. Flat-roof hardware quantities remain conditional on the engineered mounting layout.
- Motor-start estimates and generic inverter/generator classes require exact product voltage/current, surge duration, power factor, transient recovery and compatibility verification. PV and generator ratings are not assumed to add together.
- Existing modules, batteries and inverters need exact datasheet/condition verification. Capacity-only extra arrays still require module selection and surface/MPPT allocation.
- Generic cable/protection planning is not a jurisdiction-specific electrical design. Exact equipment manuals, installation conditions and local authorised review remain required.
- Battery-free modular and AC-coupled arrangements can still be unresolved power paths; the overview now says so rather than treating a generic diagram as evidence of compatibility.

## Engineering references checked

Latitude/equator-facing is a starting recommendation, not a measurement of a roof. The [US DOE design overview](https://www.energy.gov/cmei/systems/solar-photovoltaic-system-design-basics) describes northern-hemisphere orientation and mounting; [Australian Government design considerations](https://www.energy.gov.au/solar/solar-system-design/design-considerations) covers roof aspect, angle and local trade-offs. These support keeping roof geometry and a target angle distinct.

[Victron AC-coupling documentation](https://www.victronenergy.com/live/ac_coupling:start) illustrates why grid-forming, output regulation and storage requirements are product/topology-specific. Its limits are not applied as universal requirements for every manufacturer's system.
