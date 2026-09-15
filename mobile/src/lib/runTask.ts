import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useRunStore } from '../store/runStore';
import { colors } from '../theme';
import { RUN_LOCATION_TASK } from './runTaskName';

export { RUN_LOCATION_TASK };

/**
 * Background location task. `defineTask` MUST run at module top level, before
 * any React component renders, and must be imported from the app entry — the OS
 * can launch the JS bundle headlessly just to deliver a batch of fixes to this
 * function (e.g. after the app was swiped away mid-run).
 */
TaskManager.defineTask(RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    useRunStore.getState().setError(error.message ?? 'Location updates failed');
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
  if (locations.length) useRunStore.getState().ingest(locations);
});

/** Single source of truth for the tracking parameters (shared by the foreground fallback). */
export const RUN_TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 2000,
  distanceInterval: 3,
  mayShowUserSettingsDialog: true,
  // Live updates: no batching, the UI wants every fix.
  deferredUpdatesInterval: 0,
  deferredUpdatesDistance: 0,
  activityType: Location.LocationActivityType.Fitness,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'ActiveBoost — run in progress',
    notificationBody: 'Tracking your route. Open the app to pause or finish.',
    notificationColor: colors.primary,
    // Keep tracking when the user swipes the app away from Recents.
    killServiceOnDestroy: false,
  },
};

export const FOREGROUND_WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 2000,
  distanceInterval: 3,
  mayShowUserSettingsDialog: true,
};
