/*
 * Employee-initiated workshop GPS acquisition. Browsers often provide a coarse
 * Wi-Fi fix first, then improve accuracy after a few readings. Never fake a
 * precise location or bypass Django's company-configured punch radius.
 */
const locationError = (message, code) => Object.assign(new Error(message), { code });

const normalizedFix = (position) => {
  const { latitude, longitude, accuracy } = position?.coords || {};
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !Number.isFinite(accuracy) || accuracy < 0) return null;
  return { latitude, longitude, accuracy };
};

const accuracyError = (accuracy, radius) => locationError(
  `Device location accuracy is about ${Math.ceil(accuracy)} m, but the workshop radius is ${radius} m. Enable Precise Location / High Accuracy and try again, preferably using a GPS-enabled phone. You can also ask the workshop admin to review the allowed radius.`,
  'LOCATION_ACCURACY_LOW',
);

/**
 * Wait briefly for a usable high-accuracy GPS fix, rather than posting the
 * browser's first (often inaccurate) result. Reject instead of weakening the
 * server's workshop radius policy when the device cannot get a suitable fix.
 */
export const acquireWorkshopLocation = (
  geolocation,
  radiusMeters,
  onProgress,
  maxWaitMs = 18000,
) => new Promise((resolve, reject) => {
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius) || radius < 20 || radius > 5000) {
    reject(locationError('Workshop punch radius is not configured correctly. Contact the administrator.', 'LOCATION_RULE_INVALID'));
    return;
  }
  if (!geolocation || typeof geolocation.watchPosition !== 'function') {
    reject(locationError('Precise GPS is not supported by this browser. Use a phone with location enabled.', 'LOCATION_UNAVAILABLE'));
    return;
  }

  let watchId = null;
  let timerId = null;
  let settled = false;
  let best = null;

  const finish = (error, location) => {
    if (settled) return;
    settled = true;
    if (timerId !== null) clearTimeout(timerId);
    if (watchId !== null) geolocation.clearWatch?.(watchId);
    if (error) reject(error);
    else resolve(location);
  };

  timerId = setTimeout(() => {
    finish(best
      ? accuracyError(best.accuracy, radius)
      : locationError(
        'Could not obtain a GPS fix. Turn on device location, allow browser location access and retry.',
        'LOCATION_UNAVAILABLE',
      ));
  }, maxWaitMs);

  try {
    watchId = geolocation.watchPosition(
      (position) => {
        const location = normalizedFix(position);
        if (!location || settled) return;
        if (!best || location.accuracy < best.accuracy) {
          best = location;
          if (typeof onProgress === 'function') {
            onProgress({ accuracy: Math.ceil(location.accuracy), radius });
          }
        }
        if (location.accuracy <= radius) finish(null, location);
      },
      (error) => {
        if (error?.code === 1) {
          finish(locationError(
            'Location permission was denied. Allow location access for this website and enable Precise Location.',
            'LOCATION_PERMISSION_DENIED',
          ));
        } else if (error?.code === 2) {
          finish(best
            ? accuracyError(best.accuracy, radius)
            : locationError('Your device could not determine its location. Try a GPS-enabled phone or go outdoors.', 'LOCATION_UNAVAILABLE'));
        }
        // A single geolocation timeout may precede a better fix; keep
        // listening until our bounded overall timeout expires.
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: Math.min(maxWaitMs, 12000) },
    );
    if (settled && watchId !== null) geolocation.clearWatch?.(watchId);
  } catch {
    finish(locationError('Unable to start precise location. Check browser permission and retry.', 'LOCATION_UNAVAILABLE'));
  }
});
