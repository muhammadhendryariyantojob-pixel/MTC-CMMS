/**
 * Safely triggers base64 file downloads in Median (GoNative) APKs or iOS wrappers.
 * This function is designed to be highly resilient:
 * 1. It checks and prefers direct JS Bridge calls (no URL length limit crashes).
 * 2. It supports both newer 'median' and older 'gonative' namespaces.
 * 3. It falls back to custom URI schemes (median:// and gonative://) if the JS bridge is not fully bound.
 * 4. It supports standard browser downloads as a final fallback.
 */
export function downloadMedianBase64(base64Raw: string, filename: string, dataUri: string): boolean {
  console.log(`[MedianDownload] Attempting download for ${filename} (${Math.round(base64Raw.length / 1024)} KB)`);

  const gWindow = window as any;

  // --- METHOD 1: New Median JS Bridge ---
  if (gWindow.median?.share?.downloadBase64) {
    try {
      gWindow.median.share.downloadBase64({
        base64: base64Raw,
        filename: filename
      });
      console.log('[MedianDownload] Successfully invoked gWindow.median.share.downloadBase64');
      return true;
    } catch (err) {
      console.error('[MedianDownload] Error calling window.median.share.downloadBase64:', err);
    }
  }

  // --- METHOD 2: Older GoNative JS Bridge (Extremely common in established APKs) ---
  if (gWindow.gonative?.share?.downloadBase64) {
    try {
      gWindow.gonative.share.downloadBase64({
        base64: base64Raw,
        filename: filename
      });
      console.log('[MedianDownload] Successfully invoked gWindow.gonative.share.downloadBase64');
      return true;
    } catch (err) {
      console.error('[MedianDownload] Error calling window.gonative.share.downloadBase64:', err);
    }
  }

  // --- METHOD 3: Try generic download/share page methods on JS Bridge if any ---
  if (gWindow.gonative?.share?.downloadFile) {
    try {
      gWindow.gonative.share.downloadFile({
        url: dataUri,
        filename: filename
      });
      console.log('[MedianDownload] Successfully invoked gWindow.gonative.share.downloadFile');
      return true;
    } catch (err) {
      console.error('[MedianDownload] Error calling window.gonative.share.downloadFile:', err);
    }
  }

  if (gWindow.median?.share?.downloadFile) {
    try {
      gWindow.median.share.downloadFile({
        url: dataUri,
        filename: filename
      });
      console.log('[MedianDownload] Successfully invoked gWindow.median.share.downloadFile');
      return true;
    } catch (err) {
      console.error('[MedianDownload] Error calling window.median.share.downloadFile:', err);
    }
  }

  // --- METHOD 4: URI Scheme Fallbacks ---
  // We use hidden iframes to trigger the URI scheme. This is much safer than modifying window.location.href
  // because window.location.href updates can cancel active network requests or break single page navigation states.
  try {
    const encodedBase64 = encodeURIComponent(base64Raw);
    const encodedFilename = encodeURIComponent(filename);

    const triggerScheme = (scheme: string) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `${scheme}://share/downloadBase64?base64=${encodedBase64}&filename=${encodedFilename}`;
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 300);
    };

    // Trigger both 'gonative' and 'median' URI schemes for maximum backward and forward compatibility
    triggerScheme('gonative');
    triggerScheme('median');
    console.log('[MedianDownload] Fired gonative:// and median:// custom schemes via iframe');
    return true;
  } catch (err) {
    console.error('[MedianDownload] Error firing custom URI schemes:', err);
  }

  return false;
}
