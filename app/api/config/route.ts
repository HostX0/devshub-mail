import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getPublicConfig } from '@/lib/admin/public-config';
import { pickRequestHost } from '@/lib/admin/domain-branding';

export async function GET(request: NextRequest) {
  logger.debug('Config requested');
  return NextResponse.json(
    await getPublicConfig(pickRequestHost(request)),
    {
      // Runtime settings can change without new asset URLs. Prevent stale
      // browser/proxy responses, retaining Vary for host-specific branding.
      headers: {
        Vary: 'Host, X-Forwarded-Host',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      },
    },
  );
}
