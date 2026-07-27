export const dealStages = [
  "Qualification",
  "Needs Analysis",
  "Value Proposition",
  "Identify Decision Makers",
  "Proposal / Price Quote",
  "Negotiation / Review",
  "Closed Won",
  "Closed Lost",
] as const;

export type DealStage = typeof dealStages[number];

export const stageProbabilities: Record<DealStage, number> = {
  Qualification: 10,
  "Needs Analysis": 20,
  "Value Proposition": 40,
  "Identify Decision Makers": 50,
  "Proposal / Price Quote": 60,
  "Negotiation / Review": 80,
  "Closed Won": 100,
  "Closed Lost": 0,
};
