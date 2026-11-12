# HexDreams IRC 0.26.0 para Windows

- Tamaño del texto, fuente, mensajes compactos, hora y colores de nicks pasan de Colores del entorno a Apariencia → Chat, conservando sus valores y aplicación inmediata.
- Formato de NOTICE reemplaza Espacios por Estilo: Normal, Negrita, Cursiva o Negrita y cursiva, con vista previa y guardado. /me mantiene su configuración independiente.
- Se quita Temas de la navegación lateral. El bloque Tema de Colores del entorno incorpora Importar y Exportar, conservando Aplicar, Agregar, Guardar y Eliminar, con vista previa de selección.
- Activar diccionario queda únicamente en Diccionario; no se vuelve a mostrar en Nick completion al navegar o buscar opciones.
- Se elimina Chat de la barra de menús principal. Apariencia → Chat y el corrector multicolor siguen disponibles dentro de Configuración.

Se mantienen las preferencias, redes, historial, scripts y las correcciones anteriores. El orden de espaciado, NOTICE y /me se conserva; los ajustes generales se agrupan a continuación.

## Validación

Pruebas automatizadas de persistencia, formato real de NOTICE, importación/exportación de temas y ausencia de controles duplicados, más la suite de lógica, interfaz y Electron con IRC TCP/TLS. Windows repite las comprobaciones y verifica el ejecutable empaquetado antes de publicar.

Extrae todo el ZIP y abre HexDreamsIRC.exe. El ZIP distribuido no está firmado.
