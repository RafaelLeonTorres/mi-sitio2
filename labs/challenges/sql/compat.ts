// Funciones con los nombres de T-SQL para PostgreSQL. Se crean en cada base antes del esquema del
// reto, así que `YEAR(OrderDate)`, `ISNULL(x, 0)`, `LEN(Name)` o `DATEADD(day, 1, OrderDate)` corren
// igual que en SQL Server. La parte de fecha sin comillas (`day`) la pone entre comillas
// translate.ts. Cada función se prueba en compat.test.ts contra el resultado de SQL Server.

export const COMPAT_SQL = `CREATE FUNCTION year(d timestamp) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT extract(year FROM d)::int $$;
CREATE FUNCTION month(d timestamp) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT extract(month FROM d)::int $$;
CREATE FUNCTION day(d timestamp) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT extract(day FROM d)::int $$;
CREATE FUNCTION len(s text) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT length(rtrim(s)) $$;
CREATE FUNCTION isnull(a anycompatible, b anycompatible) RETURNS anycompatible LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(a, b) $$;
CREATE FUNCTION iif(c boolean, a anycompatible, b anycompatible) RETURNS anycompatible LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN c THEN a ELSE b END $$;
CREATE FUNCTION getdate() RETURNS timestamp LANGUAGE sql STABLE AS $$ SELECT localtimestamp(3) $$;
CREATE FUNCTION sysdatetime() RETURNS timestamp LANGUAGE sql STABLE AS $$ SELECT localtimestamp $$;
CREATE FUNCTION charindex(f text, s text) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT position(f IN s) $$;
CREATE FUNCTION charindex(f text, s text, start int) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN position(f IN substr(s, greatest(start, 1))) = 0 THEN 0
              ELSE position(f IN substr(s, greatest(start, 1))) + greatest(start, 1) - 1 END $$;
CREATE FUNCTION replicate(s text, n int) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT repeat(s, n) $$;
CREATE FUNCTION space(n int) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT repeat(' ', n) $$;
CREATE FUNCTION datefromparts(y int, m int, d int) RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT make_date(y, m, d) $$;
CREATE FUNCTION eomonth(d timestamp) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT (date_trunc('month', d) + interval '1 month - 1 day')::date $$;
CREATE FUNCTION newid() RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT gen_random_uuid() $$;
CREATE OPERATOR + (LEFTARG = text, RIGHTARG = text, FUNCTION = textcat);

-- La parte de fecha llega como texto: la traducción pone entre comillas el day de DATEADD(day, ...).
CREATE FUNCTION tsql_part(part text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(part)
    WHEN 'yy' THEN 'year' WHEN 'yyyy' THEN 'year'
    WHEN 'qq' THEN 'quarter' WHEN 'q' THEN 'quarter'
    WHEN 'mm' THEN 'month' WHEN 'm' THEN 'month'
    WHEN 'dy' THEN 'dayofyear' WHEN 'y' THEN 'dayofyear'
    WHEN 'dd' THEN 'day' WHEN 'd' THEN 'day'
    WHEN 'wk' THEN 'week' WHEN 'ww' THEN 'week'
    WHEN 'dw' THEN 'weekday' WHEN 'w' THEN 'weekday'
    WHEN 'hh' THEN 'hour' WHEN 'mi' THEN 'minute' WHEN 'n' THEN 'minute'
    WHEN 'ss' THEN 'second' WHEN 's' THEN 'second'
    ELSE lower(part) END $$;

-- n es bigint para aceptar también ROW_NUMBER(), que devuelve bigint.
CREATE FUNCTION dateadd(part text, n bigint, d timestamp) RETURNS timestamp LANGUAGE sql IMMUTABLE AS $$
  SELECT d + CASE tsql_part(part)
    WHEN 'year' THEN make_interval(years => n::int)
    WHEN 'quarter' THEN make_interval(months => 3 * n::int)
    WHEN 'month' THEN make_interval(months => n::int)
    WHEN 'week' THEN make_interval(weeks => n::int)
    WHEN 'hour' THEN make_interval(hours => n::int)
    WHEN 'minute' THEN make_interval(mins => n::int)
    WHEN 'second' THEN make_interval(secs => n)
    ELSE make_interval(days => n::int) END $$;
CREATE FUNCTION dateadd(part text, n bigint, d date) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT dateadd(part, n, d::timestamp)::date $$;
CREATE FUNCTION dateadd(part text, n bigint, d text) RETURNS timestamp LANGUAGE sql IMMUTABLE AS $$
  SELECT dateadd(part, n, d::timestamp) $$;

-- Como en SQL Server: cuenta los límites que cruza (del 31 de diciembre al 1 de enero es un año).
CREATE FUNCTION datediff(part text, a timestamp, b timestamp) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE tsql_part(part)
    WHEN 'year' THEN extract(year FROM b)::int - extract(year FROM a)::int
    WHEN 'quarter' THEN (extract(year FROM b)::int * 4 + extract(quarter FROM b)::int)
                      - (extract(year FROM a)::int * 4 + extract(quarter FROM a)::int)
    WHEN 'month' THEN (extract(year FROM b)::int * 12 + extract(month FROM b)::int)
                    - (extract(year FROM a)::int * 12 + extract(month FROM a)::int)
    WHEN 'week' THEN ((b::date - extract(dow FROM b)::int) - (a::date - extract(dow FROM a)::int)) / 7
    WHEN 'hour' THEN (extract(epoch FROM date_trunc('hour', b) - date_trunc('hour', a)) / 3600)::int
    WHEN 'minute' THEN (extract(epoch FROM date_trunc('minute', b) - date_trunc('minute', a)) / 60)::int
    WHEN 'second' THEN extract(epoch FROM date_trunc('second', b) - date_trunc('second', a))::int
    ELSE b::date - a::date END $$;

-- weekday y week como en SQL Server con DATEFIRST 7: la semana empieza en domingo.
-- DATETRUNC (SQL Server 2022). La semana empieza en domingo, como con el DATEFIRST de inglés de EE. UU.
CREATE FUNCTION datetrunc(part text, d timestamp) RETURNS timestamp LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE tsql_part(part)
    WHEN 'week' THEN date_trunc('day', d) - make_interval(days => extract(dow FROM d)::int)
    WHEN 'dayofyear' THEN date_trunc('day', d)
    WHEN 'weekday' THEN date_trunc('day', d)
    ELSE date_trunc(tsql_part(part), d) END $$;
CREATE FUNCTION datepart(part text, d timestamp) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE tsql_part(part)
    WHEN 'year' THEN extract(year FROM d)::int
    WHEN 'quarter' THEN extract(quarter FROM d)::int
    WHEN 'month' THEN extract(month FROM d)::int
    WHEN 'dayofyear' THEN extract(doy FROM d)::int
    WHEN 'week' THEN ((extract(doy FROM d)::int - 1 + extract(dow FROM date_trunc('year', d))::int) / 7) + 1
    WHEN 'weekday' THEN extract(dow FROM d)::int + 1
    WHEN 'hour' THEN extract(hour FROM d)::int
    WHEN 'minute' THEN extract(minute FROM d)::int
    WHEN 'second' THEN floor(extract(second FROM d))::int
    ELSE extract(day FROM d)::int END $$;
`;
