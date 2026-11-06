/* eslint-disable */
// @ts-nocheck
import { openDoc } from '../../lib/docs';

// Enlace a una foto de documento: pide un enlace temporal y la abre en otra pestaña.
export function DocLink({ url, style, children }) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        openDoc(url);
      }}
      style={style}
    >
      {children}
    </a>
  );
}
