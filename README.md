# Sitio personal de Rafael León

Sitio en español e inglés hecho con [Jekyll](https://jekyllrb.com/) y publicado en GitHub Pages:
<https://rafaelleontorres.github.io/mi-sitio2/>

## Dónde se edita cada cosa

| Quiero cambiar… | Archivo |
|---|---|
| Textos de la interfaz, "Sobre mí", botones y títulos de sección (ES y EN) | `_data/ui.yml` |
| Experiencia laboral | `_data/experience.yml` |
| Habilidades | `_data/skills.yml` |
| Formación y cursos | `_data/education.yml` |
| Proyectos del portafolio | `_data/projects.yml` |
| Correo, redes y rutas de los CV | `_data/profile.yml` |
| El bloque de código del inicio | `_includes/record-es.html` y `_includes/record-en.html` |
| Estilos (colores, tipografía, tema oscuro) | `assets/css/main.css` |
| Menú móvil, tema, botón "Copiar" | `assets/js/main.js` |
| CV en español e inglés | `latex/es/` y `latex/en/` (mismos nombres de archivo en los dos idiomas) |
| Cartas de presentación | `latex/carta-es.tex` y `latex/carta-en.tex` |
| Diseño del CV y de las cartas | `latex/yaac-rl.cls` |
| Demos del laboratorio (TypeScript) | `labs/` (cada demo en `labs/<demo>/main.ts`) |
| Compilación del laboratorio y su presupuesto de tamaño | `scripts/build-labs.mjs` y `scripts/budget.mjs` |
| Plan del laboratorio | `PLAN.md` |
| Textos del laboratorio: índice y piezas compartidas (ES y EN) | `_data/labs/ui.yml` |
| Estilos del laboratorio | `assets/css/labs.css` |

Cada entrada de los archivos de `_data` tiene una parte `es` y otra `en`. Si cambias tu experiencia, actualiza también el CV en `latex/` para que digan lo mismo.

## Cómo agregar una publicación

1. Crea `_posts/es/AAAA-MM-DD-slug.md` y `_posts/en/AAAA-MM-DD-slug.md`.
2. Usa el mismo `ref` en ambos para que el botón de idioma enlace una versión con la otra.
3. Front matter de ejemplo:

```yaml
---
title: "Título del post"
description: "Resumen de una o dos líneas."
lang: es            # en para la versión en inglés
locale: es_MX       # en_US para la versión en inglés
ref: mi-post        # igual en ambas versiones
date: 2026-11-16 10:00:00 -0600
permalink: /blog/mi-post/      # /en/blog/my-post/ en inglés
tags: [C#, .NET]
---
```

Escribe el contenido en Markdown. Los bloques de código con ```` ```csharp ```` se resaltan solos y los genéricos (`List<T>`) se muestran correctamente. Evita escribir `{{` o `{%` fuera de un bloque `{% raw %}`, porque Jekyll los interpreta como Liquid.

## Proyectos

Cada proyecto en `_data/projects.yml` aparece como "Próximamente". Cuando uno esté listo, agrega:

```yaml
  url: https://github.com/RafaelLeonTorres/nombre-del-repo
  status: done
```

## Ver el sitio en tu computadora

### Dependencias (una sola vez)

1. **Ruby 3.3 con DevKit.** En Windows, en PowerShell:

   ```powershell
   winget install RubyInstallerTeam.RubyWithDevKit.3.3
   ```

   Cierra y vuelve a abrir la terminal (o VS Code) para que reconozca `ruby`.
2. **Bundler y las gemas del sitio**, desde la carpeta del repositorio:

   ```powershell
   gem install bundler
   bundle install
   ```

   `bundle install` instala Jekyll y los mismos plugins que usa GitHub Pages (están en el `Gemfile`). En Linux o macOS instala Ruby 3.x con tu gestor de paquetes y ejecuta los mismos dos comandos.

### Levantar el sitio

Desde la carpeta del repositorio:

```powershell
bundle exec jekyll serve --livereload
```

- Ábrelo en <http://localhost:4000/mi-sitio2/>. Jekyll usa el **puerto 4000** y la ruta `/mi-sitio2/` sale de `baseurl` en `_config.yml`.
- Con `--livereload` el navegador se recarga solo cada vez que guardas un archivo; para eso usa también el puerto 35729.
- Si el puerto 4000 está ocupado: `bundle exec jekyll serve --livereload --port 4001`.
- Los cambios en `_config.yml` necesitan reiniciar el servidor. Para detenerlo, `Ctrl+C`.
- En VS Code también puedes usar *Terminal → Ejecutar tarea… → Sitio: levantar en http://localhost:4000/mi-sitio2/*.

## Laboratorio (demos interactivas)

Las demos del laboratorio están en TypeScript, en `labs/`. esbuild las compila a `assets/js/labs/`, que no se sube a git: en GitHub lo genera el workflow antes de construir el sitio. El plan completo está en `PLAN.md`.

### Dependencias (una sola vez)

1. **Node.js 24 o más nuevo** (el workflow usa el 24). En Windows, en PowerShell:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

2. **Las dependencias del laboratorio**, desde la carpeta del repositorio:

   ```powershell
   npm install
   ```

   La primera vez crea `package-lock.json`, que sí se sube a git: fija las versiones exactas que instala el workflow con `npm ci`.

### Trabajar en local

Levanta Jekyll como en la sección anterior y, en otra terminal:

```powershell
npm run dev
```

Recompila las demos cada vez que guardas; Jekyll ve el cambio y recarga la página. En VS Code, la tarea *Sitio y laboratorio* abre las dos terminales.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Compila las demos al guardar |
| `npm run build` | Compila como para publicar y revisa que cada demo pese menos de 30 kB comprimida |
| `npm test` | Corre las pruebas (Vitest); `npm run test:watch` las repite al guardar |
| `npm run check` | Revisa los tipos (TypeScript) y el formato (Prettier) |
| `npm run format` | Corrige el formato con Prettier (solo en `labs/`, `scripts/` y la configuración) |

`npm test` también revisa que cada texto de `_data/labs/` exista en español y en inglés (`scripts/content-parity.test.ts`).

## CV y cartas de presentación (LaTeX)

Los PDF que se descargan desde el sitio se generan a partir de `latex/`:

```text
latex/
├── cv-es.tex, cv-en.tex          CV en español e inglés
├── carta-es.tex, carta-en.tex    cartas de presentación
├── es/, en/                      secciones del CV (los mismos archivos en los dos idiomas)
├── yaac-rl.cls                   plantilla: versión modificada de YAAC (Another Awesome CV)
├── fonts/, foto.jpg              fuente Source Sans Pro y foto (cuadrada; se recorta en círculo)
├── compilar.ps1, compilar.sh     compilan y copian los PDF al sitio
├── build/                        archivos de compilación (no se suben a git)
└── privado/                      referencias y respaldo de los proyectos originales (no se suben)
```

### Dependencias para compilar

- **MiKTeX** (Windows). En PowerShell:

  ```powershell
  winget install MiKTeX.MiKTeX
  ```

  Abre una terminal nueva y activa la instalación automática de paquetes, para que MiKTeX no pregunte por cada uno:

  ```powershell
  initexmf --set-config-value=[MPM]AutoInstall=1
  ```

  La primera compilación tarda unos minutos porque MiKTeX descarga los paquetes que faltan (`fontawesome`, `tcolorbox`, `babel`, etc.); las siguientes tardan segundos. Si MiKTeX avisa que nunca has buscado actualizaciones, abre *MiKTeX Console* y busca actualizaciones una vez.
- En Linux o macOS: TeX Live completo (o MacTeX).
- Opcional: la extensión **LaTeX Workshop** de VS Code para editar con vista previa. VS Code la sugiere al abrir el repositorio (`.vscode/extensions.json`).

No necesitas Perl ni `latexmk`: los scripts llaman a XeLaTeX directamente.

### Recompilar los PDF

Desde la carpeta del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1
```

Compila los cuatro documentos y copia cada PDF a la raíz del repositorio, con el nombre que usa el sitio (así no se rompe ningún enlace):

| Documento | PDF que publica el sitio |
|---|---|
| `latex/cv-es.tex` | `Rafael_Leon_Resume_ES.pdf` |
| `latex/cv-en.tex` | `Rafael_Leon_Resume_EN.pdf` |
| `latex/carta-es.tex` | `Rafael_Leon_Carta_Presentacion_ES.pdf` |
| `latex/carta-en.tex` | `Rafael_Leon_Carta_Presentacion_EN.pdf` |

Otras formas:

- Solo algunos documentos: `powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1 -Documentos cv-es,carta-es`
- En VS Code: `Ctrl+Shift+B` ejecuta la tarea *LaTeX: compilar CV y cartas*.
- En Linux o macOS: `./latex/compilar.sh` (o `./latex/compilar.sh cv-es`).

Después haz commit de los `.tex` y de los PDF de la raíz: GitHub Pages publica los PDF tal como están en el repositorio.

### Editar con vista previa en VS Code

Con LaTeX Workshop instalado, abre cualquier archivo de `latex/` y guarda: se compila ese documento, el PDF se abre en una pestaña al lado (`Ctrl+Alt+V` si no aparece) y se copia a la ruta del sitio. `Ctrl+clic` sobre el PDF te lleva a la línea del código. La configuración está en `.vscode/settings.json`.

### Personalizar una carta

Al inicio de `carta-es.tex` o `carta-en.tex`:

```latex
\empresa{Contoso}
\puesto{Desarrollador .NET Senior}
```

Si los dejas vacíos, la carta es genérica. Si escribes una empresa o un puesto, el script deja ese PDF en `latex/privado/` y no toca la versión genérica que publica el sitio.

### Referencias (versión privada)

El CV público dice "Referencias disponibles a solicitud". Los datos de contacto de tus referencias están en `latex/privado/referencias-es.tex` y `referencias-en.tex`, que no se suben a git. Para generar los CV con referencias:

```powershell
powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1 -ConReferencias
```

Quedan en `latex/privado/` como `Rafael_Leon_Resume_ES_con_referencias.pdf` y `..._EN_con_referencias.pdf`.

## Validación y publicación

- Cada pull request y cada push a `main` corren el workflow `Sitio` (`.github/workflows/sitio.yml`): revisa los tipos y el formato del laboratorio, corre sus pruebas, lo compila y construye el sitio con el mismo motor de GitHub Pages.
- En los pull requests también compila los cuatro documentos LaTeX con TeX Live. Los PDF compilados quedan como artefacto `cv-y-cartas` en la ejecución del workflow.
- Al mezclar a `main`, el mismo workflow publica el sitio, solo si todo lo anterior pasó. Para eso, en *Settings → Pages → Build and deployment*, *Source* debe ser **GitHub Actions**. Para volver a publicar directo desde la rama, cambia *Source* a *Deploy from a branch* (`main`, `/ (root)`).
- Las direcciones antiguas (`post1.html`, `Post2.html`, etc.) redirigen a las publicaciones nuevas.
