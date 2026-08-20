import type { ServiceContext } from './context.js';

export interface PublicProvider {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoUrl: string | null;
  mode: string;
  trustScore: number;
  isDemo: boolean;
  supplies: string[];
  lastSyncAt: string | null;
  integrated: boolean;
}

export function createProviderService(ctx: ServiceContext) {
  const { repo } = ctx;

  async function listPublic(): Promise<PublicProvider[]> {
    const providers = await repo.listProviders();
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      website: p.website,
      logoUrl: p.logoUrl,
      mode: p.mode,
      trustScore: p.trustScore,
      isDemo: p.isDemo,
      supplies: p.disabledReason ? [] : ['refurbished phones'],
      lastSyncAt: p.lastSyncAt?.toISOString() ?? null,
      integrated: p.active,
    }));
  }

  return { listPublic };
}

export type ProviderService = ReturnType<typeof createProviderService>;