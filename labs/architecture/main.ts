// Punto de entrada de la demo de arquitecturas (assets/js/labs/architecture.js).
import { startArchitectureLab } from './app';

const root = document.querySelector<HTMLElement>('.arch-app');
if (root) startArchitectureLab(root);
