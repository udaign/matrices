// Add gtag to the window interface to avoid TypeScript errors
declare global {
  interface Window {
    gtag: (
      command: 'event',
      eventName: string,
      eventParams?: Record<string, string | number | boolean | undefined>
    ) => void;
  }
}

/**
 * Tracks an event using Google Analytics 4.
 * @param {string} eventName The name of the event to track.
 * @param {Record<string, string | number | boolean>} eventParams Optional parameters for the event.
 */
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, string | number | boolean | undefined>
) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
  } else {
    console.log(`GA Event (gtag not found): ${eventName}`, eventParams);
  }
};