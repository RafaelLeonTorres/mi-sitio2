// Vitest (Vite) importa un archivo como texto con el sufijo ?raw. Las pruebas de la consola lo
// usan para leer los textos reales de _data/labs/ en lugar de una copia.
declare module '*?raw' {
  const text: string;
  export default text;
}
