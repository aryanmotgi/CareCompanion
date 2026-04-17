import webpush from 'web-push';

let vapidInitialized = false;

function ensureVapid() {
  if (vapidInitialized) return;
  webpush.setVapidDetails(
    'mailto:support@carecompanionai.org',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidInitialized = true;
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
  } catch (err: unknown) {
    // Subscription expired or invalid — caller handles cleanup
    throw err;
  }
}
