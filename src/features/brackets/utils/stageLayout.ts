interface StageLike {
  id?: string | number;
  type?: string;
}

export const isRoundRobinStage = (stages: StageLike[]): boolean => {
  return stages[0]?.type === 'round_robin';
};
