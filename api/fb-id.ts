export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get('input')?.trim();

  if (!input) {
    return new Response(
      JSON.stringify({ error: 'MISSING_INPUT' }),
      { status: 400 }
    );
  }

  try {
    const normalized = normalizeInput(input);

    // 1️⃣ Already numeric
    if (/^\d{8,}$/.test(normalized)) {
      return Response.json({ id: normalized });
    }

    // 2️⃣ profile.php?id=###
    const idFromQuery = extractProfileId(normalized);
    if (idFromQuery) {
      return Response.json({ id: idFromQuery });
    }

    // 3️⃣ Resolve via Graph API
    const accessToken =
      `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`;

    const graphRes = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(normalized)}?access_token=${accessToken}`
    );

    const data = await graphRes.json();

    if (data?.id) {
      return Response.json({ id: data.id });
    }

    return new Response(
      JSON.stringify({ error: 'NOT_FOUND' }),
      { status: 404 }
    );
  } catch (err) {
    console.error('Resolver error:', err);
    return new Response(
      JSON.stringify({ error: 'RESOLUTION_FAILED' }),
      { status: 500 }
    );
  }
}

/* ---------------- HELPERS (MUST BE IN THIS FILE) ---------------- */

function normalizeInput(input: string): string {
  let clean = input.replace(/^@/, '').trim();

  // Remove protocol + domain
  clean = clean
    .replace(/^https?:\/\/(www\.|m\.)?facebook\.com\//, '')
    .replace(/\/$/, '');

  // Handle share links
  if (clean.startsWith('share.php')) {
    const url = new URL(`https://facebook.com/${clean}`);
    const shared = url.searchParams.get('u');
    if (shared) {
      return normalizeInput(shared);
    }
  }

  return clean;
}

function extractProfileId(input: string): string | null {
  try {
    const url = new URL(
      input.startsWith('http') ? input : `https://facebook.com/${input}`
    );
    return url.searchParams.get('id');
  } catch {
    return null;
  }
}
