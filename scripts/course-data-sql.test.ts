import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { tableColumns, type DatasetTable } from '../labs/challenges/sql/data';
import {
  commonCatalogChecks,
  commonLessonChecks,
  LANGS,
  stepTexts,
  strings,
  type Json,
} from './course-lesson-checks';
import { courses, lessonData, modules } from './course-pages.mjs';
import { examples } from './sql-examples';

// Los datos de los cursos de SQL (SQL Server por ahora; PostgreSQL se suma con su curso). Lo que vale
// para la lección de cualquier curso está en course-lesson-checks.ts; aquí, lo propio de SQL: el nivel
// de cada paso, la forma de un ejercicio y de un paso capturado, las explicaciones de los errores y
// los ejemplos del texto. Que las soluciones corran y que los ejemplos den lo que muestran lo
// comprueba sqlserver-lessons.test.ts.

const root = '.';
const KINDS = ['read', 'exercise', 'captured', 'choice'];
const LEVELS = ['executable', 'concept'];
const MODES = ['query', 'change', 'plan'];
const CHECKS = ['rows', 'table', 'error', 'plan', 'index'];
const CASE_KEYS = ['sample', 'tables', 'generate', 'expected', 'explain'];
// Las claves que acepta un paso de cada tipo: un nombre mal escrito (`levl`) no pasaría por un dato más.
const STEP_KEYS: Record<string, string[]> = {
  read: ['id', 'kind'],
  choice: ['id', 'kind', 'answer'],
  exercise: [
    ...['id', 'kind', 'level', 'mode', 'tables', 'setup', 'starter', 'solution', 'check'],
    ...['ordered', 'verify', 'query', 'plan', 'cases', 'rules', 'sqlstate', 'extensions'],
  ],
  captured: ['id', 'kind', 'script', 'predict', 'captured'],
};
const MESSAGE_KEYS = ['text', 'number', 'level', 'state', 'line'];
/** Cómo se escribe el código de un error en el errors.yml de cada curso. */
const ERROR_CODE: Record<string, RegExp> = { sqlserver: /^\d+$/ };

const read = (path: string): Json => parse(readFileSync(path, 'utf8')) as Json;
const dataset = (read('_data/labs/challenge-datasets.yml')['shared'] as { tables: DatasetTable[] })
  .tables;
const tableById = (id: string) => dataset.find((table) => table.id === id);

const sqlCourses = (courses(root) as unknown as Json[])
  .filter((course) => course['engine'] === 'sql' && course['status'] !== 'soon')
  .map((course) => ({ id: course['id'] as string, course }));

describe.each(sqlCourses)('curso $id', ({ id, course }) => {
  const catalog = modules(root, id);
  const lessons = catalog.flatMap((module) =>
    module.lessons.map((lesson) => ({
      module: module.id,
      id: lesson,
      data: lessonData(root, id, module.id, lesson),
    })),
  );
  const errors = read(`_data/course/${id}/errors.yml`);

  describe('temario', () => {
    commonCatalogChecks(root, id);

    it('cada módulo trae sus retos y sus lecturas como listas de ids, y los retos son de SQL', () => {
      for (const module of catalog) {
        const practice = (module as unknown as { practice?: Record<string, string[]> }).practice;
        for (const key of ['challenges', 'posts']) {
          const ids = practice?.[key];
          expect(Array.isArray(ids), `${module.id} practice.${key}`).toBe(true);
          expect(
            ids!.every((item) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(item)),
            `${module.id} practice.${key} son ids`,
          ).toBe(true);
        }
        for (const challenge of practice!['challenges']!) {
          const file = `_data/labs/challenges/${challenge}.yml`;
          expect(existsSync(file), `${challenge} existe`).toBe(true);
          expect((read(file)['shared'] as Json)['language'], `${challenge} es de SQL`).toBe('sql');
        }
      }
    });
  });

  it('el curso nombra el producto que enseña, para el rótulo de sus salidas capturadas', () => {
    expect(String(course['product'] ?? '').trim()).not.toBe('');
  });

  describe('explicaciones de errores', () => {
    it.each(Object.keys(errors))('%s está en los dos idiomas', (code) => {
      expect(code).toMatch(ERROR_CODE[id] ?? /\S/);
      const entry = errors[code] as Record<string, unknown>;
      expect(Object.keys(entry).sort()).toEqual(['en', 'es']);
      for (const lang of LANGS) {
        expect(typeof entry[lang], `${code} ${lang}`).toBe('string');
        expect(String(entry[lang]).trim(), `${code} ${lang}`).not.toBe('');
      }
    });
  });

  describe.each(lessons)('lección $module/$id', ({ data }) => {
    const shared = data['shared'] as { steps: Json[] };
    commonLessonChecks(data, { kinds: KINDS });

    const exercises = shared.steps.filter((step) => step['kind'] === 'exercise');
    const captured = shared.steps.filter((step) => step['kind'] === 'captured');

    it('cada paso solo trae las claves de su tipo', () => {
      for (const step of shared.steps) {
        const allowed = STEP_KEYS[step['kind'] as string] ?? [];
        expect(
          Object.keys(step).filter((key) => !allowed.includes(key)),
          `${step['id']}`,
        ).toEqual([]);
      }
    });

    it('los ejercicios dicen su nivel, su modo y cómo se revisan', () => {
      for (const step of exercises) {
        const where = String(step['id']);
        expect(LEVELS, `${where} level`).toContain(step['level']);
        expect(MODES, `${where} mode`).toContain(step['mode']);
        expect(CHECKS, `${where} check`).toContain(step['check']);
        expect(typeof step['starter'], `${where} starter`).toBe('string');
        expect(String(step['solution'] ?? '').trim(), `${where} solution`).not.toBe('');
        const tables = step['tables'];
        expect(Array.isArray(tables), `${where} tables`).toBe(true);
        for (const table of tables as string[])
          expect(
            tableById(table),
            `${where}: ${table} no está en la base de ejemplo`,
          ).toBeDefined();
        if (step['check'] === 'table')
          expect(String(step['verify'] ?? '').trim(), `${where} verify`).not.toBe('');
        if ('ordered' in step) expect(typeof step['ordered'], `${where} ordered`).toBe('boolean');
      }
    });

    it('los casos de un ejercicio usan solo sus tablas y las columnas que existen', () => {
      for (const step of exercises) {
        const cases = (step['cases'] as Json[] | undefined) ?? [];
        cases.forEach((data, index) => {
          const where = `${step['id']} caso ${index + 1}`;
          expect(
            Object.keys(data).filter((key) => !CASE_KEYS.includes(key)),
            where,
          ).toEqual([]);
          const own = (data['tables'] ?? {}) as Record<
            string,
            { columns: string[]; rows: unknown[][] }
          >;
          for (const [table, rows] of Object.entries(own)) {
            expect(step['tables'], `${where}: ${table} no está en tables`).toContain(table);
            const known = tableColumns(tableById(table)!.ddl).map((column) => column.toLowerCase());
            for (const column of rows.columns)
              expect(known, `${where}: ${table}.${column}`).toContain(column.toLowerCase());
            for (const row of rows.rows)
              expect(row, `${where}: ${table}`).toHaveLength(rows.columns.length);
          }
        });
      }
    });

    it('un ejercicio de resultado trae el caso de ejemplo y uno con datos propios', () => {
      for (const step of exercises.filter((item) =>
        ['rows', 'table'].includes(String(item['check'])),
      )) {
        const cases = (step['cases'] as Json[] | undefined) ?? [];
        expect(
          cases.some((data) => data['sample'] === true),
          `${step['id']}: falta el caso de ejemplo`,
        ).toBe(true);
        expect(
          cases.some((data) => data['tables'] !== undefined),
          `${step['id']}: falta un caso con datos propios`,
        ).toBe(true);
      }
    });

    it('los pasos capturados traen su script y su salida grabada con la forma de siempre', () => {
      for (const step of captured) {
        const where = String(step['id']);
        expect(String(step['script'] ?? '').trim(), `${where} script`).not.toBe('');
        const capture = step['captured'] as Json;
        expect(Object.keys(capture).sort(), `${where} captured`).toEqual([
          'batches',
          'date',
          'server',
        ]);
        expect(String(capture['server']), `${where} server`).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
        // Entre comillas en el YAML: sin ellas, Jekyll la lee como una fecha y no como texto.
        expect(typeof capture['date'], `${where} date`).toBe('string');
        expect(String(capture['date']), `${where} date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const batches = capture['batches'] as Json[];
        expect(batches.length, `${where} batches`).toBeGreaterThan(0);
        for (const batch of batches) {
          expect(Object.keys(batch).sort(), `${where} lote`).toEqual(['messages', 'results']);
          for (const set of batch['results'] as { columns: unknown[]; rows: unknown[][] }[]) {
            expect(Object.keys(set).sort(), `${where} resultado`).toEqual(['columns', 'rows']);
            expect(set.columns.length, `${where} columnas`).toBeGreaterThan(0);
            expect(
              set.columns.every((column) => typeof column === 'string'),
              `${where} nombres de columna`,
            ).toBe(true);
            for (const row of set.rows) {
              expect(row, `${where} fila`).toHaveLength(set.columns.length);
              for (const cell of row)
                expect(
                  cell === null || ['string', 'number', 'boolean'].includes(typeof cell),
                  `${where} celda ${JSON.stringify(cell)}`,
                ).toBe(true);
            }
          }
          for (const message of batch['messages'] as Json[]) {
            expect(typeof message['text'], `${where} mensaje`).toBe('string');
            expect(
              Object.keys(message).filter((key) => !MESSAGE_KEYS.includes(key)),
              `${where} mensaje`,
            ).toEqual([]);
            // Un error trae su número, su gravedad, su estado y su línea; un PRINT, solo el texto.
            const detail = ['number', 'level', 'state', 'line'].filter((key) => key in message);
            expect([0, 4], `${where}: ${JSON.stringify(message)}`).toContain(detail.length);
            for (const key of detail)
              expect(Number.isInteger(message[key]), `${where} ${key}`).toBe(true);
          }
        }
      }
    });

    it('cada error de una salida capturada tiene su explicación en los dos idiomas', () => {
      for (const step of captured) {
        const capture = step['captured'] as { batches: { messages: Json[] }[] };
        for (const batch of capture.batches)
          for (const message of batch.messages) {
            if (typeof message['level'] !== 'number' || message['level'] <= 10) continue;
            const entry = errors[String(message['number'])] as Record<string, string> | undefined;
            for (const lang of LANGS)
              expect(
                entry?.[lang]?.trim(),
                `${step['id']}: falta la explicación del error ${message['number']} (${lang})`,
              ).toBeTruthy();
          }
      }
    });

    it('la predicción de un paso capturado está completa en los dos idiomas', () => {
      for (const step of captured) {
        const where = String(step['id']);
        const predict = step['predict'] as Json | undefined;
        const texts = LANGS.map(
          (lang) => stepTexts(data, lang, where)['predict'] as Json | undefined,
        );
        if (!predict) {
          expect(texts, `${where}: texto de una predicción que no existe`).toEqual([
            undefined,
            undefined,
          ]);
          continue;
        }
        expect(Object.keys(predict), `${where} predict`).toEqual(['answer']);
        expect(Number.isInteger(predict['answer']), `${where} answer`).toBe(true);
        for (const text of texts) {
          expect(text, `${where}: falta la predicción en un idioma`).toBeDefined();
          expect(typeof text?.['question'], `${where} question`).toBe('string');
          expect(typeof text?.['explanation'], `${where} explanation`).toBe('string');
          const options = text?.['options'] as unknown[];
          expect(options.length, `${where} options`).toBeGreaterThanOrEqual(2);
          expect(
            options.every((option) => typeof option === 'string'),
            `${where} opciones como texto`,
          ).toBe(true);
          expect(predict['answer'] as number, `${where} answer`).toBeLessThan(options.length);
        }
        expect(
          (texts[0]?.['options'] as unknown[]).length,
          `${where}: opciones distintas en cada idioma`,
        ).toBe((texts[1]?.['options'] as unknown[]).length);
      }
    });

    it('el cuadro "Ojo: diferencias" está en los dos idiomas o en ninguno, y solo en un ejercicio ejecutable', () => {
      for (const step of shared.steps) {
        const where = String(step['id']);
        const has = LANGS.map((lang) => 'differences' in stepTexts(data, lang, where));
        expect(new Set(has).size, `${where}: el cuadro está en un solo idioma`).toBe(1);
        if (has[0]) {
          expect(step['kind'], `${where}: el cuadro es de un ejercicio`).toBe('exercise');
          expect(step['level'], `${where}: el cuadro es de un paso ejecutable`).toBe('executable');
        }
      }
    });

    it('un resultado de ejemplo (```text) siempre trae su consulta (```sql) justo antes', () => {
      for (const lang of LANGS)
        for (const text of strings(data[lang]))
          expect(examples(text).orphans, `${lang}: resultado sin consulta`).toEqual([]);
    });
  });
});
