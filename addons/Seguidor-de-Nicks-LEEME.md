# Seguidor de Nicks v1.1

Compatible con HexDreams IRC 0.31.0 o posterior. Esta entrega modifica únicamente el addon.

El aviso nombra los nicks anteriores del mismo host y red, por ejemplo:

⚠ SEGUIDOR DE NICKS: SOMMERS comparte host con estos nicks anteriores: Nick1, Nick2.

No se muestra aviso cuando no hay nombres anteriores válidos. Se filtran entradas vacías, espacios, comas y controles de historiales antiguos y se evitan duplicados, sin descartar los nombres válidos. Los avisos siguen siendo locales; no se envían mensajes al canal. La coincidencia de host no demuestra que sea la misma persona.

## Actualizar conservando el historial

1. Abrí Scripts → Editor de scripts y seleccioná el Seguidor que ya tenés instalado.
2. Abrí el archivo descargado Seguidor-de-Nicks.hex con un editor de texto, copiá su contenido y reemplazá el código del script seleccionado en HexDreams.
3. Guardá en la aplicación y volvé a activar ese mismo script.

Conservá el script existente: su identificador mantiene el historial guardado. Importar otra copia crea un script independiente y no traslada automáticamente el estado anterior. No ejecutes ambas copias.

La limpieza se aplica cuando se consulta cada historial de host. Los avisos antiguos que ya estén en el chat no se reescriben.

## Validación

Pruebas de listas antiguas vacías o contaminadas, duplicados, nombres válidos, separación por host y red, restauración de estado y ausencia de envíos IRC. Electron con servidor IRC local verifica el texto visible del aviso.
