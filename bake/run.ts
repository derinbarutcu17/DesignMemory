import { runScenario, type ScenarioResult } from './harness';
import { scenarios } from './scenarios';

async function main() {
  const requested = process.argv.includes('--scenario')
    ? process.argv[process.argv.indexOf('--scenario') + 1]
    : undefined;
  const selected = requested ? scenarios.filter((scenario) => scenario.id === requested) : scenarios;

  if (selected.length === 0) {
    console.error(`No scenario matched "${requested}".`);
    process.exit(1);
  }

  const results: ScenarioResult[] = [];
  for (const scenario of selected) {
    const result = await runScenario(scenario);
    results.push(result);
    const marker = result.passed ? 'ok  ' : 'FAIL';
    console.log(`${marker} ${result.id} (${result.durationMs}ms) - ${result.title}`);
    for (const failure of result.failures) {
      console.log(`     ${failure}`);
    }
  }

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} bake scenarios passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
