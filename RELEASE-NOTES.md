# HexDreams IRC 0.15.0 para Windows

- Configuración reorganizada según las correcciones de la versión 15: Redes e identidad, Apariencia y Herramientas. Se conservan las funciones de conexión y autenticación existentes.
- En Editar red: color del nick propio y color/estilo de escritura por red. El formato personalizado es opcional; las redes anteriores conservan su comportamiento.
- Colores del entorno reúne temas, fuente, tamaño, mensajes compactos, hora y paleta de nicks fuertes/pastel. Los temas tienen Aplicar, Agregar, Guardar y Eliminar; el editor incluye vista previa y controles compactos. Los temas incluidos no se eliminan.
- Chat reúne altura de línea y separación. Paneles reúne anchos, visibilidad, entradas/salidas, ident/host, seguimiento y vista de eventos. Notificaciones y Multimedia tienen sus propias secciones, con controles de estilo uniforme. Se puede elegir un color de menciones por red.
- Menús y submenús con tipografía, tamaño, espaciado y resaltado comunes. Orden por jerarquía y función; los submenús se abren hacia la derecha, por encima de las ventanas, y los listados largos tienen desplazamiento.
- Ver/ocultar usuarios es independiente por conversación durante la sesión. Status no tiene usuarios y puede cerrarse si está desconectado. Los privados muestran el perfil del interlocutor.
- Zona de escritura más compacta, conservando la fuente y el tamaño del texto.
- Historial con nombres de red legibles en el árbol, los títulos y los resultados de búsqueda. Si una red ya no está configurada se recupera su nombre desde el encabezado del TXT.

## Uso

Extrae todo el ZIP y abre HexDreamsIRC.exe. Se conservan redes, preferencias y archivos de historial. Conserva tu certificado existente para la firma personal con Sign/Verify; el ZIP distribuido no está firmado.

## Validación

126 pruebas de lógica e integración y 42 flujos en Chromium, además de Electron real con IRC local TCP/TLS, scripts, formato, historial, reinicio y geometría. La publicación Windows vuelve a ejecutar las pruebas y verifica también el ejecutable empaquetado antes de crear la descarga.
