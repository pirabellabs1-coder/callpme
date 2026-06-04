/** Codes promo (super-admin). */
import { prisma } from "./client";

export interface PromoRecord {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  grantPlan: string | null;
  maxRedemptions: number;
  redeemedCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  grantPlan: string | null;
  maxRedemptions: number;
  redeemedCount: number;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
};

function toRecord(r: Row): PromoRecord {
  return {
    id: r.id,
    code: r.code,
    description: r.description,
    discountType: r.discountType,
    discountValue: r.discountValue,
    grantPlan: r.grantPlan,
    maxRedemptions: r.maxRedemptions,
    redeemedCount: r.redeemedCount,
    active: r.active,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listPromoCodes(): Promise<PromoRecord[]> {
  const rows = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toRecord);
}

export async function createPromoCode(data: {
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  grantPlan?: string | null;
  maxRedemptions?: number;
  expiresAt?: Date | null;
}): Promise<PromoRecord | null> {
  const code = data.code.trim().toUpperCase();
  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) return null;
  const r = await prisma.promoCode.create({
    data: {
      code,
      description: data.description || null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      grantPlan: data.grantPlan || null,
      maxRedemptions: data.maxRedemptions ?? 0,
      expiresAt: data.expiresAt ?? null,
    },
  });
  return toRecord(r);
}

export async function togglePromoCode(id: string): Promise<boolean> {
  const r = await prisma.promoCode.findUnique({ where: { id } });
  if (!r) return false;
  await prisma.promoCode.update({
    where: { id },
    data: { active: !r.active },
  });
  return true;
}

export async function deletePromoCode(id: string): Promise<boolean> {
  const r = await prisma.promoCode.findUnique({ where: { id } });
  if (!r) return false;
  await prisma.promoCode.delete({ where: { id } });
  return true;
}
