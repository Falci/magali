import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiSession } from '@/lib/api-auth';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function bool(value: boolean): string {
  return value ? '<true/>' : '<false/>';
}

function firstForwarded(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

function resolvePublicEndpoint(req: NextRequest): {
  host: string;
  port: number;
  useSSL: boolean;
} {
  const forwardedHost = firstForwarded(req.headers.get('x-forwarded-host'));
  const forwardedProto = firstForwarded(req.headers.get('x-forwarded-proto'));

  const fallbackUrl = new URL(
    process.env.BETTER_AUTH_URL ?? req.nextUrl.origin
  );

  const proto = (
    forwardedProto ?? fallbackUrl.protocol.replace(':', '')
  ).toLowerCase();
  const useSSL = proto === 'https';

  // x-forwarded-port is frequently the upstream internal port (for example 3000),
  // so only trust a port explicitly present in the public host value.
  const hostWithPort = forwardedHost ?? fallbackUrl.host;
  const hostMatch = hostWithPort.match(/^(.*?)(?::(\d+))?$/);
  const host = hostMatch?.[1] || fallbackUrl.hostname;
  const explicitPort = hostMatch?.[2];
  const fallbackPort = fallbackUrl.port || (useSSL ? '443' : '80');
  const port = Number(
    explicitPort ?? (forwardedHost ? (useSSL ? '443' : '80') : fallbackPort)
  );

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : useSSL ? 443 : 80,
    useSSL,
  };
}

export async function GET(req: NextRequest) {
  const { error } = await requireApiSession();
  if (error) return error;

  const settings = await prisma.settings.findUnique({
    where: { id: 'singleton' },
    select: { davToken: true },
  });

  if (!settings?.davToken) {
    return NextResponse.json(
      { error: 'Generate a DAV token first' },
      { status: 400 }
    );
  }

  const { host, port, useSSL } = resolvePublicEndpoint(req);
  const scheme = useSSL ? 'https' : 'http';
  const defaultPort = useSSL ? 443 : 80;
  const hostAndPort = port === defaultPort ? host : `${host}:${port}`;
  const caldavPrincipalUrl = `${scheme}://${hostAndPort}/api/dav/caldav/calendars/magali/default`;
  const carddavPrincipalUrl = `${scheme}://${hostAndPort}/api/dav/carddav/addressbooks/magali/default`;

  const profileUuid = randomUUID().toUpperCase();
  const caldavUuid = randomUUID().toUpperCase();
  const carddavUuid = randomUUID().toUpperCase();

  const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key><string>com.apple.caldav.account</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>PayloadIdentifier</key><string>com.magali.crm.caldav.${caldavUuid}</string>
      <key>PayloadUUID</key><string>${caldavUuid}</string>
      <key>PayloadDisplayName</key><string>Magali Calendar</string>
      <key>CalDAVAccountDescription</key><string>Magali CRM Calendar</string>
      <key>CalDAVHostName</key><string>${xmlEscape(host)}</string>
      <key>CalDAVPort</key><integer>${port}</integer>
      <key>CalDAVUseSSL</key>${bool(useSSL)}
      <key>CalDAVPrincipalURL</key><string>${xmlEscape(caldavPrincipalUrl)}</string>
      <key>CalDAVUsername</key><string>magali</string>
      <key>CalDAVPassword</key><string>${xmlEscape(settings.davToken)}</string>
    </dict>
    <dict>
      <key>PayloadType</key><string>com.apple.carddav.account</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>PayloadIdentifier</key><string>com.magali.crm.carddav.${carddavUuid}</string>
      <key>PayloadUUID</key><string>${carddavUuid}</string>
      <key>PayloadDisplayName</key><string>Magali Contacts</string>
      <key>CardDAVAccountDescription</key><string>Magali CRM Contacts</string>
      <key>CardDAVHostName</key><string>${xmlEscape(host)}</string>
      <key>CardDAVPort</key><integer>${port}</integer>
      <key>CardDAVUseSSL</key>${bool(useSSL)}
      <key>CardDAVPrincipalURL</key><string>${xmlEscape(carddavPrincipalUrl)}</string>
      <key>CardDAVUsername</key><string>magali</string>
      <key>CardDAVPassword</key><string>${xmlEscape(settings.davToken)}</string>
    </dict>
  </array>
  <key>PayloadDescription</key><string>Configures CalDAV and CardDAV access for Magali CRM.</string>
  <key>PayloadDisplayName</key><string>Magali CRM DAV</string>
  <key>PayloadIdentifier</key><string>com.magali.crm.dav.${profileUuid}</string>
  <key>PayloadOrganization</key><string>Magali CRM</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>${profileUuid}</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
`;

  return new NextResponse(profile, {
    headers: {
      'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
      'Content-Disposition': 'attachment; filename="magali-dav.mobileconfig"',
      'Cache-Control': 'no-store',
    },
  });
}
