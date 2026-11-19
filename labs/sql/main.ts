// Punto de entrada del laboratorio de rendimiento SQL (assets/js/labs/sql.js).
import { startSqlLab } from './app';

const root = document.querySelector<HTMLElement>('.sql-app');
if (root) startSqlLab(root);
