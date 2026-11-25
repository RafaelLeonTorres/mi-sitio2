import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Los flujos de CI (.github/workflows): que se lean como YAML y que los scripts de npm que llaman
// existan, porque un nombre mal escrito solo se descubre cuando corre el flujo en GitHub.

interface Workflow {
  name: string;
  on: Record<string, unknown>;
  jobs: Record<string, { steps: { name?: string; uses?: string; run?: string }[] }>;
}

const dir = '.github/workflows';
const workflows = readdirSync(dir)
  .filter((name) => name.endsWith('.yml'))
  .map((name) => ({ name, workflow: parse(readFileSync(`${dir}/${name}`, 'utf8')) as Workflow }));
const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: object }).scripts;

describe.each(workflows)('flujo $name', ({ workflow }) => {
  it('tiene nombre, eventos y trabajos con pasos', () => {
    expect(workflow.name).toBeTruthy();
    expect(Object.keys(workflow.on).length).toBeGreaterThan(0);
    for (const job of Object.values(workflow.jobs))
      expect(job.steps?.length ?? 1).toBeGreaterThan(0);
  });

  it('cada `npm run` llama a un script que existe en package.json', () => {
    const called = Object.values(workflow.jobs).flatMap((job) =>
      (job.steps ?? []).flatMap((step) =>
        [...(step.run ?? '').matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1] as string),
      ),
    );
    for (const name of called) expect(Object.keys(scripts), `npm run ${name}`).toContain(name);
  });
});

describe('el flujo de SQL Server', () => {
  const sql = workflows.find((item) => item.name === 'sqlserver.yml')!.workflow;
  const steps = sql.jobs['sqlserver']!.steps;

  it('corre solo cuando cambia algo del curso, igual en los pull requests y en main', () => {
    const { push, pull_request: pullRequest } = sql.on as Record<string, { paths: string[] }>;
    expect(push?.paths).toEqual(pullRequest?.paths);
    expect(push?.paths).toContain('dotnet/sqlserver/**');
    expect(push?.paths).toContain('_data/course/sqlserver/**');
    expect(sql.on).toHaveProperty('workflow_dispatch');
  });

  it('levanta el contenedor antes de esperarlo y de comprobar las lecciones', () => {
    const order = steps.map((step) => step.run ?? '');
    const at = (text: string) => order.findIndex((run) => run.includes(text));
    expect(at('mcr.microsoft.com/mssql/server')).toBeGreaterThan(at('dotnet build'));
    expect(at('sqlserver:wait')).toBeGreaterThan(at('mcr.microsoft.com/mssql/server'));
    expect(at('sqlserver:check')).toBeGreaterThan(at('sqlserver:wait'));
    expect(at('sqlserver-lessons.test.ts')).toBeGreaterThan(at('sqlserver:wait'));
  });

  it('la contraseña se inventa en cada corrida y se oculta', () => {
    const start = steps.find((step) => step.run?.includes('mcr.microsoft.com/mssql/server'))!.run!;
    expect(start).toContain('::add-mask::');
    expect(start).toContain('openssl rand');
    expect(start).toContain('MSSQL_CONNECTION=');
    expect(start).not.toMatch(/MSSQL_SA_PASSWORD=['"]?[A-Za-z0-9]/);
  });
});
