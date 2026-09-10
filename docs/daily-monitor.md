# Daily Monitor

`/monitor` records observations independently for each system and Site-local calendar date. Apply `supabase/migrations/202609100033_daily_monitor_log.sql` before using saves (the user confirmed applying it on 10 September 2026).

## Included

- Actual daily PV production in kWh; minimum, maximum and end-of-day battery SOC.
- A single generator-ran checkbox, exposing total runtime and first-start/last-end SOC. Multiple runs can be described in notes. An unchecked box does not demand a separate no-run record.
- Optional daily grid import/input and export in kWh below the generator section, independent of whether a generator ran. These are daily totals, not cumulative meter readings. Each has its own totals, reporting-day count, chart series and history column. Missing/off-grid readings remain blank; known zeros are retained.
- Automatically loaded, read-only PVIntell forecast from the existing weather/recorded-array calculation. The forecast is frozen when the day is first saved with one available; subsequent actual-reading edits cannot replace it.
- Bar, line and table views, with 7/30/90/365-day windows. Missing readings are not plotted as zero. Forecast comparisons use only paired dates.
- Wattson context: recent observations, a bounded history summary, provenance, timezone and explicit limits. This is retrieval for advice, not model training or automatic forecast calibration.
- Connect pages offer Junctek only. Other provider records are retained and hidden; no credentials or existing telemetry were deleted.

## Boundaries

- No background scheduler currently archives forecasts. A forecast is saved with a daily entry, including a forecast-only entry for a future date. A missed historical forecast is not recreated from today's weather.
- Forecasts use recorded PV arrays, not proposed equipment. Without recorded capacity/weather, actual observations can still be saved.
- A manually entered forecast from the initial version may remain in historical data with its source preserved. The current form cannot edit or create a manual forecast.
- Generator runtime and SOC change do not measure generator kWh. The entry is one daily summary, not an individual-run timeline.
- Grid import/export are not added to solar production or forecast comparisons, and do not establish total consumption without the other energy flows. Wattson receives them separately. Existing JSON observations default missing grid fields to unknown; no additional SQL migration is needed.
- Original forecasts remain immutable through this API. A future calibrated expectation must be stored separately, with enough paired observations and an explicit method; the comparison percentage is not automatically applied as a correction factor.
- History stays in a separate RLS-protected table. API writes verify ownership and detect stale-tab updates, and never rewrite proposal/discovery settings.

Tests cover schema validation, missing versus zero readings, paired-date comparisons, forecast immutability, authentication/scope checks, stale writes, API save/reload and rendered read-only controls. Live browser automation was unavailable in this session; the user viewed the page and supplied UI feedback.
