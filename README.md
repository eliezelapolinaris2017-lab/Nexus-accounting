# Nexus Accounting PR v1.0

Portal web de contabilidad profesional enfocado en el ciclo contable.

## Cambios principales v1.0

- Se retira **Firebase DEV** del menú principal.
- Se añade **Estado del Sistema** con estado técnico y contable.
- Se elimina la dependencia visual de datos demo.
- Se añade manejo de **períodos contables**: abierto, cerrado y bloqueado.
- Las operaciones no pueden registrarse en períodos cerrados o bloqueados.
- Numeración automática reforzada para JE, INV, PAY y REC.
- Asientos manuales, facturas, cobros y gastos quedan vinculados al período activo.
- Dashboard actualizado como centro de control contable.
- Se mantiene la sincronización Firebase ya validada.

## Flujo recomendado

1. Abrir **Apertura Contable**.
2. Crear o actualizar empresa operativa.
3. Generar asiento de apertura.
4. Revisar Libro Diario y Libro Mayor.
5. Revisar **Estados Financieros** / Balance de Comprobación.
6. Validar en **Estado del Sistema**.
7. Sincronizar a Firebase.

## Nota técnica

La configuración Firebase queda encapsulada. Si necesitas cambiar credenciales, la función técnica sigue existiendo en código, pero ya no aparece en el menú principal del usuario.
