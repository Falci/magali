import { NextResponse } from 'next/server';

function permanentRelativeRedirect(path: string) {
  return new NextResponse(null, {
    status: 308,
    headers: { Location: path },
  });
}

export async function GET() {
  return permanentRelativeRedirect('/api/dav/caldav');
}

export async function HEAD() {
  return permanentRelativeRedirect('/api/dav/caldav');
}
