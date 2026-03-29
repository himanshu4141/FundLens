export interface SimulationInputs {
  monthlySip: number;
  lumpSum: number;
  annualReturnPct: number;
  years: number;
}

export interface SimulationSummary {
  terminalValue: number;
  investedCapital: number;
  wealthGain: number;
}

export interface SimulationPoint {
  year: number;
  baselineValue: number;
  scenarioValue: number;
}

function monthlyRate(annualReturnPct: number) {
  return annualReturnPct / 100 / 12;
}

function projectFutureValue(monthlySip: number, lumpSum: number, annualReturnPct: number, years: number) {
  const months = years * 12;
  const rate = monthlyRate(annualReturnPct);
  let value = lumpSum;

  for (let month = 0; month < months; month += 1) {
    value = value * (1 + rate) + monthlySip;
  }

  return value;
}

export function buildSimulationSummary(inputs: SimulationInputs): SimulationSummary {
  const terminalValue = projectFutureValue(
    inputs.monthlySip,
    inputs.lumpSum,
    inputs.annualReturnPct,
    inputs.years,
  );
  const investedCapital = inputs.lumpSum + inputs.monthlySip * inputs.years * 12;
  return {
    terminalValue,
    investedCapital,
    wealthGain: terminalValue - investedCapital,
  };
}

export function buildSimulationTimeline(params: {
  baselineSip: number;
  scenarioSip: number;
  lumpSum: number;
  annualReturnPct: number;
  years: number;
}): SimulationPoint[] {
  const points: SimulationPoint[] = [];

  for (let year = 1; year <= params.years; year += 1) {
    points.push({
      year,
      baselineValue: projectFutureValue(
        params.baselineSip,
        params.lumpSum,
        params.annualReturnPct,
        year,
      ),
      scenarioValue: projectFutureValue(
        params.scenarioSip,
        params.lumpSum,
        params.annualReturnPct,
        year,
      ),
    });
  }

  return points;
}
