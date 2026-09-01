#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Iteration 4 — AI weather routes + race weather alert (main agent)
- New backend endpoints (all under /api, auth Bearer token required):
  - GET /api/geo/search?q= : Open-Meteo geocoding, returns {results:[{name,region,country,lat,lon}]}
  - PUT /api/profile/race-location {city,lat,lon} : saves race city on user
  - GET /api/race/weather : statuses no_race|past|need_location|too_far|ok|difficult. For difficult: flags[] + Claude "strategy" (cached per day in db.race_alerts)
  - GET /api/coach/route-weather?lat&lon : live weather + wind direction, Claude picks best route from catalog, returns {route,reason,wind_tip,weather}; cached 1h in db.route_tips
- fetch_weather now includes wind_direction_10m (wind_dir_deg in current)
- RECOMMENDED_ROUTES entries now include "terrain" field
- Frontend: RaceWeatherCard on Home (city search modal, forecast, flags, collapsible strategy); Explore has "Circuit selon la météo" card + recommended badge on route list; notifications.ts has scheduleRaceWeatherAlert (device-only)
- Test account thomas@pace.app race_date temporarily set to J+2 with race_location Annecy => /api/race/weather returns "difficult" (chaleur) with strategy. Verified via curl + screenshots.
- needs_retesting: true (backend iteration 4 endpoints + frontend flows)

## Iteration 5 — Background GPS tracking + 3D circuits map (main agent, FRONTEND ONLY changes)
- No backend changes (security hardening only: generic 502 error messages instead of str(e)).
- New: /app/frontend/src/backgroundLocation.ts (expo-task-manager task "pace-run-tracking", bg permission helpers, start/stop background updates with Android foreground service). Task registered via import in app/_layout.tsx.
- run/active.tsx refactor: wall-clock chrono (startTs/pausedAccum refs) so time stays exact when screen locked; processCoord extracted; onStartPress shows one-time modal (testID bg-allow / bg-skip) asking background permission on NATIVE only (Platform web skips modal and uses watchPositionAsync fallback); finish/unmount stop background tracking; live badge shows "En cours · veille ✓" when bg active.
- New screen /routes-map (Circuits 3D): permission gate (circuits-allow-location / circuits-open-settings), generates 3 organic loops around GPS position (src/circuits.ts), distance chips 3/5/8/10/15 km (circuit-dist-N), shuffle (circuit-regenerate), circuit cards (circuit-c0..c2), "Courir ce circuit" (run-circuit) → /run/active. Native map = react-native-maps 3D camera (pitch 55, showsBuildings); web fallback = SVG (CircuitsMap.web.tsx).
- Explore: new entry card testID open-circuits-map.
- app.json: background location (iOS UIBackgroundModes + NSLocationAlways..., Android ACCESS_BACKGROUND_LOCATION + FOREGROUND_SERVICE*) — device/build only, NOT testable in web/Expo Go.
- Playwright hint: grant geolocation via context.grant_permissions(["geolocation"]) + context.set_geolocation({latitude:45.9,longitude:6.13}) to test circuits + run tracking on web.
- needs_retesting: true (frontend flows only)
