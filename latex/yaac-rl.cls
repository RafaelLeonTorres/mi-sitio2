%% yaac-rl.cls
%%
%% Versión modificada de «YAAC: Another Awesome CV» v1.9.2 (2018/07/19),
%% de Christophe Roger (Darwiin). El original completo, sin cambios, está en
%% https://github.com/darwiin/yaac-another-awesome-cv
%%
%% Copyright 2016 Christophe Roger
%% Modificaciones: 2026, Rafael León Torres
%%
%% This work may be distributed and/or modified under the conditions of the
%% LaTeX Project Public License, either version 1.3c of this license or (at
%% your option) any later version. The latest version of this license is in
%%   http://www.latex-project.org/lppl.txt
%%
%% Cambios respecto al original:
%%  1. Se llama yaac-rl para no confundirse con la clase original.
%%  2. Opciones es / en: cargan babel en español o en inglés. El original fijaba
%%     el francés, que dividía las palabras con reglas francesas.
%%  3. Sin luainputenc, \DeclareUnicodeCharacter ni fullpage: XeLaTeX y LuaLaTeX
%%     ya leen UTF-8 y geometry define los márgenes.
%%  4. Color de acento predeterminado: el morado del sitio (#512bd4). La opción
%%     navy recupera el azul original (#000066).
%%  5. Las fuentes Source Sans Pro se cargan siempre desde fonts/.
%%  6. \linkedin enlaza al perfil sin el sufijo /fr y \github a github.com.
%%  7. \experience acepta una línea opcional (cliente o producto) y muestra el
%%     periodo como «inicio» arriba y «– fin» abajo en la columna izquierda.
%%  8. Comandos nuevos: \skillgroup para las habilidades y, para la carta,
%%     \empresa, \puesto, \conempresa y \conpuesto.
%%  9. El ancho de la columna derecha se calcula a partir del ancho del texto.
%%  10. Opción 11pt para la carta; solo se conserva el encabezado «alternative».

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{yaac-rl}[2026/11/16 v1.9.2-rl YAAC: Another Awesome CV, version modificada]

\newif\if@showLinks \@showLinksfalse
\newif\if@spanish   \@spanishfalse
\newif\if@navy      \@navyfalse

\DeclareOption{es}{\@spanishtrue}
\DeclareOption{en}{\@spanishfalse}
\DeclareOption{navy}{\@navytrue}
\DeclareOption{showLinks}{\@showLinkstrue}
\DeclareOption{11pt}{\PassOptionsToClass{11pt}{article}}
\DeclareOption*{\ClassWarning{yaac-rl}{Opcion desconocida: \CurrentOption}}
\ProcessOptions\relax

\LoadClass[a4paper]{article}

% Dependencias
\RequirePackage{fontspec}
\RequirePackage{babel}
\if@spanish
  \babelprovide[import, main]{spanish}
\else
  \babelprovide[import, main]{english}
\fi
\RequirePackage{url,parskip}
\RequirePackage[dvipsnames]{xcolor}
\RequirePackage[margin=1.5cm]{geometry}
\RequirePackage{fontawesome}
\RequirePackage{hyperref}
\RequirePackage{titlesec}
\RequirePackage{array}
\RequirePackage{enumitem}
\RequirePackage{longtable}
\RequirePackage{etoolbox}
\RequirePackage{tikz}
\RequirePackage[skins]{tcolorbox}
\RequirePackage{fancyhdr}

% Colores
\if@navy
  \definecolor{basecolor}{HTML}{000066}
\else
  \definecolor{basecolor}{HTML}{512BD4}
\fi
\definecolor{darkGrey}{HTML}{989898}
\colorlet{linkcolor}{basecolor}
\colorlet{accentcolor}{linkcolor!90}
\colorlet{symbolcolor}{linkcolor!85}

% Enlaces sin recuadro (salvo con showLinks)
\if@showLinks
  \hypersetup{breaklinks}
\else
  \hypersetup{pdfborder = {0 0 0}, breaklinks}
\fi

% Sin encabezado ni pie de página
\fancyhf{}
\fancyhfoffset{0em}
\renewcommand{\headrulewidth}{0pt}
\pagestyle{fancy}

% Títulos de sección
\titleformat{\section}{\Large\raggedright}{}{0em}{}[\titlerule]
\titlespacing{\section}{0pt}{6pt}{4pt}

% Listas
\setlist[itemize,1]{label=\faAngleRight, nosep, leftmargin=2em}
\setlist[itemize,2]{label=\faAngleRight, nosep, leftmargin=1.5em}

% Columna alineada a la derecha
\newcolumntype{R}[1]{>{\hfill}m{#1}}

% Fuentes: Source Sans Pro desde fonts/ (la ruta es relativa a la carpeta latex/)
\defaultfontfeatures{Ligatures=TeX}
\setmainfont{SourceSansPro-Light}[
  Path = fonts/,
  Extension = .otf,
  BoldFont = SourceSansPro-Regular,
  ItalicFont = SourceSansPro-LightIt,
  BoldItalicFont = SourceSansPro-It]

% Columnas: la izquierda es fija y la derecha ocupa el resto del ancho
\newlength{\leftcolumn}
\setlength{\leftcolumn}{2.5cm}
\newlength{\rightcolumnlength}
\AtBeginDocument{%
  \setlength{\rightcolumnlength}{\dimexpr\textwidth-\leftcolumn-4\tabcolsep-\arrayrulewidth\relax}}

% Iconos de Font Awesome
\newcommand{\mailSymbol}{\faAt}
\newcommand{\locationSymbol}{\faMapMarker}
\newcommand{\infoSymbol}{\faInfo}
\newcommand{\linkedinSymbol}{\faLinkedin}
\newcommand{\mobileSymbol}{\faMobilePhone}
\newcommand{\githubSymbol}{\faGithub}
\newcommand{\websiteSymbol}{\faGlobe}

\newcommand\link[2]{\color{linkcolor}\href{#1}{#2}\color{Black} }
\newcommand\important[1]{\textbf #1}

% Etiqueta de tecnología. Uso: \cvtag{<texto>}
\newcommand{\cvtag}[1]{%
  \tikz[baseline]\node[anchor=base,draw=darkGrey!70,rounded corners=0.5ex,inner xsep=1ex,inner ysep =0.55ex,text height=1.3ex,text depth=.25ex]{#1};
}

% Nombre. Uso: \user{<nombre>}{<apellidos>}
\newcommand\user[2]{\color{accentcolor}{\LARGE #1 \textsc{\textbf{#2}}}\color{Black}}

% Texto o enlace con su icono
\newcommand{\socialtext}[2]{\mbox{\textcolor{symbolcolor}{#1}\hspace{0.5em}#2\hspace{1em}}}
\newcommand{\sociallink}[3]{\mbox{\textcolor{symbolcolor}{#1}\hspace{0.5em}\link{#2}{#3}\hspace{1em}}}

% Datos del encabezado
\newcommand*{\name}[2]{\def\@firstname{#1}\def\@lastname{#2}}
\newcommand*{\firstname}[1]{\def\@firstname{#1}}
\newcommand*{\lastname}[1]{\def\@lastname{#1}}
\newcommand*{\familyname}[1]{\def\@lastname{#1}}
\def\@familyname{\@lastname}
\newcommand*{\tagline}[1]{\def\@tagline{#1}}
\newcommand{\photo}[2]{\def\@photo{#2}\def\@photodiameter{#1}}
\newcommand{\socialinfo}[1]{\def\@socialinfo{#1}}

\newcommand*{\address}[1]{\socialtext{\locationSymbol}{#1}}
\newcommand*{\infos}[1]{\socialtext{\infoSymbol}{#1}}
\newcommand*{\linkedin}[1]{\sociallink{\linkedinSymbol}{https://www.linkedin.com/in/#1/}{linkedin.com/in/#1}}
\newcommand*{\github}[1]{\sociallink{\githubSymbol}{https://github.com/#1}{github.com/#1}}
\newcommand*{\email}[1]{\sociallink{\mailSymbol}{mailto:#1}{#1}}
\newcommand*{\website}[2]{\sociallink{\websiteSymbol}{#1}{#2}}
\newcommand*\smartphone[1]{\socialtext{\mobileSymbol}{#1}}

% Título bajo el nombre
\newcommand\resumetitle[1]{\color{accentcolor}\textbf{\large{#1}}\color{black}}

% Foto redonda
\newcommand\idphoto{%
  \tikz\path[fill overzoom image={\@photo}]circle[radius=0.5\linewidth];%
}

% Encabezado: nombre, título, datos de contacto y, si hay \photo, la foto
\newcommand*{\makecvheader}{
  \ifundef{\@photodiameter}{
    \begin{minipage}{\linewidth}
  }{
    \begin{minipage}{\dimexpr\linewidth-\@photodiameter-2em}
  }
  \user{\@firstname}{\@lastname}\\
  \resumetitle{\@tagline}
  \smallskip\\
  \small{\@socialinfo}
  \end{minipage}
  \ifdef{\@photodiameter}{
    \begin{minipage}{\@photodiameter}
      \idphoto
    \end{minipage}
  }{}
  \bigskip
}

% Pie de página opcional. Uso: \makecvfooter{<izquierda>}{<centro>}{<derecha>}
\newcommand*{\makecvfooter}[3]{%
  \fancyfoot{}
  \fancyfoot[L]{#1}
  \fancyfoot[C]{#2}
  \fancyfoot[R]{#3}
}

% Título de sección. Uso: \sectionTitle{<título>}{<icono>}
\newcommand\sectionTitle[2]{\section{\texorpdfstring{\color{accentcolor}#2\enspace \textsc{#1}}{#1}}}

% Entorno keywords. Uso: \keywordsentry{<etiqueta>}{<texto>}
\newenvironment{keywords}{%
  \renewcommand{\arraystretch}{1.1}
  \begin{tabular}{>{}r>{}p{13cm}}
}{%
  \end{tabular}
}
\newcommand\keywordsentry[2]{
  \textbf{#1} &   #2\\
}

% Entorno scholarship (formación, idiomas). Uso: \scholarshipentry{<fecha>}{<texto>}
\newcolumntype{Y}{>{\raggedleft}p{\leftcolumn}}
\newenvironment{scholarship}{%
  \begin{tabular}{Y p{\rightcolumnlength}}
}{%
  \end{tabular}
}
\newcommand\scholarshipentry[2]{
  #1    &  #2 \\
}

% Experiencia
\newcolumntype{E}{>{\raggedright\arraybackslash}p{\rightcolumnlength}}
\newenvironment{experiences}{%
  \begin{longtable}{R{\leftcolumn}|E}
}{%
  \end{longtable}
}

% Uso:
% \experience[<línea opcional: cliente o producto>]
%   {<inicio>}{<puesto>}{<empresa>}{<lugar>}
%   {<fin>}{<descripción, normalmente un itemize>}
%   {<tecnologías separadas por comas>}
\newcommand\experience[8][]{
  \textbf{#2}    & \textbf{#3, \textsc{#4}, #5}                         \\*
  \textbf{– #6}  & \begin{minipage}[t]{\rightcolumnlength}
                     \ifblank{#1}{}{\emph{#1}\par\smallskip}
                     #7
                   \end{minipage}                                     \\*
                 & \footnotesize{\foreach \n in {#8}{\cvtag{\n}}}     \\
}

% Puesto en renglones: a diferencia de \experience, la página puede cortarse
% entre viñetas, así que no quedan huecos al final de cada hoja.
% \job[<línea opcional: cliente o producto>]{<inicio>}{<fin>}{<puesto>}{<empresa>}{<lugar>}
% \achievement{<logro>}   (una viñeta por renglón)
% \jobtags{<tecnologías separadas por comas>}
\newlength{\achievementindent}
\setlength{\achievementindent}{1.4em}
\newcommand\job[6][]{%
  \textbf{#2}    & \textbf{#4, \textsc{#5}, #6}                          \\*
  \textbf{– #3}  & \ifblank{#1}{}{\emph{#1}}                             \\*[2pt]
}
\newcommand\achievement[1]{%
                 & \hangindent=\achievementindent\hangafter=1%
                   \makebox[\achievementindent][l]{\faAngleRight}#1      \\
}
\newcommand\jobtags[1]{%
  \nopagebreak   & \footnotesize{\foreach \n in {#1}{\cvtag{\n}}}        \\
}

\newcommand\emptySeparator{\multicolumn{2}{c}{}\\}

% Grupo de habilidades en media columna. Uso: \skillgroup{<grupo>}{<lista>}
\newcommand\skillgroup[2]{%
  \begin{minipage}[t]{\dimexpr0.5\linewidth-0.75em\relax}
    \raggedright
    \textbf{\color{accentcolor}#1}\par
    {\small #2\par}
  \end{minipage}%
}

% Dos columnas. Uso: \twocolumnsection{<izquierda>}{<derecha>}
\newcommand*\twocolumnsection[2]{
  \begin{minipage}[t]{\dimexpr(\linewidth/2) - 3em}
    #1
  \end{minipage}
  \hfill
  \begin{minipage}[t]{\dimexpr(\linewidth/2) - 3em}
    #2
  \end{minipage}
}

% Referencias. Uso: \referee{<nombre>}{<puesto>}{<empresa>}{<correo>}{<teléfono>}
\newenvironment{referees}{%
}{%
  \hfill
  \bigskip
}
\newcommand*\referee[5]{
  \hspace{1em}
  \begin{minipage}[t]{\dimexpr(\linewidth/3) - 3em}
    \begin{tabular}{>{}l >{}l}
      \multicolumn{2}{l}{\textbf{#1}}\\
      \multicolumn{2}{l}{\emph{#2}, \textsc{#3}}\\
      \quad \mailSymbol & \href{mailto:#4}{#4} \\
      \quad \faPhone & #5 \\
    \end{tabular}
  \end{minipage}%
}

% Carta: empresa y puesto opcionales.
% \empresa{<nombre>} y \puesto{<puesto>}; vacíos, la carta queda genérica.
% \conempresa{<texto si hay empresa>}{<texto si no>}, igual con \conpuesto.
\newcommand*{\empresa}[1]{\def\@empresa{#1}}
\newcommand*{\puesto}[1]{\def\@puesto{#1}}
\empresa{}
\puesto{}
\newcommand*{\laempresa}{\@empresa}
\newcommand*{\elpuesto}{\@puesto}
\newcommand{\conempresa}[2]{\expandafter\ifblank\expandafter{\@empresa}{#2}{#1}}
\newcommand{\conpuesto}[2]{\expandafter\ifblank\expandafter{\@puesto}{#2}{#1}}
