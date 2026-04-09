import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DAV_USERNAME, formatAllDayDate, formatUtcDate, icalEscape, xmlEscape } from "@/lib/dav-auth";

type CalDavItem = {
  uid: string;
  href: string;
  etag: string;
  ics: string;
};

type Context = { params: Promise<{ segments?: string[] }> };

const ROOT = "/api/dav/caldav";
const PRINCIPAL = "/api/dav/caldav/principals/magali";
const HOME = "/api/dav/caldav/calendars/magali";
const CALENDAR = "/api/dav/caldav/calendars/magali/default";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header) return null;
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return { username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
  } catch {
    return null;
  }
}

async function requireDavAuth(req: NextRequest): Promise<NextResponse | null> {
  const auth = parseBasicAuth(req.headers.get("authorization"));
  if (!auth) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Magali DAV", charset="UTF-8"' },
    });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { davToken: true } });
  if (!settings?.davToken) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Magali DAV", charset="UTF-8"' },
    });
  }

  if (!safeEqual(auth.username, DAV_USERNAME) || !safeEqual(auth.password, settings.davToken)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Magali DAV", charset="UTF-8"' },
    });
  }

  return null;
}

function requestOrigin(req: NextRequest): string {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return req.nextUrl.origin;
}

function withDavHeaders(headers: Record<string, string> = {}): Headers {
  return new Headers({
    DAV: "1, 2, calendar-access",
    "MS-Author-Via": "DAV",
    ...headers,
  });
}

function xmlResponse(xml: string, status = 207): NextResponse {
  return new NextResponse(xml, {
    status,
    headers: withDavHeaders({ "Content-Type": "application/xml; charset=utf-8" }),
  });
}

function icsCalendar(items: CalDavItem | CalDavItem[]): string {
  const list = Array.isArray(items) ? items : [items];
  const body = list.map((item) => item.ics).join("\r\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Magali CRM//EN", "CALSCALE:GREGORIAN", body, "END:VCALENDAR", ""].join("\r\n");
}

function buildEventIcs(params: {
  uid: string;
  summary: string;
  dtstamp: Date;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string | null;
  url?: string | null;
}): string {
  const lines = ["BEGIN:VEVENT", `UID:${icalEscape(params.uid)}`, `DTSTAMP:${formatUtcDate(params.dtstamp)}`];

  if (params.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatAllDayDate(params.start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatAllDayDate(params.end)}`);
  } else {
    lines.push(`DTSTART:${formatUtcDate(params.start)}`);
    lines.push(`DTEND:${formatUtcDate(params.end)}`);
  }

  lines.push(`SUMMARY:${icalEscape(params.summary)}`);
  if (params.description) lines.push(`DESCRIPTION:${icalEscape(params.description)}`);
  if (params.url) lines.push(`URL:${icalEscape(params.url)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

async function loadCalendarItems(origin: string): Promise<CalDavItem[]> {
  const [interactions, events, contacts] = await Promise.all([
    prisma.interaction.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.event.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.contact.findMany({
      where: { AND: [{ birthdayMonth: { not: null } }, { birthdayDay: { not: null } }] },
      select: { id: true, uid: true, firstName: true, birthdayDay: true, birthdayMonth: true, updatedAt: true },
    }),
  ]);

  const currentYear = new Date().getFullYear();
  const items: CalDavItem[] = [];

  for (const interaction of interactions) {
    const start = new Date(interaction.date);
    if (interaction.time) {
      const [h, m] = interaction.time.split(":").map(Number);
      start.setHours(h, m, 0, 0);
    }
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    const uid = `interaction-${interaction.id}@magali`;
    const summary = `${interaction.type} with ${interaction.contact.firstName} ${interaction.contact.lastName ?? ""}`.trim();
    const href = `${CALENDAR}/${encodeURIComponent(uid)}.ics`;

    items.push({
      uid,
      href,
      etag: `\"${interaction.id}\"`,
      ics: buildEventIcs({
        uid,
        summary,
        dtstamp: interaction.createdAt,
        start,
        end,
        allDay: !interaction.time,
        description: interaction.notes,
        url: `${origin}/contacts/${interaction.contact.id}`,
      }),
    });
  }

  for (const event of events) {
    const base = new Date(event.date);
    const years = event.recurring === "YEARLY" ? [currentYear, currentYear + 1] : [base.getFullYear()];
    for (const year of years) {
      const start = new Date(base);
      start.setFullYear(year);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const uid = `event-${event.uid}-${year}@magali`;
      const href = `${CALENDAR}/${encodeURIComponent(uid)}.ics`;
      items.push({
        uid,
        href,
        etag: `\"${event.id}-${year}\"`,
        ics: buildEventIcs({
          uid,
          summary: event.title,
          dtstamp: event.updatedAt,
          start,
          end,
          allDay: true,
          description: event.notes,
          url: event.contactId ? `${origin}/contacts/${event.contactId}` : null,
        }),
      });
    }
  }

  for (const contact of contacts) {
    if (!contact.birthdayMonth || !contact.birthdayDay) continue;
    for (const year of [currentYear, currentYear + 1]) {
      const start = new Date(Date.UTC(year, contact.birthdayMonth - 1, contact.birthdayDay));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      const uid = `birthday-${contact.uid}-${year}@magali`;
      const href = `${CALENDAR}/${encodeURIComponent(uid)}.ics`;
      items.push({
        uid,
        href,
        etag: `\"birthday-${contact.id}-${year}\"`,
        ics: buildEventIcs({
          uid,
          summary: `${contact.firstName}'s birthday`,
          dtstamp: contact.updatedAt,
          start,
          end,
          allDay: true,
          url: `${origin}/contacts/${contact.id}`,
        }),
      });
    }
  }

  return items;
}

function responseBlock(href: string, propXml: string, status = "HTTP/1.1 200 OK"): string {
  return ["<d:response>", `<d:href>${xmlEscape(href)}</d:href>`, "<d:propstat>", propXml, `<d:status>${status}</d:status>`, "</d:propstat>", "</d:response>"].join("");
}

function calendarCollectionPropResponse(nowIso: string): string {
  return [
    "<d:prop>",
    "<d:displayname>Magali CRM</d:displayname>",
    "<d:resourcetype><d:collection/><c:calendar/></d:resourcetype>",
    "<d:getcontenttype>text/calendar; charset=utf-8</d:getcontenttype>",
    `<cs:getctag>${xmlEscape(nowIso)}</cs:getctag>`,
    "<c:supported-calendar-component-set><c:comp name=\"VEVENT\"/></c:supported-calendar-component-set>",
    "</d:prop>",
  ].join("");
}

function parseTarget(segments: string[]): "root" | "principal" | "home" | "calendar" | "event" | "missing" {
  if (segments.length === 0) return "root";
  if (segments.length === 2 && segments[0] === "principals" && segments[1] === "magali") return "principal";
  if (segments.length === 2 && segments[0] === "calendars" && segments[1] === "magali") return "home";
  if (segments.length === 3 && segments[0] === "calendars" && segments[1] === "magali" && segments[2] === "default") return "calendar";
  if (segments.length === 4 && segments[0] === "calendars" && segments[1] === "magali" && segments[2] === "default" && segments[3].endsWith(".ics")) return "event";
  return "missing";
}

async function handle(method: string, req: NextRequest, context: Context): Promise<NextResponse> {
  const unauthorized = await requireDavAuth(req);
  if (unauthorized) return unauthorized;

  const segments = (await context.params).segments ?? [];
  const target = parseTarget(segments);

  if (method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: withDavHeaders({ Allow: "OPTIONS, PROPFIND, REPORT, GET, HEAD" }),
    });
  }

  if (!["PROPFIND", "REPORT", "GET", "HEAD"].includes(method)) {
    return new NextResponse("Method Not Allowed", {
      status: 405,
      headers: withDavHeaders({ Allow: "OPTIONS, PROPFIND, REPORT, GET, HEAD" }),
    });
  }

  const origin = requestOrigin(req);
  const items = await loadCalendarItems(origin);
  const nowIso = new Date().toISOString();

  if (method === "GET" || method === "HEAD") {
    if (target === "missing") return new NextResponse("Not Found", { status: 404 });

    if (target === "event") {
      const file = segments[3] ?? "";
      const uid = decodeURIComponent(file.replace(/\.ics$/i, ""));
      const item = items.find((candidate) => candidate.uid === uid);
      if (!item) return new NextResponse("Not Found", { status: 404 });

      return new NextResponse(method === "HEAD" ? null : icsCalendar(item), {
        status: 200,
        headers: withDavHeaders({
          ETag: item.etag,
          "Content-Type": "text/calendar; charset=utf-8",
        }),
      });
    }

    return new NextResponse(method === "HEAD" ? null : icsCalendar(items), {
      status: 200,
      headers: withDavHeaders({ "Content-Type": "text/calendar; charset=utf-8" }),
    });
  }

  if (method === "REPORT") {
    if (target !== "calendar") return new NextResponse("Not Found", { status: 404 });

    const responses = items
      .map((item) => responseBlock(item.href, ["<d:prop>", `<d:getetag>${item.etag}</d:getetag>`, `<c:calendar-data>${xmlEscape(icsCalendar(item))}</c:calendar-data>`, "</d:prop>"].join("")))
      .join("");

    return xmlResponse(`<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<d:multistatus xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\">${responses}</d:multistatus>`);
  }

  if (target === "missing") return new NextResponse("Not Found", { status: 404 });

  const depth = req.headers.get("depth") ?? "0";
  const responses: string[] = [];

  if (target === "root") {
    responses.push(responseBlock(ROOT, ["<d:prop>", "<d:displayname>Magali DAV Root</d:displayname>", "<d:resourcetype><d:collection/></d:resourcetype>", `<d:current-user-principal><d:href>${PRINCIPAL}</d:href></d:current-user-principal>`, `<c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set>`, "</d:prop>"].join("")));
    if (depth !== "0") {
      responses.push(responseBlock(PRINCIPAL, ["<d:prop>", "<d:displayname>magali</d:displayname>", "<d:resourcetype><d:collection/><d:principal/></d:resourcetype>", `<c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set>`, "</d:prop>"].join("")));
      responses.push(responseBlock(HOME, ["<d:prop>", "<d:displayname>magali calendars</d:displayname>", "<d:resourcetype><d:collection/></d:resourcetype>", "</d:prop>"].join("")));
      responses.push(responseBlock(CALENDAR, calendarCollectionPropResponse(nowIso)));
    }
  }

  if (target === "principal") {
    responses.push(responseBlock(PRINCIPAL, ["<d:prop>", "<d:displayname>magali</d:displayname>", "<d:resourcetype><d:collection/><d:principal/></d:resourcetype>", `<c:calendar-home-set><d:href>${HOME}</d:href></c:calendar-home-set>`, "</d:prop>"].join("")));
  }

  if (target === "home") {
    responses.push(responseBlock(HOME, ["<d:prop>", "<d:displayname>magali calendars</d:displayname>", "<d:resourcetype><d:collection/></d:resourcetype>", "</d:prop>"].join("")));
    if (depth !== "0") responses.push(responseBlock(CALENDAR, calendarCollectionPropResponse(nowIso)));
  }

  if (target === "calendar") {
    responses.push(responseBlock(CALENDAR, calendarCollectionPropResponse(nowIso)));
    if (depth !== "0") {
      for (const item of items) {
        responses.push(responseBlock(item.href, ["<d:prop>", "<d:resourcetype/>", `<d:getetag>${item.etag}</d:getetag>`, "<d:getcontenttype>text/calendar; charset=utf-8</d:getcontenttype>", "</d:prop>"].join("")));
      }
    }
  }

  if (target === "event") {
    const file = segments[3] ?? "";
    const uid = decodeURIComponent(file.replace(/\.ics$/i, ""));
    const item = items.find((candidate) => candidate.uid === uid);
    if (!item) return new NextResponse("Not Found", { status: 404 });
    responses.push(responseBlock(item.href, ["<d:prop>", "<d:resourcetype/>", `<d:getetag>${item.etag}</d:getetag>`, "<d:getcontenttype>text/calendar; charset=utf-8</d:getcontenttype>", "</d:prop>"].join("")));
  }

  return xmlResponse(`<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<d:multistatus xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\" xmlns:cs=\"http://calendarserver.org/ns/\">${responses.join("")}</d:multistatus>`);
}

export async function GET(req: NextRequest, context: Context) {
  return handle("GET", req, context);
}

export async function HEAD(req: NextRequest, context: Context) {
  return handle("HEAD", req, context);
}

export async function OPTIONS(req: NextRequest, context: Context) {
  return handle("OPTIONS", req, context);
}

// Next.js App Router only supports standard HTTP methods (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS).
// PROPFIND and REPORT are WebDAV methods and are silently ignored if exported directly.
// The reverse proxy (Caddy) must rewrite them to POST with an X-WebDAV-Method header:
//
//   @webdav method PROPFIND REPORT
//   route @webdav {
//     request_header X-WebDAV-Method {method}
//     method POST
//     reverse_proxy ...
//   }
export async function POST(req: NextRequest, context: Context) {
  const method = req.headers.get("x-webdav-method")?.toUpperCase();
  if (method === "PROPFIND" || method === "REPORT") {
    return handle(method, req, context);
  }
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: withDavHeaders({ Allow: "OPTIONS, PROPFIND, REPORT, GET, HEAD" }),
  });
}
