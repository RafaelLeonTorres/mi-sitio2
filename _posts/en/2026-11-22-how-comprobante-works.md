---
title: "How Comprobante works: a CFDI 4.0 builder and validator with .NET 11, Angular 22 and PostgreSQL"
description: "A walkthrough of a portfolio project: the SAT's files inside the repository, catalogs in PostgreSQL with EF Core, calculations with the Annex 20 limits, the original string and the seal, 129 validation rules with their codes, and a PDF with a QR code."
lang: en
locale: en_US
ref: como-funciona-comprobante
date: 2026-11-22 12:00:00 -0600
permalink: /en/blog/how-comprobante-works/
tags: [.NET, Angular, PostgreSQL, Docker, CFDI]
repo: https://github.com/RafaelLeonTorres/comprobante
---

[Comprobante](https://github.com/RafaelLeonTorres/comprobante) builds, calculates, seals and validates **CFDI 4.0**, Mexico's electronic invoice, and draws its printed representation as a PDF. In Mexico an invoice only becomes valid when an authorized certification provider (a PAC) *stamps* it, adding a UUID and the tax authority's own seal. That step is what this project leaves out: it never talks to the SAT (the tax authority) or to a PAC, and it seals with the test certificates the SAT itself publishes, so nothing it produces is a valid invoice. The screen, the names of the downloaded files and the PDF's watermark all say so. It's a portfolio project, so instead of listing features, this post explains how it's built and why I made each decision.

## What it does

- **Builds** income and expense CFDI 4.0 invoices, with taxes (VAT, IEPS, income tax and VAT withholdings, exempt and 0% rate), discounts, related CFDIs, currency and exchange rate.
- **Calculates** with `decimal` and the rounding limits of the SAT's Annex 20. Totals update while you type.
- **Seals** with the SAT's test digital seal certificates (CSDs): the original string comes from the official XSLT and the seal is RSA with SHA-256.
- **Validates** any CFDI 4.0 XML: the SAT's XSD schemas, the rules of its error matrix and the seal. Every finding comes with its code, the node and the line.
- **Looks up** the SAT's 19 catalogs (151,346 rows), stored in PostgreSQL.
- **Downloads** the XML and its printed representation as a PDF, with an optional logo.

<figure>
  <img src="{{ '/assets/img/blog/comprobante/generar.webp' | relative_url }}" alt="The Generar screen of Comprobante: the form for an income CFDI with series H and folio 2026-0042, the test issuer with its certificate, and the totals panel with subtotal, discount, VAT, withholdings and a total of 10,708.48 pesos." width="780" height="729" loading="lazy">
  <figcaption>Generar: the form, the test issuer and the totals, which the API calculates while you type.</figcaption>
</figure>

## Three containers and a single origin

Everything runs with Docker Compose in three containers:

```text
Browser (Angular 22)
    |   pages and /api
    v
web: nginx serving the Angular build
    |   /api
    v
api: ASP.NET Core 11  ---->  db: PostgreSQL 18 (the SAT's catalogs)
    |
    +-- sat/: XSD, XSLT, test certificates and catalogs as CSV
```

The browser only talks to `web`: nginx serves the Angular build and passes `/api` to the API container, so the app and the API share an origin and there is no CORS and no tokens. There are no accounts or sessions either. A CFDI carries tax IDs, names and amounts, so the API handles each request in memory and stores nothing: neither the XML nor the forms are saved or logged, and the logs only record the method, route, result, duration and size. The only database is the SAT's public catalogs, which the API only reads.

Inside, the solution is split into projects with one rule: `Comprobante.Core` (calculation, XML, original string, seal and validator) uses no third-party packages. It defines an interface, `ICatalogos`, and knows nothing about EF or PostgreSQL: it uses `System.Xml` and `System.Security.Cryptography` and could be used as a library. What does need packages goes elsewhere: `Comprobante.Catalogos` (EF Core) and `Comprobante.Pdf` (QuestPDF and QRCoder). The code and its comments are in Spanish, like the rest of the repository.

## The SAT's files travel with the repository

The XSD schemas, the XSLTs for the original string, the test certificates and the catalogs live in `sat/`, with the date they were downloaded. Nothing is downloaded while the app runs, so tests are reproducible and don't depend on the SAT's website being up.

The catch is that the schemas and the XSLTs request each other by URL (`http://www.sat.gob.mx/sitio_internet/…`). A custom `XmlResolver` maps those URLs to the files inside the assembly and refuses everything else:

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

That way neither a schema nor an XSLT can make the app read a local file or call out to the network. The XML that comes from the user is read separately and even more carefully: no DTD, no resolver and a size cap, against XXE and entity-expansion bombs.

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

## Catalogs in PostgreSQL with EF Core

The SAT publishes its catalogs as an Excel file. A tool in the repository converts it into one CSV per catalog, and those CSVs are versioned: the diff of a commit shows what changed between one publication and the next. There are 19 catalogs and 151,346 rows. The 16 small ones are read once and kept in memory; the three big ones (postal codes, products and services, and units) are queried by key, and text search uses GIN indexes with `pg_trgm`.

On startup the API applies the migrations and seeds the catalogs, but it almost always does nothing: it compares the SHA-256 fingerprint of the CSVs with the one from the last load and only reloads if it changed. Since two instances can start at the same time, the load runs in a transaction behind a PostgreSQL advisory lock, and the fingerprint is checked again once the lock is acquired:

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

On a cold start, loading the 151,346 rows takes about 14 of the 34 seconds it takes for everything to become healthy.

## The calculation: `decimal` and the Annex 20 limits

Everything is calculated with `decimal`: with `double`, 0.1 + 0.2 isn't 0.3, and cents get lost when you add up many line items. Each line item and each line-item tax is calculated with up to six decimals, and rounding to the currency's decimals happens at the end, on the sums. The calculation lives only in C#: Angular asks the API for the preview instead of repeating the rules, so what you see while typing and what ends up in the XML can't differ.

The least obvious part is one of Annex 20's checks. The amount an issuer records doesn't have to be exactly quantity times unit price: it has to fall between a lower and an upper limit that depend on how many decimals they wrote in each field (`3.10` has two and `3` has none, because that's how the SAT counts them). That way a system that rounds to six decimals and one that rounds to two pass the same rule:

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

`Piso` is 10⁻¹²: the SAT's formula subtracts it so the upper limit doesn't overshoot. If the numbers are so large they don't fit in a `decimal`, the method returns `null` instead of throwing.

## The original string and the seal

The seal is the signature of the original string (*cadena original*), and the original string isn't built by hand: it comes from the SAT's official XSLT (`cadenaoriginal_4_0.xslt`, with all the XSLTs it includes), which ships inside the assembly. What gets signed is exactly what the SAT defined.

```csharp
public static string Generar(XDocument documento)
{
    using var entrada = documento.CreateReader();
    using var salida = new StringWriter(CultureInfo.InvariantCulture);
    Transformacion.Value.Transform(entrada, null, salida);
    return salida.ToString();
}
```

The SAT's XSLTs declare version 2.0 but only use what also exists in 1.0 (`normalize-space`, `concat`), which is what .NET's `XslCompiledTransform` implements. The tests check it against strings calculated separately. The seal is RSA with SHA-256 (RSASSA-PKCS1-v1_5) over the UTF-8 string:

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

When a CSD is loaded, before it can sign anything, the code checks that the private key matches the certificate; otherwise the seal would never verify. And it only signs with the ten test CSDs the SAT publishes, whose keys and password are public: the API never receives a real private key, and shouldn't, so the project doesn't offer signing with your own certificate.

To avoid trusting only my own code, there is a second implementation. The sealed XML that `XmlWriter` produces must be identical, byte for byte, to the one a separate Python script builds with lxml and OpenSSL, and the original string from `XslCompiledTransform` is compared with libxslt's. Since PKCS#1 v1.5 signatures are deterministic, if the two agree it's very likely neither has an implementation bug.

## The validator: small rules, each with its own code

An XML goes through three checks: the SAT's XSD schemas, the rules of the error matrix (catalogs, calculations and relationships between fields) and the seal against the certificate it carries. The validator is a list of small rules, each with its code from the matrix (for example, `CFDI40161`), the node it checks and a message in Spanish, and each one has its own test. What the app generates goes through the same validator before it's delivered: if a finding shows up, the response says so instead of presenting the XML as correct.

The matrix has 129 rules. The ones that need data the app doesn't have offline (the list of registered taxpayer IDs, the official exchange rate of the day or the PAC's stamping) aren't approved silently: they're marked as not checked, with the reason. In total, 103 are checked completely, 5 partially and 21 not at all, and the Validar screen shows that table.

```csharp
public sealed record ReglaSat(string Codigo, EstadoDeRegla Estado, string? Nota = null, string? CubiertaPor = null);

// ...
Revisada("CFDI40102", "Verifica el sello con la llave pública del certificado que trae el comprobante."),
No("CFDI40118", "Compara el TipoCambio con el tipo de cambio oficial del día (DOF), que no está en los catálogos de la app."),
```

<figure>
  <img src="{{ '/assets/img/blog/comprobante/validar.webp' | relative_url }}" alt="The Validar screen with the result “The XML has 5 errors”: each finding with its SAT code, the attribute, what was found and what was expected, and a link to its line; on the right, the reviewed XML with the lines that have errors highlighted and the Download PDF button turned off." width="780" height="671" loading="lazy">
  <figcaption>An XML with five planted errors: a tampered total, a seal that no longer matches and three keys that aren't in the catalog. Each finding links to its line, which is highlighted in the XML.</figcaption>
</figure>

## The PDF

The PDF was added once everything else was done, and it's built in two steps so each can be tested on its own. `ConstructorDeRepresentacion`, in the core, turns the CFDI and the catalogs into a record with everything that gets printed already formatted (the descriptions of the keys, the amounts with their currency, the amount in words, the QR's address and the stamp's original string), and `Comprobante.Pdf` only draws that record with [QuestPDF](https://www.questpdf.com/). The tests read the PDF that comes out: its text with PdfPig and its QR code with ZXing.Net.

What the app generates isn't stamped: it has no UUID or SAT seal, and without the UUID the QR code can't be built either. That PDF carries a banner and a watermark saying "no fiscal validity" and a "Sin timbre" (unstamped) box where the QR would go. An XML that already carries the `TimbreFiscalDigital` complement (you can upload one to Validar) comes out complete, with the QR from Annex 20: the address of the SAT's verification page with the UUID, both taxpayer IDs, the total and the last eight characters of the seal.

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

Since the app doesn't check the stamp with the SAT, the PDF doesn't claim to be valid: it represents what the XML says and lets whoever receives it verify it on the SAT's website, using that QR code.

<figure>
  <img src="{{ '/assets/img/blog/comprobante/pdf-con-timbre.webp' | relative_url }}" alt="A letter-size page of the PDF of a sample invoice: the Comprobante logo, the fiscal folio, issuer and receiver, three line items with their taxes, the amount in words, the totals, the tax summary, the QR code, the original string and the seals." width="560" height="725" loading="lazy">
  <figcaption>The page of an XML with a stamp: fiscal folio, certification data, QR code and seals. The stamp in this capture is made up, because the app doesn't stamp.</figcaption>
</figure>

### Drawing is expensive

A normal invoice is drawn in tens of milliseconds, but one with a thousand line items takes over a second, and that is CPU and memory taken from the API. That's why the PDF has its own request bucket (10 per minute per IP) and, besides that, only 4 are drawn at a time across the whole API. When every slot is busy the request doesn't wait in a queue (each waiting request would hold a thread and memory): it's rejected with `429` and `Retry-After`, and the client retries.

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

The logo is optional and can only be PNG or JPEG (never SVG, which can carry external references). The type is checked from the first bytes, not the extension, and the size in pixels is read from the header before the image is decoded, against decompression bombs. The XML for the PDF weighs at most 1 MB, half of what the validator accepts, because every extra line item means more rows and more pages.

<figure>
  <img src="{{ '/assets/img/blog/comprobante/dialogo-pdf.webp' | relative_url }}" alt="The “Descargar PDF” dialog over the Generar result: the Elegir logo button with its limits of 200 KB and 2,000 by 2,000 pixels, the checkbox to include the original string and the seals, and the Cancelar and Descargar PDF buttons." width="780" height="481" loading="lazy">
  <figcaption>The “Descargar PDF” dialog: your own logo, if you want one, and the option to include the original string and the seals.</figcaption>
</figure>

A note on licenses, because it matters if someone else uses this: QuestPDF's Community 3.0 license is free for individuals, eligible open-source projects and businesses with annual revenue under one million dollars, but it isn't open source, and the public sector and publicly traded companies don't qualify. That's why QuestPDF lives in its own project: if your case doesn't fit, swapping the library only touches `Comprobante.Pdf`. The fonts (Atkinson Hyperlegible, OFL license) and the app's logo are embedded in the assembly, so the PDF looks the same on any machine and inside the container.

## Angular 22 without Zone.js

The frontend is Angular 22 with standalone components, signals, change detection without Zone.js and lazy-loaded routes. Reads from the API use `httpResource`, every form uses Signal Forms, and the theme is Angular Material 3 with this site's colors and typography, in light and dark, with the fonts bundled inside the app.

The PDF button shows what accessibility looks like in code. In Validar it's turned off while the XML has errors (a nicely laid-out PDF of a CFDI with errors would be misleading), but it stays focusable and says why instead of disappearing. When the download finishes, the notice goes in a `role="status"` region, so screen readers announce it too, and the dialog returns focus to the button that opened it.

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

The PDF is also tagged: headings, tables with headers, the QR code as a figure with alternative text and the link to the verification page; the watermark, the test banner and the footer are marked as artifacts. It carries the `es-MX` language, a title and a subject. What's still missing, and I'd rather say so than claim it, is testing the interface and the PDFs with a screen reader and with a PDF/UA checker.

## Security in both layers

The API limits requests per IP with a one-minute sliding window (generate 20, validate 30, PDF 10, calculate 240, query 300 and 600 in total) and answers `429` with `Retry-After`. nginx adds its own limit, a 3 MB cap and the security headers, with a `Content-Security-Policy` that only allows resources from the app itself. nginx's errors also come out as `problem+json`, so the interface shows them the same way as the API's. The CI checks the headers and the limits against the containers.

## Tests and CI

- **Unit (xUnit):** 571 tests of the calculation, the XML, the original string, the seal, each rule on its own, the amount in words and the PDF, with its text read with PdfPig and its QR with ZXing.Net. They include extreme invoices: 1,500 line items, 32-digit amounts, and invoices with each attribute and each node removed one at a time.
- **Integration (Testcontainers and WebApplicationFactory):** 94 tests against a real PostgreSQL. For example: what gets generated passes validation with no findings, an XML with planted errors returns its codes, an XML with XXE is rejected, the limits answer `429` and `413`, and an invoice the PDF engine can't lay out answers `422`.
- **Frontend (Vitest):** 262 tests of services and components.

GitHub Actions runs everything on every pull request and also brings up the three containers and checks, through nginx, `/api/health`, the headers, the limits and that the API draws a PDF.

## Trying it

All you need is Docker. From the repository folder, `docker compose up -d --build --wait` starts the three containers and the app is at `http://localhost:8081`. There is nothing to configure. The first time takes several minutes because it downloads the images and compiles; with an empty database, the containers are healthy about 35 seconds after the build. The API documents itself with OpenAPI and Scalar, at `/api/scalar`.

## What's next

Some things I left out on purpose and that the architecture already supports: the Payments 2.0 complement, a CLI to validate and seal from the terminal, publishing `Comprobante.Core` on NuGet and checking taxpayer IDs with the library from the CURP and RFC validation project, once it's ready. And one real pending item: the screen reader test, which has to be done by a person.

The code is at [github.com/RafaelLeonTorres/comprobante](https://github.com/RafaelLeonTorres/comprobante).

*The screenshots use the test taxpayer IDs and certificates the SAT publishes, and the stamp on the PDF page is made up.*
