// Marketplace discovery. Browsing works without signing in or playing (PRD: onboarding).

import { businesses, products } from "@hc/db";
import type { BusinessSummary, ProductSummary } from "@hc/shared";
import { and, asc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lockProfile } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { recordEvents } from "./game/quests.js";

const listQuery = z.object({
  category: z.string().max(60).optional(),
  area: z.string().max(80).optional(),
  q: z.string().max(80).optional(),
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const toProduct = (p: typeof products.$inferSelect): ProductSummary => ({
  id: p.id,
  name: p.name,
  priceKobo: p.priceKobo,
  stockStatus: p.stockStatus as ProductSummary["stockStatus"],
  photoUrl: p.photoUrl,
});

export async function marketRoutes(app: FastifyInstance) {
  app.get("/api/market/businesses", async (request): Promise<BusinessSummary[]> => {
    const query = listQuery.parse(request.query);
    const filters: SQL[] = [eq(businesses.status, "published")];
    if (query.category) filters.push(eq(businesses.category, query.category));
    if (query.area) filters.push(ilike(businesses.serviceArea, `%${escapeLike(query.area)}%`));
    if (query.q) {
      const like = `%${escapeLike(query.q)}%`;
      filters.push(or(ilike(businesses.name, like), ilike(businesses.description, like), ilike(businesses.category, like))!);
    }

    const bizRows = await app.db.select().from(businesses).where(and(...filters)).orderBy(asc(businesses.name)).limit(50);
    if (!bizRows.length) return [];
    const productRows = await app.db
      .select()
      .from(products)
      .where(and(inArray(products.businessId, bizRows.map((b) => b.id)), eq(products.status, "published")));

    return bizRows.map((b) => ({
      id: b.id,
      name: b.name,
      kind: b.kind as BusinessSummary["kind"],
      category: b.category,
      serviceArea: b.serviceArea,
      pickupAddress: b.pickupAddress,
      description: b.description,
      isMock: b.isMock,
      products: productRows.filter((p) => p.businessId === b.id).map(toProduct),
    }));
  });

  app.get<{ Params: { id: string } }>("/api/market/products/:id", async (request) => {
    const id = z.uuid().safeParse(request.params.id);
    if (!id.success) throw notFound("Product");
    const [row] = await app.db
      .select({ product: products, business: businesses })
      .from(products)
      .innerJoin(businesses, eq(businesses.id, products.businessId))
      .where(and(eq(products.id, id.data), eq(products.status, "published"), eq(businesses.status, "published")));
    if (!row) throw notFound("Product");

    const user = request.user;
    if (user) {
      await app.db.transaction(async (tx) => {
        const now = new Date();
        await lockProfile(tx, user.id);
        await recordEvents(tx, user.id, [{ type: "product_viewed", key: row.product.id }], now, app.config.GAME_TIMEZONE);
      });
    }
    return {
      ...toProduct(row.product),
      business: { id: row.business.id, name: row.business.name, pickupAddress: row.business.pickupAddress, isMock: row.business.isMock },
    };
  });
}
