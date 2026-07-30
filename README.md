# Моят Ден — Kids Training Schedule App

A mobile-first, installable schedule app for a child athlete. It reads today’s events from Google Calendar through a Netlify Function and can show the last downloaded events for the current date while offline.

## Files

| File | Purpose |
|------|---------|
| `Schedule.html` | The app — open this in a browser |
| `tweaks-panel.jsx` | In-page Tweaks UI (loaded by Schedule.html) |
| `manifest.webmanifest` | PWA manifest for install metadata and icons |
| `sw.js` | Service worker for app-shell caching and network-only calendar requests |
| `icon.svg` | ⛸️ SVG app icon and favicon |
| `netlify/functions/google-calendar.js` | Netlify Function that reads Google Calendar |
| `netlify.toml` | Netlify routing for `/` and `/api/google-calendar` |

## Features

- **Live countdown** to the next event (`MM:SS`), flips to red elapsed time once started
- **Auto-advance** — hero event advances at the halfway point to the next event
- **Готово ✓** button to manually mark an event done and jump to the next
- **Per-event checklists** — tap to check items; state is remembered per event
- **Per-event colours** — page and hero card background shift for each activity type
- **Dark mode** for Лека нощ (bedtime) to reduce eye strain
- **Google Calendar sync** through Netlify Functions; credentials are required for live events
- **Group picker** — label events in their description and show one group's schedule at a time
- **Offline support** through PWA assets and the last downloaded event list, but only when that saved list matches the current date
- **Automatic refresh** when the app opens, returns to the foreground, reconnects, or rolls over to a new date
- **Manual refresh** from the ↻ button, with the date of the last successful refresh shown beside it

## Schedule source

The app no longer includes a built-in hardcoded day of events. Events come from Google Calendar. If the calendar cannot be reached, the browser checks its saved calendar cache and displays it only when the saved `date` matches today. If the app remains open across midnight, it immediately hides the old schedule and requests the new date. If there is no current-date cache, the app shows an empty-state message instead of stale events.

## Groups

Add a line to a Google Calendar event's **description** using either English or Bulgarian:

```text
Group: Beginners
```

To show the same event in more than one group's schedule, separate the group names with commas:

```text
Group: 4,5
```

```text
Група: Напреднали
```

The app trims each comma-separated group name and collects the labels into the group selector at the top right. Use its left and right arrows to cycle through groups. An event assigned to multiple groups appears in each of their schedules. Events without a group label remain visible with every selected group. The last selection is remembered on the device.

Calendar integrations can alternatively provide one or more comma-separated groups in `extendedProperties.private.group`; that value takes precedence over the description label.

## Checklists

Checklists are assigned from event templates inferred from calendar event text:

- **Добро утро** — 🪥 Зъби · 👕 Дрехи · 🪮 Коса · 👟 Обуване
- **Лед** — ⛸️ Кънки · 💧 Вода
- **СФП** — 🪢 Ластик · 𓀫 Въже · 💧 Вода
- **Разтяжки** — 🌀 Постелка · 🧱 Йога блокчета · 💧 Вода (с икона на събитието 🧘 и отделна цветова тема)
- **Лека нощ** — 🪥 Зъби · 🚿 Душ · 🪮 Коса · 👕 Пижама

## Tweaks Panel

Open via the toolbar toggle. Controls:

- **Цвят** — accent colour for the Готово button and checklist checks (`ice` / `aurora` / `sunset`)
- **Събитие** (debug) — jump to any event regardless of real time
- **Таймер** (debug) — force countdown (`обратно`) or elapsed (`изминало`) display

## Google Calendar Setup

This integration uses a **service account**, not a public API key. That is the right choice for a private calendar and keeps secrets on Netlify instead of in the browser.

### Secrets to add in Netlify

- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON` or the pair:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- Optional: `GOOGLE_CALENDAR_TIME_ZONE` or `GOOGLE_TIME_ZONE` if you want to override the default `Europe/Sofia`

### How to generate them

1. Create or open a Google Cloud project.
2. Enable the **Google Calendar API** for that project.
3. Create a **service account** in Google Cloud IAM.
4. Create a **JSON key** for that service account and download it.
5. Copy the JSON contents into `GOOGLE_SERVICE_ACCOUNT_JSON`, or split it into:
   - `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` -> `GOOGLE_PRIVATE_KEY`
6. In Google Calendar, open the calendar you want to use and **share it** with the service account email. Give it at least “See all event details”.
7. Put the calendar’s ID into `GOOGLE_CALENDAR_ID`.

### Which calendar ID to use

- For a primary Google Calendar, the ID is usually your email address.
- For other calendars, open the calendar settings in Google Calendar and copy the value under **Integrate calendar** or **Calendar ID**.

### What the app does

- The page calls `/.netlify/functions/google-calendar` through the `/api/google-calendar` redirect.
- If the function is configured, it loads today’s events from Google Calendar and saves that mapped schedule in the browser.
- If the request fails while offline, the app displays the saved schedule only when its calendar `date` is today.
- If the function is not configured, fails, or has no current-date cache, the app shows an empty state rather than using bundled events.
