if (process.env.NODE_ENV !== 'development' || process.env.CI || process.env.DEV_INBOX_ENABLED !== 'true' || !process.env.DEV_INBOX_SECRET) {
  throw new Error('Inbox reading is available only in opted-in local development, never CI.');
}
const response = await fetch(`http://127.0.0.1:${Number(process.env.PORT ?? 5000)}/dev/inbox`, {
  headers: { 'X-Dev-Inbox-Key': process.env.DEV_INBOX_SECRET },
});
if (!response.ok) throw new Error('Local inbox is unavailable. Check the API and local inbox configuration.');
const { messages } = await response.json();
if (!messages.length) console.info('No messages yet. Register an account in the app first.');
for (const message of messages) console.info(`\nTo: ${message.to}\n${message.subject}\n${message.text}`);
