---
title: "Cómo funciona Comprobante: un generador y validador de CFDI 4.0 con .NET 11, Angular 22 y PostgreSQL"
description: "Recorrido por un proyecto de portafolio: los archivos del SAT dentro del repositorio, catálogos en PostgreSQL con EF Core, el cálculo con los límites del Anexo 20, la cadena original y el sello, 129 reglas de validación con su código y un PDF con código QR."
lang: es
locale: es_MX
ref: como-funciona-comprobante
date: 2026-11-22 12:00:00 -0600
permalink: /blog/como-funciona-comprobante/
tags: [.NET, Angular, PostgreSQL, Docker, CFDI]
repo: https://github.com/RafaelLeonTorres/comprobante
---

[Comprobante](https://github.com/RafaelLeonTorres/comprobante) arma, calcula, sella y valida **CFDI 4.0**, la factura electrónica de México, y dibuja su representación impresa en PDF. No timbra: no se conecta al SAT ni a un proveedor de certificación (PAC) y sella con los certificados de prueba que publica el propio SAT, así que nada de lo que genera es una factura válida. Lo dicen la pantalla, el nombre de los archivos que se descargan y la marca de agua del PDF. Es un proyecto de portafolio, así que en este post, más que listar funciones, cuento cómo está armado y por qué tomé cada decisión.

## Qué hace

- **Generar** CFDI 4.0 de ingreso y de egreso, con impuestos (IVA, IEPS, retenciones de ISR e IVA, exentos y tasa 0), descuentos, CFDI relacionados, moneda y tipo de cambio.
- **Calcular** con `decimal` y los límites de redondeo del Anexo 20. Los totales se ven mientras escribes.
- **Sellar** con los certificados de sello digital (CSD) de prueba del SAT: la cadena original sale del XSLT oficial y el sello es RSA con SHA-256.
- **Validar** cualquier XML CFDI 4.0: los esquemas XSD del SAT, las reglas de su matriz de errores y el sello. Cada hallazgo trae su código, el nodo y la línea.
- **Consultar** los 19 catálogos del SAT (151,346 filas), guardados en PostgreSQL.
- **Descargar** el XML y su representación impresa en PDF, con un logo opcional.

<figure>
  <img src="{{ '/assets/img/blog/comprobante/generar.webp' | relative_url }}" alt="Pantalla Generar de Comprobante: el formulario de un CFDI de ingreso con serie H y folio 2026-0042, el emisor de prueba con su certificado y el panel de totales con subtotal, descuento, IVA trasladado, retenciones y un total de 10,708.48 pesos." width="780" height="729" loading="lazy">
  <figcaption>Generar: el formulario, el emisor de prueba y los totales, que calcula la API mientras escribes.</figcaption>
</figure>

## Tres contenedores y un solo origen

Todo corre con Docker Compose en tres contenedores:

```text
Navegador (Angular 22)
    |   páginas y /api
    v
web: nginx con el build de Angular
    |   /api
    v
api: ASP.NET Core 11  ---->  db: PostgreSQL 18 (catálogos del SAT)
    |
    +-- sat/: XSD, XSLT, certificados de prueba y catálogos en CSV
```

El navegador solo habla con `web`: nginx sirve el build de Angular y pasa `/api` al contenedor de la API, así que la app y la API comparten origen y no hacen falta CORS ni tokens. Tampoco hay cuentas ni sesiones. Un CFDI trae RFC, nombres y montos, así que la API procesa cada solicitud en memoria y no guarda nada: ni el XML ni los formularios se almacenan o se registran, y los registros solo llevan método, ruta, resultado, duración y tamaño. La única base de datos son los catálogos públicos del SAT, que la API solo lee.

Por dentro, la solución se parte en proyectos con una regla: `Comprobante.Core` (cálculo, XML, cadena original, sello y validador) no usa paquetes de terceros. Define una interfaz, `ICatalogos`, y no sabe de EF ni de PostgreSQL: usa `System.Xml` y `System.Security.Cryptography`, y se podría usar como librería. Lo que sí necesita paquetes va aparte: `Comprobante.Catalogos` (EF Core) y `Comprobante.Pdf` (QuestPDF y QRCoder).

## Los archivos del SAT viajan con el repositorio

Los esquemas XSD, los XSLT de la cadena original, los certificados de prueba y los catálogos viven en `sat/`, con la fecha en que se bajaron. Nada se descarga mientras corre la app, así que las pruebas son reproducibles y no dependen de que el portal del SAT esté disponible.

El detalle es que los esquemas y los XSLT se piden unos a otros por dirección (`http://www.sat.gob.mx/sitio_internet/…`). Un `XmlResolver` propio traduce esas direcciones a los archivos del ensamblado y rechaza todo lo demás:

```csharp
internal sealed class ResolverSat : XmlResolver
{
    public const string DireccionBase = "http://www.sat.gob.mx/sitio_internet/";

    public override object? GetEntity(Uri absoluteUri, string? role, Type? ofObjectToReturn)
    {
        var nombre = NombreDelRecurso(absoluteUri)
            ?? throw new XmlException($"Solo se pueden resolver los archivos del SAT, no \"{absoluteUri}\".");
        return RecursosSat.Abrir(nombre);
    }

    // ...
}
```

Así, ni un esquema ni un XSLT pueden hacer que la app lea un archivo local o pida algo a la red. El XML que llega del usuario se lee aparte y con más cuidado todavía: sin DTD, sin resolver y con un tope de tamaño, contra XXE y bombas de entidades.

```csharp
public static XmlReaderSettings Configuracion(long maximoCaracteres = TamanoMaximoPorOmision) => new()
{
    DtdProcessing = DtdProcessing.Prohibit,
    XmlResolver = null,
    MaxCharactersFromEntities = 0,
    MaxCharactersInDocument = maximoCaracteres,
    IgnoreProcessingInstructions = true,
};
```

## Catálogos en PostgreSQL con EF Core

El SAT publica sus catálogos en un Excel. Una herramienta del repositorio lo convierte en un CSV por catálogo, y esos CSV están versionados: el diff de un commit muestra qué cambió entre una publicación y otra. Son 19 catálogos y 151,346 filas. Los 16 chicos se leen una vez y se guardan en memoria; los tres grandes (códigos postales, productos y servicios, y unidades) se consultan por clave, y la búsqueda de texto usa índices GIN con `pg_trgm`.

Al arrancar, la API aplica las migraciones y siembra los catálogos, pero casi siempre no hace nada: compara la huella SHA-256 de los CSV con la de la última carga y solo recarga si cambió. Como pueden arrancar dos instancias a la vez, la carga va en una transacción con un candado de PostgreSQL, y se vuelve a mirar la huella cuando se obtiene:

```csharp
var huella = RecursosCatalogos.Huella();
if (await YaCargadoAsync(db, huella, cancelacion))
{
    log.LogInformation("Los catálogos del SAT ya están al día (huella {Huella}).", huella[..12]);
    return new ResultadoSembrado(false, huella, 0);
}

// ...

await using var transaccion = await db.Database.BeginTransactionAsync(cancelacion);
await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({LlaveCandado})", cancelacion);

// Otra instancia pudo cargarlos mientras esperábamos el candado.
if (await YaCargadoAsync(db, huella, cancelacion))
{
    return new ResultadoSembrado(false, huella, 0);
}
```

En un arranque en frío, cargar las 151,346 filas toma unos 14 de los 34 segundos que tarda en quedar todo sano.

## El cálculo: `decimal` y los límites del Anexo 20

Todo se calcula con `decimal`: con `double`, 0.1 + 0.2 no es 0.3 y los centavos se pierden al sumar muchos conceptos. Cada concepto y cada impuesto de concepto se calculan con hasta seis decimales, y el redondeo a los decimales de la moneda se hace al final, sobre las sumas. El cálculo vive solo en C#: Angular le pide la vista previa a la API en lugar de repetir las reglas, así que lo que ves mientras escribes y lo que sale en el XML no pueden diferir.

La parte menos obvia es una validación del Anexo 20. El importe que registra un emisor no tiene que ser exactamente cantidad por valor unitario: tiene que caer entre un límite inferior y uno superior que dependen de cuántos decimales escribió en cada campo (`3.10` tiene dos y `3` ninguno, porque así los cuenta el SAT). Así, un sistema que redondea a seis decimales y otro que lo hace a dos pasan la misma regla:

```csharp
public static Rango? ImporteConcepto(
    decimal cantidad, int decimalesCantidad, decimal valorUnitario, int decimalesValorUnitario, int decimalesImporte)
{
    try
    {
        var mediaCantidad = MitadDeLaUltimaCifra(decimalesCantidad);
        var mediaValor = MitadDeLaUltimaCifra(decimalesValorUnitario);
        return new Rango(
            Redondeo.Truncar((cantidad - mediaCantidad) * (valorUnitario - mediaValor), decimalesImporte),
            Redondeo.HaciaArriba((cantidad + mediaCantidad - Piso) * (valorUnitario + mediaValor - Piso), decimalesImporte));
    }
    catch (OverflowException)
    {
        return null;
    }
}
```

`Piso` es 10⁻¹²: la fórmula del SAT lo resta para que el límite superior no se pase. Si las cifras son tan grandes que no caben en un `decimal`, el método devuelve `null` en lugar de lanzar una excepción.

## La cadena original y el sello

El sello es la firma de la cadena original, y la cadena original no se arma a mano: sale del XSLT oficial del SAT (`cadenaoriginal_4_0.xslt`, con todos los XSLT que incluye), que viaja en el ensamblado. Lo que se firma es exactamente lo que el SAT definió.

```csharp
public static string Generar(XDocument documento)
{
    using var entrada = documento.CreateReader();
    using var salida = new StringWriter(CultureInfo.InvariantCulture);
    Transformacion.Value.Transform(entrada, null, salida);
    return salida.ToString();
}
```

Los XSLT del SAT se declaran como 2.0, pero usan solo lo que también existe en 1.0 (`normalize-space`, `concat`), que es lo que implementa `XslCompiledTransform` en .NET. Las pruebas lo comprueban con cadenas calculadas aparte. El sello es RSA con SHA-256 (RSASSA-PKCS1-v1_5) sobre la cadena en UTF-8:

```csharp
public string Firmar(string cadenaOriginal)
{
    var datos = Encoding.UTF8.GetBytes(cadenaOriginal);
    lock (_candado)
    {
        return Convert.ToBase64String(_llave.SignData(datos, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
    }
}
```

Antes de firmar, al cargar el CSD se comprueba que la llave privada corresponda al certificado; si no, el sello nunca verificaría. Y solo se firma con los diez CSD de prueba que publica el SAT, cuyas llaves y contraseña son públicas: la API nunca recibe una llave privada real, y tampoco debería, así que el proyecto no ofrece firmar con tu propio certificado.

Para no confiar solo en mi propio código, hay una segunda implementación. El XML sellado que produce `XmlWriter` debe ser idéntico, byte por byte, al que arma aparte un script de Python con lxml y OpenSSL, y la cadena original de `XslCompiledTransform` se compara con la de libxslt. Como la firma PKCS#1 v1.5 es determinista, si las dos coinciden es muy probable que ninguna tenga un error de implementación.

## El validador: reglas pequeñas, cada una con su código

Un XML pasa por tres revisiones: los esquemas XSD del SAT, las reglas de la matriz de errores (catálogos, cálculos y relaciones entre campos) y el sello contra el certificado que trae. El validador es una lista de reglas pequeñas, cada una con el código de la matriz (por ejemplo, `CFDI40161`), el nodo que revisa y un mensaje en español, y cada una tiene su propia prueba. Lo que genera la app pasa por el mismo validador antes de entregarse: si aparece un hallazgo, la respuesta lo dice en lugar de presentar el XML como correcto.

La matriz tiene 129 reglas. Las que necesitan datos que la app no tiene sin conexión (la lista de RFC inscritos, el tipo de cambio oficial del día o el timbrado del PAC) no se aprueban en silencio: quedan como no revisadas, con su motivo. En total, 103 se revisan completas, 5 en parte y 21 no, y la pantalla Validar muestra esa tabla.

```csharp
public sealed record ReglaSat(string Codigo, EstadoDeRegla Estado, string? Nota = null, string? CubiertaPor = null);

// ...
Revisada("CFDI40102", "Verifica el sello con la llave pública del certificado que trae el comprobante."),
No("CFDI40118", "Compara el TipoCambio con el tipo de cambio oficial del día (DOF), que no está en los catálogos de la app."),
```

<figure>
  <img src="{{ '/assets/img/blog/comprobante/validar.webp' | relative_url }}" alt="Pantalla Validar con el resultado «El XML tiene 5 errores»: cada hallazgo con su código del SAT, el atributo, lo encontrado y lo esperado, y un enlace a su línea; a la derecha el XML revisado con las líneas con error marcadas y el botón Descargar PDF apagado." width="780" height="671" loading="lazy">
  <figcaption>Un XML con cinco errores sembrados: el total alterado, un sello que ya no corresponde y tres claves que no están en el catálogo. Cada hallazgo enlaza a su línea, que se marca en el XML.</figcaption>
</figure>

## El PDF

El PDF se agregó cuando el resto ya estaba terminado, y se arma en dos pasos para poder probar cada uno por separado. `ConstructorDeRepresentacion`, en el núcleo, convierte el CFDI y los catálogos en un registro con todo lo que se imprime ya formateado (las descripciones de las claves, los importes con su moneda, el importe con letra, la dirección del QR y la cadena original del timbre), y `Comprobante.Pdf` solo dibuja ese registro con [QuestPDF](https://www.questpdf.com/). Las pruebas leen el PDF que sale: su texto con PdfPig y su código QR con ZXing.Net.

Lo que genera la app no está timbrado: no tiene UUID ni sello del SAT, y sin el UUID tampoco se puede armar el código QR. Ese PDF lleva una franja y una marca de agua de «sin validez fiscal» y un recuadro «Sin timbre» donde iría el QR. Un XML que ya trae el complemento `TimbreFiscalDigital` (se puede subir a Validar) sale completo, con el QR del Anexo 20: la dirección del verificador del SAT con el UUID, los dos RFC, el total y los últimos ocho caracteres del sello.

```csharp
internal static string UrlDeVerificacion(string? uuid, string? rfcEmisor, string? rfcReceptor, string? total, string selloDelEmisor)
{
    var importe = decimal.TryParse(total, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var valor)
        ? valor
        : 0m;
    var ultimosOcho = selloDelEmisor.Length > 8 ? selloDelEmisor[^8..] : selloDelEmisor;

    // El RFC puede llevar "&" (A&A010101AA1) y el sello "+", "/" o "=": sin escapar, el SAT leería otra cosa.
    return DireccionDeVerificacion
        + "?id=" + Uri.EscapeDataString(uuid ?? string.Empty)
        + "&re=" + Uri.EscapeDataString(rfcEmisor ?? string.Empty)
        + "&rr=" + Uri.EscapeDataString(rfcReceptor ?? string.Empty)
        + "&tt=" + importe.ToString("0000000000.000000", CultureInfo.InvariantCulture)
        + "&fe=" + Uri.EscapeDataString(ultimosOcho);
}
```

Como la app no consulta el timbre al SAT, el PDF no afirma que sea válido: representa lo que dice el XML y deja que quien lo reciba lo verifique en el portal, con ese código QR.

<figure>
  <img src="{{ '/assets/img/blog/comprobante/pdf-con-timbre.webp' | relative_url }}" alt="Hoja carta del PDF de una factura de ejemplo: el logo de Comprobante, el folio fiscal, el emisor y el receptor, tres conceptos con sus impuestos, el importe con letra, los totales, el resumen de impuestos, el código QR, la cadena original y los sellos." width="560" height="725" loading="lazy">
  <figcaption>La hoja de un XML con timbre: folio fiscal, datos de certificación, código QR y sellos. El timbre de esta captura está inventado, porque la app no timbra.</figcaption>
</figure>

### Dibujar cuesta

Un comprobante normal se dibuja en decenas de milisegundos, pero uno de mil conceptos tarda más de un segundo, y es procesador y memoria de la API. Por eso el PDF tiene su propia cubeta de solicitudes (10 por minuto por IP) y, además, solo se dibujan 4 a la vez en toda la API. Con todos los lugares ocupados, la solicitud no espera en fila (ocuparía un hilo y memoria por cada una): se rechaza con `429` y `Retry-After`, y el cliente reintenta.

```csharp
private readonly SemaphoreSlim lugares = new(Math.Max(1, opciones.Value.PdfSimultaneos));

public async Task<ResultadoDePdf> GenerarAsync(
    XDocument xml, byte[]? logo, bool incluirCadenaYSellos, CancellationToken cancelacion)
{
    if (!await lugares.WaitAsync(TimeSpan.Zero, cancelacion))
    {
        return new ResultadoDePdf.Ocupado();
    }

    try
    {
        // ...

        // Fuera del hilo de la solicitud y sin cancelación: dibujar no se puede interrumpir a la mitad.
        var contenido = await Task.Run(() => GeneradorPdf.Generar(representacion, configuracion), CancellationToken.None);
        return new ResultadoDePdf.Listo(contenido, representacion.NombreDeArchivo);
    }
    finally
    {
        lugares.Release();
    }
}
```

El logo es opcional y solo puede ser PNG o JPEG (nunca SVG, que puede traer referencias externas). El tipo se comprueba por los primeros bytes y no por la extensión, y el tamaño en píxeles se lee del encabezado antes de decodificar la imagen, contra las bombas de descompresión. El XML del PDF pesa a lo más 1 MB, la mitad de lo que admite el validador, porque cada concepto de más son renglones y hojas de más.

<figure>
  <img src="{{ '/assets/img/blog/comprobante/dialogo-pdf.webp' | relative_url }}" alt="Cuadro «Descargar PDF» sobre el resultado de Generar: el botón Elegir logo con sus límites de 200 KB y 2,000 por 2,000 píxeles, la casilla para incluir la cadena original y los sellos, y los botones Cancelar y Descargar PDF." width="780" height="481" loading="lazy">
  <figcaption>El cuadro «Descargar PDF»: un logo propio, si se quiere, y la opción de incluir la cadena original y los sellos.</figcaption>
</figure>

Una nota sobre licencias, porque importa si alguien más lo usa: la licencia Community 3.0 de QuestPDF es gratuita para individuos, proyectos de código abierto elegibles y negocios con ingresos anuales menores a un millón de dólares, pero no es de código abierto, y el sector público y las empresas que cotizan en bolsa no califican. Por eso QuestPDF vive en su propio proyecto: si tu caso no entra, cambiar de biblioteca solo toca `Comprobante.Pdf`. Las fuentes (Atkinson Hyperlegible, licencia OFL) y el logo de la app viajan incrustados en el ensamblado, así que el PDF sale igual en cualquier equipo y dentro del contenedor.

## Angular 22 sin Zone.js

El frontend es Angular 22 con componentes standalone, signals, detección de cambios sin Zone.js y rutas con carga diferida. Las lecturas de la API usan `httpResource`, todos los formularios usan Signal Forms y el tema es Angular Material 3 con los colores y la tipografía de este sitio, en claro y oscuro, con las tipografías dentro de la app.

El botón del PDF muestra cómo se ve la accesibilidad en el código. En Validar está apagado mientras el XML tenga errores (un PDF bien presentado de un CFDI con errores engañaría), pero sigue siendo enfocable y dice por qué, en lugar de desaparecer. Al descargar, el aviso va en una región `role="status"`, así que también lo anuncian los lectores de pantalla, y el cuadro devuelve el foco al botón que lo abrió.

{% raw %}
```html
<button
  matButton="outlined"
  type="button"
  aria-haspopup="dialog"
  disabledInteractive
  [disabled]="!disponible()"
  [attr.aria-describedby]="motivoActual() ? idDelMotivo : null"
  (click)="abrir()"
>
  <mat-icon svgIcon="pdf" aria-hidden="true" />
  Descargar PDF
</button>
@if (motivoActual(); as motivo) {
  <span class="nota" [id]="idDelMotivo">{{ motivo }}</span>
}
<span class="nota" role="status">{{ aviso() }}</span>
```
{% endraw %}

El PDF también va etiquetado: títulos, tablas con encabezado, el código QR como figura con texto alternativo y el enlace al verificador; la marca de agua, la franja de prueba y el pie quedan como artefactos. Lleva idioma `es-MX`, título y asunto. Lo que falta, y que prefiero decir que afirmarlo, es probar la interfaz y los PDF con un lector de pantalla y con un verificador de PDF/UA.

## Seguridad en las dos capas

La API limita las solicitudes por IP con una ventana deslizante de un minuto (generar 20, validar 30, PDF 10, calcular 240, consultar 300 y 600 en total) y responde `429` con `Retry-After`. nginx pone su propio límite, un tope de 3 MB y las cabeceras de seguridad, con una `Content-Security-Policy` que solo admite recursos de la propia app. Los errores de nginx también salen como `problem+json`, así que la interfaz los muestra igual que los de la API. La CI comprueba las cabeceras y los límites contra los contenedores.

## Pruebas y CI

- **Unitarias (xUnit):** 571 pruebas del cálculo, el XML, la cadena original, el sello, cada regla por separado, el importe con letra y el PDF, con su texto leído con PdfPig y su QR con ZXing.Net. Incluyen comprobantes extremos: 1,500 conceptos, importes de 32 dígitos y comprobantes a los que se les quita, de uno en uno, cada atributo y cada nodo.
- **Integración (Testcontainers y WebApplicationFactory):** 94 pruebas contra un PostgreSQL real. Por ejemplo: lo que se genera pasa la validación sin hallazgos, un XML con errores sembrados devuelve sus códigos, un XML con XXE se rechaza, los límites responden `429` y `413`, y un comprobante que el motor de PDF no puede acomodar responde `422`.
- **Frontend (Vitest):** 262 pruebas de servicios y componentes.

GitHub Actions corre todo en cada pull request y, además, levanta los tres contenedores y comprueba a través de nginx `/api/health`, las cabeceras, los límites y que la API dibuje un PDF.

## Cómo probarlo

Solo hace falta Docker. Desde la carpeta del repositorio, `docker compose up -d --build --wait` levanta los tres contenedores y la app queda en `http://localhost:8081`. No hay nada que configurar. La primera vez tarda varios minutos porque descarga las imágenes y compila; con la base vacía, los contenedores quedan sanos unos 35 segundos después de compilar. La API se explica sola con OpenAPI y Scalar, en `/api/scalar`.

## Lo que sigue

Hay cosas que dejé fuera a propósito y que la arquitectura ya admite: el complemento de Pagos 2.0, un CLI para validar y sellar desde la terminal, publicar `Comprobante.Core` en NuGet y revisar los RFC con la librería del proyecto de validación de CURP y RFC, cuando esté lista. Y una pendiente de verdad: la prueba con un lector de pantalla, que tiene que hacer una persona.

El código está en [github.com/RafaelLeonTorres/comprobante](https://github.com/RafaelLeonTorres/comprobante).

*Las capturas usan los RFC y los certificados de prueba que publica el SAT, y el timbre de la hoja del PDF es inventado.*
