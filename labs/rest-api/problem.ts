// Problem Details (RFC 9457), con los valores que usa ASP.NET Core: el `type` y el `title` de
// cada código, `instance` con el método y la ruta, y `traceId` para encontrar la petición en
// el registro. La validación agrega `errors` por campo, como `ValidationProblem`.

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  readonly traceId: string;
}

export interface ProblemContext {
  /** El método y la ruta de la petición: `POST /api/products`. */
  readonly instance: string;
  /** El identificador W3C de la traza: `00-<traza>-<tramo>-00`. */
  readonly traceId: string;
}

export const PROBLEM_JSON = 'application/problem+json';

const DEFAULTS: Readonly<Record<number, readonly [type: string, title: string]>> = {
  400: ['https://tools.ietf.org/html/rfc9110#section-15.5.1', 'Bad Request'],
  401: ['https://tools.ietf.org/html/rfc9110#section-15.5.2', 'Unauthorized'],
  403: ['https://tools.ietf.org/html/rfc9110#section-15.5.4', 'Forbidden'],
  404: ['https://tools.ietf.org/html/rfc9110#section-15.5.5', 'Not Found'],
  409: ['https://tools.ietf.org/html/rfc9110#section-15.5.10', 'Conflict'],
  429: ['https://tools.ietf.org/html/rfc6585#section-4', 'Too Many Requests'],
  500: [
    'https://tools.ietf.org/html/rfc9110#section-15.6.1',
    'An error occurred while processing your request.',
  ],
};

/** Un problema con el `type` y el `title` estándar de su código. */
export function problem(status: number, context: ProblemContext, detail?: string): ProblemDetails {
  const [type, title] = DEFAULTS[status] ?? ['about:blank', `Status ${status}`];
  return {
    type,
    title,
    status,
    ...(detail === undefined ? {} : { detail }),
    instance: context.instance,
    traceId: context.traceId,
  };
}

/** El 400 de validación: `errors` lleva los mensajes de cada campo. */
export function validationProblem(
  errors: Readonly<Record<string, readonly string[]>>,
  context: ProblemContext,
): ProblemDetails {
  const [type] = DEFAULTS[400] ?? [''];
  return {
    type,
    title: 'One or more validation errors occurred.',
    status: 400,
    instance: context.instance,
    errors,
    traceId: context.traceId,
  };
}
