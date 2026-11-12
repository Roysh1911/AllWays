// Background location: regular tracking + a geofence safety net.
// Imported from index.ts so the tasks are defined before anything renders —
// iOS may launch the app straight into these handlers.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { FENCE_RADIUS_M } from './config';
import { lastStoredPoint, recordFixes } from './points';

export const LOCATION_TASK = 'compass-location';
export const FENCE_TASK = 'compass-fence';
const FENCE_ID = 'last-point';

type LocationTaskData = { locations: Location.LocationObject[] };
type FenceTaskData = { eventType: Location.GeofencingEventType; region: Location.LocationRegion };

TaskManager.defineTask<LocationTaskData>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await recordFixes(data.locations, 'track');
  await recenterFence();
});

TaskManager.defineTask<FenceTaskData>(FENCE_TASK, async ({ data, error }) => {
  if (error || !data || data.eventType !== Location.GeofencingEventType.Exit) return;
  // We were woken because the phone left the circle — possibly after a force-quit.
  const fix =
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)) ??
    (await Location.getLastKnownPositionAsync().catch(() => null));
  if (fix) await recordFixes([fix], 'fence', true);
  await recenterFence();
  await ensureTracking();
});

/** Move the safety-net circle to the latest stored point. */
export async function recenterFence(): Promise<void> {
  const p = await lastStoredPoint();
  if (!p) return;
  try {
    await Location.startGeofencingAsync(FENCE_TASK, [
      {
        identifier: FENCE_ID,
        latitude: p.lat,
        longitude: p.lng,
        radius: FENCE_RADIUS_M,
        notifyOnEnter: false,
        notifyOnExit: true,
      },
    ]);
  } catch {
    // permission not granted yet — tracking screen will ask
  }
}

/** Start background updates if they're not running. Needs "Always" permission. */
export async function ensureTracking(): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (!running) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      deferredUpdatesDistance: 500,
      deferredUpdatesInterval: 5 * 60 * 1000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      activityType: Location.ActivityType.Other,
    });
  }
  await recenterFence();
  return true;
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  if (await Location.hasStartedGeofencingAsync(FENCE_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(FENCE_TASK);
  }
}
