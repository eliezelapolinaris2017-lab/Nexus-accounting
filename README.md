# Nexus Accounting PR v0.8

Portal de contabilidad profesional enfocado en el ciclo contable.

## Nuevo en v0.8

- Accounting Engine central.
- Libro Diario como fuente oficial de verdad contable.
- Transacciones automáticas de doble partida:
  - Factura.
  - Cobro.
  - Gasto.
  - Cargo bancario.
  - Interés bancario.
- Incidencias contables.
- Paquete contable JSON.
- Panel Firebase DEV.
- Preparado para Firestore, Auth, Storage y Hosting.
- Reglas `firestore.rules` y `storage.rules` incluidas.
- Configuración Firebase local para usar el proyecto DEV `oasis-visit-card`.

## Uso

Abre `index.html` en el navegador.

Login demo:

- admin@nexuspr.com
- admin123

## Firebase

1. Abre el módulo `Firebase DEV`.
2. Pega la configuración del proyecto Firebase actual.
3. Guarda la configuración local.
4. Ejecuta `Sincronizar empresa`.
5. Antes de producción, sube `firestore.rules` y `storage.rules` desde Firebase Console.

## Principio contable

Toda operación importante debe terminar en el Libro Diario mediante doble partida. Los estados financieros se alimentan desde el Libro Mayor, que deriva del Libro Diario.
