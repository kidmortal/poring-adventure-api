/**
 * The real-money store. A product is bought through RevenueCat and claimed
 * later, which is when its rewards below are handed out.
 */
import { itemIdByName, prisma } from './client';

type ProductSeed = {
  /** The RevenueCat product identifier — what a webhook arrives carrying. */
  name: string;
  displayName: string;
  silver: number;
  /** Optional: a product may pay out silver only. */
  itemName?: string;
  itemStack: number;
};

const PRODUCTS: ProductSeed[] = [
  { name: 'gift', displayName: 'Apoio emocional', silver: 0, itemStack: 1 },
];

export async function seedStoreProducts() {
  for (const { itemName, ...product } of PRODUCTS) {
    const data = { ...product, itemId: itemName ? await itemIdByName(itemName) : null };
    await prisma.storeProduct.upsert({ where: { name: product.name }, create: data, update: data });
  }
  console.log(`store products: ${PRODUCTS.length}`);
}
