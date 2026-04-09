import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DAV_USERNAME, vcardEscape, xmlEscape } from "@/lib/dav-auth";

type CardDavItem = {
  uid: string;
  href: string;
  etag: string;
  vcard: string;
};

type Context = { params: Promise<{ segments?: string[] }> };

const ROOT = "/api/dav/carddav";
const PRINCIPAL = "/api/dav/carddav/principals/magali";
const HOME = "/api/dav/carddav/addressbooks/magali";
const ADDRESSBOOK = "/api/dav/carddav/addressbooks/magali/default";

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

function withDavHeaders(headers: Record<string, string> = {}): Headers {
  return new Headers({ DAV: "1, 2, addressbook", "MS-Author-Via": "DAV", ...headers });
}

function xmlResponse(xml: string, status = 207): NextResponse {
  return new NextResponse(xml, {
    status,
    headers: withDavHeaders({ "Content-Type": "application/xml; charset=utf-8" }),
  });
}

function responseBlock(href: string, propXml: string, status = "HTTP/1.1 200 OK"): string {
  return ["<d:response>", `<d:href>${xmlEscape(href)}</d:href>`, "<d:propstat>", propXml, `<d:status>${status}</d:status>`, "</d:propstat>", "</d:response>"].join("");
}

function addressbookPropXml(): string {
  return [
    "<d:prop>",
    "<d:displayname>Magali Contacts</d:displayname>",
    "<d:resourcetype><d:collection/><card:addressbook/></d:resourcetype>",
    "<d:getcontenttype>text/vcard; charset=utf-8</d:getcontenttype>",
    "<card:supported-address-data><card:address-data-type content-type=\"text/vcard\" version=\"3.0\"/></card:supported-address-data>",
    "</d:prop>",
  ].join("");
}

function formatFullName(firstName: string, lastName: string | null): string {
  return `${firstName} ${lastName ?? ""}`.trim();
}

function buildVcard(contact: {
  uid: string;
  firstName: string;
  lastName: string | null;
  notes: string | null;
  emails: Array<{ label: string; value: string }>;
  phones: Array<{ label: string; value: string }>;
  addresses: Array<{ label: string; street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null }>;
}): string {
  const fn = formatFullName(contact.firstName, contact.lastName);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `UID:${vcardEscape(contact.uid)}`,
    `N:${vcardEscape(contact.lastName ?? "")};${vcardEscape(contact.firstName)};;;`,
    `FN:${vcardEscape(fn)}`,
  ];

  for (const email of contact.emails) {
    lines.push(`EMAIL;TYPE=${vcardEscape(email.label.toUpperCase())}:${vcardEscape(email.value)}`);
  }
  for (const phone of contact.phones) {
    lines.push(`TEL;TYPE=${vcardEscape(phone.label.toUpperCase())}:${vcardEscape(phone.value)}`);
  }
  for (const address of contact.addresses) {
    const adr = ["", "", address.street ?? "", address.city ?? "", address.state ?? "", address.zip ?? "", address.country ?? ""]
      .map((part) => vcardEscape(part))
      .join(";");
    lines.push(`ADR;TYPE=${vcardEscape(address.label.toUpperCase())}:${adr}`);
  }

  if (contact.notes) lines.push(`NOTE:${vcardEscape(contact.notes)}`);
  lines.push("END:VCARD", "");
  return lines.join("\r\n");
}

async function loadAddressBookItems(): Promise<CardDavItem[]> {
  const contacts = await prisma.contact.findMany({
    include: {
      emails: { select: { label: true, value: true } },
      phones: { select: { label: true, value: true } },
      addresses: { select: { label: true, street: true, city: true, state: true, zip: true, country: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return contacts.map((contact) => ({
    uid: contact.uid,
    href: `${ADDRESSBOOK}/${encodeURIComponent(contact.uid)}.vcf`,
    etag: `\"${contact.updatedAt.toISOString()}\"`,
    vcard: buildVcard(contact),
  }));
}

function parseTarget(segments: string[]): "root" | "principal" | "home" | "addressbook" | "contact" | "missing" {
  if (segments.length === 0) return "root";
  if (segments.length === 2 && segments[0] === "principals" && segments[1] === "magali") return "principal";
  if (segments.length === 2 && segments[0] === "addressbooks" && segments[1] === "magali") return "home";
  if (segments.length === 3 && segments[0] === "addressbooks" && segments[1] === "magali" && segments[2] === "default") return "addressbook";
  if (segments.length === 4 && segments[0] === "addressbooks" && segments[1] === "magali" && segments[2] === "default" && segments[3].endsWith(".vcf")) return "contact";
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

  const items = await loadAddressBookItems();

  if (method === "GET" || method === "HEAD") {
    if (target === "missing") return new NextResponse("Not Found", { status: 404 });

    if (target === "contact") {
      const file = segments[3] ?? "";
      const uid = decodeURIComponent(file.replace(/\.vcf$/i, ""));
      const item = items.find((candidate) => candidate.uid === uid);
      if (!item) return new NextResponse("Not Found", { status: 404 });

      return new NextResponse(method === "HEAD" ? null : item.vcard, {
        status: 200,
        headers: withDavHeaders({ ETag: item.etag, "Content-Type": "text/vcard; charset=utf-8" }),
      });
    }

    return new NextResponse(method === "HEAD" ? null : items.map((item) => item.vcard).join(""), {
      status: 200,
      headers: withDavHeaders({ "Content-Type": "text/vcard; charset=utf-8" }),
    });
  }

  if (method === "REPORT") {
    if (target !== "addressbook") return new NextResponse("Not Found", { status: 404 });

    const responses = items
      .map((item) => responseBlock(item.href, ["<d:prop>", `<d:getetag>${item.etag}</d:getetag>`, `<card:address-data>${xmlEscape(item.vcard)}</card:address-data>`, "</d:prop>"].join("")))
      .join("");

    return xmlResponse(`<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<d:multistatus xmlns:d=\"DAV:\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">${responses}</d:multistatus>`);
  }

  if (target === "missing") return new NextResponse("Not Found", { status: 404 });

  const depth = req.headers.get("depth") ?? "0";
  const responses: string[] = [];

  if (target === "root") {
    responses.push(responseBlock(ROOT, ["<d:prop>", "<d:displayname>Magali DAV Root</d:displayname>", "<d:resourcetype><d:collection/></d:resourcetype>", `<d:current-user-principal><d:href>${PRINCIPAL}</d:href></d:current-user-principal>`, `<card:addressbook-home-set><d:href>${HOME}</d:href></card:addressbook-home-set>`, "</d:prop>"].join("")));
    if (depth !== "0") {
      responses.push(responseBlock(PRINCIPAL, ["<d:prop>", "<d:displayname>magali</d:displayname>", "<d:resourcetype><d:collection/><d:principal/></d:resourcetype>", `<card:addressbook-home-set><d:href>${HOME}</d:href></card:addressbook-home-set>`, "</d:prop>"].join("")));
      responses.push(responseBlock(HOME, ["<d:prop>", "<d:displayname>magali address books</d:displayname>", "<d:resourcetype><d:collection/></d:resourcetype>", "</d:prop>"].join("")));
      responses.push(responseBlock(ADDRESSBOOK, addressbookPropXml()));
    }
  }

  if (target === "principal") {
    responses.push(responseBlock(PRINCIPAL, ["<d:prop>", "<d:displayname>magali</d:displayname>", "<d:resourcetype><d:collection/><d:principal/></d:resourcetype>", `<card:addressbook-home-set><d:href>${HOME}</d:href></card:addressbook-home-set>`, "</d:prop>"].join("")));
  }

  if (target === "home") {
    responses.push(responseBlock(HOME, ["<d:prop>", "<d:displayname>magali address books</d:displayname>", "<d:resourcetype><d:collection/></d:resourcetype>", "</d:prop>"].join("")));
    if (depth !== "0") responses.push(responseBlock(ADDRESSBOOK, addressbookPropXml()));
  }

  if (target === "addressbook") {
    responses.push(responseBlock(ADDRESSBOOK, addressbookPropXml()));
    if (depth !== "0") {
      for (const item of items) {
        responses.push(responseBlock(item.href, ["<d:prop>", "<d:resourcetype/>", `<d:getetag>${item.etag}</d:getetag>`, "<d:getcontenttype>text/vcard; charset=utf-8</d:getcontenttype>", "</d:prop>"].join("")));
      }
    }
  }

  if (target === "contact") {
    const file = segments[3] ?? "";
    const uid = decodeURIComponent(file.replace(/\.vcf$/i, ""));
    const item = items.find((candidate) => candidate.uid === uid);
    if (!item) return new NextResponse("Not Found", { status: 404 });
    responses.push(responseBlock(item.href, ["<d:prop>", "<d:resourcetype/>", `<d:getetag>${item.etag}</d:getetag>`, "<d:getcontenttype>text/vcard; charset=utf-8</d:getcontenttype>", "</d:prop>"].join("")));
  }

  return xmlResponse(`<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<d:multistatus xmlns:d=\"DAV:\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">${responses.join("")}</d:multistatus>`);
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
