# HexDreams IRC 0.26.0

Cinco ajustes de organización solicitados después de 0.25.0, sobre la rama de desarrollo sin fusionar con main:

1. Se mueven los controles originales de tamaño, fuente, compactación, hora y paleta de nicks a Apariencia → Chat. Conservan IDs, manejadores y preferencias. El bloque queda después de espaciado, NOTICE y /me para preservar su orden anterior.
2. NOTICE utiliza el campo existente noticeStyle y la misma lista de estilos que /me, con vista previa y restauración independiente. Se elimina el control de espacios, sin borrar el valor histórico de separación guardado ni alterar otras preferencias.
3. Temas deja de aparecer en la navegación lateral. El gestor incrustado en Colores del entorno añade Importar y Exportar, usando la validación y los selectores de archivos ya existentes. Se conserva el resto de acciones, temas previos y vista previa antes de aplicar.
4. Nick completion no crea una casilla visible de diccionario. Se retiran sus controles ajenos del DOM, en vez de ocultarlos mediante un atributo que la búsqueda de ajustes podía revertir. También se evita repetir el encabezado.
5. Se retira el menú principal Chat. Su acceso al formato ya está en Apariencia → Chat; el corrector multicolor se conserva en esa misma pantalla.

Validación específica: valores tras reinicio; formato NOTICE aplicado a mensajes y previsualizaciones; no modificación de /me ni de la separación histórica; importación/exportación sin perder temas existentes; navegación y búsqueda sin reaparición del diccionario en Nick completion. Se ejecutan además la suite de interfaz y la prueba nativa de Electron. La publicación se condiciona a las comprobaciones del ejecutable Windows.
