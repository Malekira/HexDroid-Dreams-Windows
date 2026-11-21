# Seguimiento integrado y orden del botón Salas

## Uso

Comandos → Seguimiento de usuarios. Elegir red, Nick exacto / Host contiene / Nombre real contiene, ingresar el criterio y Agregar seguimiento. Buscar ahora pone consultas en cola; si la red está desconectada o iniciando, espera a que termine su secuencia de inicio. Elegir carpeta de informes guarda el destino de futuros TXT; no mueve los informes ya exportados. Generar informe crea un archivo nuevo, sin sobrescribir otros. Abrir carpeta muestra el destino elegido. Quitar detiene ese criterio y cancela sus consultas pendientes, sin borrar las evidencias históricas.

## Evidencias y límites de identificación

Se observan JOIN, NICK, CHGHOST, SETNAME, ACCOUNT, QUIT, PART/KICK, WHO, WHOX y WHOIS. Cada intervalo tiene un UUID independiente del host. Dos nicks simultáneos con el mismo vhost permanecen separados; no se agrupan por nombre real o por reutilización de host. NICK enlaza nombres dentro de la misma conexión, aunque el prefijo ya anuncie un host distinto al caer servicios. CHGHOST conserva los dos hosts en ese intervalo. Una diferencia de host recibida solo por WHO/WHOIS, sin ese evento directo, cierra el intervalo y no confirma continuidad.

QUIT o 401 cierran la observación correspondiente. PART/KICK y la salida local de la última sala compartida cierran visibilidad sin afirmar que la persona salió del servidor. Una desconexión de HexDreams cierra los intervalos como pérdida de visibilidad. Tras reiniciar, se crean intervalos nuevos. El mismo nick y host vistos sin interrupciones tampoco prueban identidad personal: los informes describen observaciones de servidor, no personas identificadas.

Se guardan nicks y máscaras observadas, nombres reales sin formato, cuentas entregadas por el servidor, salas visibles, fuente y fecha de recepción. No se inventan IP real, registro de nick ni hosts ocultos. No se unen automáticamente intervalos por cuenta, host o nombre real. El estado de la ventana dice Última observación, no garantiza presencia actual fuera de la visibilidad disponible.

## Búsqueda

Nick exacto usa WHOIS nick nick; también se comprueban los nicks actuales de intervalos ya vinculados a ese criterio. Host/nombre real usan WHO * y comparación local del texto; si hay WHOX se pide el formato conocido %tcuhnfar,153. Se consulta como máximo una petición cada dos segundos por conexión y se repiten rondas aproximadamente cada minuto, completando la cola anterior antes de empezar otra. Las consultas esperan client.ready y el fin de startupPending; no anteceden a los comandos personalizados o a las entradas iniciales en salas. Se evita interferir con consultas manuales pendientes y las respuestas internas no abren conversaciones ni llenan Status.

Los servidores pueden limitar WHO, no mostrar usuarios ocultos o no facilitar todos los datos. Sin resultados se mantiene el criterio esperando observaciones futuras; no significa necesariamente que el usuario esté desconectado. Este mecanismo no evade restricciones del servidor ni garantiza observar todo cambio de nick sin una sala compartida o soporte de la red.

## Almacenamiento e informes

Archivos propios identity-tracker/config.json y observations.jsonl bajo el perfil de HexDreams. No se utiliza ni repara SQLite. Tampoco se modifica el addon Seguidor de Nicks ni se importan sus estados previos. Las evidencias se agrupan para escritura cada 200 ms y se vacían al cerrar normalmente. Un cierre forzado puede perder el último lote aún pendiente. Si la escritura falla, se pausa la captura, se avisa y no se acumula indefinidamente más información en memoria; Buscar ahora o generar informe reintenta el guardado. El informe advierte de huecos conocidos durante esa sesión.

Los informes consultan el registro persistido, incluyendo intervalos que coincidan históricamente con un criterio nuevo; no fusionan intervalos separados. Cada exportación tiene nombre UUID y fecha dentro del contenido. Se muestran resumen de nicks/hosts/nombres reales por intervalo y detalle de evidencias, con las precauciones de interpretación. El análisis usa lectura secuencial para no cargar todo el archivo en memoria. Se admiten hasta 100 criterios y 5000 intervalos visibles simultáneos; alcanzar el segundo límite se avisa explícitamente. Cada informe limita el detalle a 100000 observaciones o 50 MB, indicando el recorte; las observaciones restantes siguen en el registro. No se borra automáticamente el registro histórico.

## Botón Salas

Solo se reordena su desplegable rápido: Entrar a otra sala…, Listado de salas, Configurar favoritas…, separador y favoritas de la red seleccionada. Las favoritas conservan el orden alfabético y la red propietaria. No cambia el orden de otros menús.

## Verificación

Pruebas para vhost compartido, NICK/CHGHOST, caída a Guest con prefijo distinto, QUIT/reutilización de host, host cambiado sin evento directo, nombre real, persistencia y carpeta, consulta tras inicio y sin interferir con consultas manuales, cancelación de búsquedas, fallo de escritura y pérdida de visibilidad de una sala. Interfaz: alta, carpeta, generación, retirada y orden del botón Salas. Electron: JOIN/NICK/CHGHOST reales de dos usuarios con el mismo vhost, informe con dos intervalos en la carpeta elegida. El CI repite las validaciones y prueba el ejecutable Windows antes de publicar.
