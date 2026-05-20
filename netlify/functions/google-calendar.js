const crypto = require('node:crypto');

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars';
const DEFAULT_TIME_ZONE = process.env.GOOGLE_CALENDAR_TIME_ZONE || process.env.GOOGLE_TIME_ZONE || 'Europe/Sofia';

function pad(n) {
  return String(n).padStart(2, '0');
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return parsed;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n'),
  };
}

function parseOffsetMinutes(offsetLabel) {
  const match = String(offsetLabel || '').match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}

function getOffsetMinutes(date, timeZone) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const offsetPart = formatted.find(part => part.type === 'timeZoneName');
  return parseOffsetMinutes(offsetPart?.value);
}

function getDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = type => parts.find(part => part.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  };
}

function getDayRange(date, timeZone) {
  const { year, month, day } = getDateParts(date, timeZone);
  const middayUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
  const offsetMinutes = getOffsetMinutes(new Date(middayUtc), timeZone);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000);
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) - offsetMinutes * 60_000);

  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

function getRequestDate(event) {
  const raw = event?.queryStringParameters?.date;
  if (!raw) return new Date();

  const parsed = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function buildJwtAssertion(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();

  const signature = signer.sign(serviceAccount.private_key);
  return `${header}.${payload}.${base64url(signature)}`;
}

async function getAccessToken(serviceAccount) {
  const assertion = buildJwtAssertion(serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Token response did not include access_token');
  }

  return data.access_token;
}

async function fetchCalendarEvents({ calendarId, timeZone, timeMin, timeMax, accessToken }) {
  const url = new URL(`${CALENDAR_API}/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('timeZone', timeZone);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Calendar request failed: ${response.status} ${text}`);
  }

  return response.json();
}

exports.handler = async function handler(event) {
  const calendarId = event?.queryStringParameters?.calendarId || process.env.GOOGLE_CALENDAR_ID;
  const timeZone = event?.queryStringParameters?.timeZone || DEFAULT_TIME_ZONE;
  let serviceAccount;

  try {
    serviceAccount = parseServiceAccount();
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        configured: false,
        timeZone,
        date: getDayRange(getRequestDate(event), timeZone).date,
        events: [],
        message: `Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${error.message}`,
      }),
    };
  }

  if (!calendarId) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        configured: false,
        timeZone,
        date: getDayRange(getRequestDate(event), timeZone).date,
        events: [],
        message: 'Missing GOOGLE_CALENDAR_ID.',
      }),
    };
  }

  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        configured: false,
        timeZone,
        date: getDayRange(getRequestDate(event), timeZone).date,
        events: [],
        message: 'Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.',
      }),
    };
  }

  try {
    const requestDate = getRequestDate(event);
    const range = getDayRange(requestDate, timeZone);
    const accessToken = await getAccessToken(serviceAccount);
    const payload = await fetchCalendarEvents({
      calendarId,
      timeZone,
      timeMin: range.timeMin,
      timeMax: range.timeMax,
      accessToken,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: true,
        configured: true,
        calendarId,
        timeZone,
        date: range.date,
        updated: new Date().toISOString(),
        events: Array.isArray(payload.items) ? payload.items : [],
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: false,
        configured: true,
        calendarId,
        timeZone,
        date: getDayRange(getRequestDate(event), timeZone).date,
        events: [],
        message: error.message,
      }),
    };
  }
};
