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

  const listingSelect = {
    id: true,
    productId: true,
    providerId: true,
    sourceProductId: true,
    sourceUrl: true,
    affiliateUrl: true,
    price: true,
    originalPrice: true,
    discount: true,
    normalizedCondition: true,
    sourceCondition: true,
    conditionScore: true,
    conditionDescription: true,
    warrantyMonths: true,
    returnDays: true,
    batteryHealth: true,
    stockStatus: true,
    deliveryEstimate: true,
    sellerName: true,
    sellerRating: true,
    consecutiveSyncFailures: true,
    archivedAt: true,
    createdAt: true,
    lastCheckedAt: true,
    priceUpdatedAt: true,
  } as const;

  console.log('\n=== 1. GOOGLE-PIXEL PRODUCT ===');
  const pixel = await prisma.product.findFirst({
    where: { slug: 'google-pixel' },
    select: {
      id: true, slug: true, brand: true, model: true, variant: true,
      storage: true, ram: true, color: true, network: true, modelNumber: true,
      imageUrl: true, images: true, matchingMethod: true, matchingConfidence: true,
      createdAt: true, updatedAt: true,
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
    console.log(`  createdAt=${pixel.createdAt.toISOString()}`);

    const listings = await prisma.listing.findMany({
      where: { productId: pixel.id },
      select: { ...listingSelect, provider: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ids = listings.map((l) => l.id);
    const histCounts = ids.length
      ? await prisma.priceHistoryPoint.groupBy({
          by: ['listingId'],
          _count: { _all: true },
          where: { listingId: { in: ids } },
        })
      : [];
    const histMap = new Map(histCounts.map((h) => [h.listingId, h._count._all]));

    console.log(`  listings=${listings.length}`);
    for (const l of listings) {
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
      console.log(`      priceHistoryPoints=${histMap.get(l.id) ?? 0}`);
    }
  }

  console.log('\n=== 1b. OTHER GOOGLE PRODUCTS (mapping candidates) ===');
  const googleish = await prisma.product.findMany({
    where: { brand: 'Google', slug: { not: 'google-pixel' } },
    select: { id: true, slug: true, model: true, variant: true, storage: true, ram: true, matchingMethod: true },
    orderBy: { slug: 'asc' },
  });
  for (const p of googleish) {
    console.log(`  ${p.slug} | model="${p.model}" variant=${JSON.stringify(p.variant)} storage=${p.storage} ram=${p.ram} method=${p.matchingMethod}`);
  }

  console.log('\n=== 2. LITERAL "/none" IMAGE VALUES ===');
  // `contains` is unsupported on the Json `images` column in Prisma 6, so
  // fetch all products (small table) and filter here.
  const allProducts = await prisma.product.findMany({
    select: { id: true, slug: true, brand: true, model: true, storage: true, ram: true, imageUrl: true, images: true, createdAt: true },
    orderBy: { slug: 'asc' },
  });
  const noneProducts = allProducts.filter(
    (p) =>
      (typeof p.imageUrl === 'string' && p.imageUrl.includes('/none')) ||
      (Array.isArray(p.images) && (p.images as unknown[]).some((u) => typeof u === 'string' && u.includes('/none'))),
  );
  console.log(`products containing "/none" in image data: ${noneProducts.length}`);
  for (const p of noneProducts) {
    const listings = await prisma.listing.findMany({
      where: { productId: p.id },
      select: { providerId: true, provider: { select: { name: true } } },
    });
    const providers = [...new Set(listings.map((l) => l.provider.name))].join(', ');
    const imagesArr = Array.isArray(p.images) ? (p.images as unknown[]) : [];
    const noneInArray = imagesArr.filter((u) => typeof u === 'string' && u.includes('/none'));
    console.log(`  --- ${p.slug} (id=${p.id}) providers=[${providers}] listings=${listings.length}`);
    console.log(`      imageUrl=${JSON.stringify(p.imageUrl)}`);
    console.log(`      images[]=${JSON.stringify(p.images)}`);
    console.log(`      none-in-array-count=${noneInArray.length} array-length=${imagesArr.length}`);
  }

  // Any row whose image data mentions "none" but is NOT the bare placeholder:
  // these must stay untouched.
  console.log('\n=== 2b. "none" SUBSTRING BUT NOT BARE "/none" imageUrl ===');
  const tricky = noneProducts.filter((p) => p.imageUrl !== '/none');
  if (tricky.length === 0) console.log('  (none — every match is either bare "/none" or lives only in images[])');
  for (const p of tricky) {
    console.log(`  ${p.slug}: imageUrl=${JSON.stringify(p.imageUrl)} images=${JSON.stringify(p.images)}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
