const prisma = require("./prismaClient");

// Cast or create a vote (+1 / -1) on a question or answer
// Uses transaction to prevent race conditions in score recalculation
async function castVote(shopId, contributorId, entityType, entityId, voteValue) {
  if (![1, -1].includes(voteValue)) throw new Error("voteValue must be +1 or -1");
  if (!["question", "answer"].includes(entityType)) throw new Error("entityType must be 'question' or 'answer'");

  return prisma.$transaction(async (tx) => {
    // Check contributor is active
    const contributor = await tx.storeContributor.findUnique({ where: { id: contributorId } });
    if (!contributor || contributor.status === "suspended") {
      throw new Error("Contributor is suspended or not found");
    }

    const whereUnique = entityType === "question"
      ? { contributorId_entityType_questionId: { contributorId, entityType, questionId: entityId } }
      : { contributorId_entityType_answerId: { contributorId, entityType, answerId: entityId } };

    const existingVote = await tx.vote.findUnique({ where: whereUnique }).catch(() => null);

    let vote;
    if (existingVote) {
      if (existingVote.voteValue === voteValue) {
        // Same vote — remove it (toggle off)
        await tx.vote.delete({ where: { id: existingVote.id } });
        await recalcScoreWithTx(tx, entityType, entityId);
        return { action: "removed", vote: null };
      }
      // Change vote direction
      vote = await tx.vote.update({
        where: { id: existingVote.id },
        data: { voteValue },
      });
      await recalcScoreWithTx(tx, entityType, entityId);
      return { action: "changed", vote };
    }

    // New vote
    const data = {
      voteValue,
      entityType,
      contributorId,
      shopId,
      ...(entityType === "question" ? { questionId: entityId } : { answerId: entityId }),
    };

    vote = await tx.vote.create({ data });
    await recalcScoreWithTx(tx, entityType, entityId);
    return { action: "created", vote };
  });
}

async function removeVote(shopId, contributorId, entityType, entityId) {
  return prisma.$transaction(async (tx) => {
    const whereUnique = entityType === "question"
      ? { contributorId_entityType_questionId: { contributorId, entityType, questionId: entityId } }
      : { contributorId_entityType_answerId: { contributorId, entityType, answerId: entityId } };

    const existing = await tx.vote.findUnique({ where: whereUnique }).catch(() => null);
    if (!existing) return { action: "none" };

    await tx.vote.delete({ where: { id: existing.id } });
    await recalcScoreWithTx(tx, entityType, entityId);
    return { action: "removed" };
  });
}

// Internal: recalc within a transaction
async function recalcScoreWithTx(tx, entityType, entityId) {
  const votes = await tx.vote.findMany({
    where: entityType === "question" ? { questionId: entityId } : { answerId: entityId },
  });
  const score = votes.reduce((sum, v) => sum + v.voteValue, 0);

  if (entityType === "question") {
    await tx.question.update({ where: { id: entityId }, data: { voteScore: score } });
  } else {
    await tx.answer.update({ where: { id: entityId }, data: { voteScore: score } });
  }
  return score;
}

// Public: standalone recalc (wraps in transaction)
async function recalcScore(entityType, entityId) {
  return prisma.$transaction(async (tx) => {
    return recalcScoreWithTx(tx, entityType, entityId);
  });
}

async function getVotesForEntity(entityType, entityId) {
  const where = entityType === "question" ? { questionId: entityId } : { answerId: entityId };
  const votes = await prisma.vote.findMany({ where, include: { contributor: { select: { id: true, name: true } } } });
  const up = votes.filter((v) => v.voteValue === 1).length;
  const down = votes.filter((v) => v.voteValue === -1).length;
  return { up, down, score: up - down, votes };
}

module.exports = { castVote, removeVote, recalcScore, getVotesForEntity };
