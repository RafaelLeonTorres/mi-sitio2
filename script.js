document.addEventListener('DOMContentLoaded', (event) => {
    // Cargar el idioma guardado al cargar la página
    const savedLanguage = localStorage.getItem('language') || 'en'; // Default to English
    applyLanguage(savedLanguage);
});


function showSection(sectionId) {
    // Oculta todas las secciones
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.style.display = 'none';
    });

    // Muestra la sección seleccionada
    document.getElementById(sectionId).style.display = 'block';
}

function changeLanguage(language) {
     // Cambia el enlace del CV según el idioma seleccionado
     const cvLink = language === 'es' ? 'Rafael_Leon_Resume_ES.pdf' : 'Rafael_Leon_Resume_EN.pdf';
     document.getElementById('cv-download').href = cvLink;
 
     // Guarda la preferencia del idioma en localStorage
     localStorage.setItem('language', language);
 
     // Aplica el idioma al contenido
     applyLanguage(language);
}

function applyLanguage(language) {
    // Cambia el contenido del sitio según el idioma
    const languageElements = document.querySelectorAll('[data-i18n]');
    languageElements.forEach((element) => {
        const key = element.getAttribute('data-i18n');
        element.textContent = translations[language][key] || key;
    });
}

// Función para copiar código al portapapeles
function copyCode(id) {
    const codeElement = document.getElementById(id);
    const code = codeElement.innerText || codeElement.textContent;
    navigator.clipboard.writeText(code).then(() => {
      alert('Code copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
  }


const translations = {
    en: {
        'navbar-skills': "Skills",
        'navbar-experience': "Experience",
        'navbar-posts': "Posts",
        'navbar-contact': "Contact",
        'navbar-language': "Language",
        'navbar-english': "English",
        'navbar-spanish': "Spanish",
        'home-title': 'Hello, I’m Rafael León',
        'home-description': 'I’m a Systems Engineer with 6 years of experience as a backend developer. I specialize in .NET C# and have worked in all stages of the software development lifecycle: requirements gathering, analysis, coding, testing, production deployment, and support. I’ve worked in the financial industry at CECOBAN (Authorized Certification Provider) and in the banking industry at CITIBANAMEX. I was part of the team that carried out the regulatory process for transitioning from CFDI version 3.3 to 4.0, as well as the implementation of the Carta Porte 2.0 add-on. I worked on various projects related to invoice generation for different banks within CECOBAN. Additionally, I contributed to CITI’s bank separation efforts, migrating components to new infrastructure, making necessary adjustments, and conducting deployments and testing to ensure proper functionality across different environments.',
        'home-leadership': "Leadership",
        'home-teamwork': "Team work",
        'home-problemresolution': "Problem Resolution",
        'home-persistence': "Persistence",
        'home-downloadcv' : "My Resume",
        "skills-dotnet": ".NET Platform",
        "skills-dotnetdescription": "Proficient using .NET platform to build tools like APIs, service workers, WPF, etc. using C# coding language.",
        "skills-database": "Database Design and Development",
        "skills-databasedescription": "Capable of designing databases from scratch, proficient working with SQL databases like SQL Server.",
        "skills-cicd": "CI/CD",
        "skills-cicdDescription": "Experience with Jenkins, TFS, GIT, BITBUCKET to deploy components to different environments.",
        "skills-cloud": "Cloud Computing",
        "skills-clouddescription": "Some experience with some services from Azure.",
        "skills-solid": "Principios SOLID",
        "skills-soliddescription": "Conocimiento en los principios SOLID para diseño orientado a objetos.",
        "experiences-title": "Experience",
        "experience-solutionsTeamLeader-title": "Solutions Team Leader",
        "experience-solutionsTeamLeader-company": "NTT DATA Europe & Latam",
        "experience-solutionsTeamLeader-period": "May 2022 - May 2024",
        "experience-solutionsTeamLeader-description": "I worked with the client CITIBANAMEX on behalf of NTT DATA on desktop applications and APIs for the bank's applications. My tasks included the following:",
        "experience-solutionsTeamLeader-task1": "Add functionality to the bank's applications (application and database objects).",
        "experience-solutionsTeamLeader-task2": "Change analysis to validate impacts.",
        "experience-solutionsTeamLeader-task3": "Error resolution and support for the QA team.",
        "experience-solutionsTeamLeader-task4": "Deployment of applications and database components using Jenkins.",
        "experience-solutionsTeamLeader-task5": "Collaborate with people from other countries to solve various issues that arise during development (specialized teams have server access and we need to raise tickets to resolve these issues).",
        "experience-solutionsTeamLeader-task6": "Other software development related tasks.",
        "experience-dotNetDeveloper-title": "Software .NET Developer",
        "experience-dotNetDeveloper-company": "Cecoban",
        "experience-dotNetDeveloper-period": "March 2019 - April 2022",
        "experience-dotNetDeveloper-description": "I worked on digital invoicing for banks, focusing on the analysis and design of components for different clients. I participated in the migration of CFDI from version 3.3 to 4.0 for invoicing, as well as in the process for the Carta Porte 2.0 add-on, among other projects for generating invoices for various banks.",
        "experience-dotNetDeveloper-task1": "Requirements analysis.",
        "experience-dotNetDeveloper-task2": "Implementation and deployment of new components.",
        "experience-dotNetDeveloper-task3": "Add functionality and modifications to existing components.",
        "experience-dotNetDeveloper-task4": "Error resolution and support for the QA team for new requirements.",
        "experience-dotNetDeveloper-task5": "Analysis, design, and development of database components.",
        "experience-dotNetDeveloper-task6": "Improvement of invoice processing performance.",
        "experience-dotNetDeveloper-task7": "Use of modern frameworks, SOLID principles, and design patterns for new components and improvement of existing ones.",
        "experience-juniorDeveloper-title": "Junior Developer",
        "experience-juniorDeveloper-company": "TOWA Software",
        "experience-juniorDeveloper-period": "January 2018 - March 2019",
        "experience-juniorDeveloper-description": "I attended an intensive course on JAVA and C#, where we learned best programming practices in these languages. We learned to analyze technical requirements to simplify their implementation in code by delegating responsibilities to functions and classes, making them smaller and easier to maintain. We also covered SQL Server databases and, finally, web services.",
        "experience-juniorDeveloper-task1": "Course on best software practices in JAVA, .NET, and SQL Server.",
        "experience-juniorDeveloper-task2": "Web services.",
        "experience-juniorDeveloper-task3": "Various projects to improve programming skills.",
        "contact":"Contact Me",
        "contact-email":"Email",
        "contact-phone":"Phone",
        "post-title": "Introduction to REST APIs",
        "post-intro": "In this post, we will explore REST APIs, their fundamental principles, and how to implement them in C#. We will look at examples of GET, POST, PUT, and DELETE requests, along with a pagination example using LINQ.",
        "post-restTitle": "What are REST APIs",
        "post-restDescription": "REST APIs (Representational State Transfer) are a set of architectural principles for designing web services. They use standard HTTP methods such as GET, POST, PUT, and DELETE to interact with resources. These resources are represented in formats like JSON or XML and are accessed via URLs.",
        "post-getTitle": "GET Request Example",
        "post-getDescription": "A GET request is used to retrieve data from a server. Here is an example of how to make a GET request with pagination using C#.",
        "post-postTitle": "POST Request Example",
        "post-postDescription": "A POST request is used to send data to the server. Here is an example of how to send JSON data using C#.",
        "post-putTitle": "PUT Request Example",
        "post-putDescription": "A PUT request is used to update data on the server. Here is an example of how to update a resource using C#.",
        "post-deleteTitle": "DELETE Request Example",
        "post-deleteDescription": "A DELETE request is used to remove a resource from the server. Here is an example of how to delete a resource using C#.",
        "post-title": "Post - Rafael León",
        "post-structure-title": "Data Structures in C#",
        "post-structure-intro": "Data structures are essential for the efficient organization and manipulation of data in programming. In this post, we will explore several data structures in C# with code examples for each.",
        "post-arrays-title": "Arrays",
        "post-arrays-description": "An array is a collection of elements of the same type stored in contiguous memory locations. Below is an example of how to declare and initialize an array in C#.",
        "post-lists-title": "Lists",
        "post-lists-description": "Lists are dynamic collections that can grow and shrink as needed. The List class in C# provides a generic list.",
        "post-trees-title": "Trees",
        "post-trees-description": "Trees are hierarchical data structures where each node has a value and a list of child nodes. Here is a basic example of a binary tree.",
        "post-stacks-title": "Stacks",
        "post-stacks-description": "A stack follows the LIFO (Last In, First Out) principle. Elements are added and removed from the same end.",
        "post-queues-title": "Queues",
        "post-queues-description": "A queue follows the FIFO (First In, First Out) principle. Elements are added at the end and removed from the front.",
        "post-parallelism-title": "Parallelism Structures",
        "post-parallelism-description": "To handle parallelism, C# offers structures like ConcurrentQueue and ConcurrentDictionary for thread-safe operations in multi-threaded environments.",
    },
    es: {
        'navbar-skills': "Habilidades",
        'navbar-experience': "Experiencia",
        'navbar-posts': "Publicaciones",
        'navbar-contact': "Contacto",
        'navbar-language': "Idioma",
        'navbar-english': "Inglés",
        'navbar-spanish': "Español",
        'home-title': 'Hola, soy Rafael León',
        'home-description': 'Soy un Ingeniero en Sistemas con 6 años de experiencia como desarrollador backend. Me especializo en .NET C# y he trabajado en todas las etapas del ciclo de vida del desarrollo de software: recopilación de requisitos, análisis, codificación, pruebas, despliegue en producción y soporte. He trabajado en la industria financiera en CECOBAN (Proveedor de Certificación Autorizado) y en la industria bancaria en CITIBANAMEX. Fui parte del equipo que realizó el proceso regulatorio para la transición de CFDI versión 3.3 a 4.0, así como la implementación del complemento Carta Porte 2.0. Trabajé en varios proyectos relacionados con la generación de facturas para diferentes bancos dentro de CECOBAN. Además, contribuí a los esfuerzos de separación de bancos de CITI, migrando componentes a una nueva infraestructura, haciendo los ajustes necesarios y realizando despliegues y pruebas para asegurar el correcto funcionamiento en diferentes entornos.',
        'home-leadership': "Liderazgo",
        'home-teamwork': "Trabajo en equipo",
        'home-problemresolution': "Resolución de problemas",
        'home-persistence': "Persistencia",
        'home-downloadcv' : "Mi Currículum",
        "skills-dotnet": "Plataforma .NET",
        "skills-dotnetdescription": "Competente en el uso de la plataforma .NET para construir herramientas como API, trabajadores de servicio, WPF, etc., utilizando el lenguaje de programación C#.",
        "skills-database": "Diseño y Desarrollo de Bases de Datos",
        "skills-databasedescription": "Capaz de diseñar bases de datos desde cero, competente trabajando con bases de datos SQL como SQL Server.",
        "skills-cicd": "CI/CD",
        "skills-cicdDescription": "Experiencia con Jenkins, TFS, GIT, BITBUCKET para desplegar componentes en diferentes entornos.",
        "skills-cloud": "Computación en la Nube",
        "skills-clouddescription": "Algo de experiencia con algunos servicios de Azure.",
        "skills-solid": "SOLID Principles",
        "skills-soliddescription": "Knowledge of SOLID principles for object-oriented design.",
        "experiences-title": "Experiencia",
        "experience-solutionsTeamLeader-title": "Solutions Team Leader",
        "experience-solutionsTeamLeader-company": "NTT DATA Europe & Latam",
        "experience-solutionsTeamLeader-period": "Mayo 2022 - Mayo 2024",
        "experience-solutionsTeamLeader-description": "Trabajé con el cliente CITIBANAMEX por parte de NTT DATA en aplicaciones de escritorio y API para las aplicaciones del banco. Las tareas que realicé incluyen las siguientes:",
        "experience-solutionsTeamLeader-task1": "Agregar funcionalidad a las aplicaciones del banco (aplicación y objetos de base de datos).",
        "experience-solutionsTeamLeader-task2": "Análisis de cambios para validar impactos.",
        "experience-solutionsTeamLeader-task3": "Resolución de errores y soporte al equipo de QA.",
        "experience-solutionsTeamLeader-task4": "Despliegue de aplicaciones y componentes de base de datos utilizando Jenkins.",
        "experience-solutionsTeamLeader-task5": "Colaborar con personas de otros países para resolver varios problemas que surgen durante el desarrollo (los equipos especializados tienen acceso al servidor y debemos levantar tickets para resolver estos problemas).",
        "experience-solutionsTeamLeader-task6": "Otras tareas relacionadas con el desarrollo de software.",
        "experience-dotNetDeveloper-title": "Desarrollador de software .NET",
        "experience-dotNetDeveloper-company": "Cecoban",
        "experience-dotNetDeveloper-period": "Marzo 2019 - Abril 2022",
        "experience-dotNetDeveloper-description": "Trabajé en facturación digital para bancos, enfocándome en el análisis y diseño de componentes para diferentes clientes. Participé en la migración de CFDI de la versión 3.3 a 4.0 para facturación, así como en el proceso para el complemento Carta Porte 2.0, entre otros proyectos para la generación de facturas para varios bancos.",
        "experience-dotNetDeveloper-task1": "Análisis de requisitos.",
        "experience-dotNetDeveloper-task2": "Implementación y despliegue de nuevos componentes.",
        "experience-dotNetDeveloper-task3": "Agregar funcionalidad y modificaciones a componentes existentes.",
        "experience-dotNetDeveloper-task4": "Resolución de errores y soporte al equipo de QA para nuevos requisitos.",
        "experience-dotNetDeveloper-task5": "Análisis, diseño y desarrollo de componentes de base de datos.",
        "experience-dotNetDeveloper-task6": "Mejora del rendimiento del procesamiento de facturas.",
        "experience-dotNetDeveloper-task7": "Uso de marcos de trabajo más modernos, principios SOLID y patrones de diseño para nuevos componentes y mejora de los existentes.",
        "experience-juniorDeveloper-title": "Desarrollador Junior",
        "experience-juniorDeveloper-company": "TOWA Software",
        "experience-juniorDeveloper-period": "Enero 2018 - Marzo 2019",
        "experience-juniorDeveloper-description": "Asistí a un curso intensivo sobre JAVA y C#, donde nos enseñaron las mejores prácticas de programación en estos lenguajes. Aprendimos a analizar requisitos técnicos para simplificar su implementación en el código, delegando responsabilidades a funciones y clases, haciéndolas más pequeñas y fáciles de mantener. También cubrimos bases de datos en SQL Server y, finalmente, servicios web.",
        "experience-juniorDeveloper-task1": "Curso sobre mejores prácticas de software en JAVA, .NET y SQL Server.",
        "experience-juniorDeveloper-task2": "Servicios web.",
        "experience-juniorDeveloper-task3": "Varios proyectos para mejorar las habilidades de programación.",
        "contact":"Contáctame",
        "contact-email":"Correo",
        "contact-phone":"Teléfono",
        "post-title": "Introducción a las APIs REST",
        "post-intro": "En esta publicación, exploraremos las APIs REST, sus principios fundamentales y cómo implementarlas en C#. Veremos ejemplos de solicitudes GET, POST, PUT y DELETE, junto con un ejemplo de paginación usando LINQ.",
        "post-restTitle": "Qué son las APIs REST",
        "post-restDescription": "Las APIs REST (Representational State Transfer) son un conjunto de principios arquitectónicos para diseñar servicios web. Utilizan métodos HTTP estándar como GET, POST, PUT y DELETE para interactuar con recursos. Estos recursos se representan en formatos como JSON o XML y se accede a ellos mediante URL.",
        "post-getTitle": "Ejemplo de solicitud GET",
        "post-getDescription": "Una solicitud GET se utiliza para recuperar datos de un servidor. Aquí tienes un ejemplo de cómo hacer una solicitud GET con paginación usando C#.",
        "post-postTitle": "Ejemplo de solicitud POST",
        "post-postDescription": "Una solicitud POST se utiliza para enviar datos al servidor. Aquí tienes un ejemplo de cómo enviar datos JSON usando C#.",
        "post-putTitle": "Ejemplo de solicitud PUT",
        "post-putDescription": "Una solicitud PUT se utiliza para actualizar datos en el servidor. Aquí tienes un ejemplo de cómo actualizar un recurso usando C#.",
        "post-deleteTitle": "Ejemplo de solicitud DELETE",
        "post-deleteDescription": "Una solicitud DELETE se utiliza para eliminar un recurso del servidor. Aquí tienes un ejemplo de cómo eliminar un recurso usando C#.", 
        "post-structure-title": "Estructuras de Datos en C#",
        "post-structure-intro": "Las estructuras de datos son esenciales para la organización y manipulación eficiente de datos en la programación. En este post, exploraremos varias estructuras de datos en C# con ejemplos de código para cada una.",
        "post-arrays-title": "Arrays",
        "post-arrays-description": "Un array es una colección de elementos del mismo tipo almacenados en ubicaciones de memoria contiguas. A continuación, se muestra cómo declarar e inicializar un array en C#.",
        "post-lists-title": "Listas",
        "post-lists-description": "Las listas son colecciones dinámicas que pueden crecer y reducirse según sea necesario. La clase List en C# proporciona una lista genérica.",
        "post-trees-title": "Árboles",
        "post-trees-description": "Los árboles son estructuras de datos jerárquicas donde cada nodo tiene un valor y una lista de nodos hijos. Aquí hay un ejemplo básico de un árbol binario.",
        "post-stacks-title": "Pilas",
        "post-stacks-description": "Una pila sigue el principio LIFO (Last In, First Out). Los elementos se añaden y se eliminan desde el mismo extremo.",
        "post-queues-title": "Colas",
        "post-queues-description": "Una cola sigue el principio FIFO (First In, First Out). Los elementos se añaden al final y se eliminan del principio.",
        "post-parallelism-title": "Estructuras para Paralelismo",
        "post-parallelism-description": "Para manejar el paralelismo, C# ofrece estructuras como ConcurrentQueue y ConcurrentDictionary para operaciones seguras en entornos multihilo.",
    }
};
