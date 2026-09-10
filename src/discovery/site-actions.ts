import type { WattsonActionRequest } from "@/ai/actions";
import { unknownAnswer, type DiscoveryAnswers } from "@/discovery/new-system";

/** Convert the combined Site discovery answers into each affected proposal's evidence record. */
export function siteDiscoveryActions(answers: DiscoveryAnswers): WattsonActionRequest[] {
  const values: Array<[string, string | number | string[] | undefined]> = [
    ["utility_relationship", answers.utility_relationship === "off_grid" ? "No public electricity supply" : "Connected to public electricity"],
    ["target_grid_role", answers.target_grid_role],
    ["ac_phase_arrangement", answers.ac_phase_arrangement], ["nominal_ac_voltage", answers.nominal_ac_voltage],
    ["primary_outcome", answers.primary_outcome],
    ["current_energy_use", typeof answers.current_energy_use === "number" ? `${answers.current_energy_use} kWh/month` : answers.current_energy_use],
    ["off_grid_daily_energy_use", typeof answers.off_grid_daily_energy_use === "number" ? `${answers.off_grid_daily_energy_use} kWh/day` : answers.off_grid_daily_energy_use],
    ["backup_preference", answers.backup_preference], ["battery_requirement", answers.battery_requirement],
    ["outage_essential_loads", answers.outage_essential_loads], ["backup_duration", answers.backup_duration],
    ["generator_requirement", answers.generator_requirement], ["generator_details", answers.generator_details], ["generator_outage_role", answers.generator_outage_role],
    ["heavy_or_surge_loads", answers.heavy_loads], ["household_motor_ratings", answers.household_motor_ratings],
    ["everyday_needs", answers.everyday_needs], ["cooking_energy", answers.cooking_energy],
    ["water_heating_energy", answers.water_heating_energy], ["hot_water_storage_litres", answers.hot_water_storage_litres],
    ["solar_hot_water_arrangement", answers.solar_hot_water_arrangement], ["solar_hot_water_storage_litres", answers.solar_hot_water_storage_litres],
    ["solar_hot_water_pump_watts", answers.solar_hot_water_pump_watts], ["solar_hot_water_pump_hours_per_day", answers.solar_hot_water_pump_hours_per_day],
    ["space_heating_energy", answers.space_heating_energy], ["pool_or_spa", answers.pool_or_spa],
    ["pool_heating_method", answers.pool_heating_method], ["pool_heating_profile", answers.pool_heating_profile],
    ["pool_heater_electrical_kw", answers.pool_heater_electrical_kw], ["pool_heater_cop", answers.pool_heater_cop],
    ["pool_equipment_ratings", answers.pool_equipment_ratings], ["pool_equipment", answers.pool_equipment], ["building_type", answers.building_type],
    ["property_authority", answers.property_authority], ["proposed_panel_location", answers.panel_location],
    ["storage_supply_source", answers.storage_supply_source_off_grid ?? answers.storage_supply_source_grid],
    ["panel_construction_interest", answers.panel_construction_interest], ["existing_panel_selection", answers.existing_panel_selection], ["panel_area_dimensions", answers.panel_area_dimensions],
    ["panel_area_constraints", answers.panel_area_constraints], ["orientation_and_pitch", answers.orientation_and_pitch],
    ["shading", answers.shading], ["shade_affected_areas", answers.shade_affected_areas],
    ["shade_time_windows", answers.shade_time_windows], ["shade_seasonality", answers.shade_seasonality],
    ["shade_extent", answers.shade_extent], ["structure_condition", answers.structure_condition],
    ["expected_expansion", answers.future_changes], ["ev_status", answers.ev_status],
    ["ev_vehicle_details", answers.ev_vehicle_details], ["ev_travel_profile", answers.ev_travel_profile],
    ["ev_charging_window", answers.ev_charging_window], ["ev_charging_priority", answers.ev_charging_priority],
    ["ev_available_supply", answers.ev_available_supply], ["ev_bidirectional_goal", answers.ev_bidirectional_goal],
    ["delivery_approach", answers.delivery_approach], ["dc_system_voltage", answers.dc_system_voltage],
    ["battery_chemistry", answers.battery_chemistry], ["custom_battery_assessment", answers.custom_battery_assessment],
    ["module_level_electronics", answers.module_level_electronics], ["module_electronics_compatibility", answers.module_electronics_compatibility],
  ];
  return values
    .filter(([, value]) => value !== undefined && value !== "" && value !== unknownAnswer)
    .map(([key, value]) => ({
      name: "record_design_discovery",
      arguments: { key, value: Array.isArray(value) ? value.join(", ") : String(value), confidence: "user_confirmed" },
    }));
}
