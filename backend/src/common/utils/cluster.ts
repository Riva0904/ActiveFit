/**
 * True when this process should own singleton background work (cron jobs).
 *
 * Under PM2 cluster mode every worker boots the same Nest app, so without this
 * gate each @Cron fires once per CPU core — duplicate renewal emails, duplicate
 * occupancy snapshots, racing auto-checkouts. PM2 numbers workers via
 * NODE_APP_INSTANCE; outside PM2 (Render, docker, local dev) the variable is
 * unset and the single process is the primary.
 */
export function isPrimaryInstance(): boolean {
  const instance = process.env.NODE_APP_INSTANCE;
  return instance === undefined || instance === '' || instance === '0';
}
