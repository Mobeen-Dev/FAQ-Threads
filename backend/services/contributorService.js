const prisma = require("./prismaClient");

// Find or create a storefront contributor by email
async function findOrCreateContributor(shopId, customerData) {
  if (!customerData?.email) return null;

  const existing = await prisma.storeContributor.findUnique({
    where: { shopId_email: { shopId, email: customerData.email } },
  });

  if (existing) {
    // Update name/phone/externalId if provided
    const update = {};
    if (customerData.name && customerData.name !== existing.name) update.name = customerData.name;
    if (customerData.phone && customerData.phone !== existing.phone) update.phone = customerData.phone;
    if (customerData.id && customerData.id !== existing.externalId) update.externalId = customerData.id;
    if (Object.keys(update).length > 0) {
      return prisma.storeContributor.update({ where: { id: existing.id }, data: update });
    }
    return existing;
  }

  return prisma.storeContributor.create({
    data: {
      email: customerData.email,
      name: customerData.name || null,
      phone: customerData.phone || null,
      externalId: customerData.id || null,
      shopId,
    },
  });
}

async function getContributors(shopId, filters = {}) {
  const where = { shopId };
  if (filters.status) where.status = filters.status;
  if (filters.trusted !== undefined) where.trusted = filters.trusted;
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.storeContributor.findMany({
    where,
    include: {
      _count: { select: { questions: true, answers: true, votes: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function updateContributor(shopId, contributorId, data) {
  const existing = await prisma.storeContributor.findFirst({
    where: { id: contributorId, shopId },
  });
  if (!existing) throw new Error("Contributor not found");

  const update = {};
  if (data.trusted !== undefined) update.trusted = data.trusted;
  if (data.status !== undefined) update.status = data.status;
  if (data.name !== undefined) update.name = data.name;

  return prisma.storeContributor.update({ where: { id: contributorId }, data: update });
}

async function suspendContributor(shopId, contributorId) {
  return updateContributor(shopId, contributorId, { status: "suspended" });
}

async function unsuspendContributor(shopId, contributorId) {
  return updateContributor(shopId, contributorId, { status: "active" });
}

async function setTrusted(shopId, contributorId, trusted) {
  return updateContributor(shopId, contributorId, { trusted });
}

module.exports = {
  findOrCreateContributor,
  getContributors,
  updateContributor,
  suspendContributor,
  unsuspendContributor,
  setTrusted,
};
