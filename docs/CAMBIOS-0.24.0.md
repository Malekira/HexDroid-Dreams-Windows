# HexDreams IRC 0.24.0 — anotaciones del PDF

Implementación sobre `feat/irc-advanced-systems`, partiendo de 0.23.0. No se fusiona con main. El documento adjunto es una especificación; sus capturas no se tratan como evidencia de funciones existentes.

| Anotación | Implementación |
| --- | --- |
| 01 | Encabezado Usuarios · cantidad y lupa; búsqueda oculta por defecto, conservada por sala; paneles activos e inactivos con el mismo ancho y estructura. |
| 02 | Se conserva el aviso flotante «Hay mensajes nuevos» y su acción de volver al final. |
| 03 | Se ocultan los accesos superiores al primer mensaje sin leer y al último. Estilo y vista dividida pasan al encabezado de cada ventana, junto a usuarios. |
| 04 | Un PV no abre un listado de usuarios ni un perfil automáticamente. Pulsar un nick abre el mismo perfil que en sala. |
| 05 | Status se identifica por su nombre en el encabezado y árbol; mantiene comandos y mensajes del servidor. |
| 06 | Configuración de Status accesible desde Chat y la configuración. Filtros por categorías y opciones, persistidos; solo afectan a la visualización. |
| 07 | Texto del chat y texto del editor independientes. Selector Fuertes/Pastel junto a nicks coloreados y negrita independiente, con vista previa. |
| 08 | Ventanas → Maximizar todo incluye las ventanas minimizadas, Status y PV. |
| 09 | Salas queda inmediatamente después de Comandos, con entradas y favoritos existentes. |
| 10 | Temas desde Apariencia: importar/exportar JSON validado, previsualizar, aplicar, restaurar apariencia anterior y eliminar temas guardados. |
| 11 | Prefijos y colores locales de NOTICE y ACTION; separación del prefijo NOTICE y estilo/color de nick de ACTION. Vistas previas y restauración por formato. No se cambia el protocolo ACTION. |
| 12 | Espaciado, colores, fuentes y herramientas generales de estilo en Apariencia; formatos NOTICE y /me accesibles desde Chat. |
| 13 | Corrector multicolor con editor de códigos y vista previa, 16 botones IRC 00–15, Ctrl+K y copia de códigos. No aplica RGB, ANSI ni colores extendidos. Al colorear una selección restaura el formato siguiente. El nombre real también serializa colores clásicos. El visor de mensajes conserva compatibilidad con colores recibidos extendidos. |
| 14 | Formularios de scripts redimensionables, movibles, con título y ventanas simultáneas independientes. |
| 15 | Controles seguros, lectura genérica de formularios, eventos de selección/clic/doble clic, delat, tip, view.close, datos de mensajes ampliados y pruebas de aislamiento/persistencia/intercepción. Sin Anti-PV fijo en el cliente. |
| Adicional | Tab y Shift+Tab recorren coincidencias de salas en las que se participa y nicks de Notify de la red actual, en cualquier posición del texto. Las salas no reciben decoraciones de nick completion. |

## Formularios .hex

La sintaxis anterior `view { ... }` conserva la ventana predeterminada. Los identificadores de ventana se aíslan por script y red. Ejemplo:

```text
alias opciones {
  view config "Opciones" width 620 height 420 {
    column gap 8 {
      input saludo $state(saludo) label "Saludo"
      textarea texto $state(texto) label "Texto largo"
      checkbox enabled true label "Activar"
      radio opcionA true group modo label "Modo A"
      radio opcionB false group modo label "Modo B"
      select modo uno onchange modo_cambiado {
        option uno "Primero"
        option dos "Segundo"
      }
      list pendientes Alice onclick seleccionado ondblclick aceptar {
        option Alice "Alice"
        option Bob "Bob"
      }
      button "Guardar" guardar
    }
  }
}
alias guardar {
  state.set saludo $form(saludo)
  state.set texto $form(texto)
  view solicitudes "Solicitudes" width 340 height 300 {
    text $form(saludo)
  }
}
alias cerrar { view.close config }
```

`$form(id)` devuelve el valor actual; checkbox/radio devuelven booleanos. `$window`, `$control`, `$interaction` y `$selected` identifican la ventana, control, interacción y último elemento seleccionado. Los alias siguen recibiendo sus argumentos originales; los valores del formulario se transfieren aparte, sin dividir textos por espacios.

Cada control editable necesita un ID único en su ventana. Los cambios conservan el texto, foco, selección y desplazamiento al actualizar. `reset` permite que el script sustituya explícitamente un valor editado. Las listas entregan su valor también mediante `$form(id)`; cada botón puede consultar todas las listas del formulario. `width`, `height`, `pad`, `gap`, `offsetx`, `offsety` y los contenedores fila/columna permiten organizar los controles dentro de límites.

`delat %mapa clave` elimina una entrada de un mapa; en listas elimina el índice. `tip "Título" "Mensaje"` usa una notificación nativa y requiere el permiso UI existente. `state.set`, `state.delete` y `$state()` conservan su aislamiento por script y usan el almacén seguro del sistema. No se guardan secretos sin cifrar si ese almacén no está disponible.

Los eventos TEXT/ACTION reciben `own`, `private`, `channel`, `notice`, `historical`, `new`, `network`, `nick`, `buffer` y `conversation`. NOTICE se despacha además a sus manejadores específicos, conservando TEXT para scripts anteriores. Un `halt` de un mensaje recibido nuevo y privado se evalúa antes de mostrarlo, notificarlo o escribir sus historiales; no oculta mensajes propios, históricos ni de sala.

La UI no interpreta HTML/JavaScript. El intérprete mantiene presupuestos de ejecución, permisos y límites; cada ventana admite controles autorizados, formularios de hasta 64 KB y 200 campos, y un máximo global de 50 ventanas de scripts.

## Temas

Los archivos JSON usan `format: "hexdreams-theme"`, `version: 1`, `name` y `settings`. Solo se importan las claves de apariencia admitidas por la aplicación; no redes, scripts ni acciones. Tamaño máximo 256 KB. Importar no aplica el tema hasta pulsar Aplicar. Restaurar apariencia anterior recupera la instantánea de entrada a la gestión sin eliminar temas guardados.
