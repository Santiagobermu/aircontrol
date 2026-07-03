import { runAutoSchedulerForMonth as localScheduler } from './schedulerEngine';

// Local development endpoint for Flask server
const LOCAL_API_URL = 'http://localhost:8080/solve';

// Production Firebase Cloud Function endpoint (will be set after deployment)
const PROD_API_URL = 'https://solve-schedule-api-a6wq44c5vq-uc.a.run.app'; // Fallback / placeholder

export const runOrToolsScheduler = async (daysInMonth, controllers, exceptions, sequencePattern, requests, currentSchedule) => {
  // Pre-process special requests client-side first so they act as fixed presets for the solver
  const preScheduled = JSON.parse(JSON.stringify(currentSchedule || {}));
  
  // Initialize empty days if not present
  daysInMonth.forEach(day => {
    if (!preScheduled[day]) {
      preScheduled[day] = {
        A: {}, M: {}, T: {}, N: {}
      };
    }
  });

  // Apply special requests as presets
  if (requests && requests.length > 0) {
    requests.forEach(req => {
      const day = req.date;
      if (!daysInMonth.includes(day)) return;
      
      const c = controllers.find(ctrl => ctrl.id === req.controllerId);
      if (!c || !c.active) return;
      
      const shift = req.shift !== 'Cualquiera' ? req.shift : 'M'; // Default to Morning if Cualquiera
      const pos = req.position !== 'Cualquiera' ? req.position : (c.skills && c.skills[0] ? c.skills[0] : 'TWR');
      
      // Find a slot starting with this position prefix in this day and shift
      if (!preScheduled[day][shift]) preScheduled[day][shift] = {};
      
      // Determine actual slot key (e.g. TWR-1 or CTE-1)
      const slotKey = `${pos}-1`; 
      
      // Pre-schedule it if not already assigned
      if (!preScheduled[day][shift][slotKey]) {
        preScheduled[day][shift][slotKey] = c.id;
      }
    });
  }

  // Detect server URLs
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiEndpoint = isLocalhost ? LOCAL_API_URL : PROD_API_URL;

  console.log(`[OR-Tools Scheduler] Attempting to solve using backend: ${apiEndpoint}`);

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        controllers,
        exceptions,
        sequencePattern,
        days: daysInMonth,
        holidays: [], // Holidays are determined internally or can be passed
        schedule: preScheduled
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'OPTIMAL' || data.status === 'FEASIBLE') {
      console.log('[OR-Tools Scheduler] Solver succeeded! Metrics:', data.metrics);
      return data.schedule;
    } else {
      console.warn('[OR-Tools Scheduler] Solver returned INFEASIBLE. Falling back to local JS engine.');
    }
  } catch (err) {
    console.error('[OR-Tools Scheduler] Backend solve failed:', err.message);
    console.warn('[OR-Tools Scheduler] Falling back to local JS engine.');
  }

  // Graceful fallback to client-side heuristic scheduler
  return localScheduler(daysInMonth, controllers, exceptions, sequencePattern, requests);
};
