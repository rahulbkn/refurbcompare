// READ-ONLY. Fires in CI only. Dumps every fact needed to decide the two
// data-quality cleanups WITHOUT touching any row:
//   1. The "google-pixel" product: full row + every attached listing with all
//      evidence fields (source URL, source id, price, condition, stock).
//   2. Every product whose image data contains a literal "/none" value,
//      including inside the images[] JSON array, plus the provider mix that
//      feeds each such product (to confirm the ReFit-placeholder origin).
import { loadConfig } from '@refurbcompare/core';
import { getPrismaClient } from '@refurbcompare/db';

async function main() {
  if (!process.env.RENDER_DATABASE_URL) throw new Error('RENDER_DATABASE_URL is required (CI only).');
  const config = loadConfig({
    NODE_ENV: 'development',
    DATA_MODE: 'live',
    ADMIN_API_KEY: 'unused-read-only',
    DATABASE_DRIVER: 'prisma',
    DATABASE_URL: process.env.RENDER_DATABASE_URL,
    QUEUE_DRIVER: 'memory',
    RATE_LIMIT_MAX: '60',
  });
  const prisma = getPrismaClient(process.env.RENDER_DATABASE_URL);

  console.log('=== GROUND COUNTS (BEFORE) ===');
  const [totalProducts, totalListings, totalHistory] = await Promise.all([
    prisma.product.count(),
    prisma.listing.count(),
    prisma.priceHistoryPoint.count(),
  ]);
  console.log(`products=${totalProducts} listings=${totalListings} priceHistory=${totalHistory}`);

  console.log('\n=== 1. GOOGLE-PIXEL PRODUCT ===');
  const pixel = await prisma.product.findFirst({
    where: { slug: 'google-pixel' },
    include: {
      listings: {
        orderBy: { createdAt: 'asc' },
        include: { provider: true, _count: { select: { priceHistory: true } } },
      },
    },
  });
  if (!pixel) {
    console.log('No product with slug google-pixel found.');
  } else {
    console.log(`product.id=${pixel.id}`);
    console.log(`  slug=${pixel.slug} brand=${pixel.brand} model="${pixel.model}" variant=${JSON.stringify(pixel.variant)}`);
    console.log(`  storage=${pixel.storage} ram=${pixel.ram} color=${JSON.stringify(pixel.color)} network=${JSON.stringify(pixel.network)}`);
    console.log(`  modelNumber=${JSON.stringify(pixel.modelNumber)} matchingMethod=${pixel.matchingMethod} confidence=${pixel.matchingConfidence}`);
    console.log(`  imageUrl=${JSON.stringify(pixel.imageUrl)} images=${JSON.stringify(pixel.images)}`);
    console.log(`  createdAt=${pixel.createdAt.toISOString()} listings=${pixel.listings.length}`);
    for (const l of pixel.listings) {
      console.log(`  --- listing ${l.id}`);
      console.log(`      provider=${l.provider.name} (${l.providerId})`);
      console.log(`      sourceProductId=${JSON.stringify(l.sourceProductId)}`);
      console.log(`      sourceUrl=${l.sourceUrl}`);
      console.log(`      affiliateUrl=${JSON.stringify(l.affiliateUrl)}`);
      console.log(`      price=${l.price} originalPrice=${JSON.stringify(l.originalPrice)} discount=${JSON.stringify(l.discount)}`);
      console.log(`      condition=${l.normalizedCondition} sourceCondition=${JSON.stringify(l.sourceCondition)} score=${l.conditionScore} desc=${JSON.stringify(l.conditionDescription)}`);
      console.log(`      stock=${l.stockStatus} seller=${JSON.stringify(l.sellerName)} battery=${JSON.stringify(l.batteryHealth)}`);
      console.log(`      warranty=${l.warrantyMonths}m returns=${l.returnDays}d failures=${l.consecutiveSyncFailures} archivedAt=${JSON.stringify(l.archivedAt)}`);
      console.log(`      createdAt=${l.createdAt.toISOString()} lastChecked=${l.lastCheckedAt.toISOString()} priceUpdatedAt=${l.priceUpdatedAt.toISOString()}`);
      console.log(`      priceHistoryPoints=${l._count.priceHistory}`);
    }
  }

  // Any other product whose slug/model mentions pixel but is not the target.
  console.log('\n=== 1b. OTHER PIXEL PRODUCTS (for mapping candidates) ===');
  const pixelish = await prisma.product.findMany({
    where: { brand: 'Google', slug: { not: 'google-pixel' } },
    select: { id: true, slug: true, model: true, variant: true, storage: true, ram: true, matchingMethod: true },
    orderBy: { slug: 'asc' },
  });
  for (const p of pixelish) {
    console.log(`  ${p.slug} | model="${p.model}" variant=${JSON.stringify(p.variant)} storage=${p.storage} ram=${p.ram} method=${p.matchingMethod}`);
  }

  console.log('\n=== 2. LITERAL "/none" IMAGE VALUES ===');
  const noneProducts = await prisma.product.findMany({
    where: { OR: [{ imageUrl: { contains: '/none' } }, { images: { contains: '/none' } }] },
    include: {
      listings: { include: { provider: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { slug: 'asc' },
  });
  console.log(`products containing "/none" in image data: ${noneProducts.length}`);
  for (const p of noneProducts) {
    const providers = [...new Set(p.listings.map((l) => l.provider.name))].join(', ');
    const imagesArr = Array.isArray(p.images) ? (p.images as unknown[]) : [];
    const noneInArray = imagesArr.filter((u) => typeof u === 'string' && u.includes('/none'));
    console.log(`  --- ${p.slug} (id=${p.id}) providers=[${providers}] listings=${p.listings.length}`);
    console.log(`      imageUrl=${JSON.stringify(p.imageUrl)}`);
    console.log(`      images[]=${JSON.stringify(p.images)}`);
    console.log(`      none-in-array-count=${noneInArray.length} array-length=${imagesArr.length}`);
  }

  // Sanity: any legit-looking URL that merely contains the substring "none"
  // but is NOT the bare placeholder (must NOT be mutated later).
  console.log('\n=== 2b. SUBSTRING "none" BUT NOT BARE PLACEHOLDER (must stay untouched) ===');
  const tricky = await prisma.product.findMany({
    where: {
      AND: [
        { OR: [{ imageUrl: { contains: 'none' } }, { images: { contains: 'none' } }] },
        { NOT: { imageUrl: '/none' } },
      ],
    },
    select: { id: true, slug: true, imageUrl: true, images: true },
  });
  for (const p of tricky) {
    const bare = p.imageUrl === '/none';
    const arrHasBareOnly =
      Array.isArray(p.images) &&
      (p.images as unknown[]).every((u) => typeof u !== 'string' || !u.includes('none') || u === '/none');
    if (!bare && !(p.imageUrl && p.imageUrl.includes('/none')) && arrHasBareOnly) continue;
    console.log(`  ${p.slug}: imageUrl=${JSON.stringify(p.imageUrl)} images=${JSON.stringify(p.images)}`);
  }
  console.log(`(tricky rows printed: ${tricky.length} candidates scanned)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
