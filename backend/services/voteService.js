const prisma = require("./prismaClient");

// Cast or create a vote (+1 / -1) on a question or answer
async function castVote(shopId, contributorId, entityType, entityId, voteValue) {
  if (![1, -1].includes(voteValue)) throw new Error("voteValue must be +1 or -1");
  if (!["question", "answer"].includes(entityType)) throw new Error("entityType must be 'question' or 'answer'");

  // Check contributor is active
  const contributor = await prisma.storeContributor.findUnique({ where: { id: contributorId } });
  if (!contributor || contributor.status === "suspended") {
    throw new Error("Contributor is suspended or not found");
  }

  const whereUnique = entityType === "question"
    ? { contributorId_entityType_questionId: { contributorId, entityType, questionId: entityId } }
    : { contributorId_entityType_answerId: { contributorId, entityType, answerId: entityId } };

  const existingVote = await prisma.vote.findUnique({ where: whereUnique }).catch(() => null);

  let vote;
  if (existingVote) {
    if (existingVote.voteValue === voteValue) {
      // Same vote — remove it (toggle off)
      await prisma.vote.delete({ where: { id: existingVote.id } });
      await recalcScore(entityType, entityId);
      return { action: "removed", vote: null };
    }
    // Change vote direction
    vote = await prisma.vote.update({
      where: { id: existingVote.id },
      data: { voteValue },
    });
    await recalcScore(entityType, entityId);
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

  vote = await prisma.vote.create({ data });
  await recalcScore(entityType, entityId);
  return { action: "created", vote };
}

async function removeVote(shopId, contributorId, entityType, entityId) {
  const whereUnique = entityType === "question"
    ? { contributorId_entityType_questionId: { contributorId, entityType, questionId: entityId } }
    : { contributorId_entityType_answerId: { contributorId, entityType, answerId: entityId } };

  const existing = await prisma.vote.findUnique({ where: whereUnique }).catch(() => null);
  if (!existing) return { action: "none" };

  await prisma.vote.delete({ where: { id: existing.id } });
  await recalcScore(entityType, entityId);
  return { action: "removed" };
}

async function recalcScore(entityType, entityId) {
  const votes = await prisma.vote.findMany({
    where: entityType === "question" ? { questionId: entityId } : { answerId: entityId },
  });
  const score = votes.reduce((sum, v) => sum + v.voteValue, 0);

  if (entityType === "question") {
    await prisma.question.update({ where: { id: entityId }, data: { voteScore: score } });
  } else {
    await prisma.answer.update({ where: { id: entityId }, data: { voteScore: score } });
  }
  return score;
}

async function getVotesForEntity(entityType, entityId) {
  const where = entityType === "question" ? { questionId: entityId } : { answerId: entityId };
  const votes = await prisma.vote.findMany({ where, include: { contributor: { select: { id: true, name: true } } } });
  const up = votes.filter((v) => v.voteValue === 1).length;
  const down = votes.filter((v) => v.voteValue === -1).length;
  return { up, down, score: up - down, votes };
}

module.exports = { castVote, removeVote, recalcScore, getVotesForEntity };
