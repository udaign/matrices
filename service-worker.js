importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  console.log('Workbox is loaded');

  // --- START OF OFFLINE ANALYTICS IMPLEMENTATION ---

  // 1. Initialize the Background Sync plugin for queuing failed analytics requests.
  const backgroundSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('analytics-queue', {
    maxRetentionTime: 24 * 60 * 30, // Retry for up to 30 days.
  });

  // 2. Define the strategy for analytics requests: NetworkOnly with the sync plugin.
  // This ensures that we always try to send the request to the network.
  // If it fails (e.g., user is offline), the backgroundSyncPlugin will queue it.
  const analyticsStrategy = new workbox.strategies.NetworkOnly({
    plugins: [backgroundSyncPlugin],
  });

  // 3. Register routes to catch both POST and GET requests to Google Analytics.
  // gtag.js can use either method depending on the browser and context.
  const analyticsHost = 'www.google-analytics.com';

  workbox.routing.registerRoute(
    ({url}) => url.hostname === analyticsHost,
    analyticsStrategy,
    'POST'
  );
  
  workbox.routing.registerRoute(
    ({url}) => url.hostname === analyticsHost,
    analyticsStrategy,
    'GET'
  );

  // --- END OF OFFLINE ANALYTICS IMPLEMENTATION ---

  // Stale-while-revalidate for page navigations.
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.StaleWhileRevalidate()
  );

  // Stale-while-revalidate for CSS and JavaScript files.
  // This will cache local .tsx files as well as files from CDNs.
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script' || request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
      plugins: [
        // This plugin ensures that only successful responses are cached.
        // For opaque responses (from CDNs without CORS), the status is 0.
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Cache-first for images.
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Special handling for Google Fonts.
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets',
    })
  );
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://fonts.gstatic.com',
    new workbox.strategies.CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Year
        }),
      ],
    })
  );

  // Cache-first for local fonts (like Ndot-55).
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: 'local-fonts',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Year
        }),
      ],
    })
  );

} else {
  console.log('Workbox did not load, offline support is unavailable.');
}
