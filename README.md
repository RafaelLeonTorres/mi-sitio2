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

Cada entrada de los archivos de `_data` tiene una parte `es` y otra `en`.

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

Necesitas Ruby 3.x (en Windows, [RubyInstaller](https://rubyinstaller.org/) con DevKit).

```bash
bundle install
bundle exec jekyll serve
```

Después abre <http://localhost:4000/mi-sitio2/>.

## Validación y publicación

- Al subir una rama distinta de `main` o abrir un pull request, el workflow `Validar build de Jekyll` construye el sitio con el mismo motor de GitHub Pages y avisa si hay errores.
- Al mezclar a `main`, GitHub Pages publica el sitio automáticamente.
- Las direcciones antiguas (`post1.html`, `Post2.html`, etc.) redirigen a las publicaciones nuevas.
