// Un deslizador con su valor visible al lado (<output>) y anunciado con aria-valuetext, para
// que el lector de pantalla diga "1,000,000 filas" en lugar de solo el número.

/** Muestra el valor de `input` en `output` con el formato dado, ahora y cada vez que cambia. */
export function bindRange(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  format: (value: number) => string,
): void {
  const update = () => {
    const text = format(input.valueAsNumber);
    output.value = text;
    input.setAttribute('aria-valuetext', text);
  };
  input.addEventListener('input', update);
  update();
}
