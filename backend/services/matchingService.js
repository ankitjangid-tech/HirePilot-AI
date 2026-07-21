const normalizeSkillKey = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizeSkills = (skills) => {
  if (skills === null || skills === undefined) {
    return [];
  }

  const rawSkills = Array.isArray(skills)
    ? skills.flatMap((skillGroup) => String(skillGroup || "").split(","))
    : String(skills).split(",");
  const uniqueSkills = new Map();

  rawSkills.forEach((skill) => {
    const label = String(skill || "").trim().replace(/\s+/g, " ");
    const key = normalizeSkillKey(label);

    if (key && !uniqueSkills.has(key)) {
      uniqueSkills.set(key, label);
    }
  });

  return Array.from(uniqueSkills.entries()).map(([key, label]) => ({
    key,
    label,
  }));
};

const compareSkills = (candidateSkillsValue, requiredSkillsValue) => {
  const candidateSkills = normalizeSkills(candidateSkillsValue);
  const requiredSkills = normalizeSkills(requiredSkillsValue);
  const candidateSkillKeys = new Set(candidateSkills.map((skill) => skill.key));
  const matchedSkills = requiredSkills.filter((skill) =>
    candidateSkillKeys.has(skill.key)
  );
  const missingSkills = requiredSkills.filter(
    (skill) => !candidateSkillKeys.has(skill.key)
  );

  return {
    candidateSkills,
    requiredSkills,
    matchedSkills,
    missingSkills,
    matchedCount: matchedSkills.length,
    requiredCount: requiredSkills.length,
  };
};

const calculatePercentageScore = (candidateSkillsValue, requiredSkillsValue) => {
  const comparison = compareSkills(candidateSkillsValue, requiredSkillsValue);
  const matchScore = comparison.requiredCount
    ? Math.round((comparison.matchedCount / comparison.requiredCount) * 100)
    : 0;

  return {
    ...comparison,
    matchScore,
  };
};

const calculateFixedSkillScore = (
  candidateSkillsValue,
  requiredSkillsValue,
  pointsPerSkill = 20
) => {
  const comparison = compareSkills(candidateSkillsValue, requiredSkillsValue);

  return {
    ...comparison,
    matchScore: Math.min(comparison.matchedCount * pointsPerSkill, 100),
  };
};

module.exports = {
  calculateFixedSkillScore,
  calculatePercentageScore,
  compareSkills,
  normalizeSkillKey,
  normalizeSkills,
};
