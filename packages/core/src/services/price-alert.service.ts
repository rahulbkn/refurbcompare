import { AppError as AppErr } from '../errors.js';
import type { PriceAlert } from '../types/models.js';
import type { ServiceContext } from './context.js';
import { visibleInLive } from './visibility.js';

export function createPriceAlertService(ctx: ServiceContext) {
  const { repo } = ctx;

  async function create(input: {
    productId: string;
    email: string;
    targetPrice: number;
  }): Promise<{ alert: PriceAlert; existing: boolean }> {
    const product = await repo.getProductById(input.productId);
    if (!product) throw AppErr.notFound('Product not found');

    const existing = await repo.getPriceAlertByProductAndEmail(input.productId, input.email.toLowerCase());
    if (existing) {
      throw AppErr.conflict('A price alert for this product and email already exists');
    }

    const alert = await repo.createPriceAlert({
      productId: input.productId,
      email: input.email.toLowerCase(),
      targetPrice: input.targetPrice,
    });

    return { alert, existing: false };
  }

  async function triggerCheck(workhorse: (matcher: { productId: string; email: string; targetPrice: number }) => Promise<void>): Promise<number> {
    const alerts = await repo.listActiveAlerts();
    for (const alert of alerts) {
      const product = await repo.getProductById(alert.productId);
      if (!product) continue;
      const listings = (await repo.listListingsForProduct(alert.productId)).filter((l) => visibleInLive(l, ctx.config.dataMode));
      const best = listings.filter((l) => l.stockStatus === 'IN_STOCK').map((l) => l.price).sort((a, b) => a - b)[0];
      if (best !== undefined && best <= alert.targetPrice) {
        await workhorse({
          productId: alert.productId,
          email: alert.email,
          targetPrice: alert.targetPrice,
        });
        await repo.setAlertStatus(alert.id, 'TRIGGERED');
      }
    }
    return alerts.length;
  }

  return { create, triggerCheck };
}

export type PriceAlertService = ReturnType<typeof createPriceAlertService>;