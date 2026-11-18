// Punto de entrada del simulador de API REST (assets/js/labs/rest-api.js).
import { startRestApiLab } from './app';

const root = document.querySelector<HTMLElement>('.api-app');
if (root) void startRestApiLab(root);
